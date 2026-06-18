import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { galleries } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { hashPassword } from '@/lib/gallery-auth';

/*
 * PUT /api/galleries/<id>/password  { password }
 * Set or change the gallery password. Send an empty string to make the
 * gallery open (removes protection). Owner-only.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const { id } = await params;
  const { password } = await req.json();

  // confirm ownership before touching anything
  const [owned] = await db
    .select({ id: galleries.id })
    .from(galleries)
    .where(and(eq(galleries.id, id), eq(galleries.ownerId, session.user.id)));
  if (!owned) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  const next = password && String(password).length > 0 ? hashPassword(String(password)) : null;
  await db.update(galleries).set({ passwordHash: next }).where(eq(galleries.id, id));

  return NextResponse.json({ ok: true, hasPassword: next !== null });
}
