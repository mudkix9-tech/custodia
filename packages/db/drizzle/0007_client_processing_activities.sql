CREATE TABLE IF NOT EXISTS "client_processing_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"processing_activity_id" uuid NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "client_processing_activities" ADD CONSTRAINT "client_processing_activities_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "client_processing_activities" ADD CONSTRAINT "client_processing_activities_processing_activity_id_processing_activities_id_fk" FOREIGN KEY ("processing_activity_id") REFERENCES "public"."processing_activities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_cpa_client" ON "client_processing_activities" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_cpa_activity" ON "client_processing_activities" USING btree ("processing_activity_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "client_activity_unq" ON "client_processing_activities" USING btree ("client_id", "processing_activity_id");
