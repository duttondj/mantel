import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { galleries, posts, user as userTable } from '@/db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { isEntitled } from '@/lib/entitlements';
import { makeSlug } from '@/lib/slug';
import { hashPassword } from '@/lib/gallery-auth';

/* GET /api/galleries — list the signed-in host's galleries (+ post counts) */
export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const rows = await db
    .select({
      id: galleries.id,
      title: galleries.title,
      slug: galleries.slug,
      hasPassword: sql<boolean>`${galleries.passwordHash} is not null`,
      createdAt: galleries.createdAt,
      postCount: sql<number>`count(${posts.id})::int`,
    })
    .from(galleries)
    .leftJoin(posts, eq(posts.galleryId, galleries.id))
    .where(eq(galleries.ownerId, session.user.id))
    .groupBy(galleries.id)
    .orderBy(desc(galleries.createdAt));

  return NextResponse.json({ galleries: rows });
}

/* POST /api/galleries  { title, password? } — create a gallery */
export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  // must have an active plan to create galleries
  const [me] = await db
    .select({ status: userTable.status, expiresAt: userTable.expiresAt })
    .from(userTable)
    .where(eq(userTable.id, session.user.id));

  if (!me || !isEntitled(me))
    return NextResponse.json(
      { error: 'Your account isn’t active yet. Redeem a code or subscribe first.' },
      { status: 403 }
    );

  const { title, password } = await req.json();
  const cleanTitle = String(title || '').trim().slice(0, 120);
  if (!cleanTitle)
    return NextResponse.json({ error: 'Give your gallery a name.' }, { status: 400 });

  const passwordHash =
    password && String(password).length > 0 ? hashPassword(String(password)) : null;

  // retry slug on the very unlikely collision
  let slug = makeSlug(cleanTitle);
  for (let i = 0; i < 3; i++) {
    const [clash] = await db
      .select({ id: galleries.id })
      .from(galleries)
      .where(eq(galleries.slug, slug));
    if (!clash) break;
    slug = makeSlug(cleanTitle);
  }

  const [created] = await db
    .insert(galleries)
    .values({ ownerId: session.user.id, title: cleanTitle, slug, passwordHash })
    .returning({ id: galleries.id, slug: galleries.slug, title: galleries.title });

  return NextResponse.json({ gallery: created });
}
