CREATE TABLE "dpf_registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name_key" varchar(255) NOT NULL,
	"organisation_name" varchar(500) NOT NULL,
	"domains" text[] DEFAULT ARRAY[]::text[],
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"certification_date" date,
	"recertification_date" date,
	"next_recertification_date" date,
	"covered_entities" jsonb DEFAULT '[]'::jsonb,
	"source_url" text,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dpf_registrations_name_key_unq" UNIQUE("name_key")
);
--> statement-breakpoint
CREATE TABLE "vendor_candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid,
	"name" varchar(255) NOT NULL,
	"slug" varchar(100),
	"domain" varchar(255) DEFAULT '' NOT NULL,
	"category" varchar(100),
	"payload" jsonb NOT NULL,
	"probe_results" jsonb DEFAULT '{}'::jsonb,
	"grounding" jsonb,
	"confidence" integer DEFAULT 0 NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"rejection_reason" text,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"created_vendor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "vendor_candidates_domain_unq" UNIQUE("domain")
);
--> statement-breakpoint
CREATE TABLE "vendor_field_provenance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" uuid NOT NULL,
	"field_name" varchar(100) NOT NULL,
	"value" jsonb,
	"source_type" varchar(20) NOT NULL,
	"source_url" text,
	"confidence" integer DEFAULT 0 NOT NULL,
	"evidence_snippet" text,
	"retrieved_at" timestamp with time zone DEFAULT now() NOT NULL,
	"verified_by" varchar(255),
	"verified_at" timestamp with time zone,
	CONSTRAINT "vendor_field_provenance_vendor_field_unq" UNIQUE("vendor_id","field_name")
);
--> statement-breakpoint
CREATE TABLE "vendor_intelligence_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" varchar(30) NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"targets" jsonb DEFAULT '[]'::jsonb,
	"processed" integer DEFAULT 0 NOT NULL,
	"accepted" integer DEFAULT 0 NOT NULL,
	"rejected" integer DEFAULT 0 NOT NULL,
	"failed" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"cursor" integer DEFAULT 0 NOT NULL,
	"triggered_by" uuid,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "vendor_sub_processor_entities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_vendor_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"name_key" varchar(255) DEFAULT '' NOT NULL,
	"service" varchar(255),
	"country" char(2),
	"purpose" text,
	"website" varchar(500),
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"removed_at" timestamp with time zone,
	CONSTRAINT "vendor_sub_processor_entities_parent_name_unq" UNIQUE("parent_vendor_id","name_key")
);
--> statement-breakpoint
ALTER TABLE "vendor_candidates" ADD CONSTRAINT "vendor_candidates_run_id_vendor_intelligence_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."vendor_intelligence_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_candidates" ADD CONSTRAINT "vendor_candidates_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_candidates" ADD CONSTRAINT "vendor_candidates_created_vendor_id_vendors_id_fk" FOREIGN KEY ("created_vendor_id") REFERENCES "public"."vendors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_field_provenance" ADD CONSTRAINT "vendor_field_provenance_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_intelligence_runs" ADD CONSTRAINT "vendor_intelligence_runs_triggered_by_users_id_fk" FOREIGN KEY ("triggered_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_sub_processor_entities" ADD CONSTRAINT "vendor_sub_processor_entities_parent_vendor_id_vendors_id_fk" FOREIGN KEY ("parent_vendor_id") REFERENCES "public"."vendors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_vc_status" ON "vendor_candidates" USING btree ("status","confidence");