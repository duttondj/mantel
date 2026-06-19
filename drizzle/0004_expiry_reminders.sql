ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "reminder_30d_at" timestamp;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "reminder_7d_at" timestamp;
