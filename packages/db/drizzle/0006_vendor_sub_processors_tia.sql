CREATE TABLE IF NOT EXISTS "vendor_sub_processors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_vendor_id" uuid NOT NULL,
	"sub_processor_vendor_id" uuid,
	"name" varchar(255),
	"service" varchar(255),
	"country" char(2),
	"website" varchar(500),
	"purpose" text,
	"data_categories" jsonb DEFAULT '[]'::jsonb,
	"processing_locations" jsonb DEFAULT '[]'::jsonb,
	"added_at" timestamp with time zone DEFAULT now(),
	"removed_at" timestamp with time zone,
	"notified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "transfer_impact_assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"vendor_id" uuid,
	"org_vendor_id" uuid,
	"processing_transfer_id" uuid,
	"destination_country" char(2) NOT NULL,
	"data_categories" jsonb DEFAULT '[]'::jsonb,
	"transfer_mechanism" varchar(100) NOT NULL,
	"mechanism_detail" text,
	"surveillance_laws_exist" boolean,
	"surveillance_laws_detail" text,
	"independent_dpa_exists" boolean,
	"effective_remedies_exist" boolean,
	"relevant_case_law" text,
	"legal_assessment_conclusion" varchar(50),
	"legal_assessment_detail" text,
	"technical_measures" jsonb DEFAULT '[]'::jsonb,
	"organizational_measures" jsonb DEFAULT '[]'::jsonb,
	"contractual_measures" jsonb DEFAULT '[]'::jsonb,
	"measures_detail" text,
	"residual_risk_level" varchar(20),
	"residual_risk_justification" text,
	"conclusion" varchar(50),
	"conditions" text,
	"status" varchar(50) DEFAULT 'draft',
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"next_review_at" timestamp with time zone,
	"last_reviewed_at" timestamp with time zone,
	"document_id" uuid,
	"version" integer DEFAULT 1,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);

DO $$ BEGIN
 ALTER TABLE "vendor_sub_processors" ADD CONSTRAINT "vendor_sub_processors_parent_vendor_id_vendors_id_fk" FOREIGN KEY ("parent_vendor_id") REFERENCES "vendors"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "vendor_sub_processors" ADD CONSTRAINT "vendor_sub_processors_sub_processor_vendor_id_vendors_id_fk" FOREIGN KEY ("sub_processor_vendor_id") REFERENCES "vendors"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "transfer_impact_assessments" ADD CONSTRAINT "transfer_impact_assessments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "transfer_impact_assessments" ADD CONSTRAINT "transfer_impact_assessments_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "transfer_impact_assessments" ADD CONSTRAINT "transfer_impact_assessments_org_vendor_id_organization_vendors_id_fk" FOREIGN KEY ("org_vendor_id") REFERENCES "organization_vendors"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "transfer_impact_assessments" ADD CONSTRAINT "transfer_impact_assessments_processing_transfer_id_processing_transfers_id_fk" FOREIGN KEY ("processing_transfer_id") REFERENCES "processing_transfers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "transfer_impact_assessments" ADD CONSTRAINT "transfer_impact_assessments_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "transfer_impact_assessments" ADD CONSTRAINT "transfer_impact_assessments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

ALTER TABLE vendor_sub_processors ADD CONSTRAINT sub_processor_identity CHECK (sub_processor_vendor_id IS NOT NULL OR name IS NOT NULL);
