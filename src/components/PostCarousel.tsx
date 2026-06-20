'use client';

import { useState, useRef, useEffect } from 'react';
import { useLightbox } from './GalleryLightbox';

function VideoThumb({ src, style, onClick }: { src: string; style?: React.CSSProperties; onClick?: () => void }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const onSeeked = () => {
      try {
        const c = document.createElement('canvas');
        c.width = v.videoWidth || 320;
        c.height = v.videoHeight || 240;
        c.getContext('2d')?.drawImage(v, 0, 0, c.width, c.height);
        const url = c.toDataURL('image/jpeg', 0.8);
        if (url.length > 100) v.poster = url;
      } catch { /* codec or cross-origin issue */ }
    };
    const onMeta = () => { v.currentTime = 0.001; };
    v.addEventListener('loadedmetadata', onMeta);
    v.addEventListener('seeked', onSeeked);
    return () => {
      v.removeEventListener('loadedmetadata', onMeta);
      v.removeEventListener('seeked', onSeeked);
    };
  }, [src]);

  return (
    <video ref={ref} src={src} controls preload="metadata" playsInline style={style} onClick={onClick} />
  );
}

type Media = { publicId: string; mimeType: string; width?: number | null; height?: number | null };

export function PostCarousel({
  images,
  startIndex,
}: {
  images: Media[];
  startIndex?: number;
}) {
  const [idx, setIdx] = useState(0);
  const touchX = useRef<number | null>(null);
  const lb = useLightbox();

  if (images.length === 0) return null;

  function handleTouchStart(e: React.TouchEvent) {
    touchX.current = e.touches[0].clientX;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchX.current;
    touchX.current = null;
    if (delta < -50 && idx < images.length - 1) setIdx((i) => i + 1);
    else if (delta > 50 && idx > 0) setIdx((i) => i - 1);
  }

  function openLightbox(localIdx: number) {
    if (lb && startIndex !== undefined) lb.openAt(startIndex + localIdx);
  }

  const mediaEl = (item: Media, localIdx: number) => {
    const canOpen = lb && startIndex !== undefined;
    return item.mimeType.startsWith('video/') ? (
      <VideoThumb
        key={item.publicId}
        src={`/i/${item.publicId}`}
        style={canOpen ? { cursor: 'pointer' } : undefined}
        onClick={canOpen ? () => openLightbox(localIdx) : undefined}
      />
    ) : (
      <img
        key={item.publicId}
        src={`/i/${item.publicId}`}
        alt=""
        loading="eager"
        width={item.width ?? undefined}
        height={item.height ?? undefined}
        style={canOpen ? { cursor: 'pointer' } : undefined}
        onClick={canOpen ? () => openLightbox(localIdx) : undefined}
      />
    );
  };

  if (images.length === 1) {
    return (
      <>
        <div className="post__images">{mediaEl(images[0], 0)}</div>
        <div className="post__download-bar">
          <a className="post__download" href={`/i/${images[0].publicId}?download=1`} download>
            Download
          </a>
        </div>
      </>
    );
  }

  return (
    <div
      className="post__images carousel"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {images.map((item, i) => (
        <div
          key={item.publicId}
          className={'carousel__slide' + (i === idx ? ' carousel__slide--active' : '')}
        >
          {mediaEl(item, i)}
        </div>
      ))}

      {idx > 0 && (
        <button
          className="carousel__arrow carousel__arrow--prev"
          onClick={() => setIdx((i) => i - 1)}
          aria-label="Previous"
        >
          ‹
        </button>
      )}
      {idx < images.length - 1 && (
        <button
          className="carousel__arrow carousel__arrow--next"
          onClick={() => setIdx((i) => i + 1)}
          aria-label="Next"
        >
          ›
        </button>
      )}

      <div className="carousel__footer">
        <div className="carousel__dots">
          {images.map((_, i) => (
            <button
              key={i}
              className={'carousel__dot' + (i === idx ? ' carousel__dot--active' : '')}
              onClick={() => setIdx(i)}
              aria-label={`Go to image ${i + 1} of ${images.length}`}
            />
          ))}
        </div>
        <a
          className="post__download"
          href={`/i/${images[idx].publicId}?download=1`}
          download
        >
          Download
        </a>
      </div>
    </div>
  );
}
