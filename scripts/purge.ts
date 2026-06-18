import { db } from '../src/db/index.ts';
import { user, galleries, posts, images } from '../src/db/schema.ts';
import { eq, lt, and } from 'drizzle-orm';
import { deleteObject } from '../src/lib/storage.ts';

/*
 * PURGE JOB — the only irreversible operation in the system. Treat with care.
 *
 * Lifecycle of a couple's data:
 *   1. expiresAt passes  -> access is already cut off everywhere by the
 *      isEntitled() checks in the request path. The customer experiences
 *      this as "deleted." Nothing is physically gone yet.
 *   2. grace period (GRACE_DAYS) -> data still on disk. This is your
 *      insurance against bugs and your renewal upsell window.
 *   3. only AFTER expiresAt + GRACE_DAYS do we physically delete.
 *
 * SAFETY: this script DRY-RUNS by default. It will only delete when run
 * with --commit. Run it on a schedule (cron/systemd timer) once you've
 * watched the dry-run output and trust it:
 *
 *     node --experimental-strip-types scripts/purge.ts            # dry run
 *     node --experimental-strip-types scripts/purge.ts --commit   # for real
 */

const GRACE_DAYS = 30;
const COMMIT = process.argv.includes('--commit');

async function main() {
  const cutoff = new Date(Date.now() - GRACE_DAYS * 86_400_000);

  // couples whose access expired more than GRACE_DAYS ago
  const expired = await db
    .select({ id: user.id, email: user.email, expiresAt: user.expiresAt })
    .from(user)
    .where(and(eq(user.status, 'active'), lt(user.expiresAt, cutoff)));
  // note: status flips to 'expired' below; re-running won't reprocess.

  console.log(
    `${COMMIT ? 'COMMIT' : 'DRY RUN'} — ${expired.length} couple(s) past the ${GRACE_DAYS}-day grace period.`
  );

  for (const couple of expired) {
    // gather all storage keys for this couple's images
    const keys = await db
      .select({ storageKey: images.storageKey, publicId: images.publicId })
      .from(images)
      .innerJoin(posts, eq(images.postId, posts.id))
      .innerJoin(galleries, eq(posts.galleryId, galleries.id))
      .where(eq(galleries.ownerId, couple.id));

    console.log(`  ${couple.email}: ${keys.length} image(s)`);

    if (!COMMIT) continue;

    // delete objects from storage first…
    for (const k of keys) {
      try {
        await deleteObject(k.storageKey);
      } catch (e) {
        console.error(`    failed to delete ${k.publicId}:`, e);
      }
    }
    // …then the rows (cascades remove posts/images/galleries)…
    await db.delete(galleries).where(eq(galleries.ownerId, couple.id));
    // …and mark the couple expired so they're not reprocessed.
    await db.update(user).set({ status: 'expired' }).where(eq(user.id, couple.id));
  }

  console.log(COMMIT ? 'Purge complete.' : 'Dry run complete. Re-run with --commit to delete.');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
