import type { Metadata } from 'next';
import './globals.css';

const APP_URL = process.env.APP_URL ?? 'https://mantel.wedding';

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: 'Mantel — shared photo galleries for events',
    template: '%s — Mantel',
  },
  description:
    'Create a private photo gallery for your wedding, party, or event. Guests add photos instantly — no app, no sign-up, just a link or QR code.',
  openGraph: {
    type: 'website',
    url: APP_URL,
    siteName: 'Mantel',
    title: 'Mantel — shared photo galleries for events',
    description:
      'Create a private photo gallery for your wedding, party, or event. Guests add photos instantly — no app, no sign-up, just a link or QR code.',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Mantel' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Mantel — shared photo galleries for events',
    description:
      'Create a private photo gallery for your wedding, party, or event. Guests add photos instantly — no app, no sign-up, just a link or QR code.',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
