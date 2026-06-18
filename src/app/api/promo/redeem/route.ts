import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { redeemPromoCode } from '@/lib/entitlements';
import { checkRateLimit, RULES } from '@/lib/rate-limit';

/*
 * POST /api/promo/redeem  { code }
 * Requires a logged-in host. Activates their year of hosting via the
 * shared grantAccess seam. Stripe will later hit that same seam.
 */
const MESSAGES: Record<string, string> = {
  not_found: "We couldn't find that code.",
  inactive: 'That code is no longer active.',
  expired: 'That code has expired.',
  used_up: 'That code has been fully claimed.',
  already_redeemed: "You've already used that code.",
};

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session)
    return NextResponse.json({ error: 'Please sign in first.' }, { status: 401 });

  // key on the authenticated user — stops code-guessing per account
  const rl = checkRateLimit(`promo:${session.user.id}`, RULES.promo);
  if (!rl.ok)
    return NextResponse.json(
      { error: 'Too many attempts. Please wait a few minutes and try again.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
    );

  const { code } = await req.json();
  if (!code || typeof code !== 'string')
    return NextResponse.json({ error: 'Enter a code.' }, { status: 400 });

  const result = await redeemPromoCode(session.user.id, code);
  if (!result.ok)
    return NextResponse.json({ error: MESSAGES[result.reason] }, { status: 400 });

  return NextResponse.json({ ok: true, expiresAt: result.expiresAt });
}
