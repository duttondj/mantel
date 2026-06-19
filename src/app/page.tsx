import Link from 'next/link';

export default function Home() {
  return (
    <div className="wrap">
      <header className="masthead">
        <p className="masthead__eyebrow">A shared album</p>
        <h1 className="masthead__title">Mantel</h1>
        <p className="masthead__sub">
          Every guest's view of the day, in one place. Create a gallery, share a
          link or QR code, and let guests add their photos — no app, no sign-up.
        </p>
        <div style={{ marginTop: '1.8rem' }}>
          <Link className="btn btn--sm" href="/signin" style={{ display: 'inline-block' }}>
            Host a gallery
          </Link>
        </div>
      </header>
    </div>
  );
}
