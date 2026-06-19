import { auth } from '@/lib/auth';
import { db } from '@/db';
import { user as userTable, galleries, images } from '@/db/schema';
import { count, desc, eq, sum } from 'drizzle-orm';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { AdminClient } from './AdminClient';

export default async function AdminPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/signin');

  const [me] = await db
    .select({ isAdmin: userTable.isAdmin })
    .from(userTable)
    .where(eq(userTable.id, session.user.id))
    .limit(1);

  if (!me?.isAdmin) redirect('/dashboard');

  const [users, [{ users: userCount }], [{ gals: galleryCount }], [{ bytes }]] =
    await Promise.all([
      db
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
        .orderBy(desc(userTable.createdAt)),
      db.select({ users: count() }).from(userTable),
      db.select({ gals: count() }).from(galleries),
      db.select({ bytes: sum(images.fileSize) }).from(images),
    ]);

  return (
    <AdminClient
      currentUserId={session.user.id}
      initialUsers={users.map((u) => ({
        ...u,
        expiresAt: u.expiresAt?.toISOString() ?? null,
        createdAt: u.createdAt.toISOString(),
      }))}
      initialStats={{
        users: userCount,
        galleries: galleryCount,
        storedBytes: Number(bytes ?? 0),
      }}
    />
  );
}
