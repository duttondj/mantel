import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <div className="wrap">
      <div className="privacy">
        <h1 className="privacy__title">Privacy policy</h1>
        <p className="privacy__date">Last updated June 2026</p>

        <p>
          Mantel is a self-hosted event photo gallery. This page explains what information is
          collected when you use a Mantel gallery, how it is used, and your rights regarding it.
        </p>

        <h2>Your photos and copyright</h2>
        <p>
          You retain full copyright over every photo and video you upload. By uploading, you grant
          a limited, non-exclusive licence to the event host (the person who created this gallery)
          and to the Mantel software solely to store, transmit, and display your content within
          this gallery. Your content is never used for advertising, sold, or shared with third
          parties.
        </p>

        <h2>What is collected</h2>
        <h3>If you are a host (account holder)</h3>
        <ul>
          <li>
            <strong>Email address</strong> — required for login and account recovery.
          </li>
          <li>
            <strong>Name</strong> — required to create an account.
          </li>
          <li>
            <strong>Password</strong> — stored as a salted cryptographic hash (scrypt). Your
            actual password is never stored.
          </li>
          <li>
            <strong>Session information</strong> — the IP address and browser type recorded when
            you sign in. Used for security and session management only.
          </li>
        </ul>

        <h3>If you are a guest (uploading photos)</h3>
        <ul>
          <li>
            <strong>Photos and videos</strong> — stored on the host&apos;s server.{' '}
            <strong>
              GPS coordinates and all EXIF metadata (including location) are stripped from images
              automatically before storage.
            </strong>{' '}
            Videos are stored as uploaded.
          </li>
          <li>
            <strong>Name and message</strong> — only if you choose to provide them. Stored with
            your post and visible to other gallery viewers.
          </li>
          <li>
            <strong>Like token</strong> — a random identifier stored in a browser cookie,
            used only to remember which posts you have liked so the same post cannot be liked
            twice. It contains no personal information.
          </li>
        </ul>

        <h2>What is not collected</h2>
        <p>
          There are no analytics scripts, no advertising trackers, and no third-party code
          embedded in these pages. No data is ever sold or shared with advertisers.
        </p>

        <h2>Cookies</h2>
        <ul>
          <li>
            <strong>Hosts:</strong> a session cookie that keeps you signed in to your account.
          </li>
          <li>
            <strong>Guests:</strong> a gallery-access cookie (if the gallery is
            password-protected), and a random like-tracking token (described above).
          </li>
        </ul>
        <p>No third-party cookies are set.</p>

        <h2>Data retention</h2>
        <p>
          Gallery access expires at the end of the host&apos;s subscription period. After expiry,
          the gallery becomes inaccessible immediately. Photos and all associated data are
          permanently deleted after a 30-day grace period.
        </p>

        <h2>Contact</h2>
        <p>
          For questions or requests about your data, email{' '}
          <a href="mailto:admin@mantel.wedding">admin@mantel.wedding</a>.
        </p>

        <p className="privacy__back">
          <Link href="/" className="linkbtn">
            ← Back to home
          </Link>
        </p>
      </div>
    </div>
  );
}
