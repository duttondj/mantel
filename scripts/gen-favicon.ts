import satori from 'satori';
import sharp from 'sharp';
import toIco from 'to-ico';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const dir = import.meta.dirname;
const root = join(dir, '..');

const frauncesFont = readFileSync(
  join(dir, '../node_modules/@fontsource/fraunces/files/fraunces-latin-600-normal.woff')
);

async function renderM(size: number): Promise<Buffer> {
  // Font size and positioning tuned so the M fills the tile well
  const fontSize = Math.round(size * 0.72);

  const svg = await satori(
    {
      type: 'div',
      props: {
        style: {
          width: size,
          height: size,
          background: '#b6705f',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        },
        children: {
          type: 'div',
          props: {
            style: {
              fontFamily: 'Fraunces',
              fontSize,
              fontWeight: 600,
              color: '#f6f2ea',
              lineHeight: 1,
              marginTop: Math.round(size * 0.05),
            },
            children: 'M',
          },
        },
      },
    },
    {
      width: size,
      height: size,
      fonts: [{ name: 'Fraunces', data: frauncesFont, weight: 600, style: 'normal' }],
    }
  );

  return sharp(Buffer.from(svg)).png().toBuffer();
}

// Generate all sizes
const [png512, png192, png180, png32, png16] = await Promise.all([
  renderM(512),
  renderM(192),
  renderM(180),
  renderM(32),
  renderM(16),
]);

// favicon.ico — 16 + 32 embedded (goes in src/app/ for Next.js auto-linking)
const ico = await toIco([png16, png32]);
writeFileSync(join(root, 'src/app/favicon.ico'), ico);

// icon.png — 192x192, linked by Next.js as <link rel="icon">
writeFileSync(join(root, 'src/app/icon.png'), png192);

// apple-icon.png — 180x180, linked as <link rel="apple-touch-icon">
writeFileSync(join(root, 'src/app/apple-icon.png'), png180);

// 512x512 for PWA / general use in public/
writeFileSync(join(root, 'public/icon-512.png'), png512);

console.log('Generated favicon.ico, icon.png, apple-icon.png, public/icon-512.png');
