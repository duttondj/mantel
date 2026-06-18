'use client';

import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';

/*
 * Renders a QR for the given URL into a canvas, client-side, and offers a
 * download as a PNG so the host can print it on a place card or sign.
 */
export function QR({ url, size = 132, label }: { url: string; size?: number; label?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (ref.current) {
      QRCode.toCanvas(ref.current, url, {
        width: size,
        margin: 1,
        color: { dark: '#221d18', light: '#ffffff' },
      });
    }
  }, [url, size]);

  function download() {
    // Render at a larger size for print quality, then trigger a download.
    QRCode.toDataURL(url, { width: 1024, margin: 2, color: { dark: '#221d18', light: '#ffffff' } })
      .then((dataUrl) => {
        const a = document.createElement('a');
        a.href = dataUrl;
        const safe = (label || 'gallery').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
        a.download = `mantel-qr-${safe}.png`;
        a.click();
      })
      .catch(() => {/* ignore */});
  }

  return (
    <div>
      <div className="qr">
        <canvas ref={ref} />
      </div>
      <button className="qr-download" onClick={download}>
        Download QR (PNG)
      </button>
    </div>
  );
}
