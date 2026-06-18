import { auth } from '@/lib/auth';
import { db } from '@/db';
import { user as userTable } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { isEntitled } from '@/lib/entitlements';
import { DashboardClient } from './DashboardClient';

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/signin');

  const [me] = await db
    .select({
      email: userTable.email,
      name: userTable.name,
      plan: userTable.plan,
      status: userTable.status,
      expiresAt: userTable.expiresAt,
    })
    .from(userTable)
    .where(eq(userTable.id, session.user.id));

  const active = me ? isEntitled(me) : false;

  return (
    <DashboardClient
      email={me?.email ?? ''}
      active={active}
      plan={me?.plan ?? 'free'}
      expiresAt={me?.expiresAt ? me.expiresAt.toISOString() : null}
    />
  );
}
