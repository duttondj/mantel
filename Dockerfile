# ---- build stage ----
FROM node:22-slim AS build
WORKDIR /app

# sharp compiles against libvips; slim images need these to build it
RUN apt-get update && apt-get install -y --no-install-recommends \
    libvips-dev python3 build-essential ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# ---- runtime stage ----
FROM node:22-slim AS run
WORKDIR /app

# runtime only needs the libvips shared lib, not the -dev headers
RUN apt-get update && apt-get install -y --no-install-recommends \
    libvips ca-certificates \
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
CMD ["node", "server.js"]
