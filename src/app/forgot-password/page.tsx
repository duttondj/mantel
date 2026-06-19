'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (!email) return;
    setBusy(true);
    setError('');
    try {
      await fetch('/api/auth/forget-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          redirectTo: `${window.location.origin}/reset-password`,
        }),
      });
      // Always show success to avoid leaking which emails are registered
      setSent(true);
    } catch {
      setError('Something went wrong. Please try again.');
    }
    setBusy(false);
  }

  return (
    <div className="wrap">
      <div className="panel">
        <h2>Reset your password</h2>
        {sent ? (
          <>
            <p>
              If an account exists for <strong>{email}</strong>, you will receive a password
              reset email shortly.
            </p>
            <p>
              <Link href="/signin" className="linkbtn">
                Back to sign in
              </Link>
            </p>
          </>
        ) : (
          <>
            <p>Enter your email address and we will send you a reset link.</p>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
              />
            </div>
            <button className="btn" onClick={submit} disabled={busy}>
              {busy ? 'Sending…' : 'Send reset link'}
            </button>
            {error && <p className="err">{error}</p>}
            <p className="switch">
              <Link href="/signin" className="linkbtn">
                Back to sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
