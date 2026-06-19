'use client';

import { useState, useRef } from 'react';
import { useLightbox } from './GalleryLightbox';

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
      <video
        key={item.publicId}
        src={`/i/${item.publicId}`}
        controls
        preload="metadata"
        playsInline
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
    return <div className="post__images">{mediaEl(images[0], 0)}</div>;
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
    </div>
  );
}
