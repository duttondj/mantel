import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';

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
