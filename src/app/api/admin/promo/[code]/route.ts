import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { db } from '@/db';
import { promoCodes, redemptions } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const check = await requireAdmin(req);
  if (!check.ok) return check.response;

  const { code } = await params;
  const { active } = await req.json();

  await db
    .update(promoCodes)
    .set({ active: Boolean(active) })
    .where(eq(promoCodes.code, code));

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const check = await requireAdmin(req);
  if (!check.ok) return check.response;

  const { code } = await params;

  // delete redemption records first (no cascade FK on this side)
  await db.transaction(async (tx) => {
    await tx.delete(redemptions).where(eq(redemptions.code, code));
    await tx.delete(promoCodes).where(eq(promoCodes.code, code));
  });

  return NextResponse.json({ ok: true });
}
