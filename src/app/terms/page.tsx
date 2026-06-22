import Link from 'next/link';

export const metadata = { title: 'Terms of Service' };

export default function TermsPage() {
  return (
    <div className="wrap">
      <div className="privacy">
        <h1 className="privacy__title">Terms of service</h1>
        <p className="privacy__date">Last updated June 2026</p>

        <p>
          These terms govern your use of Mantel (&ldquo;the service&rdquo;), operated by the
          Mantel team. By creating an account or using the service you agree to these terms.
        </p>

        <h2>The service</h2>
        <p>
          Mantel lets event hosts create private photo galleries and share them with guests.
          Guests can upload photos and videos via a link or QR code with no account required.
          Hosts are responsible for their galleries and the content uploaded to them.
        </p>

        <h2>Accounts</h2>
        <p>
          You must provide an accurate email address and keep your password secure. You are
          responsible for all activity that occurs under your account. Notify us immediately at{' '}
          <a href="mailto:admin@mantel.wedding">admin@mantel.wedding</a> if you believe your
          account has been compromised.
        </p>

        <h2>Payment and access</h2>
        <p>
          Access to host a gallery requires a one-time payment for a one-year period. Payments
          are processed by Square. Your access period begins on the date of purchase and expires
          one year later.
        </p>
        <p>
          After your access expires, your galleries become immediately inaccessible to you and
          your guests. Photos and all associated data are permanently deleted after a 30-day
          grace period. Download a ZIP of your gallery before expiry to keep your photos.
        </p>
        <p>
          For refund requests, contact us at{' '}
          <a href="mailto:admin@mantel.wedding">admin@mantel.wedding</a> within 14 days of
          purchase.
        </p>

        <h2>Acceptable use</h2>
        <p>You agree not to use Mantel to upload, store, or share content that:</p>
        <ul>
          <li>is illegal in your jurisdiction or that of the server&apos;s location;</li>
          <li>infringes the copyright or privacy of others;</li>
          <li>depicts minors in a sexual context;</li>
          <li>
            is used to harass, threaten, or harm any individual.
          </li>
        </ul>
        <p>
          We reserve the right to remove content or terminate accounts that violate these rules
          without notice or refund.
        </p>

        <h2>Your content</h2>
        <p>
          You and your guests retain full copyright over uploaded photos and videos. By uploading,
          you grant Mantel a limited licence to store, transmit, and display the content within
          your gallery. We will never use your content for advertising or share it with third
          parties.
        </p>

        <h2>Availability</h2>
        <p>
          We aim to keep Mantel running reliably but do not guarantee uninterrupted availability.
          The service is provided on a self-hosted basis and may occasionally be unavailable for
          maintenance or due to circumstances outside our control.
        </p>

        <h2>Limitation of liability</h2>
        <p>
          To the fullest extent permitted by law, Mantel is provided &ldquo;as is&rdquo; without
          warranty of any kind. We are not liable for any loss of data, lost profits, or indirect
          damages arising from your use of the service. Our total liability for any claim is
          limited to the amount you paid for the access period in which the claim arose.
        </p>

        <h2>Changes to these terms</h2>
        <p>
          We may update these terms from time to time. Material changes will be communicated by
          email. Continued use of the service after changes take effect constitutes acceptance.
        </p>

        <h2>Contact</h2>
        <p>
          Questions about these terms? Email{' '}
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
