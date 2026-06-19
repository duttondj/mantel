import { NextRequest, NextResponse } from 'next/server';
import { PassThrough, Readable } from 'node:stream';
import archiver from 'archiver';
import { db } from '@/db';
import { galleries, posts, images } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { getObjectStream } from '@/lib/storage';

/*
 * GET /api/galleries/:id/download
 * Streams a ZIP of every image and video in the gallery to the host.
 * Auth: session required + must own the gallery.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const { id } = await params;

  const [gallery] = await db
    .select({ id: galleries.id, title: galleries.title, ownerId: galleries.ownerId })
    .from(galleries)
    .where(and(eq(galleries.id, id), eq(galleries.ownerId, session.user.id)));

  if (!gallery) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  const files = await db
    .select({ storageKey: images.storageKey, mimeType: images.mimeType })
    .from(images)
    .innerJoin(posts, eq(images.postId, posts.id))
    .where(eq(posts.galleryId, gallery.id));

  const safeTitle = gallery.title.replace(/[^a-z0-9\-_ ]/gi, '').trim() || 'gallery';

  const pass = new PassThrough();
  const archive = archiver('zip', { zlib: { level: 1 } });

  archive.on('error', (err) => {
    console.error('Archive error:', err);
    pass.destroy(err);
  });

  archive.pipe(pass);

  // Queue all S3 streams into the archive, then finalize
  (async () => {
    let imgIndex = 0;
    let vidIndex = 0;
    for (const file of files) {
      try {
        const obj = await getObjectStream(file.storageKey);
        const isVideo = file.mimeType.startsWith('video/');
        const ext = file.storageKey.split('.').pop() ?? (isVideo ? 'mp4' : 'jpg');
        const name = isVideo
          ? `video-${String(++vidIndex).padStart(3, '0')}.${ext}`
          : `photo-${String(++imgIndex).padStart(3, '0')}.${ext}`;
        // AWS SDK v3 Body is a Node.js Readable in the Node.js runtime —
        // do NOT call Readable.fromWeb(), which expects a Web ReadableStream.
        archive.append(obj.Body as unknown as Readable, { name });
      } catch (err) {
        console.error(`[download] skipping ${file.storageKey}:`, err);
      }
    }
    archive.finalize();
  })();

  const webStream = Readable.toWeb(pass) as ReadableStream;

  return new NextResponse(webStream, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${safeTitle}.zip"`,
    },
  });
}
