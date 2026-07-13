CREATE TABLE IF NOT EXISTS "notification_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid,
	"type" varchar(100) NOT NULL,
	"title" varchar(255) NOT NULL,
	"body" text NOT NULL,
	"action_url" varchar(500),
	"channel" varchar(50) NOT NULL,
	"priority" varchar(20) DEFAULT 'normal',
	"status" varchar(50) DEFAULT 'pending',
	"attempts" integer DEFAULT 0,
	"max_attempts" integer DEFAULT 3,
	"last_attempt_at" timestamp with time zone,
	"next_retry_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"error" text,
	"email_to" varchar(255),
	"email_message_id" varchar(255),
	"slack_response" jsonb,
	"payload" jsonb,
	"scheduled_for" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "slack_webhook_url" varchar(500);
--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "notification_preferences" jsonb DEFAULT '{}'::jsonb;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "notification_overrides" jsonb DEFAULT '{}'::jsonb;
--> statement-breakpoint
ALTER TABLE "dsar_requests" ADD COLUMN "inbound_email_address" varchar(255);
--> statement-breakpoint
ALTER TABLE "dsar_communications" ADD COLUMN "attachments" jsonb DEFAULT '[]'::jsonb;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notification_queue" ADD CONSTRAINT "notification_queue_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notification_queue" ADD CONSTRAINT "notification_queue_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_nq_pending" ON "notification_queue" ("status","priority","created_at") WHERE status = 'pending';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_nq_org" ON "notification_queue" ("organization_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_nq_retry" ON "notification_queue" ("next_retry_at") WHERE status = 'failed' AND attempts < max_attempts;
--> statement-breakpoint
ALTER TABLE "dsar_requests" ADD CONSTRAINT "dsar_requests_inbound_email_address_unique" UNIQUE("inbound_email_address");
