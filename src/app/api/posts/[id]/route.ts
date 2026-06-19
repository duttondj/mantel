import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { posts, images, galleries } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { deleteObject } from '@/lib/storage';

/* PATCH /api/posts/<id>  — host edits the message on a guest post */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const raw = typeof body.message === 'string' ? body.message.trim() : '';
  const message = raw.slice(0, 180) || null;

  const [ownsPost] = await db
    .select({ id: posts.id })
    .from(posts)
    .innerJoin(galleries, eq(posts.galleryId, galleries.id))
    .where(and(eq(posts.id, id), eq(galleries.ownerId, session.user.id)));

  if (!ownsPost) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  await db.update(posts).set({ message }).where(eq(posts.id, id));
  return NextResponse.json({ ok: true });
}

/*
 * DELETE /api/posts/<id>  — host removes a guest post from one of THEIR
 * galleries (moderation). Verifies the post belongs to a gallery the
 * signed-in host owns, deletes the image objects from storage, then the
 * rows (cascade removes the image rows when the post goes).
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const { id } = await params;

  // confirm this post is in a gallery owned by the caller, and collect
  // the storage keys to delete — all in one ownership-checked query.
  const rows = await db
    .select({ storageKey: images.storageKey })
    .from(posts)
    .innerJoin(galleries, eq(posts.galleryId, galleries.id))
    .innerJoin(images, eq(images.postId, posts.id))
    .where(and(eq(posts.id, id), eq(galleries.ownerId, session.user.id)));

  // No rows means either the post doesn't exist, isn't owned by this
  // host, or has no images. Distinguish the no-images case so a post
  // with an empty image set can still be deleted.
  const [ownsPost] = await db
    .select({ id: posts.id })
    .from(posts)
    .innerJoin(galleries, eq(posts.galleryId, galleries.id))
    .where(and(eq(posts.id, id), eq(galleries.ownerId, session.user.id)));

  if (!ownsPost) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  // best-effort storage cleanup; a failed object delete shouldn't block
  // removing the post from the gallery.
  for (const r of rows) {
    try {
      await deleteObject(r.storageKey);
    } catch {
      // leave orphaned object; the purge job / manual cleanup can catch it
    }
  }

  await db.delete(posts).where(eq(posts.id, id)); // cascade drops images rows

  return NextResponse.json({ ok: true });
}
