import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '@/db';
import * as schema from '@/db/schema';
import { sendPasswordResetEmail, sendVerificationEmail } from './email';

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
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }: { user: { email: string }; url: string }) => {
      await sendPasswordResetEmail(user.email, url);
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url }: { user: { email: string }; url: string }) => {
      await sendVerificationEmail(user.email, url);
    },
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
  // build-time fallback silences the warning during `next build` (env vars
  // aren't injected at build time); real secrets are always present at runtime
  secret: process.env.BETTER_AUTH_SECRET ?? process.env.SESSION_SECRET
    ?? 'b7Kp3Mn8Qr2Vs6Xw4Yz9Aa1Bb5Cc0Dd7Ee3Ff8Gg2Hh6Ii4Jj9Kk1Ll5Mm0Nn7Pp',
  baseURL: process.env.APP_URL || 'http://localhost:13000',
});

export type Session = typeof auth.$Infer.Session;
