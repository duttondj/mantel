import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { images, posts, galleries } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getObjectStream } from '@/lib/storage';
import {
  verifyGalleryAccess,
  galleryCookieName,
} from '@/lib/gallery-auth';
import { isEntitled } from '@/lib/entitlements';
import { user as userTable } from '@/db/schema';

/*
 * GET /i/<publicId>  — serve a single image by its obfuscation token.
 *
 * This route enforces ALL THREE url-privacy requirements:
 *
 *  1. The publicId is random and unrelated to the gallery slug, so a
 *     direct image link reveals nothing about the gallery it belongs to.
 *  2. If the gallery is password-protected and the visitor has NOT
 *     unlocked it (no valid signed cookie), we redirect to the gallery's
 *     password prompt instead of serving the image. A leaked direct link
 *     to a locked gallery is therefore useless.
 *  3. Access is checked server-side on every request, so you can't get
 *     the bytes by guessing or by holding an old link.
 *
 * It also enforces entitlement: an expired couple's images stop serving.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ publicId: string }> }
) {
  const { publicId } = await params;

  // resolve image -> post -> gallery -> owner in one join
  const [row] = await db
    .select({
      storageKey: images.storageKey,
      gallerySlug: galleries.slug,
      galleryId: galleries.id,
      passwordHash: galleries.passwordHash,
      ownerStatus: userTable.status,
      ownerExpiresAt: userTable.expiresAt,
    })
    .from(images)
    .innerJoin(posts, eq(images.postId, posts.id))
    .innerJoin(galleries, eq(posts.galleryId, galleries.id))
    .innerJoin(userTable, eq(galleries.ownerId, userTable.id))
    .where(eq(images.publicId, publicId));

  if (!row) {
    return new NextResponse('Not found', { status: 404 });
  }

  // entitlement gate: expired/inactive couples' media is no longer served
  if (!isEntitled({ status: row.ownerStatus, expiresAt: row.ownerExpiresAt })) {
    return new NextResponse('This gallery has expired', { status: 410 });
  }

  // password gate: locked gallery + no valid cookie -> redirect to prompt
  if (row.passwordHash) {
    const cookie = req.cookies.get(galleryCookieName(row.galleryId))?.value;
    if (!verifyGalleryAccess(cookie, row.galleryId)) {
      const url = new URL(`/g/${row.gallerySlug}`, req.url);
      url.searchParams.set('locked', '1');
      return NextResponse.redirect(url, 302);
    }
  }

  // authorized — stream the object back, with Range support for video seeking
  const rangeHeader = req.headers.get('range') ?? undefined;
  const obj = await getObjectStream(row.storageKey, rangeHeader);
  const body = obj.Body as unknown as ReadableStream;

  const responseHeaders: Record<string, string> = {
    'Content-Type': obj.ContentType || 'image/jpeg',
    // private: don't let shared caches hold images for locked galleries
    'Cache-Control': 'private, max-age=3600',
    'Accept-Ranges': 'bytes',
  };
  if (obj.ContentRange) responseHeaders['Content-Range'] = obj.ContentRange;
  if (obj.ContentLength != null) responseHeaders['Content-Length'] = String(obj.ContentLength);

  return new NextResponse(body, {
    status: rangeHeader && obj.ContentRange ? 206 : 200,
    headers: responseHeaders,
  });
}
