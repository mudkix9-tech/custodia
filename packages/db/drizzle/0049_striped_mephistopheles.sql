CREATE TABLE "legal_hold_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legal_hold_id" uuid NOT NULL,
	"processing_activity_id" uuid NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "legal_hold_activities_hold_activity_unq" UNIQUE("legal_hold_id","processing_activity_id")
);
--> statement-breakpoint
CREATE TABLE "legal_holds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"reference" varchar(120) NOT NULL,
	"reason" text NOT NULL,
	"hold_type" varchar(40) DEFAULT 'litigation' NOT NULL,
	"owner_id" uuid,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"next_review_at" timestamp with time zone,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"released_at" timestamp with time zone,
	"released_by" uuid,
	"release_note" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "material_change_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"processing_activity_id" uuid NOT NULL,
	"from_version_id" uuid,
	"to_version_id" uuid,
	"changes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"materiality" varchar(20) DEFAULT 'advisory' NOT NULL,
	"consequences" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"verdicts" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"evaluated_by" varchar(20) DEFAULT 'rules' NOT NULL,
	"status" varchar(20) DEFAULT 'open' NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"review_note" text,
	"detected_at" timestamp with time zone DEFAULT now(),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "retention_disposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"processing_activity_id" uuid NOT NULL,
	"retention_schedule_id" uuid,
	"data_category_id" uuid,
	"due_key" varchar(64) DEFAULT '' NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"status" varchar(20) DEFAULT 'due' NOT NULL,
	"performed_at" timestamp with time zone,
	"performed_by" uuid,
	"method" varchar(30),
	"record_count" integer,
	"systems" jsonb DEFAULT '[]'::jsonb,
	"evidence" jsonb DEFAULT '[]'::jsonb,
	"note" text,
	"legal_hold_id" uuid,
	"deferred_until" timestamp with time zone,
	"deferral_reason" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "retention_disposals_activity_due_key_unq" UNIQUE("processing_activity_id","due_key")
);
--> statement-breakpoint
CREATE TABLE "retention_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(160) NOT NULL,
	"description" text,
	"period_value" integer,
	"period_unit" varchar(20) DEFAULT 'years' NOT NULL,
	"trigger" varchar(40) DEFAULT 'collection' NOT NULL,
	"trigger_detail" text,
	"statutory_citation" varchar(255),
	"jurisdiction" char(2),
	"justification" text,
	"disposal_method" varchar(30) DEFAULT 'deletion' NOT NULL,
	"owner_id" uuid,
	"review_interval_months" integer,
	"last_reviewed_at" timestamp with time zone,
	"next_review_at" timestamp with time zone,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"archived_at" timestamp with time zone,
	CONSTRAINT "retention_schedules_org_name_unq" UNIQUE("organization_id","name")
);
--> statement-breakpoint
CREATE TABLE "ropa_activity_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"processing_activity_id" uuid,
	"discovery_signal_id" uuid,
	"intake_request_id" uuid,
	"prompt" text NOT NULL,
	"model" varchar(80),
	"proposal" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"decisions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" varchar(20) DEFAULT 'proposed' NOT NULL,
	"applied_activity_id" uuid,
	"applied_at" timestamp with time zone,
	"applied_by" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ropa_completeness_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"captured_on" date NOT NULL,
	"activity_count" integer DEFAULT 0 NOT NULL,
	"active_count" integer DEFAULT 0 NOT NULL,
	"average_score" integer DEFAULT 0 NOT NULL,
	"blocked_count" integer DEFAULT 0 NOT NULL,
	"bands" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"by_requirement" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "ropa_completeness_snapshots_org_day_unq" UNIQUE("organization_id","captured_on")
);
--> statement-breakpoint
CREATE TABLE "ropa_discovery_signals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"source" varchar(30) NOT NULL,
	"source_key" varchar(255) DEFAULT '' NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"confidence" varchar(20) DEFAULT 'medium' NOT NULL,
	"suggested_name" varchar(255),
	"suggested_purpose" text,
	"suggested_lawful_basis" varchar(50),
	"suggested_data_categories" jsonb DEFAULT '[]'::jsonb,
	"suggested_data_subjects" jsonb DEFAULT '[]'::jsonb,
	"suggested_recipients" jsonb DEFAULT '[]'::jsonb,
	"suggested_transfers" jsonb DEFAULT '[]'::jsonb,
	"evidence" jsonb DEFAULT '{}'::jsonb,
	"vendor_id" uuid,
	"consent_domain_id" uuid,
	"integration_id" uuid,
	"status" varchar(20) DEFAULT 'open' NOT NULL,
	"accepted_activity_id" uuid,
	"accepted_at" timestamp with time zone,
	"accepted_by" uuid,
	"dismissed_reason" text,
	"dismissed_at" timestamp with time zone,
	"dismissed_by" uuid,
	"first_seen_at" timestamp with time zone DEFAULT now(),
	"last_seen_at" timestamp with time zone DEFAULT now(),
	"detection_count" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "ropa_discovery_signals_org_source_key_unq" UNIQUE("organization_id","source","source_key")
);
--> statement-breakpoint
CREATE TABLE "ropa_intake_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"processing_activity_id" uuid,
	"token" uuid DEFAULT gen_random_uuid() NOT NULL,
	"kind" varchar(20) DEFAULT 'interview' NOT NULL,
	"recipient_email" varchar(255) NOT NULL,
	"recipient_name" varchar(160),
	"department" varchar(120),
	"subject" varchar(255),
	"message" text,
	"locale" varchar(5) DEFAULT 'en' NOT NULL,
	"questions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"due_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"opened_at" timestamp with time zone,
	"submitted_at" timestamp with time zone,
	"submitted_by_name" varchar(160),
	"declined_reason" text,
	"reminders_sent" integer DEFAULT 0 NOT NULL,
	"last_reminder_at" timestamp with time zone,
	"merged_fields" jsonb DEFAULT '{}'::jsonb,
	"merged_at" timestamp with time zone,
	"merged_by" uuid,
	"created_activity_id" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "ropa_intake_requests_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "processing_activities" ADD COLUMN "retention_schedule_id" uuid;--> statement-breakpoint
ALTER TABLE "processing_activities" ADD COLUMN "retention_anchor_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "processing_data_categories" ADD COLUMN "retention_schedule_id" uuid;--> statement-breakpoint
ALTER TABLE "reconsent_flags" ADD COLUMN "material_change_event_id" uuid;--> statement-breakpoint
ALTER TABLE "legal_hold_activities" ADD CONSTRAINT "legal_hold_activities_legal_hold_id_legal_holds_id_fk" FOREIGN KEY ("legal_hold_id") REFERENCES "public"."legal_holds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_hold_activities" ADD CONSTRAINT "legal_hold_activities_processing_activity_id_processing_activities_id_fk" FOREIGN KEY ("processing_activity_id") REFERENCES "public"."processing_activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_holds" ADD CONSTRAINT "legal_holds_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_holds" ADD CONSTRAINT "legal_holds_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_holds" ADD CONSTRAINT "legal_holds_released_by_users_id_fk" FOREIGN KEY ("released_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_holds" ADD CONSTRAINT "legal_holds_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_change_events" ADD CONSTRAINT "material_change_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_change_events" ADD CONSTRAINT "material_change_events_processing_activity_id_processing_activities_id_fk" FOREIGN KEY ("processing_activity_id") REFERENCES "public"."processing_activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_change_events" ADD CONSTRAINT "material_change_events_from_version_id_processing_activity_versions_id_fk" FOREIGN KEY ("from_version_id") REFERENCES "public"."processing_activity_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_change_events" ADD CONSTRAINT "material_change_events_to_version_id_processing_activity_versions_id_fk" FOREIGN KEY ("to_version_id") REFERENCES "public"."processing_activity_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_change_events" ADD CONSTRAINT "material_change_events_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retention_disposals" ADD CONSTRAINT "retention_disposals_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retention_disposals" ADD CONSTRAINT "retention_disposals_processing_activity_id_processing_activities_id_fk" FOREIGN KEY ("processing_activity_id") REFERENCES "public"."processing_activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retention_disposals" ADD CONSTRAINT "retention_disposals_retention_schedule_id_retention_schedules_id_fk" FOREIGN KEY ("retention_schedule_id") REFERENCES "public"."retention_schedules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retention_disposals" ADD CONSTRAINT "retention_disposals_data_category_id_processing_data_categories_id_fk" FOREIGN KEY ("data_category_id") REFERENCES "public"."processing_data_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retention_disposals" ADD CONSTRAINT "retention_disposals_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retention_disposals" ADD CONSTRAINT "retention_disposals_legal_hold_id_legal_holds_id_fk" FOREIGN KEY ("legal_hold_id") REFERENCES "public"."legal_holds"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retention_schedules" ADD CONSTRAINT "retention_schedules_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retention_schedules" ADD CONSTRAINT "retention_schedules_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retention_schedules" ADD CONSTRAINT "retention_schedules_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ropa_activity_drafts" ADD CONSTRAINT "ropa_activity_drafts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ropa_activity_drafts" ADD CONSTRAINT "ropa_activity_drafts_processing_activity_id_processing_activities_id_fk" FOREIGN KEY ("processing_activity_id") REFERENCES "public"."processing_activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ropa_activity_drafts" ADD CONSTRAINT "ropa_activity_drafts_discovery_signal_id_ropa_discovery_signals_id_fk" FOREIGN KEY ("discovery_signal_id") REFERENCES "public"."ropa_discovery_signals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ropa_activity_drafts" ADD CONSTRAINT "ropa_activity_drafts_intake_request_id_ropa_intake_requests_id_fk" FOREIGN KEY ("intake_request_id") REFERENCES "public"."ropa_intake_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ropa_activity_drafts" ADD CONSTRAINT "ropa_activity_drafts_applied_activity_id_processing_activities_id_fk" FOREIGN KEY ("applied_activity_id") REFERENCES "public"."processing_activities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ropa_activity_drafts" ADD CONSTRAINT "ropa_activity_drafts_applied_by_users_id_fk" FOREIGN KEY ("applied_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ropa_activity_drafts" ADD CONSTRAINT "ropa_activity_drafts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ropa_completeness_snapshots" ADD CONSTRAINT "ropa_completeness_snapshots_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ropa_discovery_signals" ADD CONSTRAINT "ropa_discovery_signals_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ropa_discovery_signals" ADD CONSTRAINT "ropa_discovery_signals_consent_domain_id_consent_domains_id_fk" FOREIGN KEY ("consent_domain_id") REFERENCES "public"."consent_domains"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ropa_discovery_signals" ADD CONSTRAINT "ropa_discovery_signals_integration_id_organization_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."organization_integrations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ropa_discovery_signals" ADD CONSTRAINT "ropa_discovery_signals_accepted_activity_id_processing_activities_id_fk" FOREIGN KEY ("accepted_activity_id") REFERENCES "public"."processing_activities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ropa_discovery_signals" ADD CONSTRAINT "ropa_discovery_signals_accepted_by_users_id_fk" FOREIGN KEY ("accepted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ropa_discovery_signals" ADD CONSTRAINT "ropa_discovery_signals_dismissed_by_users_id_fk" FOREIGN KEY ("dismissed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ropa_intake_requests" ADD CONSTRAINT "ropa_intake_requests_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ropa_intake_requests" ADD CONSTRAINT "ropa_intake_requests_processing_activity_id_processing_activities_id_fk" FOREIGN KEY ("processing_activity_id") REFERENCES "public"."processing_activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ropa_intake_requests" ADD CONSTRAINT "ropa_intake_requests_merged_by_users_id_fk" FOREIGN KEY ("merged_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ropa_intake_requests" ADD CONSTRAINT "ropa_intake_requests_created_activity_id_processing_activities_id_fk" FOREIGN KEY ("created_activity_id") REFERENCES "public"."processing_activities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ropa_intake_requests" ADD CONSTRAINT "ropa_intake_requests_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_legal_hold_activities_hold" ON "legal_hold_activities" USING btree ("legal_hold_id");--> statement-breakpoint
CREATE INDEX "idx_legal_hold_activities_activity" ON "legal_hold_activities" USING btree ("processing_activity_id");--> statement-breakpoint
CREATE INDEX "idx_legal_holds_org" ON "legal_holds" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_legal_holds_org_status" ON "legal_holds" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "idx_material_change_org" ON "material_change_events" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_material_change_org_status" ON "material_change_events" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "idx_material_change_activity" ON "material_change_events" USING btree ("processing_activity_id");--> statement-breakpoint
CREATE INDEX "idx_retention_disposals_org" ON "retention_disposals" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_retention_disposals_org_status_due" ON "retention_disposals" USING btree ("organization_id","status","due_at");--> statement-breakpoint
CREATE INDEX "idx_retention_disposals_activity" ON "retention_disposals" USING btree ("processing_activity_id");--> statement-breakpoint
CREATE INDEX "idx_retention_schedules_org" ON "retention_schedules" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_retention_schedules_org_review" ON "retention_schedules" USING btree ("organization_id","next_review_at");--> statement-breakpoint
CREATE INDEX "idx_ropa_drafts_org" ON "ropa_activity_drafts" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_ropa_drafts_org_status" ON "ropa_activity_drafts" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "idx_ropa_drafts_activity" ON "ropa_activity_drafts" USING btree ("processing_activity_id");--> statement-breakpoint
CREATE INDEX "idx_ropa_completeness_snapshots_org" ON "ropa_completeness_snapshots" USING btree ("organization_id","captured_on");--> statement-breakpoint
CREATE INDEX "idx_ropa_discovery_org" ON "ropa_discovery_signals" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_ropa_discovery_org_status" ON "ropa_discovery_signals" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "idx_ropa_intake_org" ON "ropa_intake_requests" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_ropa_intake_org_status" ON "ropa_intake_requests" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "idx_ropa_intake_activity" ON "ropa_intake_requests" USING btree ("processing_activity_id");--> statement-breakpoint
CREATE INDEX "idx_ropa_intake_due" ON "ropa_intake_requests" USING btree ("status","due_at");