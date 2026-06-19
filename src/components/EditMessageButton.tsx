'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const MAX = 180;

export function EditMessageButton({
  postId,
  initialMessage,
}: {
  postId: string;
  initialMessage: string | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState(initialMessage ?? '');
  const [busy, setBusy] = useState(false);

  if (!editing) {
    return (
      <div className="post__msg-host">
        {initialMessage && <p className="post__msg">{initialMessage}</p>}
        <button className="mod-btn" onClick={() => setEditing(true)}>
          {initialMessage ? 'Edit message' : 'Add message'}
        </button>
      </div>
    );
  }

  async function save() {
    setBusy(true);
    const res = await fetch(`/api/posts/${postId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: message.trim() || null }),
    });
    if (res.ok) {
      setEditing(false);
      router.refresh();
    }
    setBusy(false);
  }

  function cancel() {
    setEditing(false);
    setMessage(initialMessage ?? '');
  }

  const remaining = MAX - message.length;

  return (
    <div className="post__msg-edit">
      <textarea
        className="post__msg-textarea"
        value={message}
        onChange={(e) => setMessage(e.target.value.slice(0, MAX))}
        rows={3}
        autoFocus
        disabled={busy}
      />
      <div className={'post__msg-chars' + (remaining < 20 ? ' post__msg-chars--low' : '')}>
        {remaining} left
      </div>
      <span className="mod-confirm">
        <button className="mod-btn" onClick={save} disabled={busy}>
          {busy ? 'Saving…' : 'Save'}
        </button>
        <button className="mod-btn" onClick={cancel} disabled={busy}>
          Cancel
        </button>
      </span>
    </div>
  );
}
