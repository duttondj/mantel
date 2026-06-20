'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from '@/lib/auth-client';
import { QR } from '@/components/QR';

type Gallery = {
  id: string;
  title: string;
  slug: string;
  hasPassword: boolean;
  uploadsClosedAt: string | null;
  postCount: number;
  viewCount: number;
  downloadCount: number;
};

export function DashboardClient({
  email,
  active,
  plan,
  expiresAt,
}: {
  email: string;
  active: boolean;
  plan: string;
  expiresAt: string | null;
}) {
  const router = useRouter();
  const [galleries, setGalleries] = useState<Gallery[]>([]);
  const [loading, setLoading] = useState(true);
  const [origin, setOrigin] = useState('');
  const [paymentBanner, setPaymentBanner] = useState(false);

  // modals
  const [showCreate, setShowCreate] = useState(false);
  const [pwModal, setPwModal] = useState<Gallery | null>(null);
  const [deleteModal, setDeleteModal] = useState<Gallery | null>(null);
  const [showChangePw, setShowChangePw] = useState(false);

  useEffect(() => setOrigin(window.location.origin), []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') === 'success') {
      setPaymentBanner(true);
      window.history.replaceState({}, '', '/dashboard');
    }
  }, []);

  const load = useCallback(async () => {
    const res = await fetch('/api/galleries');
    if (res.ok) {
      const data = await res.json();
      setGalleries(data.galleries);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (active) load();
    else setLoading(false);
  }, [active, load]);

  async function handleSignOut() {
    await signOut();
    router.push('/signin');
  }

  const expiryLabel = expiresAt
    ? new Date(expiresAt).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;

  return (
    <>
      <div className="topbar">
        <a className="topbar__brand" href="/dashboard">Mantel</a>
        <div className="topbar__right">
          <span className="topbar__email">{email}</span>
          <button className="linkbtn" onClick={() => setShowChangePw(true)}>Change password</button>
          <button className="linkbtn" onClick={handleSignOut}>Sign out</button>
        </div>
      </div>

      <div className="dash">
        {paymentBanner && (
          <div className="banner" style={{ background: '#e8f5e9' }}>
            <span className="banner__text">
              Payment received — your account is now active. Welcome to Mantel!
            </span>
          </div>
        )}
        {!active && paymentBanner ? (
          <PaymentProcessingPanel />
        ) : !active ? (
          <ActivatePanel onActivated={() => router.refresh()} />
        ) : (
          <>
            <div className="banner">
              <span className="banner__text">
                Your account is <strong>active</strong>
                {expiryLabel
                  ? <> — hosting through <strong>{expiryLabel}</strong>.</>
                  : <> — <strong>lifetime access</strong>.</>
                }
                {plan === 'comped' && <> (comped)</>}
              </span>
            </div>

            <div className="dash__head">
              <h1 className="dash__title">Your galleries</h1>
              <button className="btn btn--sm" onClick={() => setShowCreate(true)}>
                New gallery
              </button>
            </div>

            {loading ? (
              <p className="banner__text">Loading…</p>
            ) : galleries.length === 0 ? (
              <div className="empty">
                <h3>No galleries yet</h3>
                <p>Create one, then share its link or QR code with your guests.</p>
                <div style={{ marginTop: '1.2rem' }}>
                  <button className="btn btn--sm" onClick={() => setShowCreate(true)}>
                    Create your first gallery
                  </button>
                </div>
              </div>
            ) : (
              <div className="gallery-grid">
                {galleries.map((g) => {
                  const link = `${origin}/g/${g.slug}`;
                  return (
                    <div className="gcard" key={g.id}>
                      <h2 className="gcard__title">{g.title}</h2>
                      <div className="gcard__meta">
                        <span className={'pill ' + (g.hasPassword ? 'pill--locked' : 'pill--open')}>
                          {g.hasPassword ? 'Password' : 'Open'}
                        </span>
                        <span>{g.postCount} {g.postCount === 1 ? 'post' : 'posts'}</span>
                        <span>{g.viewCount} {g.viewCount === 1 ? 'view' : 'views'}</span>
                        {g.downloadCount > 0 && (
                          <span>{g.downloadCount} {g.downloadCount === 1 ? 'download' : 'downloads'}</span>
                        )}
                      </div>

                      {origin && <QR url={link} label={g.title} />}

                      <div className="gcard__link">{link}</div>
                      <div className="gcard__actions">
                        <button
                          className="btn btn--ghost btn--sm"
                          onClick={() => navigator.clipboard.writeText(link)}
                        >
                          Copy link
                        </button>
                        <a className="btn btn--ghost btn--sm" href={`/g/${g.slug}`} target="_blank" rel="noreferrer">
                          View
                        </a>
                        <button className="btn btn--ghost btn--sm" onClick={() => setPwModal(g)}>
                          {g.hasPassword ? 'Change password' : 'Add password'}
                        </button>
                      </div>
                      <div className="gcard__footer">
                        <a className="linkbtn" href={`/api/galleries/${g.id}/download`}>
                          Download all photos &amp; videos
                        </a>
                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                          {!g.uploadsClosedAt && (
                            <CloseUploadsButton galleryId={g.id} onClosed={load} />
                          )}
                          <button className="gcard__danger" onClick={() => setDeleteModal(g)}>
                            Delete gallery
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {showChangePw && (
        <ChangePasswordModal onClose={() => setShowChangePw(false)} />
      )}

      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            load();
          }}
        />
      )}
      {pwModal && (
        <PasswordModal
          gallery={pwModal}
          onClose={() => setPwModal(null)}
          onSaved={() => {
            setPwModal(null);
            load();
          }}
        />
      )}
      {deleteModal && (
        <DeleteGalleryModal
          gallery={deleteModal}
          onClose={() => setDeleteModal(null)}
          onDeleted={() => {
            setDeleteModal(null);
            load();
          }}
        />
      )}
    </>
  );
}

/* ---- shown when redirected back from Square before webhook fires ---- */
function PaymentProcessingPanel() {
  const router = useRouter();
  useEffect(() => {
    const interval = setInterval(async () => {
      const res = await fetch('/api/me');
      if (res.ok) {
        const data = await res.json();
        if (data.active) {
          clearInterval(interval);
          router.refresh();
        }
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [router]);

  return (
    <div className="panel" style={{ margin: '2rem auto', textAlign: 'center' }}>
      <h2>Completing your purchase…</h2>
      <p style={{ color: 'var(--ink-soft)' }}>Confirming your payment with Square. This takes just a moment.</p>
    </div>
  );
}

/* ---- account activation — purchase or promo code ---- */
function ActivatePanel({ onActivated }: { onActivated: () => void }) {
  const [code, setCode] = useState('');
  const [promoError, setPromoError] = useState('');
  const [promoBusy, setPromoBusy] = useState(false);
  const [buyBusy, setBuyBusy] = useState(false);
  const [buyError, setBuyError] = useState('');

  async function buy() {
    setBuyBusy(true);
    setBuyError('');
    try {
      const res = await fetch('/api/square/checkout', { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setBuyError(data.error || 'Could not start checkout.');
        setBuyBusy(false);
        return;
      }
      const { url } = await res.json();
      window.location.href = url;
    } catch {
      setBuyError('Could not start checkout.');
      setBuyBusy(false);
    }
  }

  async function redeem() {
    setPromoBusy(true);
    setPromoError('');
    const res = await fetch('/api/promo/redeem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    if (res.ok) onActivated();
    else {
      const data = await res.json().catch(() => ({}));
      setPromoError(data.error || 'Could not redeem that code.');
      setPromoBusy(false);
    }
  }

  return (
    <div className="panel" style={{ margin: '2rem auto' }}>
      <h2>Activate your account</h2>
      <p>Get a year of Mantel hosting — create unlimited galleries, share with all your guests.</p>

      <button className="btn" style={{ width: '100%', marginBottom: '0.5rem' }} onClick={buy} disabled={buyBusy}>
        {buyBusy ? 'Redirecting to checkout…' : 'Purchase 1 year — $20'}
      </button>
      {buyError && <p className="err">{buyError}</p>}

      <p style={{ textAlign: 'center', color: 'var(--ink-soft)', fontSize: '0.85rem', margin: '1.25rem 0 1rem' }}>
        — or —
      </p>

      <p style={{ fontSize: '0.9rem', color: 'var(--ink-soft)', marginBottom: '0.75rem' }}>Have a promo code?</p>
      <div className="field">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && redeem()}
          placeholder="Enter your code"
        />
      </div>
      <button className="btn btn--ghost" onClick={redeem} disabled={promoBusy || !code}>
        {promoBusy ? 'Checking…' : 'Redeem code'}
      </button>
      {promoError && <p className="err">{promoError}</p>}
    </div>
  );
}

/* ---- create gallery ---- */
function CreateModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    setError('');
    const res = await fetch('/api/galleries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, password: password || undefined }),
    });
    if (res.ok) onCreated();
    else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || 'Could not create gallery.');
      setBusy(false);
    }
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>New gallery</h3>
        <div className="field">
          <label htmlFor="t">Gallery name</label>
          <input
            id="t"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Sarah & Tom"
            autoFocus
          />
        </div>
        <div className="field">
          <label htmlFor="p">Password (optional)</label>
          <input
            id="p"
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Leave blank for an open gallery"
          />
        </div>
        {error && <p className="err">{error}</p>}
        <div className="modal__row">
          <button className="btn btn--ghost btn--sm" onClick={onClose}>Cancel</button>
          <button className="btn btn--sm" onClick={create} disabled={busy}>
            {busy ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---- set / change / remove password ---- */
function PasswordModal({
  gallery,
  onClose,
  onSaved,
}: {
  gallery: Gallery;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function save(removing = false) {
    setBusy(true);
    setError('');
    const res = await fetch(`/api/galleries/${gallery.id}/password`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: removing ? '' : password }),
    });
    if (res.ok) onSaved();
    else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || 'Could not save.');
      setBusy(false);
    }
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{gallery.hasPassword ? 'Change password' : 'Add password'}</h3>
        <p className="banner__text" style={{ marginBottom: '1rem' }}>
          Guests will need this to view <strong>{gallery.title}</strong>. Direct photo
          links will redirect to the password prompt.
        </p>
        <div className="field">
          <label htmlFor="np">New password</label>
          <input
            id="np"
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
          />
        </div>
        {error && <p className="err">{error}</p>}
        <div className="modal__row">
          {gallery.hasPassword && (
            <button
              className="btn btn--ghost btn--sm"
              onClick={() => save(true)}
              disabled={busy}
            >
              Remove password
            </button>
          )}
          <button className="btn btn--ghost btn--sm" onClick={onClose}>Cancel</button>
          <button className="btn btn--sm" onClick={() => save(false)} disabled={busy || !password}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---- delete gallery (destructive — requires typing the name) ---- */
function DeleteGalleryModal({
  gallery,
  onClose,
  onDeleted,
}: {
  gallery: Gallery;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const matches = confirm.trim() === gallery.title.trim();

  async function remove() {
    if (!matches) return;
    setBusy(true);
    setError('');
    const res = await fetch(`/api/galleries/${gallery.id}`, { method: 'DELETE' });
    if (res.ok) onDeleted();
    else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || 'Could not delete.');
      setBusy(false);
    }
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Delete gallery</h3>
        <p className="banner__text" style={{ marginBottom: '1rem' }}>
          This permanently deletes <strong>{gallery.title}</strong> and all{' '}
          {gallery.postCount} {gallery.postCount === 1 ? 'post' : 'posts'} in it,
          including every photo. This can't be undone.
        </p>
        <div className="field">
          <label htmlFor="confirm">
            Type the gallery name to confirm
          </label>
          <input
            id="confirm"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={gallery.title}
            autoFocus
          />
        </div>
        {error && <p className="err">{error}</p>}
        <div className="modal__row">
          <button className="btn btn--ghost btn--sm" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            className="btn btn--sm"
            onClick={remove}
            disabled={busy || !matches}
            style={!matches ? { opacity: 0.5 } : undefined}
          >
            {busy ? 'Deleting…' : 'Delete forever'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---- close uploads for a gallery ---- */
function CloseUploadsButton({
  galleryId,
  onClosed,
}: {
  galleryId: string;
  onClosed: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button className="gcard__danger" onClick={() => setConfirming(true)}>
        Close uploads
      </button>
    );
  }

  async function confirm() {
    setBusy(true);
    await fetch(`/api/galleries/${galleryId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uploadsClosedAt: new Date().toISOString() }),
    });
    onClosed();
  }

  return (
    <span style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center', fontSize: '0.78rem', color: 'var(--ink-soft)' }}>
      Close uploads?
      <button className="mod-btn mod-btn--danger" onClick={confirm} disabled={busy}>
        {busy ? '…' : 'Yes'}
      </button>
      <button className="mod-btn" onClick={() => setConfirming(false)} disabled={busy}>
        No
      </button>
    </span>
  );
}

/* ---- change password modal ---- */
function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function submit() {
    if (!current || !next) { setError('Fill in all fields.'); return; }
    if (next.length < 8) { setError('New password must be at least 8 characters.'); return; }
    if (next !== confirm) { setError('Passwords do not match.'); return; }
    setBusy(true);
    setError('');
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: current, newPassword: next, revokeOtherSessions: false }),
    });
    if (res.ok) {
      setDone(true);
    } else {
      const d = await res.json().catch(() => ({}));
      setError((d as { message?: string }).message || 'Could not change password. Check your current password and try again.');
      setBusy(false);
    }
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Change password</h3>
        {done ? (
          <>
            <p style={{ color: 'var(--ink-soft)' }}>Your password has been updated.</p>
            <div className="modal__row">
              <button className="btn btn--sm" onClick={onClose}>Done</button>
            </div>
          </>
        ) : (
          <>
            <div className="field">
              <label htmlFor="cpw-cur">Current password</label>
              <input id="cpw-cur" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoFocus />
            </div>
            <div className="field">
              <label htmlFor="cpw-new">New password</label>
              <input id="cpw-new" type="password" value={next} onChange={(e) => setNext(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="cpw-confirm">Confirm new password</label>
              <input
                id="cpw-confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
              />
            </div>
            {error && <p className="err">{error}</p>}
            <div className="modal__row">
              <button className="btn btn--ghost btn--sm" onClick={onClose} disabled={busy}>Cancel</button>
              <button className="btn btn--sm" onClick={submit} disabled={busy}>
                {busy ? 'Saving…' : 'Update password'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
