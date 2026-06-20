ALTER TABLE "galleries" ADD COLUMN IF NOT EXISTS "view_count" integer NOT NULL DEFAULT 0;
ALTER TABLE "galleries" ADD COLUMN IF NOT EXISTS "download_count" integer NOT NULL DEFAULT 0;
