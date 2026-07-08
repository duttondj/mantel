# syntax=docker/dockerfile:1
# ---- build stage ----
FROM node:22-slim AS build
WORKDIR /app

# sharp compiles against libvips; slim images need these to build it
RUN apt-get update && apt-get install -y --no-install-recommends \
    libvips-dev python3 build-essential ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
# npm ci is faster and deterministic (installs straight from the lockfile);
# skip audit/fund network round-trips and reuse cached tarballs from the mount
RUN --mount=type=cache,target=/root/.npm \
    npm ci --prefer-offline --no-audit --no-fund

COPY . .
RUN --mount=type=cache,target=/app/.next/cache \
    npm run build

# ---- runtime stage ----
FROM node:22-slim AS run
WORKDIR /app

# runtime needs the libvips shared lib (for sharp) and ffmpeg (to strip
# metadata/GPS out of uploaded videos before they hit storage)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libvips ffmpeg ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=3000

# standalone output ships a minimal server + only required node_modules
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
# scripts + schema for migrate/seed/purge run inside the container
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/src/db ./src/db
COPY --from=build /app/src/lib ./src/lib
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/node_modules ./node_modules

EXPOSE 3000
# Run migrations on every startup (idempotent), then hand off to the app.
CMD ["sh", "-c", "node --experimental-strip-types scripts/migrate.ts && exec node server.js"]
