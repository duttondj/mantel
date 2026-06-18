import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '@/db';
import * as schema from '@/db/schema';

/*
 * Better Auth for the HOSTS (account owners). Sessions live in our own
 * Postgres via the Drizzle adapter — no external service, nothing phones
 * home, fully container-portable.
 *
 * Guests never touch this; they use the separate signed-cookie system in
 * lib/gallery-auth.ts.
 */
export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  emailAndPassword: {
    enabled: true,
    // keep the MVP simple; turn on verification when you wire up email
    requireEmailVerification: false,
  },
  // Brute-force protection on auth endpoints (sign-in/up etc). Better Auth
  // enables this in production by default, but we set it explicitly so it
  // doesn't silently depend on NODE_ENV. Stricter per-path defaults for
  // sign-in/up apply on top of this.
  rateLimit: {
    enabled: true,
    window: 10, // seconds
    max: 100, // generous global ceiling; sign-in has its own tighter rule
    storage: 'memory',
  },
  secret: process.env.SESSION_SECRET,
  baseURL: process.env.APP_URL || 'http://localhost:13000',
});

export type Session = typeof auth.$Infer.Session;
