import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { db } from '@/db';
import { user as userTable, galleries } from '@/db/schema';
import { count, desc, eq } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  const check = await requireAdmin(req);
  if (!check.ok) return check.response;

  const users = await db
    .select({
      id: userTable.id,
      email: userTable.email,
      name: userTable.name,
      plan: userTable.plan,
      status: userTable.status,
      isAdmin: userTable.isAdmin,
      expiresAt: userTable.expiresAt,
      createdAt: userTable.createdAt,
      galleryCount: count(galleries.id),
    })
    .from(userTable)
    .leftJoin(galleries, eq(galleries.ownerId, userTable.id))
    .groupBy(
      userTable.id,
      userTable.email,
      userTable.name,
      userTable.plan,
      userTable.status,
      userTable.isAdmin,
      userTable.expiresAt,
      userTable.createdAt,
    )
    .orderBy(desc(userTable.createdAt));

  return NextResponse.json(users);
}

// Create a new host account (optionally as admin)
export async function POST(req: NextRequest) {
  const check = await requireAdmin(req);
  if (!check.ok) return check.response;

  const { email, password, name, isAdmin } = await req.json();
  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
  }

  // Create the account via Better Auth's own sign-up endpoint
  const signUpRes = await fetch('http://localhost:3000/api/auth/sign-up/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name: name || email }),
  });

  if (!signUpRes.ok) {
    const err = await signUpRes.json().catch(() => ({}));
    return NextResponse.json(
      { error: (err as { message?: string }).message || 'Could not create account.' },
      { status: 400 }
    );
  }

  if (isAdmin) {
    await db
      .update(userTable)
      .set({ isAdmin: true, status: 'active', plan: 'comped' })
      .where(eq(userTable.email, email));
  }

  return NextResponse.json({ ok: true });
}
