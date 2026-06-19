'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

export type LightboxImage = {
  publicId: string;
  mimeType: string;
  guestName: string | null;
  message: string | null;
};

type LightboxCtx = { openAt: (index: number) => void };

export const LightboxContext = createContext<LightboxCtx | null>(null);

export function GalleryLightbox({
  allImages,
  children,
}: {
  allImages: LightboxImage[];
  children: React.ReactNode;
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [slideshow, setSlideshow] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const close = useCallback(() => {
    setActiveIndex(null);
    setSlideshow(false);
  }, []);

  const next = useCallback(() => {
    setActiveIndex((i) => (i !== null ? (i + 1) % allImages.length : null));
  }, [allImages.length]);

  const prev = useCallback(() => {
    setActiveIndex((i) => (i !== null ? (i - 1 + allImages.length) % allImages.length : null));
  }, [allImages.length]);

  // Keyboard navigation
  useEffect(() => {
    if (activeIndex === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeIndex, close, next, prev]);

  // Slideshow interval
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (!slideshow || activeIndex === null) return;
    intervalRef.current = setInterval(next, 4000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [slideshow, activeIndex, next]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = activeIndex !== null ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [activeIndex]);

  const current = activeIndex !== null ? allImages[activeIndex] : null;

  function fileExt(mimeType: string) {
    if (mimeType.startsWith('video/')) return mimeType.split('/')[1] || 'mp4';
    if (mimeType.includes('jpeg')) return 'jpg';
    return mimeType.split('/')[1] || 'bin';
  }

  return (
    <LightboxContext.Provider value={{ openAt: setActiveIndex }}>
      {children}
      {current !== null && activeIndex !== null && (
        <div className="lightbox" onClick={close} role="dialog" aria-modal="true">
          <button className="lightbox__close" onClick={close} aria-label="Close">✕</button>

          {allImages.length > 1 && (
            <>
              <button
                className="lightbox__arrow lightbox__arrow--prev"
                onClick={(e) => { e.stopPropagation(); prev(); }}
                aria-label="Previous"
              >‹</button>
              <button
                className="lightbox__arrow lightbox__arrow--next"
                onClick={(e) => { e.stopPropagation(); next(); }}
                aria-label="Next"
              >›</button>
            </>
          )}

          <div className="lightbox__media" onClick={(e) => e.stopPropagation()}>
            {current.mimeType.startsWith('video/') ? (
              <video
                key={current.publicId}
                src={`/i/${current.publicId}`}
                controls
                autoPlay
                playsInline
              />
            ) : (
              <img key={current.publicId} src={`/i/${current.publicId}`} alt="" />
            )}
          </div>

          <div className="lightbox__bar" onClick={(e) => e.stopPropagation()}>
            <div className="lightbox__meta">
              {current.guestName && (
                <span className="lightbox__author">{current.guestName}</span>
              )}
              {current.message && (
                <span className="lightbox__caption">{current.message}</span>
              )}
            </div>
            <div className="lightbox__actions">
              <a
                className="lightbox__btn"
                href={`/i/${current.publicId}?download=1`}
                download={`photo.${fileExt(current.mimeType)}`}
                onClick={(e) => e.stopPropagation()}
              >
                Download
              </a>
              {allImages.length > 1 && (
                <button
                  className="lightbox__btn"
                  onClick={() => setSlideshow((s) => !s)}
                >
                  {slideshow ? 'Pause' : 'Slideshow'}
                </button>
              )}
            </div>
            {allImages.length > 1 && (
              <div className="lightbox__counter">
                {activeIndex + 1} / {allImages.length}
              </div>
            )}
          </div>
        </div>
      )}
    </LightboxContext.Provider>
  );
}

export function useLightbox() {
  return useContext(LightboxContext);
}
