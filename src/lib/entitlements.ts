import { db } from '@/db';
import { user, promoCodes, redemptions } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';

/*
 * THE ENTITLEMENT SEAM.
 *
 * grantAccess() is the single function that activates a host's year of
 * hosting. The Square webhook calls it with { plan: 'paid' }. Promo
 * redemption grants access through the same seam (see redeemPromoCode
 * below, which applies the identical status/expiry update inside its
 * transaction). Any future payment provider hits this same function and
 * nothing else in the app needs to change.
 */
export async function grantAccess(
  userId: string,
  opts: { plan: 'paid' | 'comped'; durationDays?: number | null }
) {
  // null = lifetime access; undefined falls back to 365 days
  const expiresAt = opts.durationDays === null
    ? null
    : new Date(Date.now() + (opts.durationDays ?? 365) * 86_400_000);
  await db
    .update(user)
    .set({ plan: opts.plan, expiresAt, status: 'active' })
    .where(eq(user.id, userId));
  return { expiresAt };
}

/*
 * Redeem a promo code for a couple. Validates the code is active, not
 * expired, and under its use cap; records the redemption; bumps the
 * counter; then grants access through the same seam above.
 *
 * Returns a discriminated result so the caller can show a precise error.
 */
export async function redeemPromoCode(
  userId: string,
  rawCode: string
): Promise<
  | { ok: true; expiresAt: Date | null }
  | { ok: false; reason: 'not_found' | 'inactive' | 'expired' | 'used_up' | 'already_redeemed' }
> {
  const code = rawCode.trim().toUpperCase();

  return await db.transaction(async (tx) => {
    const [promo] = await tx
      .select()
      .from(promoCodes)
      .where(eq(promoCodes.code, code))
      .for('update'); // lock the row so the use-count check is race-safe

    if (!promo) return { ok: false, reason: 'not_found' };
    if (!promo.active) return { ok: false, reason: 'inactive' };
    if (promo.expiresAt && promo.expiresAt < new Date())
      return { ok: false, reason: 'expired' };
    if (promo.maxUses !== null && promo.usedCount >= promo.maxUses)
      return { ok: false, reason: 'used_up' };

    // already redeemed by this user?
    const existing = await tx
      .select()
      .from(redemptions)
      .where(eq(redemptions.userId, userId));
    if (existing.some((r) => r.code === code))
      return { ok: false, reason: 'already_redeemed' };

    await tx.insert(redemptions).values({ code, userId });
    await tx
      .update(promoCodes)
      .set({ usedCount: sql`${promoCodes.usedCount} + 1` })
      .where(eq(promoCodes.code, code));

    const expiresAt = promo.durationDays === null
      ? null
      : new Date(Date.now() + promo.durationDays * 86_400_000);
    await tx
      .update(user)
      .set({ plan: promo.grantsPlan as 'comped', expiresAt, status: 'active' })
      .where(eq(user.id, userId));

    return { ok: true, expiresAt };
  });
}

/*
 * Is this couple currently entitled to create/serve galleries?
 * Checks both the status flag AND the expiry date, so access cuts off
 * exactly on time regardless of when the purge job runs.
 */
export function isEntitled(u: {
  status: string;
  expiresAt: Date | null;
}): boolean {
  if (u.status !== 'active') return false;
  if (u.expiresAt === null) return true; // lifetime / forever plan
  return u.expiresAt > new Date();
}
