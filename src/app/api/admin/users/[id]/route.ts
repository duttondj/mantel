import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { db } from '@/db';
import { user as userTable } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireAdmin(req);
  if (!check.ok) return check.response;

  const { id } = await params;
  const body = await req.json();

  // Prevent self-demotion to avoid accidental lockout
  if ('isAdmin' in body && body.isAdmin === false && id === check.userId) {
    return NextResponse.json({ error: "You can't remove your own admin access." }, { status: 400 });
  }

  const patch: Partial<typeof userTable.$inferInsert> = {};
  if ('isAdmin' in body) patch.isAdmin = Boolean(body.isAdmin);
  if ('status' in body && ['active', 'inactive'].includes(body.status)) {
    patch.status = body.status;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
  }

  await db.update(userTable).set(patch).where(eq(userTable.id, id));
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireAdmin(req);
  if (!check.ok) return check.response;

  const { id } = await params;

  if (id === check.userId) {
    return NextResponse.json({ error: "You can't delete your own account." }, { status: 400 });
  }

  await db.delete(userTable).where(eq(userTable.id, id));
  return NextResponse.json({ ok: true });
}
