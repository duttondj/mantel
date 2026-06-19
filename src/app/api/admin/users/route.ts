import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { db } from '@/db';
import { user as userTable, account as accountTable, galleries } from '@/db/schema';
import { count, desc, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

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

  const { hashPassword } = await import('@better-auth/utils/password');
  const passwordHash = await hashPassword(password);
  const userId = nanoid();
  const now = new Date();

  try {
    await db.insert(userTable).values({
      id: userId,
      email,
      name: name || email,
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
      plan: 'free',
      status: 'inactive',
      isAdmin: false,
    });
    await db.insert(accountTable).values({
      id: nanoid(),
      userId,
      accountId: userId,
      providerId: 'credential',
      password: passwordHash,
      createdAt: now,
      updatedAt: now,
    });
  } catch (err) {
    const pgErr = err as { code?: string };
    if (pgErr.code === '23505') {
      return NextResponse.json({ error: 'An account with that email already exists.' }, { status: 400 });
    }
    throw err;
  }

  if (isAdmin) {
    await db
      .update(userTable)
      .set({ isAdmin: true, status: 'active', plan: 'comped' })
      .where(eq(userTable.id, userId));
  }

  return NextResponse.json({ ok: true });
}
