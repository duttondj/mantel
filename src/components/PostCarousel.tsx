'use client';

import { useState } from 'react';

type Media = { publicId: string; mimeType: string };

export function PostCarousel({ images }: { images: Media[] }) {
  const [idx, setIdx] = useState(0);

  if (images.length === 0) return null;

  const current = images[idx];

  const media = (item: Media) =>
    item.mimeType.startsWith('video/') ? (
      <video
        key={item.publicId}
        src={`/i/${item.publicId}`}
        controls
        preload="metadata"
        playsInline
      />
    ) : (
      <img key={item.publicId} src={`/i/${item.publicId}`} alt="" loading="lazy" />
    );

  if (images.length === 1) {
    return <div className="post__images">{media(images[0])}</div>;
  }

  return (
    <div className="post__images carousel">
      <div className="carousel__slide">{media(current)}</div>

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
