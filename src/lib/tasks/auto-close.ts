import { db } from '@/db';
import { galleries } from '@/db/schema';
import { and, isNull, isNotNull, lt, sql } from 'drizzle-orm';

export async function runAutoClose() {
  const days = parseInt(process.env.AUTO_CLOSE_DAYS ?? '14', 10);
  const cutoff = new Date(Date.now() - days * 86_400_000);

  const closed = await db
    .update(galleries)
    .set({ uploadsClosedAt: sql`now()` })
    .where(
      and(
        isNull(galleries.uploadsClosedAt),
        isNotNull(galleries.lastUploadAt),
        lt(galleries.lastUploadAt, cutoff),
      )
    )
    .returning({ id: galleries.id });

  console.log(`[auto-close] Closed ${closed.length} idle galerie(s) (no activity for ${days}+ days).`);
}
