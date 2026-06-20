# Mantel — shared event galleries

A self-hosted photo gallery for event guests. Hosts get a private gallery;
guests upload photos and videos via a link or QR code — no app, no account.
Every photo is stripped of EXIF/location data on upload. Direct image links
don't work outside the gallery, so photos can't be hotlinked or used as
general-purpose image hosting.

## Features

**For hosts**
- Create unlimited galleries, each with an optional password
- Share via link or print a QR code (PNG download for place cards)
- Close uploads manually, or they auto-close after 14 days of inactivity
- Download all photos and videos as a ZIP at any time
- Remove any guest post (delete button only visible to the gallery owner)
- Edit or add a caption to any guest post
- View gallery stats (views and downloads)
- Change password from the dashboard; full forgot-password / reset flow
- Activate via promo code or Square payment ($20 / year)

**For guests**
- Post 1–5 photos or videos with an optional name and 180-char message
- Text-only guestbook posts (no photo required)
- Like posts; see an upload progress bar
- View everything in a lightbox with fullscreen slideshow and swipe support

**Privacy**
- All EXIF/GPS/camera metadata stripped server-side on upload — always
- HEIC (iPhone default format) decoded and re-encoded, so iPhone uploads
  work and are stripped too
- Image URLs use a random `publicId` unrelated to the gallery slug
- Direct image URLs redirect to the home page — Mantel is not an image host
- Password-protected galleries redirect direct image links to the password prompt

**Admin**
- Admin dashboard at `/admin` (flagged per-user in the DB)
- Manage all host accounts: activate, expire, reset password via email
- Create, toggle, and delete promo codes (1-year or lifetime, limited or unlimited uses)

**Automated**
- Cron jobs run in-process (no extra container): auto-close at 2am,
  data purge at 3am, expiry reminder emails at 9am

## Run it

```bash
cp .env.example .env   # fill in secrets (see comments in the file)
make up                # build + start everything
make migrate           # run once after first boot (creates tables)
make seed              # run once after migrate (creates sample promo codes)
make seed-demo         # optional: populate the /g/demo gallery for marketing
```

Seeded promo codes: `***REMOVED***` (25 uses, 1 year) and `***REMOVED***` (unlimited, lifetime).

### Makefile shortcuts

| Command | What it does |
|---|---|
| `make up` | Build and start the full stack |
| `make down` | Stop everything |
| `make restart` | Restart the app container only |
| `make logs` | Tail app logs |
| `make migrate` | Run pending DB migrations |
| `make seed` | Seed initial promo codes |
| `make seed-demo` | Populate the demo gallery |
| `make purge` | Dry-run data purge |
| `make purge-commit` | Actually delete expired data |
| `make remind` | Send expiry reminder emails now |

### Ports (10000+ range to avoid collisions on a home server)

| Service       | Host port | URL                        |
|---------------|-----------|----------------------------|
| App           | 13000     | http://localhost:13000     |
| MinIO API     | 19000     | (internal S3 API)          |
| MinIO console | 19001     | http://localhost:19001     |

### Internet access via Cloudflare proxy + DDNS

Mantel uses Caddy as a reverse proxy and `cloudflare-ddns` to keep the DNS A record pointing at your home IP. Cloudflare's proxy sits in front (orange cloud on), which hides your real IP and provides DDoS protection. Set up once:

1. In Cloudflare dashboard, set SSL/TLS mode to **Full (Strict)**
2. Create a Cloudflare API token with **Zone → DNS → Edit** permission for your domain
3. Forward ports **80** and **443** on your router to the server
4. In `.env`, set:
   ```
   APP_URL=https://yourdomain.com
   APP_DOMAIN=yourdomain.com
   CF_API_TOKEN=your_token_here
   ```
5. Run `make up`

Caddy automatically provisions a Let's Encrypt certificate via DNS-01 challenge (using the same CF API token). The `cloudflare-ddns` container updates the A record whenever your public IP changes — no static IP needed.

### LAN-only (no tunnel)

```bash
docker compose up -d --build
```

Set `APP_URL=http://<your-server-lan-ip>:13000` in `.env`. Other LAN devices
can reach the app at that address. Note: `secure` session cookies require
HTTPS, so some auth features won't work properly over plain HTTP.

## How the pieces fit

| Concern | Where |
|---|---|
| Host dashboard | `src/app/dashboard/` |
| Gallery page (guest view) | `src/app/g/[slug]/page.tsx` |
| Sign in / sign up / forgot / reset | `src/app/signin/`, `src/app/forgot-password/`, `src/app/reset-password/` |
| Gallery CRUD API | `src/app/api/galleries/` |
| Upload API | `src/app/api/upload/route.ts` |
| EXIF stripping + HEIC decode | `src/lib/images.ts` (`stripAndStore`) |
| Image serving + access control | `src/app/i/[publicId]/route.ts` |
| Gallery passwords | `src/lib/gallery-auth.ts` (HMAC cookie) |
| Host auth | `src/lib/auth.ts` (Better Auth) |
| Entitlement seam | `src/lib/entitlements.ts` (`grantAccess`, `isEntitled`) |
| Square checkout + webhook | `src/app/api/square/` |
| Promo code redemption | `src/app/api/promo/redeem/route.ts` |
| Storage (S3/MinIO) | `src/lib/storage.ts` |
| Email (Resend) | `src/lib/email.ts` |
| Scheduled tasks (cron) | `src/instrumentation.ts` + `src/lib/tasks/` |
| Data purge | `src/lib/tasks/purge.ts` / `scripts/purge.ts` |
| Admin panel + promo management | `src/app/admin/` + `src/app/api/admin/` |
| Demo gallery seed | `scripts/seed-demo.ts` |

## The "deleted after a year" lifecycle

Deletion is the only irreversible action, so it's deliberately staged:

1. **Expiry** — when `expiresAt` passes, access is cut off everywhere
   immediately by `isEntitled()` checks in the request path.
2. **Grace period** — `scripts/purge.ts` keeps data on disk for 30 days
   after expiry. Safety net against bugs and a renewal window.
3. **Purge** — only after the grace period does the script physically delete
   storage objects and DB rows.

The purge script dry-runs by default (`make purge`). Use `make purge-commit`
to actually delete. The 3am cron runs with commit mode automatically.

## Migrating storage later

Storage speaks the S3 API, so switching to AWS S3, Cloudflare R2, or
Backblaze B2 is just changing `S3_ENDPOINT` and the key env vars. Postgres
can move to any managed Postgres by changing `DATABASE_URL`. The app
container is unchanged.
