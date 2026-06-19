'use client';

import { useState } from 'react';
import { signIn, signUp } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function SignInPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError('');
    try {
      if (mode === 'signup') {
        const { error } = await signUp.email({ email, password, name });
        if (error) throw new Error(error.message || 'Could not create account.');
      } else {
        const { error } = await signIn.email({ email, password });
        if (error) throw new Error(error.message || 'Could not sign in.');
      }
      router.push('/dashboard');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
      setBusy(false);
    }
  }

  return (
    <div className="wrap">
      <div className="panel">
        <h2>{mode === 'signin' ? 'Welcome back' : 'Create your account'}</h2>
        <p>
          {mode === 'signin'
            ? 'Sign in to manage your galleries.'
            : 'Set up galleries for your event and share them with guests.'}
        </p>

        {mode === 'signup' && (
          <div className="field">
            <label htmlFor="name">Your name</label>
            <input id="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
        )}
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="pw">Password</label>
          <input
            id="pw"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
        </div>

        <button className="btn" onClick={submit} disabled={busy}>
          {busy ? 'Just a moment…' : mode === 'signin' ? 'Sign in' : 'Create account'}
        </button>
        {error && <p className="err">{error}</p>}

        {mode === 'signin' && (
          <p className="switch">
            <Link href="/forgot-password" className="linkbtn">
              Forgot your password?
            </Link>
          </p>
        )}

        <p className="switch">
          {mode === 'signin' ? (
            <>
              New here?{' '}
              <button className="linkbtn" onClick={() => setMode('signup')}>
                Create an account
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button className="linkbtn" onClick={() => setMode('signin')}>
                Sign in
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
