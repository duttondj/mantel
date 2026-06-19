import {
  pgTable,
  text,
  timestamp,
  integer,
  boolean,
  uuid,
  primaryKey,
} from 'drizzle-orm/pg-core';

/* ------------------------------------------------------------------ *
 *  BETTER AUTH TABLES
 *  These four tables are required by Better Auth. We extend `user`
 *  (the couples) with our own entitlement columns: plan / expiresAt /
 *  status. Everything else is Better Auth's standard shape.
 * ------------------------------------------------------------------ */

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name'),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),

  // --- our entitlement extension ---
  // plan: how they got access. 'free' is the signed-up-but-no-access
  // default; 'paid' and 'comped' are active states.
  plan: text('plan').notNull().default('free'),
  // when their year of hosting runs out. null = never activated.
  expiresAt: timestamp('expires_at'),
  // 'inactive' (signed up, not paid/redeemed), 'active', 'expired'
  status: text('status').notNull().default('inactive'),
  // site admin flag — grants access to the /admin dashboard
  isAdmin: boolean('is_admin').notNull().default(false),
});

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'), // email/password hash lives here
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

/* ------------------------------------------------------------------ *
 *  GALLERIES, POSTS, IMAGES
 * ------------------------------------------------------------------ */

export const galleries = pgTable('galleries', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: text('owner_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  // public-facing link component, e.g. "amber-tom-9f3k". Random suffix
  // so slugs aren't guessable from the couple's names alone.
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  // null = open gallery. Otherwise a hash (never the plaintext password).
  passwordHash: text('password_hash'),
  uploadsClosedAt: timestamp('uploads_closed_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const posts = pgTable('posts', {
  id: uuid('id').primaryKey().defaultRandom(),
  galleryId: uuid('gallery_id')
    .notNull()
    .references(() => galleries.id, { onDelete: 'cascade' }),
  // optional name the guest attached, remembered client-side via cookie
  guestName: text('guest_name'),
  message: text('message'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const images = pgTable('images', {
  id: uuid('id').primaryKey().defaultRandom(),
  postId: uuid('post_id')
    .notNull()
    .references(() => posts.id, { onDelete: 'cascade' }),
  // THE OBFUSCATION TOKEN. Long, random, unrelated to the gallery slug.
  // This is what appears in a direct image URL. Knowing it reveals
  // nothing about the gallery and yields nothing if the gallery is locked.
  publicId: text('public_id').notNull().unique(),
  // key of the object in MinIO/S3. Images are EXIF-stripped; videos are stored as-is.
  storageKey: text('storage_key').notNull(),
  mimeType: text('mime_type').notNull().default('image/jpeg'),
  width: integer('width'),
  height: integer('height'),
  // stored size in bytes — populated on upload; null for rows pre-dating this column
  fileSize: integer('file_size'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const likes = pgTable(
  'likes',
  {
    postId: uuid('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    // Random token stored in the guest's httpOnly cookie. Not tied to any
    // account — just a stable per-browser identity for de-duplicating likes.
    guestToken: text('guest_token').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.postId, t.guestToken] }),
  })
);

/* ------------------------------------------------------------------ *
 *  PROMO CODES + REDEMPTIONS  (entitlement, decoupled from payment)
 * ------------------------------------------------------------------ */

export const promoCodes = pgTable('promo_codes', {
  // the code itself is the key, e.g. "***REMOVED***"
  code: text('code').primaryKey(),
  // what redeeming grants — usually 'comped' for friends & family
  grantsPlan: text('grants_plan').notNull().default('comped'),
  durationDays: integer('duration_days').notNull().default(365),
  // null = unlimited uses
  maxUses: integer('max_uses'),
  usedCount: integer('used_count').notNull().default(0),
  // when the CODE stops working (distinct from the access it grants)
  expiresAt: timestamp('expires_at'),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const redemptions = pgTable(
  'redemptions',
  {
    code: text('code')
      .notNull()
      .references(() => promoCodes.code),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    redeemedAt: timestamp('redeemed_at').notNull().defaultNow(),
  },
  (t) => ({
    // a given user can only redeem a given code once
    pk: primaryKey({ columns: [t.code, t.userId] }),
  })
);
