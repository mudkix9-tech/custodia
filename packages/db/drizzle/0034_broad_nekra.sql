CREATE TABLE "consent_daily_summary" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"domain_id" uuid NOT NULL,
	"date" date NOT NULL,
	"category" varchar(50),
	"accepted_sessions" integer DEFAULT 0,
	"rejected_sessions" integer DEFAULT 0,
	"total_sessions" integer DEFAULT 0,
	"accept_all_count" integer DEFAULT 0,
	"reject_all_count" integer DEFAULT 0,
	"customized_with_acceptance_count" integer DEFAULT 0,
	"customized_all_rejected_count" integer DEFAULT 0,
	"category_combination" text,
	"category_combination_count" integer DEFAULT 0
);
--> statement-breakpoint
-- CREATE TABLE "reconsent_flags" (
-- 	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
-- 	"organization_id" uuid NOT NULL,
-- 	"processing_activity_id" uuid NOT NULL,
-- 	"reason" text NOT NULL,
-- 	"confidence" varchar(20),
-- 	"detected_at" timestamp with time zone DEFAULT now(),
-- 	"status" varchar(50) DEFAULT 'flagged',
-- 	"dismissed_by" uuid,
-- 	"dismissed_at" timestamp with time zone
-- );
-- --> statement-breakpoint
ALTER TABLE "consent_daily_summary" ADD CONSTRAINT "consent_daily_summary_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_daily_summary" ADD CONSTRAINT "consent_daily_summary_domain_id_consent_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."consent_domains"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- ALTER TABLE "reconsent_flags" ADD CONSTRAINT "reconsent_flags_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- ALTER TABLE "reconsent_flags" ADD CONSTRAINT "reconsent_flags_processing_activity_id_processing_activities_id_fk" FOREIGN KEY ("processing_activity_id") REFERENCES "public"."processing_activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- ALTER TABLE "reconsent_flags" ADD CONSTRAINT "reconsent_flags_dismissed_by_users_id_fk" FOREIGN KEY ("dismissed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_consent_daily_summary_category" ON "consent_daily_summary" USING btree ("domain_id","date","category");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_consent_daily_summary_combination" ON "consent_daily_summary" USING btree ("domain_id","date","category_combination");--> statement-breakpoint
CREATE INDEX "idx_consent_daily_summary_org_date" ON "consent_daily_summary" USING btree ("organization_id","date");