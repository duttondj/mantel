import satori from 'satori';
import sharp from 'sharp';
import { readFileSync } from 'fs';
import { join } from 'path';

const dir = import.meta.dirname;

const frauncesFont = readFileSync(
  join(dir, '../node_modules/@fontsource/fraunces/files/fraunces-latin-600-normal.woff')
);

// satori takes a React-like element tree (plain objects, no JSX needed)
const element = {
  type: 'div',
  props: {
    style: {
      width: 1200,
      height: 630,
      background: '#f6f2ea',
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 0,
      border: '1px solid #ddd4c6',
      margin: 32,
    },
    children: [
      // Wordmark
      {
        type: 'div',
        props: {
          style: {
            fontFamily: 'Fraunces',
            fontSize: 156,
            fontWeight: 600,
            color: '#221d18',
            lineHeight: 1,
            letterSpacing: '-2px',
          },
          children: 'Mantel',
        },
      },
      // Rose rule
      {
        type: 'div',
        props: {
          style: {
            width: 128,
            height: 2,
            background: '#b6705f',
            marginTop: 28,
            marginBottom: 28,
          },
          children: '',
        },
      },
      // Tagline
      {
        type: 'div',
        props: {
          style: {
            fontFamily: 'sans-serif',
            fontSize: 30,
            color: '#6b6058',
            letterSpacing: '0.5px',
          },
          children: 'A shared album for your event',
        },
      },
    ],
  },
};

// Satori sizes the outer element, but we pass width/height at top level
const svg = await satori(
  {
    type: 'div',
    props: {
      style: {
        width: 1200,
        height: 630,
        background: '#f6f2ea',
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative' as const,
      },
      children: [
        // Border inset
        {
          type: 'div',
          props: {
            style: {
              position: 'absolute' as const,
              inset: 32,
              border: '1px solid #ddd4c6',
            },
            children: '',
          },
        },
        // Wordmark
        {
          type: 'div',
          props: {
            style: {
              fontFamily: 'Fraunces',
              fontSize: 156,
              fontWeight: 600,
              color: '#221d18',
              lineHeight: 1,
              letterSpacing: '-2px',
            },
            children: 'Mantel',
          },
        },
        // Rose rule
        {
          type: 'div',
          props: {
            style: {
              width: 128,
              height: 2,
              background: '#b6705f',
              marginTop: 28,
              marginBottom: 28,
            },
            children: '',
          },
        },
        // Tagline
        {
          type: 'div',
          props: {
            style: {
              fontFamily: 'sans-serif',
              fontSize: 30,
              color: '#6b6058',
              letterSpacing: '0.5px',
            },
            children: 'A shared album for your event',
          },
        },
      ],
    },
  },
  {
    width: 1200,
    height: 630,
    fonts: [
      {
        name: 'Fraunces',
        data: frauncesFont,
        weight: 600,
        style: 'normal',
      },
    ],
  }
);

await sharp(Buffer.from(svg))
  .png()
  .toFile(join(dir, '../public/og.png'));

console.log('Generated public/og.png');
