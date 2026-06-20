import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/*
 * One S3 client, pointed at MinIO today. To migrate to AWS S3 /
 * Cloudflare R2 / Backblaze B2 later, change only these env vars —
 * no code changes. `forcePathStyle` is what MinIO needs; real S3 and
 * R2 accept it fine too, so it's safe to leave on.
 */
export const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION || 'us-east-1',
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY!,
    secretAccessKey: process.env.S3_SECRET_KEY!,
  },
});

const BUCKET = process.env.S3_BUCKET || 'photos';

export async function putObject(key: string, body: Buffer, contentType: string) {
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
}

export async function getObjectStream(key: string, range?: string) {
  const res = await s3.send(
    new GetObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ...(range ? { Range: range } : {}),
    })
  );
  return res; // res.Body is a stream; res.ContentType, res.ContentRange, res.ContentLength available
}

export async function deleteObject(key: string) {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

/*
 * Returns true when S3_ENDPOINT is a public HTTPS cloud endpoint (R2, B2, AWS S3).
 * False when using the local MinIO container (http://minio:...), which isn't
 * reachable by browsers — in that case the image route streams bytes instead.
 */
export function isCloudStorage(): boolean {
  const endpoint = process.env.S3_ENDPOINT ?? '';
  return endpoint.startsWith('https://');
}

/*
 * Generates a short-lived presigned GET URL so the browser can fetch
 * media directly from cloud storage, bypassing the app server entirely.
 * Only call this when isCloudStorage() is true.
 */
export async function getPresignedUrl(
  key: string,
  expiresIn = 900,
  disposition?: string,
): Promise<string> {
  const cmd = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ...(disposition ? { ResponseContentDisposition: disposition } : {}),
  });
  return getSignedUrl(s3, cmd, { expiresIn });
}
