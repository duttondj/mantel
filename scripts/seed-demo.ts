/**
 * Populates a read-only demo gallery with royalty-free photos from picsum.photos
 * and fake guest posts so potential customers can try the UI before signing up.
 *
 * Run once (idempotent — skips if the demo gallery already exists):
 *   npm run seed:demo
 *   (or via: make seed-demo)
 *
 * Requires the app's env vars: DATABASE_URL, S3_ENDPOINT, S3_BUCKET, etc.
 * Run inside the Docker container: docker compose exec app npm run seed:demo
 */

import { db } from '../src/db/index.ts';
import { galleries, posts, images, user } from '../src/db/schema.ts';
import { stripAndStore } from '../src/lib/images.ts';
import { eq } from 'drizzle-orm';

const DEMO_SLUG = 'demo';
const DEMO_USER_ID = 'system-demo-user';
const DEMO_USER_EMAIL = 'demo@system.internal';
const DEMO_TITLE = 'Garden Party – Summer 2025';

// Seeded picsum URLs are deterministic — same seed always returns the same photo.
// These are Unsplash-licensed photos served via picsum.photos (free for all uses).
const PHOTO_SEEDS = [
  'mantel01', 'mantel02', 'mantel03', 'mantel04', 'mantel05',
  'mantel06', 'mantel07', 'mantel08', 'mantel09', 'mantel10',
  'mantel11', 'mantel12', 'mantel13',
];

const DEMO_POSTS: { guestName: string | null; message: string | null; photoCount: number }[] = [
  { guestName: 'The Hendersons', message: 'What an incredible night! So glad we made it.', photoCount: 2 },
  { guestName: 'Priya & James',  message: 'Thank you for having us 🎉',                   photoCount: 2 },
  { guestName: 'Chris M.',       message: null,                                            photoCount: 1 },
  { guestName: 'Aunt Carol',     message: "I took way too many pictures but I couldn't help it!", photoCount: 3 },
  { guestName: 'Raj',            message: 'Best party of the year, hands down.',           photoCount: 1 },
  { guestName: null,             message: 'Wishing you nothing but the best from here on out. — The Okafor Family', photoCount: 0 },
  { guestName: 'Sam & Jordan',   message: 'The decorations were stunning 😍',              photoCount: 2 },
  { guestName: 'Tom B.',         message: 'Already planning next year!',                   photoCount: 2 },
];

async function downloadPhoto(seed: string): Promise<Buffer> {
  const url = `https://picsum.photos/seed/${seed}/1200/800`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download ${url}: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  // Check if demo gallery already exists
  const [existing] = await db
    .select({ id: galleries.id })
    .from(galleries)
    .where(eq(galleries.slug, DEMO_SLUG));

  if (existing) {
    console.log('Demo gallery already exists — nothing to do.');
    process.exit(0);
  }

  // Create the demo system user (no account record = can't log in)
  const [existingUser] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.id, DEMO_USER_ID));

  if (!existingUser) {
    await db.insert(user).values({
      id: DEMO_USER_ID,
      name: 'Demo',
      email: DEMO_USER_EMAIL,
      emailVerified: true,
      plan: 'comped',
      status: 'active',
      expiresAt: null, // lifetime
    });
    console.log('Created demo system user.');
  }

  // Create the demo gallery (uploads closed so guests can't post)
  const [gallery] = await db.insert(galleries).values({
    ownerId: DEMO_USER_ID,
    slug: DEMO_SLUG,
    title: DEMO_TITLE,
    isDemo: true,
    uploadsClosedAt: new Date(), // blocks API-level uploads too
  }).returning({ id: galleries.id });

  console.log(`Created demo gallery: /g/${DEMO_SLUG}`);

  // Download and store all photos upfront
  console.log(`Downloading ${PHOTO_SEEDS.length} photos from picsum.photos…`);
  const stored: { storageKey: string; publicId: string; width: number; height: number; fileSize: number }[] = [];
  for (const seed of PHOTO_SEEDS) {
    process.stdout.write(`  ${seed}… `);
    try {
      const buf = await downloadPhoto(seed);
      const result = await stripAndStore(buf);
      stored.push(result);
      console.log('ok');
    } catch (e) {
      console.log(`FAILED (${(e as Error).message}) — skipping`);
    }
  }

  // Seed posts — spread timestamps over ~4 hours to look natural
  let photoIdx = 0;
  const baseTime = Date.now() - 4 * 60 * 60 * 1000;
  const timeStep = (3.5 * 60 * 60 * 1000) / DEMO_POSTS.length;

  for (let i = 0; i < DEMO_POSTS.length; i++) {
    const template = DEMO_POSTS[i];
    const createdAt = new Date(baseTime + i * timeStep);

    const [post] = await db.insert(posts).values({
      galleryId: gallery.id,
      guestName: template.guestName,
      message: template.message,
      createdAt,
    }).returning({ id: posts.id });

    for (let j = 0; j < template.photoCount && photoIdx < stored.length; j++, photoIdx++) {
      const s = stored[photoIdx];
      await db.insert(images).values({
        postId: post.id,
        publicId: s.publicId,
        storageKey: s.storageKey,
        mimeType: 'image/jpeg',
        width: s.width,
        height: s.height,
        fileSize: s.fileSize,
      });
    }

    const label = template.guestName ?? '(text only)';
    console.log(`  Post ${i + 1}: ${label} — ${template.photoCount} photo(s)`);
  }

  console.log('\nDemo gallery ready. Visit /g/demo to preview.');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
