'use client';

import { useState } from 'react';

export function UnlockForm({ slug, title }: { slug: string; title: string }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError('');
    const res = await fetch('/api/gallery/unlock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, password }),
    });
    if (res.ok) {
      window.location.reload();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || 'Something went wrong.');
      setBusy(false);
    }
  }

  return (
    <div className="panel">
      <h2>{title}</h2>
      <p>This gallery is private. Enter the password the couple shared with you.</p>
      <div className="field">
        <label htmlFor="pw">Password</label>
        <input
          id="pw"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          autoFocus
        />
      </div>
      <button className="btn" onClick={submit} disabled={busy}>
        {busy ? 'Checking…' : 'Open gallery'}
      </button>
      {error && <p className="err">{error}</p>}
    </div>
  );
}
