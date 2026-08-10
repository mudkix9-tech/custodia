CREATE TABLE "consent_findings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"domain_id" uuid NOT NULL,
	"finding_type" varchar(50) NOT NULL,
	"severity" varchar(20) NOT NULL,
	"tracker_key" varchar(100),
	"provider" varchar(255),
	"observed_host" varchar(255) DEFAULT '' NOT NULL,
	"required_category" varchar(50),
	"matched_vendor_id" uuid,
	"evidence" jsonb DEFAULT '{}'::jsonb,
	"confidence" numeric(3, 2),
	"state" varchar(20) DEFAULT 'open' NOT NULL,
	"resolution_note" text,
	"first_seen_at" timestamp with time zone DEFAULT now(),
	"last_seen_at" timestamp with time zone DEFAULT now(),
	"resolved_at" timestamp with time zone,
	"resolved_by" uuid,
	"first_scan_run_id" uuid,
	"last_scan_run_id" uuid,
	CONSTRAINT "uq_consent_finding_domain_type_host" UNIQUE("domain_id","finding_type","observed_host")
);
--> statement-breakpoint
CREATE TABLE "consent_scan_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"domain_id" uuid NOT NULL,
	"started_at" timestamp with time zone DEFAULT now(),
	"finished_at" timestamp with time zone,
	"status" varchar(20) DEFAULT 'running' NOT NULL,
	"cmp_detected" varchar(50),
	"post_consent_method" varchar(20),
	"pre_request_count" integer DEFAULT 0,
	"post_request_count" integer DEFAULT 0,
	"cookies_found" integer DEFAULT 0,
	"findings_open" integer DEFAULT 0,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "consent_tracker_observations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scan_run_id" uuid NOT NULL,
	"domain_id" uuid NOT NULL,
	"observed_host" varchar(255) NOT NULL,
	"tracker_key" varchar(100),
	"provider" varchar(255),
	"required_category" varchar(50),
	"matched_vendor_id" uuid,
	"pass" varchar(20) NOT NULL,
	"resource_type" varchar(30),
	"carried_identifiers" boolean DEFAULT false,
	"consent_signal" varchar(20),
	"request_count" integer DEFAULT 1,
	"sample_url" text,
	"observed_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "uq_consent_observation_run_host_pass" UNIQUE("scan_run_id","observed_host","pass")
);
--> statement-breakpoint
CREATE TABLE "tracker_registry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tracker_key" varchar(100) NOT NULL,
	"provider" varchar(255) NOT NULL,
	"match_domains" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"cookie_prefixes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"required_category" varchar(50) NOT NULL,
	"consent_mode_supported" boolean DEFAULT false,
	"consent_signal_params" jsonb DEFAULT '[]'::jsonb,
	"vendor_slug" varchar(100),
	"purpose" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "tracker_registry_tracker_key_unique" UNIQUE("tracker_key")
);
--> statement-breakpoint
ALTER TABLE "consent_findings" ADD CONSTRAINT "consent_findings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_findings" ADD CONSTRAINT "consent_findings_domain_id_consent_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."consent_domains"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_findings" ADD CONSTRAINT "consent_findings_matched_vendor_id_vendors_id_fk" FOREIGN KEY ("matched_vendor_id") REFERENCES "public"."vendors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_findings" ADD CONSTRAINT "consent_findings_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_findings" ADD CONSTRAINT "consent_findings_first_scan_run_id_consent_scan_runs_id_fk" FOREIGN KEY ("first_scan_run_id") REFERENCES "public"."consent_scan_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_findings" ADD CONSTRAINT "consent_findings_last_scan_run_id_consent_scan_runs_id_fk" FOREIGN KEY ("last_scan_run_id") REFERENCES "public"."consent_scan_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_scan_runs" ADD CONSTRAINT "consent_scan_runs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_scan_runs" ADD CONSTRAINT "consent_scan_runs_domain_id_consent_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."consent_domains"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_tracker_observations" ADD CONSTRAINT "consent_tracker_observations_scan_run_id_consent_scan_runs_id_fk" FOREIGN KEY ("scan_run_id") REFERENCES "public"."consent_scan_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_tracker_observations" ADD CONSTRAINT "consent_tracker_observations_domain_id_consent_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."consent_domains"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_tracker_observations" ADD CONSTRAINT "consent_tracker_observations_matched_vendor_id_vendors_id_fk" FOREIGN KEY ("matched_vendor_id") REFERENCES "public"."vendors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_consent_findings_domain_state" ON "consent_findings" USING btree ("domain_id","state");--> statement-breakpoint
CREATE INDEX "idx_consent_findings_org_state_severity" ON "consent_findings" USING btree ("organization_id","state","severity");--> statement-breakpoint
CREATE INDEX "idx_consent_scan_runs_domain_started" ON "consent_scan_runs" USING btree ("domain_id","started_at");--> statement-breakpoint
CREATE INDEX "idx_consent_scan_runs_org" ON "consent_scan_runs" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_consent_observations_run" ON "consent_tracker_observations" USING btree ("scan_run_id");--> statement-breakpoint
CREATE INDEX "idx_consent_observations_domain_host" ON "consent_tracker_observations" USING btree ("domain_id","observed_host");--> statement-breakpoint
CREATE INDEX "idx_tracker_registry_category" ON "tracker_registry" USING btree ("required_category");--> statement-breakpoint
CREATE INDEX "idx_tracker_registry_vendor_slug" ON "tracker_registry" USING btree ("vendor_slug");