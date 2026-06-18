import { customAlphabet } from 'nanoid';

// short, unambiguous suffix (no 0/O/1/l/I) appended to a name-based slug
const suffix = customAlphabet('23456789abcdefghjkmnpqrstuvwxyz', 5);

/*
 * Turn a gallery title into a URL-safe slug with a random suffix, so two
 * "Sarah & Tom" galleries don't collide and slugs aren't guessable from
 * the title alone. e.g. "Sarah & Tom" -> "sarah-tom-7k2mq"
 */
export function makeSlug(title: string): string {
  const base = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'gallery';
  return `${base}-${suffix()}`;
}
