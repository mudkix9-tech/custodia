CREATE TABLE "dpia_screenings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"processing_activity_id" uuid NOT NULL,
	"answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"criteria_met" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"blacklist_matches" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"verdict" varchar(20),
	"decision" varchar(20),
	"rationale" text,
	"jurisdiction" char(2),
	"dpia_id" uuid,
	"status" varchar(20) DEFAULT 'open' NOT NULL,
	"superseded_by_id" uuid,
	"screened_by" uuid,
	"screened_at" timestamp with time zone,
	"next_review_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "dpia_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"dpia_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"reason" varchar(30) NOT NULL,
	"note" text,
	"snapshot" jsonb NOT NULL,
	"content_hash" varchar(64),
	"status" varchar(50),
	"residual_risk_level" varchar(20),
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dpia_versions_dpia_version_unq" UNIQUE("dpia_id","version")
);
--> statement-breakpoint
ALTER TABLE "legitimate_interest_assessments" ALTER COLUMN "purpose_test_legitimate_interest" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "legitimate_interest_assessments" ALTER COLUMN "necessity_test_is_necessary" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "legitimate_interest_assessments" ALTER COLUMN "balancing_test_impact" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "legitimate_interest_assessments" ALTER COLUMN "balancing_test_overrides" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "legitimate_interest_assessments" ALTER COLUMN "outcome" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "parent_resource_id" varchar(255);--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "child_resource_type" varchar(100);--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "controller_address" jsonb;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "controller_representative" jsonb;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "controller_dpo_name" varchar(255);--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "controller_dpo_email" varchar(255);--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "processing_categories" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "dpia_measures" ADD COLUMN "measure_type" varchar(30);--> statement-breakpoint
ALTER TABLE "dpia_measures" ADD COLUMN "owner_id" uuid;--> statement-breakpoint
ALTER TABLE "dpia_measures" ADD COLUMN "due_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "dpia_measures" ADD COLUMN "effectiveness" varchar(20);--> statement-breakpoint
ALTER TABLE "dpia_measures" ADD COLUMN "evidence" text;--> statement-breakpoint
ALTER TABLE "dpia_measures" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now();--> statement-breakpoint
ALTER TABLE "dpia_risks" ADD COLUMN "residual_likelihood" integer;--> statement-breakpoint
ALTER TABLE "dpia_risks" ADD COLUMN "residual_severity" integer;--> statement-breakpoint
ALTER TABLE "dpia_risks" ADD COLUMN "risk_category" varchar(40);--> statement-breakpoint
ALTER TABLE "dpia_risks" ADD COLUMN "harms" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "dpia_risks" ADD COLUMN "affected_subjects" text;--> statement-breakpoint
ALTER TABLE "dpia_risks" ADD COLUMN "source_of_risk" text;--> statement-breakpoint
ALTER TABLE "dpia_risks" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now();--> statement-breakpoint
ALTER TABLE "dpias" ADD COLUMN "purposes" text;--> statement-breakpoint
ALTER TABLE "dpias" ADD COLUMN "scope_description" text;--> statement-breakpoint
ALTER TABLE "dpias" ADD COLUMN "context_description" text;--> statement-breakpoint
ALTER TABLE "dpias" ADD COLUMN "legitimate_interest_pursued" text;--> statement-breakpoint
ALTER TABLE "dpias" ADD COLUMN "data_flow_description" text;--> statement-breakpoint
ALTER TABLE "dpias" ADD COLUMN "dpo_consulted" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "dpias" ADD COLUMN "dpo_opinion" text;--> statement-breakpoint
ALTER TABLE "dpias" ADD COLUMN "dpo_opinion_outcome" varchar(30);--> statement-breakpoint
ALTER TABLE "dpias" ADD COLUMN "dpo_opinion_by" uuid;--> statement-breakpoint
ALTER TABLE "dpias" ADD COLUMN "dpo_opinion_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "dpias" ADD COLUMN "dpo_advice_followed" boolean;--> statement-breakpoint
ALTER TABLE "dpias" ADD COLUMN "dpo_advice_departure_reason" text;--> statement-breakpoint
ALTER TABLE "dpias" ADD COLUMN "consultation_sought" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "dpias" ADD COLUMN "consultation_method" varchar(60);--> statement-breakpoint
ALTER TABLE "dpias" ADD COLUMN "consultation_summary" text;--> statement-breakpoint
ALTER TABLE "dpias" ADD COLUMN "consultation_not_sought_reason" text;--> statement-breakpoint
ALTER TABLE "dpias" ADD COLUMN "consultation_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "dpias" ADD COLUMN "sign_off_decision" varchar(30);--> statement-breakpoint
ALTER TABLE "dpias" ADD COLUMN "sign_off_conditions" text;--> statement-breakpoint
ALTER TABLE "dpias" ADD COLUMN "signed_off_by" uuid;--> statement-breakpoint
ALTER TABLE "dpias" ADD COLUMN "signed_off_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "dpias" ADD COLUMN "prior_consultation_status" varchar(30);--> statement-breakpoint
ALTER TABLE "dpias" ADD COLUMN "prior_consultation_authority" varchar(120);--> statement-breakpoint
ALTER TABLE "dpias" ADD COLUMN "prior_consultation_submitted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "dpias" ADD COLUMN "prior_consultation_reference" varchar(120);--> statement-breakpoint
ALTER TABLE "dpias" ADD COLUMN "prior_consultation_response" text;--> statement-breakpoint
ALTER TABLE "dpias" ADD COLUMN "prior_consultation_responded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "dpias" ADD COLUMN "template_id" varchar(60);--> statement-breakpoint
ALTER TABLE "dpias" ADD COLUMN "screening_id" uuid;--> statement-breakpoint
ALTER TABLE "dpias" ADD COLUMN "owner_id" uuid;--> statement-breakpoint
ALTER TABLE "dpias" ADD COLUMN "review_cadence_months" integer;--> statement-breakpoint
ALTER TABLE "dpias" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "dpias" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "legitimate_interest_assessments" ADD COLUMN "status" varchar(20) DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "legitimate_interest_assessments" ADD COLUMN "title" varchar(255);--> statement-breakpoint
ALTER TABLE "legitimate_interest_assessments" ADD COLUMN "purpose_test_beneficiary" varchar(30);--> statement-breakpoint
ALTER TABLE "legitimate_interest_assessments" ADD COLUMN "purpose_test_importance" varchar(30);--> statement-breakpoint
ALTER TABLE "legitimate_interest_assessments" ADD COLUMN "necessity_test_proportionate" boolean;--> statement-breakpoint
ALTER TABLE "legitimate_interest_assessments" ADD COLUMN "balancing_test_involves_children" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "legitimate_interest_assessments" ADD COLUMN "balancing_test_involves_special_category" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "legitimate_interest_assessments" ADD COLUMN "balancing_test_relationship" text;--> statement-breakpoint
ALTER TABLE "legitimate_interest_assessments" ADD COLUMN "objection_mechanism" text;--> statement-breakpoint
ALTER TABLE "legitimate_interest_assessments" ADD COLUMN "opt_out_offered" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "legitimate_interest_assessments" ADD COLUMN "outcome_rationale" text;--> statement-breakpoint
ALTER TABLE "legitimate_interest_assessments" ADD COLUMN "evidence" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "legitimate_interest_assessments" ADD COLUMN "completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "legitimate_interest_assessments" ADD COLUMN "last_reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "legitimate_interest_assessments" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "legitimate_interest_assessments" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "processing_activity_versions" ADD COLUMN "content_hash" varchar(64);--> statement-breakpoint
ALTER TABLE "transfer_impact_assessments" ADD COLUMN "processing_activity_id" uuid;--> statement-breakpoint
ALTER TABLE "transfer_impact_assessments" ADD COLUMN "title" varchar(255);--> statement-breakpoint
ALTER TABLE "transfer_impact_assessments" ADD COLUMN "data_exporter" varchar(255);--> statement-breakpoint
ALTER TABLE "transfer_impact_assessments" ADD COLUMN "data_importer" varchar(255);--> statement-breakpoint
ALTER TABLE "transfer_impact_assessments" ADD COLUMN "transfer_purpose" text;--> statement-breakpoint
ALTER TABLE "transfer_impact_assessments" ADD COLUMN "data_subject_categories" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "transfer_impact_assessments" ADD COLUMN "transfer_frequency" varchar(40);--> statement-breakpoint
ALTER TABLE "transfer_impact_assessments" ADD COLUMN "onward_transfers" text;--> statement-breakpoint
ALTER TABLE "transfer_impact_assessments" ADD COLUMN "reevaluation_interval_months" integer;--> statement-breakpoint
ALTER TABLE "transfer_impact_assessments" ADD COLUMN "reevaluation_triggers" text;--> statement-breakpoint
ALTER TABLE "transfer_impact_assessments" ADD COLUMN "suspended_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "transfer_impact_assessments" ADD COLUMN "suspended_by" uuid;--> statement-breakpoint
ALTER TABLE "transfer_impact_assessments" ADD COLUMN "suspension_reason" text;--> statement-breakpoint
ALTER TABLE "transfer_impact_assessments" ADD COLUMN "assessed_by" uuid;--> statement-breakpoint
ALTER TABLE "dpia_screenings" ADD CONSTRAINT "dpia_screenings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dpia_screenings" ADD CONSTRAINT "dpia_screenings_processing_activity_id_processing_activities_id_fk" FOREIGN KEY ("processing_activity_id") REFERENCES "public"."processing_activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dpia_screenings" ADD CONSTRAINT "dpia_screenings_screened_by_users_id_fk" FOREIGN KEY ("screened_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dpia_screenings" ADD CONSTRAINT "dpia_screenings_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dpia_versions" ADD CONSTRAINT "dpia_versions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dpia_versions" ADD CONSTRAINT "dpia_versions_dpia_id_dpias_id_fk" FOREIGN KEY ("dpia_id") REFERENCES "public"."dpias"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dpia_versions" ADD CONSTRAINT "dpia_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_dpia_screenings_activity" ON "dpia_screenings" USING btree ("processing_activity_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_dpia_screenings_org" ON "dpia_screenings" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "idx_dpia_versions_dpia" ON "dpia_versions" USING btree ("dpia_id","version");--> statement-breakpoint
CREATE INDEX "idx_dpia_versions_org" ON "dpia_versions" USING btree ("organization_id");--> statement-breakpoint
ALTER TABLE "dpia_measures" ADD CONSTRAINT "dpia_measures_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dpias" ADD CONSTRAINT "dpias_dpo_opinion_by_users_id_fk" FOREIGN KEY ("dpo_opinion_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dpias" ADD CONSTRAINT "dpias_signed_off_by_users_id_fk" FOREIGN KEY ("signed_off_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dpias" ADD CONSTRAINT "dpias_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dpias" ADD CONSTRAINT "dpias_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legitimate_interest_assessments" ADD CONSTRAINT "legitimate_interest_assessments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfer_impact_assessments" ADD CONSTRAINT "transfer_impact_assessments_processing_activity_id_processing_activities_id_fk" FOREIGN KEY ("processing_activity_id") REFERENCES "public"."processing_activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfer_impact_assessments" ADD CONSTRAINT "transfer_impact_assessments_suspended_by_users_id_fk" FOREIGN KEY ("suspended_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfer_impact_assessments" ADD CONSTRAINT "transfer_impact_assessments_assessed_by_users_id_fk" FOREIGN KEY ("assessed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_audit_logs_org_resource" ON "audit_logs" USING btree ("organization_id","resource_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_parent" ON "audit_logs" USING btree ("parent_resource_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_dpia_measures_risk" ON "dpia_measures" USING btree ("dpia_risk_id");--> statement-breakpoint
CREATE INDEX "idx_dpia_risks_dpia" ON "dpia_risks" USING btree ("dpia_id");--> statement-breakpoint
CREATE INDEX "idx_dpias_org" ON "dpias" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "idx_dpias_review" ON "dpias" USING btree ("organization_id","next_review_at");--> statement-breakpoint
CREATE INDEX "idx_lia_activity" ON "legitimate_interest_assessments" USING btree ("processing_activity_id");--> statement-breakpoint
CREATE INDEX "idx_lia_org" ON "legitimate_interest_assessments" USING btree ("organization_id","status");