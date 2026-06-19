ALTER TABLE "images" ADD COLUMN IF NOT EXISTS "mime_type" text DEFAULT 'image/jpeg' NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "likes" (
	"post_id" uuid NOT NULL,
	"guest_token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "likes_pkey" PRIMARY KEY("post_id","guest_token")
);
--> statement-breakpoint
ALTER TABLE "likes" ADD CONSTRAINT "likes_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
