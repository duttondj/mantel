import { db } from '@/db';
import { user } from '@/db/schema';
import { eq, and, isNull, lte, gt } from 'drizzle-orm';
import { sendExpiryReminderEmail } from '@/lib/email';

const APP_URL = process.env.APP_URL ?? 'http://localhost:13000';

export async function runRemind() {
  const now = new Date();
  const in30d = new Date(now.getTime() + 30 * 86_400_000);
  const in7d  = new Date(now.getTime() + 7  * 86_400_000);

  // Users expiring within 30 days who haven't received the 30-day reminder
  const need30 = await db
    .select({ id: user.id, email: user.email, expiresAt: user.expiresAt })
    .from(user)
    .where(and(
      eq(user.status, 'active'),
      gt(user.expiresAt, now),
      lte(user.expiresAt, in30d),
      isNull(user.reminder30dAt),
    ));

  // Users expiring within 7 days who haven't received the 7-day reminder
  const need7 = await db
    .select({ id: user.id, email: user.email, expiresAt: user.expiresAt })
    .from(user)
    .where(and(
      eq(user.status, 'active'),
      gt(user.expiresAt, now),
      lte(user.expiresAt, in7d),
      isNull(user.reminder7dAt),
    ));

  console.log(`[remind] ${need30.length} user(s) need 30d reminder, ${need7.length} need 7d reminder.`);

  for (const u of need30) {
    const daysLeft = Math.ceil((u.expiresAt!.getTime() - now.getTime()) / 86_400_000);
    try {
      await sendExpiryReminderEmail(u.email, daysLeft, u.expiresAt!, APP_URL);
      await db.update(user).set({ reminder30dAt: now }).where(eq(user.id, u.id));
      console.log(`[remind]   30d sent to ${u.email}`);
    } catch (e) {
      console.error(`[remind]   failed for ${u.email}:`, e);
    }
  }

  for (const u of need7) {
    const daysLeft = Math.ceil((u.expiresAt!.getTime() - now.getTime()) / 86_400_000);
    try {
      await sendExpiryReminderEmail(u.email, daysLeft, u.expiresAt!, APP_URL);
      await db.update(user).set({ reminder7dAt: now }).where(eq(user.id, u.id));
      console.log(`[remind]   7d sent to ${u.email}`);
    } catch (e) {
      console.error(`[remind]   failed for ${u.email}:`, e);
    }
  }

  console.log('[remind] Done.');
}
