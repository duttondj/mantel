import { NextRequest, NextResponse } from 'next/server';
import { auth } from './auth';
import { db } from '@/db';
import { user as userTable } from '@/db/schema';
import { eq } from 'drizzle-orm';

type AdminCheckOk = { ok: true; userId: string };
type AdminCheckFail = { ok: false; response: NextResponse };
type AdminCheck = AdminCheckOk | AdminCheckFail;

export async function requireAdmin(req: NextRequest): Promise<AdminCheck> {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  const [me] = await db
    .select({ isAdmin: userTable.isAdmin })
    .from(userTable)
    .where(eq(userTable.id, session.user.id))
    .limit(1);
  if (!me?.isAdmin) {
    return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { ok: true, userId: session.user.id };
}
