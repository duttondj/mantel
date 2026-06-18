'use client';

import { useState } from 'react';

export function LikeButton({
  postId,
  initialCount,
  initialLiked,
}: {
  postId: string;
  initialCount: number;
  initialLiked: boolean;
}) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (busy) return;
    setBusy(true);

    // Optimistic update
    const nextLiked = !liked;
    const nextCount = count + (nextLiked ? 1 : -1);
    setLiked(nextLiked);
    setCount(nextCount);

    try {
      const res = await fetch(`/api/posts/${postId}/like`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setLiked(data.liked);
        setCount(data.count);
      } else {
        // Revert on error
        setLiked(liked);
        setCount(count);
      }
    } catch {
      setLiked(liked);
      setCount(count);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={toggle}
      className={'like-btn' + (liked ? ' like-btn--liked' : '')}
      aria-label={liked ? 'Unlike' : 'Like'}
      disabled={busy}
    >
      <span aria-hidden="true">{liked ? '♥' : '♡'}</span>
      {count > 0 && <span className="like-btn__count">{count}</span>}
    </button>
  );
}
