import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { galleries } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verifyPassword } from '@/lib/gallery-auth';
import {
  signGalleryAccess,
  galleryCookieName,
} from '@/lib/gallery-auth';
import { checkRateLimit, clientIp, RULES } from '@/lib/rate-limit';

/*
 * POST /api/gallery/unlock  { slug, password }
 * On correct password, sets a signed cookie scoped to that gallery id.
 * That cookie is what the image route and upload route check.
 */
export async function POST(req: NextRequest) {
  const rl = checkRateLimit(`unlock:${clientIp(req)}`, RULES.unlock);
  if (!rl.ok)
    return NextResponse.json(
      { error: 'Too many attempts. Please wait a few minutes and try again.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
    );

  const { slug, password } = await req.json();

  const [gallery] = await db
    .select({ id: galleries.id, passwordHash: galleries.passwordHash })
    .from(galleries)
    .where(eq(galleries.slug, String(slug || '')));

  if (!gallery)
    return NextResponse.json({ error: 'Gallery not found.' }, { status: 404 });

  // open gallery — nothing to unlock
  if (!gallery.passwordHash)
    return NextResponse.json({ ok: true });

  if (!verifyPassword(String(password || ''), gallery.passwordHash))
    return NextResponse.json({ error: 'That password is incorrect.' }, { status: 401 });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(galleryCookieName(gallery.id), signGalleryAccess(gallery.id), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return res;
}
