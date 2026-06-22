import Link from 'next/link';

export default function Home() {
  const year = new Date().getFullYear();
  const priceCents = parseInt(process.env.SQUARE_PRICE_CENTS ?? '2000', 10);
  const priceDisplay = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(priceCents / 100);

  return (
    <>
      <div className="wrap">
        {/* Hero */}
        <header className="masthead">
          <p className="masthead__eyebrow">A shared album for your event</p>
          <h1 className="masthead__title">Mantel</h1>
          <p className="masthead__sub">
            Create a private gallery for your event and let every guest add their
            photos — no app, no sign-up, just a link.
          </p>
          <div style={{ marginTop: '1.8rem', display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link className="btn btn--sm" href="/signin" style={{ display: 'inline-block' }}>
              Get started
            </Link>
            <Link className="btn btn--sm btn--ghost" href="/g/demo" style={{ display: 'inline-block' }}>
              See a live demo
            </Link>
          </div>
        </header>

        {/* How it works */}
        <section className="home-section">
          <h2 className="home-section__title">How it works</h2>
          <div className="steps">
            <div className="step">
              <span className="step__n">1</span>
              <h3 className="step__h">Create a gallery</h3>
              <p className="step__p">Sign up, name your gallery, and optionally add a password. Done in under a minute.</p>
            </div>
            <div className="step">
              <span className="step__n">2</span>
              <h3 className="step__h">Share the link</h3>
              <p className="step__p">Send a link or print a QR code. Guests open it on any phone — no app, no account needed.</p>
            </div>
            <div className="step">
              <span className="step__n">3</span>
              <h3 className="step__h">Everyone contributes</h3>
              <p className="step__p">Guests add photos and videos instantly. Everyone sees the whole album as it grows.</p>
            </div>
          </div>
        </section>

        {/* Feature highlights */}
        <section className="home-section">
          <h2 className="home-section__title">Why Mantel</h2>
          <div className="features">
            <div className="feature">
              <h3 className="feature__h">Privacy first</h3>
              <p className="feature__p">GPS coordinates and all EXIF metadata are stripped from every photo on upload — automatically, server-side, every time. Your guests' location data never reaches the server.</p>
            </div>
            <div className="feature">
              <h3 className="feature__h">Zero friction for guests</h3>
              <p className="feature__p">Guests scan a QR code or tap a link and they're in. No app to install, no account to create — nothing standing between the moment and the memory.</p>
            </div>
            <div className="feature">
              <h3 className="feature__h">Yours to keep</h3>
              <p className="feature__p">Download every photo and video as a single ZIP whenever you like. Your gallery stays live for a full year — plenty of time to save everything before it expires.</p>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section className="home-section">
          <h2 className="home-section__title">Pricing</h2>
          <div className="pricing-card">
            <p className="pricing-card__price">{priceDisplay}<span className="pricing-card__per"> / year</span></p>
            <p className="pricing-card__desc">One year of private gallery hosting for your event — unlimited guests, unlimited uploads.</p>
            <Link className="btn btn--sm" href="/signin" style={{ display: 'inline-block' }}>
              Get started
            </Link>
          </div>
        </section>
      </div>

      {/* Site footer */}
      <footer className="site-footer">
        <span>© {year} Mantel</span>
        <span className="site-footer__sep">·</span>
        <Link href="/privacy" className="site-footer__link">Privacy</Link>
        <span className="site-footer__sep">·</span>
        <Link href="/terms" className="site-footer__link">Terms</Link>
        <span className="site-footer__sep">·</span>
        <a href="mailto:admin@mantel.wedding" className="site-footer__link">Contact</a>
      </footer>
    </>
  );
}
