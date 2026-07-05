'use client';

import { useState, useCallback } from 'react';
import { signOut } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';

type PromoCode = {
  code: string;
  grantsPlan: string;
  durationDays: number | null;
  maxUses: number | null;
  usedCount: number;
  expiresAt: string | null;
  active: boolean;
  createdAt: string;
};

type User = {
  id: string;
  email: string;
  name: string | null;
  plan: string;
  status: string;
  isAdmin: boolean;
  expiresAt: string | null;
  createdAt: string;
  galleryCount: number;
};

type Stats = {
  users: number;
  galleries: number;
  storedBytes: number;
};

function fmtBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 ** 3) return `${(b / 1024 ** 2).toFixed(1)} MB`;
  return `${(b / 1024 ** 3).toFixed(2)} GB`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function AdminClient({
  currentUserId,
  initialUsers,
  initialStats,
  initialPromoCodes,
}: {
  currentUserId: string;
  initialUsers: User[];
  initialStats: Stats;
  initialPromoCodes: PromoCode[];
}) {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [stats, setStats] = useState<Stats>(initialStats);
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>(initialPromoCodes);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  // create user modal
  const [showCreate, setShowCreate] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [newIsAdmin, setNewIsAdmin] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createBusy, setCreateBusy] = useState(false);

  // delete confirm modal
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);

  const reload = useCallback(async () => {
    const [usersRes, statsRes, promoRes] = await Promise.all([
      fetch('/api/admin/users'),
      fetch('/api/admin/stats'),
      fetch('/api/admin/promo'),
    ]);
    if (usersRes.ok) setUsers(await usersRes.json());
    if (statsRes.ok) setStats(await statsRes.json());
    if (promoRes.ok) setPromoCodes(await promoRes.json());
  }, []);

  async function patch(userId: string, body: object) {
    setBusy(userId);
    setError('');
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError((d as { error?: string }).error || 'Something went wrong.');
    } else {
      await reload();
    }
    setBusy(null);
  }

  async function deleteUser(userId: string) {
    setBusy(userId);
    setError('');
    const res = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError((d as { error?: string }).error || 'Could not delete user.');
    } else {
      await reload();
    }
    setBusy(null);
    setDeleteTarget(null);
  }

  async function sendReset(email: string) {
    setBusy(email);
    setError('');
    await fetch('/api/auth/forget-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, redirectTo: `${window.location.origin}/reset-password` }),
    });
    setBusy(null);
    alert(`Password reset email sent to ${email}.`);
  }

  async function createUser() {
    if (!newEmail || !newPassword) {
      setCreateError('Email and password are required.');
      return;
    }
    setCreateBusy(true);
    setCreateError('');
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: newEmail, password: newPassword, name: newName, isAdmin: newIsAdmin }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setCreateError((d as { error?: string }).error || 'Could not create account.');
    } else {
      setShowCreate(false);
      setNewEmail(''); setNewPassword(''); setNewName(''); setNewIsAdmin(false);
      await reload();
    }
    setCreateBusy(false);
  }

  return (
    <div className="wrap">
      <div className="admin-header">
        <h1 className="admin-title">Admin</h1>
        <div className="admin-header-actions">
          <button className="btn btn--sm" onClick={() => router.push('/dashboard')}>
            My dashboard
          </button>
          <button
            className="btn btn--sm btn--ghost"
            onClick={() => signOut().then(() => router.push('/signin'))}
          >
            Sign out
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="admin-stats">
        <div className="admin-stat">
          <span className="admin-stat__n">{stats.users}</span>
          <span className="admin-stat__label">customers</span>
        </div>
        <div className="admin-stat">
          <span className="admin-stat__n">{stats.galleries}</span>
          <span className="admin-stat__label">galleries</span>
        </div>
        <div className="admin-stat">
          <span className="admin-stat__n">{fmtBytes(stats.storedBytes)}</span>
          <span className="admin-stat__label">stored</span>
        </div>
      </div>

      {/* Promo codes */}
      <PromoSection codes={promoCodes} onReload={reload} />

      {/* Users table */}
      <div className="admin-section">
        <div className="admin-section-header">
          <h2 className="admin-section-title">Accounts</h2>
          <button className="btn btn--sm" onClick={() => setShowCreate(true)}>
            + Add account
          </button>
        </div>

        {error && <p className="err" style={{ marginBottom: '1rem' }}>{error}</p>}

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Status</th>
                <th>Plan</th>
                <th>Galleries</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className={busy === u.id ? 'admin-row--busy' : ''}>
                  <td>
                    <span className="admin-email">{u.email}</span>
                    {u.isAdmin && <span className="admin-badge">admin</span>}
                  </td>
                  <td>
                    <span className={`admin-status admin-status--${u.status}`}>{u.status}</span>
                  </td>
                  <td>{u.plan}</td>
                  <td>{u.galleryCount}</td>
                  <td>{fmtDate(u.createdAt)}</td>
                  <td>
                    <div className="admin-actions">
                      <button
                        className="linkbtn"
                        disabled={busy === u.id}
                        onClick={() => patch(u.id, { isAdmin: !u.isAdmin })}
                        title={u.isAdmin ? 'Remove admin' : 'Make admin'}
                      >
                        {u.isAdmin ? 'Demote' : 'Make admin'}
                      </button>
                      <button
                        className="linkbtn"
                        disabled={busy === u.id}
                        onClick={() => patch(u.id, { status: u.status === 'active' ? 'inactive' : 'active' })}
                      >
                        {u.status === 'active' ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        className="linkbtn"
                        disabled={busy === u.email}
                        onClick={() => sendReset(u.email)}
                      >
                        Reset pw
                      </button>
                      <button
                        className="linkbtn linkbtn--danger"
                        disabled={busy === u.id || u.id === currentUserId}
                        onClick={() => setDeleteTarget(u)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create user modal */}
      {showCreate && (
        <div className="modal-bg" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Add account</h3>
            <div className="field">
              <label>Email</label>
              <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
            </div>
            <div className="field">
              <label>Password</label>
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </div>
            <div className="field">
              <label>Name (optional)</label>
              <input value={newName} onChange={(e) => setNewName(e.target.value)} />
            </div>
            <label className="admin-checkbox">
              <input
                type="checkbox"
                checked={newIsAdmin}
                onChange={(e) => setNewIsAdmin(e.target.checked)}
              />
              Grant admin access
            </label>
            {createError && <p className="err">{createError}</p>}
            <div className="modal__row">
              <button className="btn" onClick={createUser} disabled={createBusy}>
                {createBusy ? 'Creating…' : 'Create account'}
              </button>
              <button className="btn btn--ghost" onClick={() => setShowCreate(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {deleteTarget && (
        <div className="modal-bg" onClick={() => setDeleteTarget(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Delete account?</h3>
            <p>
              This permanently deletes <strong>{deleteTarget.email}</strong> and all their galleries.
              This cannot be undone.
            </p>
            <div className="modal__row">
              <button
                className="btn btn--danger"
                onClick={() => deleteUser(deleteTarget.id)}
                disabled={busy === deleteTarget.id}
              >
                {busy === deleteTarget.id ? 'Deleting…' : 'Delete'}
              </button>
              <button className="btn btn--ghost" onClick={() => setDeleteTarget(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---- promo code management ---- */
function PromoSection({ codes, onReload }: { codes: PromoCode[]; onReload: () => Promise<void> }) {
  const [showCreate, setShowCreate] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [forever, setForever] = useState(false);
  const [unlimited, setUnlimited] = useState(true);
  const [maxUses, setMaxUses] = useState('1');
  const [codeExpiresAt, setCodeExpiresAt] = useState('');
  const [createError, setCreateError] = useState('');
  const [createBusy, setCreateBusy] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  async function create() {
    setCreateBusy(true);
    setCreateError('');
    const res = await fetch('/api/admin/promo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: newCode,
        forever,
        maxUses: unlimited ? null : Number(maxUses),
        codeExpiresAt: codeExpiresAt || null,
      }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setCreateError((d as { error?: string }).error || 'Could not create code.');
    } else {
      setShowCreate(false);
      setNewCode(''); setForever(false); setUnlimited(true); setMaxUses('1'); setCodeExpiresAt('');
      await onReload();
    }
    setCreateBusy(false);
  }

  async function toggle(code: string, active: boolean) {
    setBusy(code);
    await fetch(`/api/admin/promo/${encodeURIComponent(code)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active }),
    });
    await onReload();
    setBusy(null);
  }

  async function remove(code: string) {
    if (!confirm(`Delete code "${code}"? This cannot be undone.`)) return;
    setBusy(code);
    await fetch(`/api/admin/promo/${encodeURIComponent(code)}`, { method: 'DELETE' });
    await onReload();
    setBusy(null);
  }

  return (
    <div className="admin-section">
      <div className="admin-section-header">
        <h2 className="admin-section-title">Promo codes</h2>
        <button className="btn btn--sm" onClick={() => setShowCreate(true)}>+ New code</button>
      </div>

      {codes.length === 0 ? (
        <p style={{ color: 'var(--ink-soft)', fontSize: '0.9rem' }}>No promo codes yet.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Grants</th>
                <th>Uses</th>
                <th>Code expires</th>
                <th>Active</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {codes.map((c) => (
                <tr key={c.code} className={busy === c.code ? 'admin-row--busy' : ''}>
                  <td><code style={{ fontSize: '0.85rem' }}>{c.code}</code></td>
                  <td>{c.durationDays === null ? 'Forever' : '1 year'}</td>
                  <td>{c.usedCount}{c.maxUses !== null ? ` / ${c.maxUses}` : ' / ∞'}</td>
                  <td>{c.expiresAt ? fmtDate(c.expiresAt) : '—'}</td>
                  <td>
                    <span className={`admin-status admin-status--${c.active ? 'active' : 'inactive'}`}>
                      {c.active ? 'yes' : 'no'}
                    </span>
                  </td>
                  <td>
                    <div className="admin-actions">
                      <button
                        className="linkbtn"
                        disabled={busy === c.code}
                        onClick={() => toggle(c.code, !c.active)}
                      >
                        {c.active ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        className="linkbtn linkbtn--danger"
                        disabled={busy === c.code}
                        onClick={() => remove(c.code)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <div className="modal-bg" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>New promo code</h3>
            <div className="field">
              <label>Code</label>
              <input
                value={newCode}
                onChange={(e) => setNewCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))}
                placeholder="e.g. WELCOME-2026"
                autoFocus
              />
            </div>

            <div className="field">
              <label>Access granted</label>
              <div style={{ display: 'flex', gap: '1.25rem', marginTop: '0.35rem' }}>
                <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', cursor: 'pointer' }}>
                  <input type="radio" checked={!forever} onChange={() => setForever(false)} />
                  1 year
                </label>
                <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', cursor: 'pointer' }}>
                  <input type="radio" checked={forever} onChange={() => setForever(true)} />
                  Forever
                </label>
              </div>
            </div>

            <div className="field">
              <label>Max redemptions</label>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginTop: '0.35rem', flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', cursor: 'pointer' }}>
                  <input type="checkbox" checked={unlimited} onChange={(e) => setUnlimited(e.target.checked)} />
                  Unlimited
                </label>
                {!unlimited && (
                  <input
                    type="number"
                    min="1"
                    value={maxUses}
                    onChange={(e) => setMaxUses(e.target.value)}
                    style={{ width: '5rem' }}
                  />
                )}
              </div>
            </div>

            <div className="field">
              <label>Code expires on (optional)</label>
              <input
                type="date"
                value={codeExpiresAt}
                onChange={(e) => setCodeExpiresAt(e.target.value)}
              />
            </div>

            {createError && <p className="err">{createError}</p>}
            <div className="modal__row">
              <button className="btn" onClick={create} disabled={createBusy || !newCode}>
                {createBusy ? 'Creating…' : 'Create code'}
              </button>
              <button className="btn btn--ghost" onClick={() => setShowCreate(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
