import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '@/db';
import * as schema from '@/db/schema';
import { randomBytes } from 'node:crypto';
import { sendPasswordResetEmail, sendVerificationEmail } from './email';

/*
 * Better Auth for the HOSTS (account owners). Sessions live in our own
 * Postgres via the Drizzle adapter — no external service, nothing phones
 * home, fully container-portable.
 *
 * Guests never touch this; they use the separate signed-cookie system in
 * lib/gallery-auth.ts.
 */
// The session-signing secret must come from the environment. If it's missing
// at runtime, session cookies would be forgeable, so we fail fast rather than
// fall back to any baked-in value. Env vars aren't injected during
// `next build`, so a random throwaway (never persisted — nothing is signed at
// build time) is allowed ONLY in the build phase.
function resolveAuthSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET ?? process.env.SESSION_SECRET;
  if (secret) return secret;

  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return randomBytes(32).toString('hex');
  }

  throw new Error(
    'BETTER_AUTH_SECRET (or SESSION_SECRET) is not set. Refusing to start ' +
      'without a signing secret — session cookies would be forgeable. ' +
      'Set it to a long random value (e.g. `openssl rand -hex 32`).'
  );
}

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
    minPasswordLength: 8,
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
  secret: resolveAuthSecret(),
  baseURL: process.env.APP_URL || 'http://localhost:13000',
});

export type Session = typeof auth.$Infer.Session;
