/*
 * Client-side image metadata stripping.
 *
 * Photos picked from an iPhone's Photo Library arrive as JPEG — iOS transcodes
 * HEIC on the way out whenever the file input's `accept` excludes HEIC (see
 * UploadComposer). We re-encode those through a canvas here, which drops ALL
 * metadata (GPS, EXIF, timestamps) before the bytes ever leave the browser.
 *
 * This is what makes direct-to-R2 uploads a real option: storage never has to
 * see location data, and the app server no longer has to process every photo.
 * For now the server-side strip in src/lib/images.ts stays as a backstop
 * (defense-in-depth) and still handles anything we can't strip here.
 *
 * GOTCHA — the same one CLAUDE.md flags for the server: orientation lives in
 * the EXIF we're deleting. We MUST bake it into the pixels before dropping
 * metadata, or portrait phone photos come out sideways.
 * `createImageBitmap(file, { imageOrientation: 'from-image' })` applies the
 * EXIF orientation to the decoded pixels; the re-encode then produces an
 * upright image with no orientation tag. Do not remove that option.
 */

// A browser canvas can decode these. It CANNOT decode HEIC/HEIF.
const STRIPPABLE = new Set(['image/jpeg', 'image/png', 'image/webp']);

/** True when we can re-encode (and thus strip) this file in the browser. */
export function canStripInBrowser(file: File): boolean {
  return STRIPPABLE.has(file.type.toLowerCase());
}

/** True for HEIC/HEIF, which no browser canvas can decode. */
export function isHeic(file: File): boolean {
  const type = file.type.toLowerCase();
  return type === 'image/heic' || type === 'image/heif' || /\.hei[cf]$/i.test(file.name);
}

/**
 * Re-encode an image to a metadata-free JPEG. Only call when
 * canStripInBrowser(file) is true. Throws if decode/encode fails so callers
 * can fall back to the server-side strip.
 */
export async function stripImageMetadata(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get a 2D canvas context.');
    ctx.drawImage(bitmap, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.9),
    );
    if (!blob) throw new Error('Canvas re-encode returned no data.');
    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() });
  } finally {
    bitmap.close();
  }
}
