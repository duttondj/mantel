import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { galleries, posts, images, user as userTable } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { stripAndStore, storeVideo } from '@/lib/images';
import {
  verifyGalleryAccess,
  galleryCookieName,
} from '@/lib/gallery-auth';
import { isEntitled } from '@/lib/entitlements';
import { checkRateLimit, clientIp, RULES } from '@/lib/rate-limit';

/*
 * POST /api/upload  — a guest submits a post (1+ images + optional
 * message + optional name) to a gallery.
 *
 * Body is multipart/form-data:
 *   slug      - gallery slug
 *   message   - optional text
 *   guestName - optional name (client also stores this in a cookie)
 *   files     - one or more image files
 *
 * Every file is run through stripAndStore(), so location/EXIF is gone
 * before anything is persisted. Locked galleries require a valid access
 * cookie to post, same as to view.
 */
const MAX_FILES = 5;
const MAX_MESSAGE = 180;
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;   // 25 MB per image
const MAX_VIDEO_BYTES = 200 * 1024 * 1024;  // 200 MB per video

const ACCEPTED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];

export async function POST(req: NextRequest) {
  // rate limit before doing any expensive work
  const rl = checkRateLimit(`upload:${clientIp(req)}`, RULES.upload);
  if (!rl.ok)
    return NextResponse.json(
      { error: "You're posting very quickly. Please wait a moment and try again." },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
    );

  let form: FormData;
  try {
    form = await req.formData();
  } catch (err) {
    console.error('[upload] formData parse error:', err);
    return NextResponse.json({ error: 'Upload failed — could not parse the request. Try fewer or smaller files.' }, { status: 400 });
  }
  const slug = String(form.get('slug') || '');
  const message = String(form.get('message') || '').slice(0, MAX_MESSAGE) || null;
  const guestName = String(form.get('guestName') || '').slice(0, 80) || null;
  const files = form.getAll('files').filter((f): f is File => f instanceof File);

  if (!slug) return NextResponse.json({ error: 'Missing gallery.' }, { status: 400 });
  if (files.length === 0 && !message)
    return NextResponse.json({ error: 'Add a photo, video, or message.' }, { status: 400 });
  if (files.length > MAX_FILES)
    return NextResponse.json(
      { error: `That's more than ${MAX_FILES} files in one post.` },
      { status: 400 }
    );

  const [gallery] = await db
    .select({
      id: galleries.id,
      passwordHash: galleries.passwordHash,
      uploadsClosedAt: galleries.uploadsClosedAt,
      ownerStatus: userTable.status,
      ownerExpiresAt: userTable.expiresAt,
    })
    .from(galleries)
    .innerJoin(userTable, eq(galleries.ownerId, userTable.id))
    .where(eq(galleries.slug, slug));

  if (!gallery)
    return NextResponse.json({ error: 'Gallery not found.' }, { status: 404 });

  if (!isEntitled({ status: gallery.ownerStatus, expiresAt: gallery.ownerExpiresAt }))
    return NextResponse.json({ error: 'This gallery has expired.' }, { status: 410 });

  if (gallery.uploadsClosedAt && gallery.uploadsClosedAt <= new Date())
    return NextResponse.json({ error: 'Uploads for this gallery have closed.' }, { status: 410 });

  // locked gallery: must have unlocked it to post
  if (gallery.passwordHash) {
    const cookie = req.cookies.get(galleryCookieName(gallery.id))?.value;
    if (!verifyGalleryAccess(cookie, gallery.id))
      return NextResponse.json({ error: 'This gallery is locked.' }, { status: 401 });
  }

  // process files first so we don't create an empty post if all fail
  const stored: {
    publicId: string;
    storageKey: string;
    mimeType: string;
    fileSize: number;
    width?: number | null;
    height?: number | null;
  }[] = [];
  const skipped: string[] = [];

  for (const file of files) {
    const isVideo = ACCEPTED_VIDEO_TYPES.includes(file.type);
    const isImage = file.type.startsWith('image/');

    if (!isVideo && !isImage) {
      skipped.push(`${file.name || 'a file'} (unsupported file type)`);
      continue;
    }

    const limit = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
    if (file.size > limit) {
      const cap = isVideo ? '200MB' : '25MB';
      skipped.push(`${file.name || 'a file'} (too large, max ${cap})`);
      continue;
    }

    try {
      const buf = Buffer.from(await file.arrayBuffer());
      if (isVideo) {
        const result = await storeVideo(buf, file.type);
        stored.push({ ...result, mimeType: file.type });
      } else {
        const result = await stripAndStore(buf); // EXIF/location stripped here
        stored.push({ ...result, mimeType: 'image/jpeg' });
      }

    } catch {
      skipped.push(`${file.name || 'a file'} (couldn't be processed)`);
    }
  }

  // if files were provided but all failed, only proceed if there's a message to save
  if (stored.length === 0 && files.length > 0 && !message)
    return NextResponse.json(
      {
        error:
          skipped.length > 0
            ? `None of your files could be added: ${skipped.join('; ')}.`
            : 'No files could be added.',
      },
      { status: 400 }
    );

  // create the post; images are optional (text-only posts have none)
  const [post] = await db
    .insert(posts)
    .values({ galleryId: gallery.id, guestName, message })
    .returning();

  // track last activity for auto-close cron (fire-and-forget)
  db.update(galleries)
    .set({ lastUploadAt: sql`now()` })
    .where(eq(galleries.id, gallery.id))
    .catch(() => {});

  const created = [];
  for (const s of stored) {
    const [img] = await db
      .insert(images)
      .values({
        postId: post.id,
        publicId: s.publicId,
        storageKey: s.storageKey,
        mimeType: s.mimeType,
        fileSize: s.fileSize,
        width: s.width ?? null,
        height: s.height ?? null,
      })
      .returning();
    created.push({ publicId: img.publicId, mimeType: img.mimeType, width: img.width, height: img.height });
  }

  return NextResponse.json({
    postId: post.id,
    images: created,
    skipped: skipped.length > 0 ? skipped : undefined,
  });
}
