CREATE TABLE "processing_activity_approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"processing_activity_id" uuid NOT NULL,
	"requested_by" uuid NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"request_note" text,
	"reviewer_id" uuid,
	"decision" varchar(20) DEFAULT 'pending' NOT NULL,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"decision_reason" text,
	"version_id" uuid,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "processing_activity_attestations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"processing_activity_id" uuid NOT NULL,
	"attested_by" uuid NOT NULL,
	"attested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"statement" text,
	"score_at_attestation" integer,
	"version_at_attestation" integer,
	"next_review_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "processing_activity_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"processing_activity_id" uuid NOT NULL,
	"parent_id" uuid,
	"field" varchar(80),
	"body" text NOT NULL,
	"mentions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"author_id" uuid NOT NULL,
	"resolved_by" uuid,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "processing_activity_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"processing_activity_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"section" varchar(40),
	"assignee_id" uuid,
	"due_date" timestamp with time zone,
	"status" varchar(20) DEFAULT 'open' NOT NULL,
	"priority" varchar(20) DEFAULT 'normal' NOT NULL,
	"created_by" uuid,
	"completed_by" uuid,
	"completed_at" timestamp with time zone,
	"reminder_sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "processing_activity_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"processing_activity_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"reason" varchar(30) NOT NULL,
	"note" text,
	"snapshot" jsonb NOT NULL,
	"score" integer,
	"status" varchar(50),
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "processing_activity_versions_activity_version_unq" UNIQUE("processing_activity_id","version")
);
--> statement-breakpoint
CREATE TABLE "ropa_saved_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" text,
	"filters" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_shared" boolean DEFAULT false NOT NULL,
	"default_for_role" varchar(20),
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "ropa_saved_views_org_author_name_unq" UNIQUE("organization_id","created_by","name")
);
--> statement-breakpoint
ALTER TABLE "processing_activities" ADD COLUMN "review_cadence_months" integer;--> statement-breakpoint
ALTER TABLE "processing_activities" ADD COLUMN "approval_state" varchar(20) DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "processing_activities" ADD COLUMN "approval_requested_by" uuid;--> statement-breakpoint
ALTER TABLE "processing_activities" ADD COLUMN "approval_requested_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "processing_activities" ADD COLUMN "current_reviewer_id" uuid;--> statement-breakpoint
ALTER TABLE "processing_activities" ADD COLUMN "approved_by" uuid;--> statement-breakpoint
ALTER TABLE "processing_activities" ADD COLUMN "approved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "processing_activities" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "processing_activities" ADD COLUMN "archived_by" uuid;--> statement-breakpoint
ALTER TABLE "processing_activities" ADD COLUMN "status_before_archive" varchar(50);--> statement-breakpoint
ALTER TABLE "processing_activities" ADD COLUMN "duplicated_from_id" uuid;--> statement-breakpoint
ALTER TABLE "processing_activities" ADD COLUMN "tags" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "processing_activities" ADD COLUMN "completeness_score" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "processing_activity_approvals" ADD CONSTRAINT "processing_activity_approvals_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processing_activity_approvals" ADD CONSTRAINT "processing_activity_approvals_processing_activity_id_processing_activities_id_fk" FOREIGN KEY ("processing_activity_id") REFERENCES "public"."processing_activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processing_activity_approvals" ADD CONSTRAINT "processing_activity_approvals_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processing_activity_approvals" ADD CONSTRAINT "processing_activity_approvals_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processing_activity_approvals" ADD CONSTRAINT "processing_activity_approvals_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processing_activity_attestations" ADD CONSTRAINT "processing_activity_attestations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processing_activity_attestations" ADD CONSTRAINT "processing_activity_attestations_processing_activity_id_processing_activities_id_fk" FOREIGN KEY ("processing_activity_id") REFERENCES "public"."processing_activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processing_activity_attestations" ADD CONSTRAINT "processing_activity_attestations_attested_by_users_id_fk" FOREIGN KEY ("attested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processing_activity_comments" ADD CONSTRAINT "processing_activity_comments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processing_activity_comments" ADD CONSTRAINT "processing_activity_comments_processing_activity_id_processing_activities_id_fk" FOREIGN KEY ("processing_activity_id") REFERENCES "public"."processing_activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processing_activity_comments" ADD CONSTRAINT "processing_activity_comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processing_activity_comments" ADD CONSTRAINT "processing_activity_comments_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processing_activity_tasks" ADD CONSTRAINT "processing_activity_tasks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processing_activity_tasks" ADD CONSTRAINT "processing_activity_tasks_processing_activity_id_processing_activities_id_fk" FOREIGN KEY ("processing_activity_id") REFERENCES "public"."processing_activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processing_activity_tasks" ADD CONSTRAINT "processing_activity_tasks_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processing_activity_tasks" ADD CONSTRAINT "processing_activity_tasks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processing_activity_tasks" ADD CONSTRAINT "processing_activity_tasks_completed_by_users_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processing_activity_versions" ADD CONSTRAINT "processing_activity_versions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processing_activity_versions" ADD CONSTRAINT "processing_activity_versions_processing_activity_id_processing_activities_id_fk" FOREIGN KEY ("processing_activity_id") REFERENCES "public"."processing_activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processing_activity_versions" ADD CONSTRAINT "processing_activity_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ropa_saved_views" ADD CONSTRAINT "ropa_saved_views_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ropa_saved_views" ADD CONSTRAINT "ropa_saved_views_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_papr_activity" ON "processing_activity_approvals" USING btree ("processing_activity_id","requested_at");--> statement-breakpoint
CREATE INDEX "idx_papr_org" ON "processing_activity_approvals" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_papr_one_pending" ON "processing_activity_approvals" USING btree ("processing_activity_id") WHERE decision = 'pending';--> statement-breakpoint
CREATE INDEX "idx_paa_activity" ON "processing_activity_attestations" USING btree ("processing_activity_id","attested_at");--> statement-breakpoint
CREATE INDEX "idx_paa_org" ON "processing_activity_attestations" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_pac_activity" ON "processing_activity_comments" USING btree ("processing_activity_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_pac_org" ON "processing_activity_comments" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_pat_activity" ON "processing_activity_tasks" USING btree ("processing_activity_id","status");--> statement-breakpoint
CREATE INDEX "idx_pat_assignee" ON "processing_activity_tasks" USING btree ("assignee_id","status");--> statement-breakpoint
CREATE INDEX "idx_pat_org" ON "processing_activity_tasks" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_pav_activity" ON "processing_activity_versions" USING btree ("processing_activity_id","version");--> statement-breakpoint
CREATE INDEX "idx_pav_org" ON "processing_activity_versions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_rsv_org" ON "ropa_saved_views" USING btree ("organization_id");--> statement-breakpoint
ALTER TABLE "processing_activities" ADD CONSTRAINT "processing_activities_approval_requested_by_users_id_fk" FOREIGN KEY ("approval_requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processing_activities" ADD CONSTRAINT "processing_activities_current_reviewer_id_users_id_fk" FOREIGN KEY ("current_reviewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processing_activities" ADD CONSTRAINT "processing_activities_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processing_activities" ADD CONSTRAINT "processing_activities_archived_by_users_id_fk" FOREIGN KEY ("archived_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_processing_activities_org_status" ON "processing_activities" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "idx_processing_activities_org_updated" ON "processing_activities" USING btree ("organization_id","updated_at");--> statement-breakpoint
CREATE INDEX "idx_processing_activities_org_review" ON "processing_activities" USING btree ("organization_id","next_review_at");--> statement-breakpoint
CREATE INDEX "idx_processing_activities_deleted" ON "processing_activities" USING btree ("deleted_at");