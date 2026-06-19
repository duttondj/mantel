import { db } from '../src/db/index.ts';
import { user as userTable } from '../src/db/schema.ts';
import { eq } from 'drizzle-orm';

/*
 * Creates or promotes an admin account.
 *
 * Usage (inside the container):
 *   ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=secret npm run db:create-admin
 *
 * If the account already exists, it is promoted to admin without changing
 * the password. If it doesn't exist, it is created via Better Auth and then
 * promoted.
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
  const res = await fetch('http://localhost:3000/api/auth/sign-up/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD, name: 'Admin' }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error('Failed to create account:', err);
    process.exit(1);
  }
  console.log('Created account for', ADMIN_EMAIL);
}

await db
  .update(userTable)
  .set({ isAdmin: true, status: 'active', plan: 'comped' })
  .where(eq(userTable.email, ADMIN_EMAIL));

console.log('Admin account ready:', ADMIN_EMAIL);
process.exit(0);
