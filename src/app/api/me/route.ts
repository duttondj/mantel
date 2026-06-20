import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { user } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { isEntitled } from '@/lib/entitlements';

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return NextResponse.json({ active: false });

  const [u] = await db
    .select({ status: user.status, expiresAt: user.expiresAt })
    .from(user)
    .where(eq(user.id, session.user.id));

  return NextResponse.json({ active: isEntitled(u ?? { status: 'inactive', expiresAt: null }) });
}
