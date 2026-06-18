'use client';

import { useState } from 'react';

/*
 * Per-image share controls.
 *
 * Reality check on the platforms:
 *  - Download: works everywhere. On mobile this is also the real path to
 *    Instagram (save photo, then post it), since Instagram has NO web
 *    "share to feed" URL — it does not exist.
 *  - X / Facebook: their web sharers take a LINK, not an image file, so
 *    we share the image's public URL.
 *  - Copy link: the obfuscated /i/<publicId> URL.
 *  - "Save for Instagram": honest label — it downloads, because that's
 *    the only thing the browser can actually do for Instagram.
 */
export function ShareButtons({ publicId }: { publicId: string }) {
  const [copied, setCopied] = useState(false);
  const imageUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/i/${publicId}`
      : `/i/${publicId}`;

  async function download() {
    const res = await fetch(`/i/${publicId}`);
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `photo-${publicId}.jpg`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function copyLink() {
    await navigator.clipboard.writeText(imageUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  // Use the native share sheet if available (best mobile experience —
  // this CAN hand a file to Instagram on supported devices).
  async function nativeShare() {
    try {
      const res = await fetch(`/i/${publicId}`);
      const blob = await res.blob();
      const file = new File([blob], `photo-${publicId}.jpg`, { type: blob.type });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] });
        return;
      }
    } catch {
      /* fall through to download */
    }
    download();
  }

  const x = `https://twitter.com/intent/tweet?url=${encodeURIComponent(imageUrl)}`;
  const fb = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(imageUrl)}`;

  return (
    <div className="share">
      <button onClick={nativeShare} className="share__btn">Share</button>
      <button onClick={download} className="share__btn">Download</button>
      <button onClick={copyLink} className="share__btn">
        {copied ? 'Copied' : 'Copy link'}
      </button>
      <a href={x} target="_blank" rel="noreferrer" className="share__btn">X</a>
      <a href={fb} target="_blank" rel="noreferrer" className="share__btn">Facebook</a>
    </div>
  );
}
