# Mantel — shared event galleries

A browser-based photo gallery for event guests (weddings and beyond). Hosts get
a private gallery; guests upload photos via a link/QR code with no app and no
account. Maximum privacy: every photo is stripped of EXIF/location data on
upload, and direct image links never reveal or unlock a gallery.

## What's built

- **Host dashboard** — sign up / sign in, activate via promo code, create
  galleries, set/change/remove a gallery password, copy the share link, show a
  QR code (with **PNG download** for printing on place cards), and **delete a
  gallery** (type-the-name confirm).
- **Guests** open a gallery link, optionally enter a name (remembered by
  cookie), and post 1–5 photos with a 180-char message — Instagram-style.
- **Host moderation** — when the gallery owner is signed in and views their own
  gallery, each post shows a **Remove** control (guests never see it). Deletes
  remove the storage objects, not just the DB rows.
- **Privacy**
  - All EXIF/GPS/camera metadata is stripped server-side on upload (verified).
  - **HEIC/iPhone photos** are decoded (via heic-convert) then re-encoded, so
    default iPhone uploads work and are stripped too.
  - Image URLs use a random `publicId` unrelated to the gallery slug, so a
    leaked direct link reveals nothing about the gallery.
  - For password-protected galleries, direct image links **redirect to the
    password prompt** instead of serving the image.
- **Rate limiting** — in-process (no extra service) on upload, gallery unlock,
  and promo redemption; auth endpoints use Better Auth's built-in limiter.
  Limits live in `src/lib/rate-limit.ts`.
- **Sharing** per post: native share sheet, download, copy link, X, Facebook.
- **Billing model** (entitlement only; payment not wired yet)
  - One year of hosting per host account, then data is purged.
  - **Promo codes** for free/comped accounts work today.
  - A single `grantAccess()` seam means adding Stripe later is a drop-in.

## Run it

```bash
cp .env.example .env          # then edit the secrets
#  generate SESSION_SECRET with: openssl rand -hex 32

docker compose up --build     # starts app + Postgres + MinIO + bucket init
```

Then, once for first-time setup (creates tables + sample promo codes):

```bash
docker compose exec app npm run db:migrate
docker compose exec app npm run db:seed
```

Seeded promo codes: `***REMOVED***` (25 uses) and `***REMOVED***` (unlimited).

### Ports (all in the 10000+ range to avoid collisions)

| Service        | Host port | URL                          |
|----------------|-----------|------------------------------|
| App            | 13000     | http://localhost:13000       |
| MinIO API      | 19000     | (used internally)            |
| MinIO console  | 19001     | http://localhost:19001       |

### Accessing from another PC on your LAN

The compose file binds these ports to `0.0.0.0`, so other machines on your
network can reach the app. Two steps:

1. Find your home server's LAN IP (e.g. `192.168.1.50`):
   - Linux: `ip addr` · macOS: `ipconfig getifaddr en0`
2. In `.env`, set `APP_URL` to that IP and port, e.g.:
   ```
   APP_URL=http://192.168.1.50:13000
   ```
   This matters because auth and the QR/share links must point at an address
   other devices can actually reach — `localhost` would only work on the server
   itself. Restart with `docker compose up -d` after changing it.

Then browse from any LAN device to `http://192.168.1.50:13000`.

(Internet access is a later step — you'll add a reverse proxy + HTTPS and set
`APP_URL` to your domain. Nothing else changes.)

## How the pieces fit

| Concern            | Where                                    |
|--------------------|------------------------------------------|
| Host dashboard     | `src/app/dashboard/`                     |
| Sign in / sign up  | `src/app/signin/page.tsx`                |
| Gallery CRUD API   | `src/app/api/galleries/`                 |
| EXIF stripping     | `src/lib/images.ts` (`stripAndStore`)    |
| Obfuscated serving | `src/app/i/[publicId]/route.ts`          |
| Gallery passwords  | `src/lib/gallery-auth.ts` (HMAC cookie)  |
| Host auth          | `src/lib/auth.ts` (Better Auth)          |
| Entitlement seam   | `src/lib/entitlements.ts`                |
| Storage (S3/MinIO) | `src/lib/storage.ts`                     |
| Data purge         | `scripts/purge.ts`                       |

## Adding payment later (Stripe)

Everything routes through one function:

```ts
grantAccess(userId, { plan: 'paid' });  // sets plan + expiresAt + status
```

Promo redemption already calls it. To add Stripe:
1. Add a checkout route that creates a Stripe Checkout Session.
2. Add a webhook route; on `checkout.session.completed`, look up the host and
   call `grantAccess(userId, { plan: 'paid' })`.

No other code changes — galleries only read `status` + `expiresAt`.

## The "deleted after a year" lifecycle (read before scheduling purge)

Deletion is the only irreversible action, so it's deliberately staged:

1. **Expiry** — when `expiresAt` passes, access is cut off everywhere
   immediately by `isEntitled()` checks in the request path. To the host this
   looks "deleted."
2. **Grace period** — `scripts/purge.ts` keeps data on disk for `GRACE_DAYS`
   (default 30) after expiry. Safety net against bugs + renewal-upsell window.
3. **Purge** — only after grace does the script physically delete files + rows.

The purge script **dry-runs by default**. It only deletes with `--commit`:

```bash
node --experimental-strip-types scripts/purge.ts            # preview
node --experimental-strip-types scripts/purge.ts --commit   # delete
```

Watch the dry-run output before you schedule it (cron/systemd timer).

## The Instagram reality

Instagram has no web "share to feed/story" URL — a browser cannot post to it.
So the share controls do the honest thing: the **native share sheet** can hand
the photo file to Instagram on supported mobile devices; otherwise **Download**
is the real path. X and Facebook share the image's link.

## Migrating off self-host later

Storage already speaks the S3 API, so moving to AWS S3 / Cloudflare R2 /
Backblaze B2 is just changing `S3_ENDPOINT` and keys. Postgres can move to any
managed Postgres by changing `DATABASE_URL`. The app container is unchanged.

## Still to build (next steps)

- Email for hosts: verification + **password reset** (Better Auth supports
  both; off for now — password reset is the one that'll cause lockouts).
- Stripe checkout + webhook against the `grantAccess` seam.
- Scheduling the purge job (cron/systemd timer) — the script is ready and
  dry-runs by default; nothing runs it automatically yet.
- Backups of the Postgres + MinIO volumes before a real event relies on it.
- HTTPS + reverse proxy when you expose it beyond the LAN (cookies marked
  `secure` need HTTPS to work).
