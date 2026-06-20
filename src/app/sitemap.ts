import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.APP_URL ?? 'https://mantel.wedding';
  return [
    { url: base, changeFrequency: 'monthly', priority: 1 },
    { url: `${base}/privacy`, changeFrequency: 'yearly', priority: 0.3 },
  ];
}
