ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "is_admin" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE "images" ADD COLUMN IF NOT EXISTS "file_size" integer;
