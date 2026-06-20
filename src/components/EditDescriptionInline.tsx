'use client';

import { useState } from 'react';

const MAX = 300;

export function EditDescriptionInline({
  galleryId,
  initialDescription,
}: {
  galleryId: string;
  initialDescription: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [description, setDescription] = useState(initialDescription ?? '');
  const [saved, setSaved] = useState(initialDescription);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const val = description.trim() || null;
    const res = await fetch(`/api/galleries/${galleryId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: val }),
    });
    if (res.ok) {
      setSaved(val);
      setDescription(val ?? '');
      setEditing(false);
    }
    setBusy(false);
  }

  function cancel() {
    setEditing(false);
    setDescription(saved ?? '');
  }

  if (!editing) {
    return (
      <div className="gallery-desc">
        {saved
          ? <p className="masthead__sub">{saved}</p>
          : <p className="gallery-desc__placeholder">Add a welcome message…</p>
        }
        <button className="mod-btn gallery-desc__edit" onClick={() => setEditing(true)}>
          {saved ? 'Edit' : 'Add message'}
        </button>
      </div>
    );
  }

  const remaining = MAX - description.length;

  return (
    <div className="gallery-desc gallery-desc--editing">
      <textarea
        className="gallery-desc__textarea"
        value={description}
        onChange={(e) => setDescription(e.target.value.slice(0, MAX))}
        placeholder="Welcome message shown at the top of your gallery"
        rows={3}
        autoFocus
        disabled={busy}
      />
      <div className={'post__msg-chars' + (remaining < 30 ? ' post__msg-chars--low' : '')}>
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
