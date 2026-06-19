'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

function ResetForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) setError('Invalid or missing reset token. Please request a new reset link.');
  }, [token]);

  async function submit() {
    if (!password) { setError('Enter a new password.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setBusy(true);
    setError('');
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPassword: password, token }),
    });
    if (res.ok) {
      setDone(true);
      setTimeout(() => router.push('/signin'), 2000);
    } else {
      const d = await res.json().catch(() => ({}));
      setError((d as { message?: string }).message || 'Could not reset password. The link may have expired.');
    }
    setBusy(false);
  }

  if (done) {
    return (
      <div className="panel">
        <h2>Password updated</h2>
        <p>Your password has been changed. Redirecting to sign in…</p>
      </div>
    );
  }

  return (
    <div className="panel">
      <h2>Choose a new password</h2>
      <div className="field">
        <label htmlFor="pw">New password</label>
        <input
          id="pw"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="confirm">Confirm password</label>
        <input
          id="confirm"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
      </div>
      <button className="btn" onClick={submit} disabled={busy || !token}>
        {busy ? 'Saving…' : 'Set new password'}
      </button>
      {error && <p className="err">{error}</p>}
      <p className="switch">
        <Link href="/signin" className="linkbtn">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="wrap">
      <Suspense fallback={<div className="panel"><p>Loading…</p></div>}>
        <ResetForm />
      </Suspense>
    </div>
  );
}
