ALTER TABLE "regulatory_update_matches" ADD COLUMN "notified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "regulatory_update_matches" ADD COLUMN "acknowledged_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "regulatory_update_matches" ADD COLUMN "acknowledged_by" uuid;--> statement-breakpoint
ALTER TABLE "regulatory_update_matches" ADD CONSTRAINT "regulatory_update_matches_acknowledged_by_users_id_fk" FOREIGN KEY ("acknowledged_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;