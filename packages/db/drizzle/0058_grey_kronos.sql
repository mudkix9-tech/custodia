ALTER TABLE "dpf_registrations" DROP CONSTRAINT "dpf_registrations_name_key_unq";--> statement-breakpoint
ALTER TABLE "dpf_registrations" ADD COLUMN "framework" varchar(20) DEFAULT 'eu_us' NOT NULL;--> statement-breakpoint
ALTER TABLE "dpf_registrations" ADD COLUMN "inactive_start_date" date;--> statement-breakpoint
ALTER TABLE "dpf_registrations" ADD COLUMN "hr_data_covered" boolean;--> statement-breakpoint
ALTER TABLE "dpf_registrations" ADD COLUMN "non_hr_data_covered" boolean;--> statement-breakpoint
ALTER TABLE "dpf_registrations" ADD COLUMN "dispute_resolution_body" varchar(500);--> statement-breakpoint
ALTER TABLE "dpf_registrations" ADD COLUMN "privacy_policy_url" text;--> statement-breakpoint
ALTER TABLE "dpf_registrations" ADD COLUMN "participant_id" integer;--> statement-breakpoint
ALTER TABLE "dpf_registrations" ADD COLUMN "detail_fetched_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "dpf_registrations" ADD CONSTRAINT "dpf_registrations_name_key_framework_unq" UNIQUE("name_key","framework");