import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  PutObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';

/*
 * Migrates all objects from the current S3 backend (MinIO by default) to a
 * new cloud provider (Cloudflare R2, Backblaze B2, AWS S3, etc.).
 *
 * Usage:
 *   make migrate-storage              # dry-run: lists what would be copied
 *   make migrate-storage-commit       # actually copies everything
 *
 * Configure the DESTINATION in .env (or export inline):
 *   DEST_S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com
 *   DEST_S3_ACCESS_KEY=...
 *   DEST_S3_SECRET_KEY=...
 *   DEST_S3_BUCKET=photos
 *   DEST_S3_REGION=auto
 *
 * The SOURCE is your current S3_* env vars (MinIO or wherever you're migrating from).
 *
 * Safe to re-run: objects that already exist in the destination are skipped.
 * After migration, update your S3_* vars in .env to point at the destination
 * and run make up — the app switches over immediately.
 */

const commit = process.argv.includes('--commit');

const src = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION || 'us-east-1',
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY!,
    secretAccessKey: process.env.S3_SECRET_KEY!,
  },
});

const dest = new S3Client({
  endpoint: process.env.DEST_S3_ENDPOINT,
  region: process.env.DEST_S3_REGION || 'auto',
  forcePathStyle: !!process.env.DEST_S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.DEST_S3_ACCESS_KEY!,
    secretAccessKey: process.env.DEST_S3_SECRET_KEY!,
  },
});

const SRC_BUCKET = process.env.S3_BUCKET || 'photos';
const DEST_BUCKET = process.env.DEST_S3_BUCKET || 'photos';

async function objectExists(key: string): Promise<boolean> {
  try {
    await dest.send(new HeadObjectCommand({ Bucket: DEST_BUCKET, Key: key }));
    return true;
  } catch {
    return false;
  }
}

async function copyObject(key: string, contentType: string): Promise<void> {
  const res = await src.send(new GetObjectCommand({ Bucket: SRC_BUCKET, Key: key }));
  const chunks: Buffer[] = [];
  for await (const chunk of res.Body as AsyncIterable<Uint8Array>) {
    chunks.push(Buffer.from(chunk));
  }
  const body = Buffer.concat(chunks);
  await dest.send(new PutObjectCommand({
    Bucket: DEST_BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
  }));
}

async function run() {
  if (!process.env.DEST_S3_ENDPOINT) {
    console.error('DEST_S3_ENDPOINT is not set. Add it to .env before migrating.');
    process.exit(1);
  }

  console.log(`Source:      ${process.env.S3_ENDPOINT ?? 'AWS S3'} / ${SRC_BUCKET}`);
  console.log(`Destination: ${process.env.DEST_S3_ENDPOINT} / ${DEST_BUCKET}`);
  console.log(commit ? '▶ COMMIT mode — objects will be copied' : '▶ DRY RUN — pass --commit to actually copy');
  console.log('');

  let total = 0;
  let skipped = 0;
  let copied = 0;
  let failed = 0;
  let token: string | undefined;

  do {
    const list = await src.send(new ListObjectsV2Command({
      Bucket: SRC_BUCKET,
      ContinuationToken: token,
    }));

    for (const obj of list.Contents ?? []) {
      const key = obj.Key!;
      total++;

      const exists = commit ? await objectExists(key) : false;
      if (exists) {
        console.log(`  skip  ${key}`);
        skipped++;
        continue;
      }

      const contentType = key.match(/\.(mp4|mov|webm)$/i)
        ? 'video/mp4'
        : 'image/jpeg';

      if (!commit) {
        console.log(`  would copy  ${key}  (${formatBytes(obj.Size ?? 0)})`);
        continue;
      }

      try {
        await copyObject(key, contentType);
        console.log(`  copied  ${key}  (${formatBytes(obj.Size ?? 0)})`);
        copied++;
      } catch (e) {
        console.error(`  FAILED  ${key}:`, e instanceof Error ? e.message : e);
        failed++;
      }
    }

    token = list.NextContinuationToken;
  } while (token);

  console.log('');
  if (commit) {
    console.log(`Done. ${total} objects — ${copied} copied, ${skipped} skipped, ${failed} failed.`);
    if (failed > 0) {
      console.log('Re-run to retry failed objects (already-copied objects are skipped automatically).');
      process.exit(1);
    }
  } else {
    console.log(`Dry run complete. ${total} objects found.`);
    console.log('Run with --commit to copy them.');
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
