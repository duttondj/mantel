import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { likes, posts, galleries, user as userTable } from '@/db/schema';
import { eq, and, count } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { verifyGalleryAccess, galleryCookieName } from '@/lib/gallery-auth';
import { isEntitled } from '@/lib/entitlements';
import { checkRateLimit, clientIp, RULES } from '@/lib/rate-limit';

/*
 * POST /api/posts/:id/like
 *
 * Toggles a like on a post. Guest identity is a random token in an
 * httpOnly cookie (`mantel_guest_token`), generated here on first use.
 * The same token is used across all galleries in the same browser, so a
 * guest's likes persist as long as the cookie does (1 year).
 *
 * Respects the gallery's lock state: a guest who hasn't unlocked a
 * password-protected gallery can't like posts in it.
 */

const GUEST_TOKEN_COOKIE = 'mantel_guest_token';
const TOKEN_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: postId } = await params;

  const rl = checkRateLimit(`like:${clientIp(req)}`, RULES.like);
  if (!rl.ok)
    return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });

  // Resolve post -> gallery -> owner to enforce access rules
  const [row] = await db
    .select({
      galleryId: galleries.id,
      passwordHash: galleries.passwordHash,
      ownerStatus: userTable.status,
      ownerExpiresAt: userTable.expiresAt,
    })
    .from(posts)
    .innerJoin(galleries, eq(posts.galleryId, galleries.id))
    .innerJoin(userTable, eq(galleries.ownerId, userTable.id))
    .where(eq(posts.id, postId));

  if (!row) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  if (!isEntitled({ status: row.ownerStatus, expiresAt: row.ownerExpiresAt }))
    return NextResponse.json({ error: 'Gallery has expired.' }, { status: 410 });

  if (row.passwordHash) {
    const cookie = req.cookies.get(galleryCookieName(row.galleryId))?.value;
    if (!verifyGalleryAccess(cookie, row.galleryId))
      return NextResponse.json({ error: 'Gallery is locked.' }, { status: 401 });
  }

  // Resolve or mint a guest token
  let guestToken = req.cookies.get(GUEST_TOKEN_COOKIE)?.value;
  const isNewToken = !guestToken;
  if (!guestToken) guestToken = nanoid();

  // Toggle: delete if exists, insert if not
  const [existing] = await db
    .select({ postId: likes.postId })
    .from(likes)
    .where(and(eq(likes.postId, postId), eq(likes.guestToken, guestToken)))
    .limit(1);

  let liked: boolean;
  if (existing) {
    await db
      .delete(likes)
      .where(and(eq(likes.postId, postId), eq(likes.guestToken, guestToken)));
    liked = false;
  } else {
    await db.insert(likes).values({ postId, guestToken });
    liked = true;
  }

  const [{ n }] = await db
    .select({ n: count() })
    .from(likes)
    .where(eq(likes.postId, postId));

  const res = NextResponse.json({ liked, count: n });

  if (isNewToken) {
    res.cookies.set(GUEST_TOKEN_COOKIE, guestToken, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: TOKEN_MAX_AGE,
      path: '/',
    });
  }

  return res;
}
