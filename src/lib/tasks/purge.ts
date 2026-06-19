import { db } from '@/db';
import { user, galleries, posts, images } from '@/db/schema';
import { eq, lt, and } from 'drizzle-orm';
import { deleteObject } from '@/lib/storage';

const GRACE_DAYS = 30;

export async function runPurge(commit: boolean) {
  const cutoff = new Date(Date.now() - GRACE_DAYS * 86_400_000);

  const expired = await db
    .select({ id: user.id, email: user.email, expiresAt: user.expiresAt })
    .from(user)
    .where(and(eq(user.status, 'active'), lt(user.expiresAt, cutoff)));

  console.log(
    `[purge] ${commit ? 'COMMIT' : 'DRY RUN'} — ${expired.length} couple(s) past the ${GRACE_DAYS}-day grace period.`
  );

  for (const couple of expired) {
    const keys = await db
      .select({ storageKey: images.storageKey, publicId: images.publicId })
      .from(images)
      .innerJoin(posts, eq(images.postId, posts.id))
      .innerJoin(galleries, eq(posts.galleryId, galleries.id))
      .where(eq(galleries.ownerId, couple.id));

    console.log(`[purge]   ${couple.email}: ${keys.length} image(s)`);

    if (!commit) continue;

    for (const k of keys) {
      try {
        await deleteObject(k.storageKey);
      } catch (e) {
        console.error(`[purge]     failed to delete ${k.publicId}:`, e);
      }
    }
    await db.delete(galleries).where(eq(galleries.ownerId, couple.id));
    await db.update(user).set({ status: 'expired' }).where(eq(user.id, couple.id));
  }

  console.log(commit ? '[purge] Purge complete.' : '[purge] Dry run complete.');
}
