import { db } from '../src/db/index.ts';
import { user as userTable, account as accountTable } from '../src/db/schema.ts';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

/*
 * Creates or promotes an admin account.
 * Uses @better-auth/utils/password (Better Auth's own dep) to hash
 * the password identically to how Better Auth itself does it.
 *
 * Usage (inside the container):
 *   ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=secret npm run db:create-admin
 */

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!ADMIN_EMAIL) {
  console.error('Error: ADMIN_EMAIL env var is required');
  process.exit(1);
}

const [existing] = await db
  .select({ id: userTable.id })
  .from(userTable)
  .where(eq(userTable.email, ADMIN_EMAIL))
  .limit(1);

if (!existing) {
  if (!ADMIN_PASSWORD) {
    console.error('Error: ADMIN_PASSWORD is required when creating a new account');
    process.exit(1);
  }

  const { hashPassword } = await import('@better-auth/utils/password');
  const passwordHash = await hashPassword(ADMIN_PASSWORD);

  const userId = nanoid();
  const now = new Date();

  await db.insert(userTable).values({
    id: userId,
    email: ADMIN_EMAIL,
    name: 'Admin',
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

  console.log('Created account for', ADMIN_EMAIL);
}

await db
  .update(userTable)
  .set({ isAdmin: true, status: 'active', plan: 'comped' })
  .where(eq(userTable.email, ADMIN_EMAIL));

console.log('Admin account ready:', ADMIN_EMAIL);
process.exit(0);
