import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { galleries, posts, images } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { deleteObject } from '@/lib/storage';

/* PATCH /api/galleries/<id>  — update mutable gallery settings */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const { id } = await params;

  const [owned] = await db
    .select({ id: galleries.id })
    .from(galleries)
    .where(and(eq(galleries.id, id), eq(galleries.ownerId, session.user.id)));
  if (!owned) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  const body = await req.json();

  if ('uploadsClosedAt' in body) {
    const val = body.uploadsClosedAt === null ? null : new Date(body.uploadsClosedAt);
    await db.update(galleries).set({ uploadsClosedAt: val }).where(eq(galleries.id, id));
  }

  return NextResponse.json({ ok: true });
}

/*
 * DELETE /api/galleries/<id>  — host deletes one of their own galleries
 * and everything in it. Removes all image objects from storage, then the
 * gallery row (cascade removes posts + image rows).
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const { id } = await params;

  // ownership check
  const [owned] = await db
    .select({ id: galleries.id })
    .from(galleries)
    .where(and(eq(galleries.id, id), eq(galleries.ownerId, session.user.id)));
  if (!owned) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  // gather every storage key under this gallery
  const keys = await db
    .select({ storageKey: images.storageKey })
    .from(images)
    .innerJoin(posts, eq(images.postId, posts.id))
    .where(eq(posts.galleryId, id));

  for (const k of keys) {
    try {
      await deleteObject(k.storageKey);
    } catch {
      // orphaned object; non-fatal
    }
  }

  await db.delete(galleries).where(eq(galleries.id, id)); // cascade

  return NextResponse.json({ ok: true });
}
