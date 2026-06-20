#!/usr/bin/env bash
# backup.sh — snapshot Mantel's two data volumes to compressed files.
#
# What gets backed up:
#   db-<timestamp>.sql.gz   — full Postgres dump (users, galleries, posts, likes, etc.)
#   photos-<timestamp>.tar.gz — all photo and video files from MinIO storage
#
# Both files together are everything needed to fully restore Mantel on a new
# server. Run this before any major event, before updating the server, or on
# a regular cron schedule. Copy the output files off the server (e.g. to an
# external drive or cloud storage) — a backup on the same disk as the data
# it's protecting isn't a real backup.
#
# Usage:
#   bash scripts/backup.sh
#   BACKUP_DIR=/mnt/external bash scripts/backup.sh   # custom destination
#
# Restore:
#   DB:     docker compose exec -T db psql -U mantel mantel < db-<timestamp>.sql
#   Photos: docker run --rm -v mantel_minio_data:/data -v $(pwd):/src alpine \
#             tar xzf /src/photos-<timestamp>.tar.gz -C /data

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"

mkdir -p "$BACKUP_DIR"

echo "[backup] Starting Mantel backup — $TIMESTAMP"

# --- Postgres ---
echo "[backup] Dumping database…"
docker compose exec -T db pg_dump -U mantel mantel \
  | gzip > "$BACKUP_DIR/db-$TIMESTAMP.sql.gz"
echo "[backup]   → $BACKUP_DIR/db-$TIMESTAMP.sql.gz"

# --- MinIO (photos + videos) ---
echo "[backup] Archiving photo storage…"
docker run --rm \
  -v mantel_minio_data:/data:ro \
  -v "$(cd "$BACKUP_DIR" && pwd)":/backups \
  alpine tar czf "/backups/photos-$TIMESTAMP.tar.gz" -C /data .
echo "[backup]   → $BACKUP_DIR/photos-$TIMESTAMP.tar.gz"

echo "[backup] Done. Copy these files off the server to a safe location:"
echo "         $BACKUP_DIR/db-$TIMESTAMP.sql.gz"
echo "         $BACKUP_DIR/photos-$TIMESTAMP.tar.gz"
