'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/*
 * Host-only "remove post" control, shown on each post when the viewer
 * owns the gallery. Two-step (asks to confirm) so a post isn't deleted
 * by a stray tap.
 */
export function DeletePostButton({ postId }: { postId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function remove() {
    setBusy(true);
    const res = await fetch(`/api/posts/${postId}`, { method: 'DELETE' });
    if (res.ok) {
      router.refresh();
    } else {
      setBusy(false);
      setConfirming(false);
    }
  }

  if (!confirming) {
    return (
      <button className="mod-btn" onClick={() => setConfirming(true)}>
        Remove
      </button>
    );
  }

  return (
    <span className="mod-confirm">
      <span>Remove this post?</span>
      <button className="mod-btn mod-btn--danger" onClick={remove} disabled={busy}>
        {busy ? 'Removing…' : 'Yes'}
      </button>
      <button className="mod-btn" onClick={() => setConfirming(false)} disabled={busy}>
        No
      </button>
    </span>
  );
}
