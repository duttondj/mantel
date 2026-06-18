import { NextRequest } from 'next/server';

/*
 * In-process rate limiting. No Redis, no extra container — just a Map in
 * the Node process. Good enough for a single-container deploy.
 *
 * Tradeoffs (deliberately accepted for now):
 *  - Counters reset on app restart. Fine; restarts are rare.
 *  - Not shared across multiple app instances. When you scale to >1 app
 *    container, swap the internals of `hit()` for a Postgres-backed
 *    counter — every caller uses the same `checkRateLimit()` signature,
 *    so nothing else changes. (Same seam idea as grantAccess.)
 *
 * Algorithm: sliding window. We keep recent hit timestamps per key and
 * count how many fall inside the window.
 */

type Bucket = number[]; // sorted-ish list of hit timestamps (ms)
const store = new Map<string, Bucket>();

// Periodically drop fully-expired buckets so the Map doesn't grow forever.
// Keyed to the longest window we use (15 min); anything older is dead.
const MAX_AGE_MS = 15 * 60 * 1000;
let lastSweep = Date.now();
function sweep(now: number) {
  if (now - lastSweep < 60_000) return; // at most once a minute
  lastSweep = now;
  for (const [key, hits] of store) {
    const live = hits.filter((t) => now - t < MAX_AGE_MS);
    if (live.length === 0) store.delete(key);
    else store.set(key, live);
  }
}

export type RateLimit = { limit: number; windowMs: number };

export type RateResult = {
  ok: boolean;
  remaining: number;
  retryAfterSec: number; // seconds until the oldest hit leaves the window
};

/*
 * Record a hit for `key` and report whether it's within `limit` per
 * `windowMs`. The hit is always recorded (even when rejected), so a
 * client hammering the endpoint keeps pushing its own retry time out —
 * which is the behavior you want against brute force.
 */
export function checkRateLimit(key: string, rule: RateLimit): RateResult {
  const now = Date.now();
  sweep(now);

  const windowStart = now - rule.windowMs;
  const hits = (store.get(key) || []).filter((t) => t > windowStart);
  hits.push(now);
  store.set(key, hits);

  const count = hits.length;
  const ok = count <= rule.limit;
  const oldest = hits[0];
  const retryAfterSec = ok ? 0 : Math.ceil((oldest + rule.windowMs - now) / 1000);

  return { ok, remaining: Math.max(0, rule.limit - count), retryAfterSec };
}

/*
 * Resolve the real client IP. Behind Docker / a reverse proxy, the
 * socket IP is the gateway, so without this every guest would share one
 * bucket and rate-limit each other. We read x-forwarded-for (first hop)
 * and fall back to x-real-ip, then to a constant so a missing header
 * doesn't crash (it just means everyone shares a bucket, fail-safe).
 *
 * NOTE: x-forwarded-for is spoofable if your proxy doesn't overwrite it.
 * On your LAN that's not a concern; when you put this behind a real
 * reverse proxy for internet access, configure the proxy to SET (not
 * append) this header so a client can't forge extra hops.
 */
export function clientIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  const real = req.headers.get('x-real-ip');
  if (real) return real.trim();
  return 'unknown';
}

// Named rules, in one place so limits are easy to tune.
export const RULES = {
  // expensive: EXIF re-encode + storage writes
  upload: { limit: 12, windowMs: 10 * 60 * 1000 }, // 12 posts / 10 min / IP
  // security-sensitive: brute-force surface on gallery passwords
  unlock: { limit: 8, windowMs: 15 * 60 * 1000 }, // 8 tries / 15 min / IP
  // security-sensitive: brute-force on host accounts
  signin: { limit: 10, windowMs: 15 * 60 * 1000 }, // 10 tries / 15 min / IP
  // promo guessing
  promo: { limit: 10, windowMs: 15 * 60 * 1000 },
  // light action but still want a floor to prevent abuse
  like: { limit: 120, windowMs: 10 * 60 * 1000 }, // 120 likes / 10 min / IP
} as const;
