# Mantel

Self-hostable photo gallery for event guests (weddings and beyond, kept
intentionally event-neutral). Hosts create private galleries; guests upload
photos via a link/QR with no app and no account. Privacy-first: all EXIF/
location data is stripped on upload, and direct image links never reveal or
unlock a gallery.

## Commands

- Dev: `npm run dev` (needs a reachable Postgres — easiest via the db container)
- Build: `npm run build`  ·  Typecheck: `npx tsc --noEmit`
- **Preferred deploy shortcuts (use these):**
  - `make up` — build + start full stack with Cloudflare Tunnel
  - `make down` / `make restart` / `make logs` / `make ps`
  - `make migrate` — run pending DB migrations
  - `make seed` — seed initial promo codes
  - `make seed-demo` — populate the demo gallery (`/g/demo`) with photos + fake posts
  - `make purge` / `make purge-commit` — dry-run / commit data purge
  - `make remind` — send expiry reminder emails manually
- Raw compose (LAN only, no tunnel): `docker compose up -d --build`
- Regenerate migration after schema change: `npx drizzle-kit generate`

## Stack

Next.js 15 (App Router) · Postgres + Drizzle ORM · MinIO (S3-compatible) for
images · Better Auth (email/password, sessions in Postgres) for hosts · sharp +
heic-convert for image processing · Square for payments · Resend for email ·
node-cron for scheduled tasks. All self-hosted in Docker; no external SaaS
except Square and Resend.

## Architecture decisions (the non-obvious "why"s — do not undo these)

- **Two separate auth systems by design.** Hosts use Better Auth
  (`src/lib/auth.ts`). Guests are NOT authenticated — they get a signed HMAC
  cookie scoped to one gallery id (`src/lib/gallery-auth.ts`). Keep them
  separate.
- **Image obfuscation is a security feature, not cosmetic.** Each image has a
  random `publicId` unrelated to the gallery slug. The serving route
  (`src/app/i/[publicId]/route.ts`) checks the parent gallery's lock state on
  every request and redirects locked-gallery images to the password prompt. A
  leaked direct link must reveal nothing and unlock nothing. Don't "simplify"
  this by serving images directly from storage.
- **Direct image URL access is intentionally blocked.** The image route uses
  `Sec-Fetch-Dest` to allow only `image`/`video` sub-resource loads (gallery
  `<img>`/`<video>` elements) and explicit `?download=1` requests. Direct
  navigation, shared links, and third-party embeds redirect to the home page.
  This is deliberate — Mantel is not an image host.
- **EXIF stripping must stay server-side and never be trusted to the client.**
  In `src/lib/images.ts`. `.rotate()` MUST run before metadata is dropped, or
  portrait phone photos come out sideways (orientation lives in the EXIF we
  delete). Verified end-to-end; don't reorder.
- **Entitlement is decoupled from payment.** Everything flows through
  `grantAccess()` in `src/lib/entitlements.ts`. Square and promo codes both
  call it. Galleries only read `status` + `expiresAt`. Don't scatter payment
  logic elsewhere.
- **Deletion is staged and irreversible-by-design-last.** Expiry cuts off
  access immediately (via `isEntitled()` in the request path); the purge script
  only physically deletes after a 30-day grace period, and dry-runs unless
  `--commit`. Don't make expiry directly delete.
- **Demo gallery is read-only by design.** The `isDemo` flag on a gallery hides
  the upload composer entirely (server-side) and `uploadsClosedAt` is set so
  the API also rejects uploads. Both layers are needed.

## Gotchas (these cost real debugging time — keep them in place)

- **HEIC:** prebuilt `sharp` CANNOT decode HEIC (iPhone default) — throws "bad
  seek". We decode via `heic-convert` (pure-WASM) first, then hand to sharp.
  `next.config.mjs` has `serverExternalPackages` + `outputFileTracingIncludes`
  for `libheif-js` — WITHOUT these, HEIC builds fine but crashes ONLY in the
  Docker standalone image at runtime. Don't remove them.
- **Script imports need explicit `.ts` extensions** (e.g. `./schema.ts`).
  Scripts run under raw Node `--experimental-strip-types`, which won't resolve
  extensionless imports even though Next's bundler does. `tsconfig.json` has
  `allowImportingTsExtensions: true` to keep `tsc` happy with this.
- **`APP_URL` must match how the browser actually reaches the app** (LAN IP+port
  for LAN, `https://domain` for the tunnel). Better Auth validates against it
  and QR/share links are built from it. Wrong value = broken auth or QR codes
  pointing nowhere. Most common deploy mistake. Also used by the image route to
  construct the redirect target — wrong value = broken redirects.
- **`secure` cookies need HTTPS** — they don't function over plain-HTTP LAN.
  They start working once behind the Cloudflare Tunnel.
- **Ports are in the 10000+ range** (app 13000, MinIO 19000/19001) to avoid
  colliding with other stacks on the home server. Internal container ports are
  still standard (app 3000, minio 9000).
- **MinIO bucket isn't auto-created** — the one-shot `createbucket` service in
  compose handles it. First upload fails without it.
- **`durationDays: null` means lifetime access** in `promoCodes`. `isEntitled`
  returns true when `expiresAt === null` — don't add a null check that inverts
  this. The `***REMOVED***` promo code uses this path.

## Conventions

- Guest-facing copy stays event-neutral ("host", "your event", "guests") — NOT
  wedding-specific, even though weddings are the main target.
- Limits live in one place: rate limits in `src/lib/rate-limit.ts`, upload caps
  (5 photos, 180-char message) as constants in the upload route.
- Prefer simple in-process solutions over new services (rate limiting is an
  in-memory Map, scheduled tasks use node-cron in `src/instrumentation.ts`).
- Cron jobs run in-process via `src/instrumentation.ts` (Next.js `register()`):
  2am auto-close idle galleries · 3am purge expired data · 9am expiry reminders.
- All task logic lives in `src/lib/tasks/` as exported functions so they can be
  called both from cron and from CLI scripts in `scripts/`.
