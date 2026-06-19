import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { db } from '@/db';
import { user as userTable, galleries, images } from '@/db/schema';
import { count, sum } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  const check = await requireAdmin(req);
  if (!check.ok) return check.response;

  const [[{ users }], [{ gals }], [{ bytes }]] = await Promise.all([
    db.select({ users: count() }).from(userTable),
    db.select({ gals: count() }).from(galleries),
    db.select({ bytes: sum(images.fileSize) }).from(images),
  ]);

  return NextResponse.json({
    users,
    galleries: gals,
    storedBytes: Number(bytes ?? 0),
  });
}
