import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { db } from '@/db';
import { promoCodes } from '@/db/schema';
import { desc } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  const check = await requireAdmin(req);
  if (!check.ok) return check.response;

  const codes = await db
    .select()
    .from(promoCodes)
    .orderBy(desc(promoCodes.createdAt));

  return NextResponse.json(codes);
}

export async function POST(req: NextRequest) {
  const check = await requireAdmin(req);
  if (!check.ok) return check.response;

  const { code, forever, maxUses, codeExpiresAt } = await req.json();

  const cleanCode = String(code || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '');

  if (!cleanCode)
    return NextResponse.json({ error: 'Enter a code.' }, { status: 400 });
  if (cleanCode.length > 40)
    return NextResponse.json({ error: 'Code is too long (max 40 chars).' }, { status: 400 });

  const maxUsesNum = maxUses != null ? Number(maxUses) : null;
  if (maxUsesNum !== null && (!Number.isInteger(maxUsesNum) || maxUsesNum < 1))
    return NextResponse.json({ error: 'Max uses must be a whole number ≥ 1.' }, { status: 400 });

  try {
    await db.insert(promoCodes).values({
      code: cleanCode,
      grantsPlan: 'comped',
      durationDays: forever ? null : 365,
      maxUses: maxUsesNum,
      expiresAt: codeExpiresAt ? new Date(codeExpiresAt) : null,
      active: true,
    });
  } catch (err) {
    const pgErr = err as { code?: string };
    if (pgErr.code === '23505')
      return NextResponse.json({ error: 'A code with that name already exists.' }, { status: 400 });
    throw err;
  }

  return NextResponse.json({ ok: true, code: cleanCode });
}
