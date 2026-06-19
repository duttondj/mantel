import sharp from 'sharp';
import convert from 'heic-convert';
import { nanoid } from 'nanoid';
import { putObject } from './storage.ts';

/*
 * Strip ALL metadata (EXIF, GPS/location, camera info) by re-encoding
 * the image server-side. We never trust the client to do this.
 *
 * Order matters: .rotate() with no args reads the EXIF orientation tag
 * and BAKES the rotation into the pixels. We must do that BEFORE we drop
 * metadata, otherwise photos shot in portrait come out sideways once the
 * orientation tag is gone.
 *
 * sharp drops metadata by default (we do NOT call .withMetadata()), so
 * the output buffer carries no EXIF/GPS at all.
 *
 * HEIC handling: iPhones shoot HEIC by default, but sharp's prebuilt
 * binary ships a libvips WITHOUT the HEVC codec (libde265), so it can
 * parse the container but not decode the pixels — it throws "bad seek".
 * So we detect HEIC by magic bytes and decode it with heic-convert
 * (pure JS) first, then hand the resulting JPEG to the normal sharp
 * path. Everything downstream is identical.
 */

// HEIC/HEIF files are ISO-BMFF: bytes 4-8 are 'ftyp', followed by a
// brand like 'heic', 'heix', 'mif1', 'heif'. We sniff that rather than
// trusting the upload's declared MIME type.
function isHeic(buf: Buffer): boolean {
  if (buf.length < 12) return false;
  if (buf.toString('ascii', 4, 8) !== 'ftyp') return false;
  const brand = buf.toString('ascii', 8, 12);
  return ['heic', 'heix', 'heif', 'mif1', 'hevc', 'hevx'].includes(brand);
}

// Videos are stored as-is — no metadata stripping (no ffmpeg in this stack).
// mimeType must be one of the accepted video/* types from the upload route.
export async function storeVideo(
  input: Buffer,
  mimeType: string
): Promise<{ storageKey: string; publicId: string; fileSize: number }> {
  const ext = mimeType === 'video/mp4' ? 'mp4' : mimeType === 'video/webm' ? 'webm' : 'mov';
  const publicId = nanoid();
  const storageKey = `vid/${publicId}.${ext}`;
  await putObject(storageKey, input, mimeType);
  return { storageKey, publicId, fileSize: input.length };
}

export async function stripAndStore(
  input: Buffer
): Promise<{ storageKey: string; publicId: string; width: number; height: number; fileSize: number }> {
  // HEIC must be decoded to a sharp-readable format first.
  let working = input;
  if (isHeic(input)) {
    working = Buffer.from(
      await convert({ buffer: input, format: 'JPEG', quality: 0.94 })
    );
  }

  const pipeline = sharp(working)
    .rotate() // bake orientation in, then the tag is safe to discard
    .jpeg({ quality: 88, mozjpeg: true }); // normalize everything to jpeg

  const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });

  // publicId: the obfuscation token in the direct image URL.
  // 21 url-safe chars from nanoid ≈ 126 bits — not enumerable.
  const publicId = nanoid();
  const storageKey = `img/${publicId}.jpg`;

  await putObject(storageKey, data, 'image/jpeg');

  return { storageKey, publicId, width: info.width, height: info.height, fileSize: data.length };
}
