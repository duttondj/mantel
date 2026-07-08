import sharp from 'sharp';
import convert from 'heic-convert';
import { nanoid } from 'nanoid';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { putObject } from './storage.ts';

const execFileAsync = promisify(execFile);

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

/*
 * Videos: strip ALL container metadata (including GPS/location — which iPhones
 * embed in moov as an ISO-6709 string) before storing. We use ffmpeg with a
 * stream copy (`-c copy`), so it's a fast remux, NOT a re-encode — no quality
 * loss and low CPU.
 *
 * ffmpeg needs seekable files for the mp4/mov muxer (it writes the moov atom
 * with seek-backs and can't do that on a pipe), so we round-trip through a
 * temp dir rather than piping stdin/stdout. If ffmpeg fails we throw, so the
 * upload route skips the file rather than storing an un-stripped video — a
 * GPS leak must never fall through.
 *
 * mimeType must be one of the accepted video/* types from the upload route.
 */
export async function storeVideo(
  input: Buffer,
  mimeType: string
): Promise<{ storageKey: string; publicId: string; fileSize: number }> {
  const ext = mimeType === 'video/mp4' ? 'mp4' : mimeType === 'video/webm' ? 'webm' : 'mov';
  const publicId = nanoid();
  const storageKey = `vid/${publicId}.${ext}`;

  const dir = await mkdtemp(join(tmpdir(), 'mantel-vid-'));
  const inPath = join(dir, `in.${ext}`);
  const outPath = join(dir, `out.${ext}`);
  try {
    await writeFile(inPath, input);
    await execFileAsync(
      'ffmpeg',
      [
        '-y',
        '-i', inPath,
        '-map_metadata', '-1', // drop all global/container metadata (GPS lives here)
        '-map_chapters', '-1', // drop chapters too
        '-c', 'copy',          // remux only, no re-encode
        outPath,
      ],
      { maxBuffer: 16 * 1024 * 1024 },
    );
    const cleaned = await readFile(outPath);
    await putObject(storageKey, cleaned, mimeType);
    return { storageKey, publicId, fileSize: cleaned.length };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
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
