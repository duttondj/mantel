'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const MAX_FILES = 5;
const MAX_MESSAGE = 180;
const NAME_COOKIE = 'mantel_guest_name';
const ACCEPTED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];

type Preview = { file: File; url: string; id: string };

function readNameCookie(): string {
  if (typeof document === 'undefined') return '';
  const match = document.cookie
    .split('; ')
    .find((c) => c.startsWith(`${NAME_COOKIE}=`));
  return match ? decodeURIComponent(match.split('=')[1]) : '';
}

export function UploadComposer({ slug, uploadsClosed }: { slug: string; uploadsClosed?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [previews, setPreviews] = useState<Preview[]>([]);
  const [message, setMessage] = useState('');
  const [name, setName] = useState('');
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // prefill the remembered name once the modal opens
  useEffect(() => {
    if (open) setName(readNameCookie());
  }, [open]);

  // revoke object URLs on unmount / when previews change, to avoid leaks
  useEffect(() => {
    return () => previews.forEach((p) => URL.revokeObjectURL(p.url));
  }, [previews]);

  const addFiles = useCallback(
    (incoming: FileList | File[]) => {
      setError('');
      const accepted = Array.from(incoming).filter(
        (f) => f.type.startsWith('image/') || ACCEPTED_VIDEO_TYPES.includes(f.type)
      );
      if (accepted.length === 0) {
        setError("Those files don't look like photos or videos.");
        return;
      }
      setPreviews((prev) => {
        const room = MAX_FILES - prev.length;
        if (room <= 0) {
          setError(`You can add up to ${MAX_FILES} files per post.`);
          return prev;
        }
        const take = accepted.slice(0, room);
        if (accepted.length > room)
          setError(`Only the first ${room} were added — ${MAX_FILES} files max per post.`);
        const next = take.map((file) => ({
          file,
          url: URL.createObjectURL(file),
          id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 7)}`,
        }));
        return [...prev, ...next];
      });
    },
    []
  );

  function removePreview(id: string) {
    setPreviews((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((p) => p.id !== id);
    });
  }

  function reset() {
    previews.forEach((p) => URL.revokeObjectURL(p.url));
    setPreviews([]);
    setMessage('');
    setError('');
    setBusy(false);
  }

  function close() {
    if (busy) return;
    reset();
    setOpen(false);
  }

  async function submit() {
    if (previews.length === 0) {
      setError('Add at least one photo or video.');
      return;
    }
    setBusy(true);
    setError('');

    const fd = new FormData();
    fd.set('slug', slug);
    fd.set('message', message.trim());
    fd.set('guestName', name.trim());
    previews.forEach((p) => fd.append('files', p.file));

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Upload failed. Please try again.');
      }
      // remember the name for next time (1 year)
      if (name.trim()) {
        document.cookie = `${NAME_COOKIE}=${encodeURIComponent(name.trim())}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
      }
      reset();
      setOpen(false);
      router.refresh(); // re-fetch the gallery so the new post appears
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
      setBusy(false);
    }
  }

  const remaining = MAX_MESSAGE - message.length;

  return (
    <>
      <div className="upload-cta">
        {uploadsClosed ? (
          <p className="upload-closed">Uploads for this gallery have closed.</p>
        ) : (
          <button className="btn btn--sm" onClick={() => setOpen(true)}>
            Add photos &amp; videos
          </button>
        )}
      </div>

      {open && (
        <div className="modal-bg" onClick={close}>
          <div
            className="modal modal--upload"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>Add photos & videos</h3>

            {/* drop zone / picker */}
            <div
              className={'dropzone' + (dragging ? ' dropzone--active' : '')}
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                addFiles(e.dataTransfer.files);
              }}
            >
              <p className="dropzone__text">
                {previews.length === 0
                  ? 'Tap to choose photos or videos, or drag them here'
                  : `${previews.length} of ${MAX_FILES} added — tap to add more`}
              </p>
              <input
                ref={inputRef}
                type="file"
                accept="image/*,video/mp4,video/quicktime,video/webm"
                multiple
                hidden
                onChange={(e) => {
                  if (e.target.files) addFiles(e.target.files);
                  e.target.value = ''; // allow re-picking the same file
                }}
              />
            </div>

            {previews.length > 0 && (
              <div className="thumbs">
                {previews.map((p) => (
                  <div className="thumb" key={p.id}>
                    {p.file.type.startsWith('video/') ? (
                      <video src={p.url} preload="metadata" muted playsInline />
                    ) : (
                      <img src={p.url} alt="" />
                    )}
                    <button
                      className="thumb__x"
                      onClick={() => removePreview(p.id)}
                      aria-label="Remove"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="field">
              <label htmlFor="msg">Message (optional)</label>
              <textarea
                id="msg"
                rows={2}
                value={message}
                maxLength={MAX_MESSAGE}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Say something about these…"
              />
              <div className={'counter' + (remaining <= 20 ? ' counter--low' : '')}>
                {remaining}
              </div>
            </div>

            <div className="field">
              <label htmlFor="nm">Your name (optional)</label>
              <input
                id="nm"
                value={name}
                maxLength={80}
                onChange={(e) => setName(e.target.value)}
                placeholder="So others know who shared these"
              />
            </div>

            {error && <p className="err">{error}</p>}

            <p className="upload-privacy">
              Photos are stored privately for this gallery. GPS and location data are
              removed automatically.{' '}
              <a href="/privacy" target="_blank" rel="noreferrer">Privacy policy</a>
            </p>

            <div className="modal__row">
              <button className="btn btn--ghost btn--sm" onClick={close} disabled={busy}>
                Cancel
              </button>
              <button
                className="btn btn--sm"
                onClick={submit}
                disabled={busy || previews.length === 0}
              >
                {busy ? 'Posting…' : 'Post'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
