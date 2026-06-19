import { createHmac, timingSafeEqual, scryptSync, randomBytes } from 'crypto';

/*
 * Gallery-access cookies and password hashing.
 *
 * These are SEPARATE from Better Auth's couple sessions. A guest who
 * enters a gallery password gets a signed cookie scoped to THAT gallery
 * id — entering one gallery's password never unlocks another.
 */

// Lazy: resolved at request time so Next.js can import this module at
// build time without SESSION_SECRET set. Still fails loud on first use.
function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error('SESSION_SECRET is not set');
  return s;
}

/* ---- gallery password hashing (scrypt, salted) ---- */

export function hashPassword(plain: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(plain, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(plain: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  const candidate = scryptSync(plain, salt, 64);
  const original = Buffer.from(hash, 'hex');
  if (candidate.length !== original.length) return false;
  return timingSafeEqual(candidate, original);
}

/* ---- signed gallery-access tokens (HMAC) ---- */

// Cookie value proves "this visitor entered the password for gallery X".
// Format: <galleryId>.<hmac(galleryId)>. No DB lookup needed to verify.
export function signGalleryAccess(galleryId: string): string {
  const sig = createHmac('sha256', secret()).update(galleryId).digest('hex');
  return `${galleryId}.${sig}`;
}

export function verifyGalleryAccess(
  cookieValue: string | undefined,
  galleryId: string
): boolean {
  if (!cookieValue) return false;
  const [id, sig] = cookieValue.split('.');
  if (id !== galleryId || !sig) return false;
  const expected = createHmac('sha256', secret()).update(galleryId).digest('hex');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// cookie name per gallery keeps multiple unlocked galleries independent
export function galleryCookieName(galleryId: string): string {
  return `g_access_${galleryId}`;
}
