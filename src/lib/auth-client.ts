'use client';

import { createAuthClient } from 'better-auth/react';

/*
 * Client-side auth helpers for the host-facing pages (sign up, sign in,
 * sign out, session). baseURL is same-origin so this works on localhost
 * and over the LAN without extra config.
 */
export const authClient = createAuthClient();

export const { signIn, signUp, signOut, useSession } = authClient;
