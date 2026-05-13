CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"uploader_id" uuid,
	"filename" varchar(255) NOT NULL,
	"original_name" varchar(255) NOT NULL,
	"mime_type" varchar(100),
	"size_bytes" integer,
	"s3_key" varchar(500) NOT NULL,
	"encryption_key_id" varchar(255),
	"status" varchar(50) DEFAULT 'active',
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "dpia_measures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dpia_risk_id" uuid NOT NULL,
	"description" text NOT NULL,
	"status" varchar(50) DEFAULT 'planned',
	"implemented_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "dpia_risks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dpia_id" uuid NOT NULL,
	"description" text NOT NULL,
	"likelihood" integer,
	"severity" integer,
	"initial_risk_score" integer,
	"residual_risk_score" integer,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "dpias" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"processing_activity_ids" jsonb DEFAULT '[]'::jsonb,
	"processing_description" text,
	"necessity_assessment" text,
	"proportionality_assessment" text,
	"overall_risk_level" varchar(20),
	"residual_risk_level" varchar(20),
	"requires_prior_consultation" boolean DEFAULT false,
	"status" varchar(50) DEFAULT 'draft',
	"version" integer DEFAULT 1,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"last_reviewed_at" timestamp with time zone,
	"next_review_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "legitimate_interest_assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"processing_activity_id" uuid NOT NULL,
	"purpose_test_legitimate_interest" text NOT NULL,
	"purpose_test_is_lawful" boolean DEFAULT true,
	"purpose_test_evidence" text,
	"necessity_test_is_necessary" text NOT NULL,
	"necessity_test_alternatives" text,
	"necessity_test_conclusion" text,
	"balancing_test_impact" text NOT NULL,
	"balancing_test_expectation" text,
	"balancing_test_safeguards" text,
	"balancing_test_overrides" text NOT NULL,
	"outcome" varchar(50) NOT NULL,
	"assessed_by" uuid,
	"assessed_at" timestamp with time zone DEFAULT now(),
	"next_review_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "processing_data_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"processing_activity_id" uuid NOT NULL,
	"category" varchar(100) NOT NULL,
	"category_group" varchar(100) NOT NULL,
	"description" text,
	"source" varchar(100),
	"source_detail" text,
	"is_special_category" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "processing_recipients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"processing_activity_id" uuid NOT NULL,
	"recipient_type" varchar(50) NOT NULL,
	"name" varchar(255) NOT NULL,
	"vendor_id" uuid,
	"purpose" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "processing_transfers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"processing_activity_id" uuid NOT NULL,
	"destination_country" char(2) NOT NULL,
	"destination_entity" varchar(255),
	"vendor_id" uuid,
	"transfer_mechanism" varchar(100) NOT NULL,
	"mechanism_detail" text,
	"tia_required" boolean DEFAULT false,
	"tia_completed" boolean DEFAULT false,
	"tia_risk_level" varchar(20),
	"tia_document_id" uuid,
	"supplementary_measures" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploader_id_users_id_fk" FOREIGN KEY ("uploader_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dpia_measures" ADD CONSTRAINT "dpia_measures_dpia_risk_id_dpia_risks_id_fk" FOREIGN KEY ("dpia_risk_id") REFERENCES "public"."dpia_risks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dpia_risks" ADD CONSTRAINT "dpia_risks_dpia_id_dpias_id_fk" FOREIGN KEY ("dpia_id") REFERENCES "public"."dpias"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dpias" ADD CONSTRAINT "dpias_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dpias" ADD CONSTRAINT "dpias_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legitimate_interest_assessments" ADD CONSTRAINT "legitimate_interest_assessments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legitimate_interest_assessments" ADD CONSTRAINT "legitimate_interest_assessments_processing_activity_id_processing_activities_id_fk" FOREIGN KEY ("processing_activity_id") REFERENCES "public"."processing_activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legitimate_interest_assessments" ADD CONSTRAINT "legitimate_interest_assessments_assessed_by_users_id_fk" FOREIGN KEY ("assessed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processing_data_categories" ADD CONSTRAINT "processing_data_categories_processing_activity_id_processing_activities_id_fk" FOREIGN KEY ("processing_activity_id") REFERENCES "public"."processing_activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processing_recipients" ADD CONSTRAINT "processing_recipients_processing_activity_id_processing_activities_id_fk" FOREIGN KEY ("processing_activity_id") REFERENCES "public"."processing_activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processing_transfers" ADD CONSTRAINT "processing_transfers_processing_activity_id_processing_activities_id_fk" FOREIGN KEY ("processing_activity_id") REFERENCES "public"."processing_activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processing_transfers" ADD CONSTRAINT "processing_transfers_tia_document_id_documents_id_fk" FOREIGN KEY ("tia_document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;