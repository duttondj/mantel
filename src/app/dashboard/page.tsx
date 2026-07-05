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
      isAdmin: userTable.isAdmin,
    })
    .from(userTable)
    .where(eq(userTable.id, session.user.id));

  if (me?.isAdmin) redirect('/admin');

  const active = me ? isEntitled(me) : false;

  const priceCents = parseInt(process.env.SQUARE_PRICE_CENTS ?? '2000', 10);
  const priceDisplay = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(priceCents / 100);

  return (
    <DashboardClient
      email={me?.email ?? ''}
      active={active}
      plan={me?.plan ?? 'free'}
      expiresAt={me?.expiresAt ? me.expiresAt.toISOString() : null}
      priceDisplay={priceDisplay}
    />
  );
}
