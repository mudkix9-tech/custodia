CREATE TABLE "data_element_catalogue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"element_group" varchar(100) NOT NULL,
	"description" text,
	"sensitivity" varchar(20) DEFAULT 'standard' NOT NULL,
	"is_special_category" boolean DEFAULT false NOT NULL,
	"special_category_type" varchar(50),
	"is_criminal_data" boolean DEFAULT false NOT NULL,
	"identifiability" varchar(20) DEFAULT 'direct' NOT NULL,
	"format" varchar(50),
	"example" text,
	"is_seeded" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "data_element_catalogue_org_name_unq" UNIQUE("organization_id","name")
);
--> statement-breakpoint
CREATE TABLE "data_subject_category_catalogue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" text,
	"is_child" boolean DEFAULT false NOT NULL,
	"is_vulnerable" boolean DEFAULT false NOT NULL,
	"is_seeded" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "data_subject_category_catalogue_org_name_unq" UNIQUE("organization_id","name")
);
--> statement-breakpoint
CREATE TABLE "processing_data_subjects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"processing_activity_id" uuid NOT NULL,
	"catalogue_id" uuid,
	"category" varchar(120) NOT NULL,
	"is_child" boolean DEFAULT false NOT NULL,
	"is_vulnerable" boolean DEFAULT false NOT NULL,
	"volume_band" varchar(30),
	"jurisdictions" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "processing_data_subjects_activity_category_unq" UNIQUE("processing_activity_id","category")
);
--> statement-breakpoint
ALTER TABLE "processing_activities" ADD COLUMN "involves_profiling" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "processing_activities" ADD COLUMN "involves_automated_decision_making" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "processing_activities" ADD COLUMN "adm_logic" text;--> statement-breakpoint
ALTER TABLE "processing_activities" ADD COLUMN "adm_significance" text;--> statement-breakpoint
ALTER TABLE "processing_activities" ADD COLUMN "adm_human_intervention" text;--> statement-breakpoint
ALTER TABLE "processing_activities" ADD COLUMN "business_owner_id" uuid;--> statement-breakpoint
ALTER TABLE "processing_activities" ADD COLUMN "privacy_owner_id" uuid;--> statement-breakpoint
ALTER TABLE "processing_activities" ADD COLUMN "published_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "processing_activities" ADD COLUMN "published_by" uuid;--> statement-breakpoint
ALTER TABLE "processing_activities" ADD COLUMN "publication_exception_reason" text;--> statement-breakpoint
ALTER TABLE "processing_activities" ADD COLUMN "publication_exception_by" uuid;--> statement-breakpoint
ALTER TABLE "processing_activities" ADD COLUMN "publication_exception_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "processing_data_categories" ADD COLUMN "catalogue_id" uuid;--> statement-breakpoint
ALTER TABLE "processing_data_categories" ADD COLUMN "special_category_type" varchar(50);--> statement-breakpoint
ALTER TABLE "processing_data_categories" ADD COLUMN "article_9_condition" varchar(10);--> statement-breakpoint
ALTER TABLE "processing_data_categories" ADD COLUMN "article_9_national_law_basis" text;--> statement-breakpoint
ALTER TABLE "processing_data_categories" ADD COLUMN "is_criminal_data" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "processing_data_categories" ADD COLUMN "article_10_basis" text;--> statement-breakpoint
ALTER TABLE "processing_data_categories" ADD COLUMN "identifiability" varchar(20);--> statement-breakpoint
ALTER TABLE "processing_data_categories" ADD COLUMN "necessity_justification" text;--> statement-breakpoint
ALTER TABLE "processing_data_categories" ADD COLUMN "retention_period" varchar(100);--> statement-breakpoint
ALTER TABLE "processing_data_categories" ADD COLUMN "retention_trigger" varchar(100);--> statement-breakpoint
ALTER TABLE "processing_data_categories" ADD COLUMN "retention_justification" text;--> statement-breakpoint
ALTER TABLE "processing_recipients" ADD COLUMN "recipient_category" varchar(100);--> statement-breakpoint
ALTER TABLE "processing_recipients" ADD COLUMN "role" varchar(30);--> statement-breakpoint
ALTER TABLE "processing_transfers" ADD COLUMN "scc_year" varchar(10);--> statement-breakpoint
ALTER TABLE "processing_transfers" ADD COLUMN "scc_module" varchar(20);--> statement-breakpoint
ALTER TABLE "processing_transfers" ADD COLUMN "annexes_complete" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "processing_transfers" ADD COLUMN "execution_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "processing_transfers" ADD COLUMN "expiry_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "processing_transfers" ADD COLUMN "signatories" text;--> statement-breakpoint
ALTER TABLE "processing_transfers" ADD COLUMN "document_id" uuid;--> statement-breakpoint
ALTER TABLE "processing_transfers" ADD COLUMN "bcr_reference" varchar(255);--> statement-breakpoint
ALTER TABLE "processing_transfers" ADD COLUMN "adequacy_decision_reference" varchar(255);--> statement-breakpoint
ALTER TABLE "processing_transfers" ADD COLUMN "article_49_sub_reason" varchar(50);--> statement-breakpoint
ALTER TABLE "processing_transfers" ADD COLUMN "article_49_justification" text;--> statement-breakpoint
ALTER TABLE "processing_transfers" ADD COLUMN "dpf_certification_number" varchar(100);--> statement-breakpoint
ALTER TABLE "processing_transfers" ADD COLUMN "dpf_scope" varchar(20);--> statement-breakpoint
ALTER TABLE "processing_transfers" ADD COLUMN "dpf_expiry_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "data_element_catalogue" ADD CONSTRAINT "data_element_catalogue_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_subject_category_catalogue" ADD CONSTRAINT "data_subject_category_catalogue_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processing_data_subjects" ADD CONSTRAINT "processing_data_subjects_processing_activity_id_processing_activities_id_fk" FOREIGN KEY ("processing_activity_id") REFERENCES "public"."processing_activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processing_data_subjects" ADD CONSTRAINT "processing_data_subjects_catalogue_id_data_subject_category_catalogue_id_fk" FOREIGN KEY ("catalogue_id") REFERENCES "public"."data_subject_category_catalogue"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_data_element_catalogue_org" ON "data_element_catalogue" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_data_subject_category_catalogue_org" ON "data_subject_category_catalogue" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_processing_data_subjects_activity" ON "processing_data_subjects" USING btree ("processing_activity_id");--> statement-breakpoint
ALTER TABLE "processing_activities" ADD CONSTRAINT "processing_activities_business_owner_id_users_id_fk" FOREIGN KEY ("business_owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processing_activities" ADD CONSTRAINT "processing_activities_privacy_owner_id_users_id_fk" FOREIGN KEY ("privacy_owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processing_activities" ADD CONSTRAINT "processing_activities_published_by_users_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processing_activities" ADD CONSTRAINT "processing_activities_publication_exception_by_users_id_fk" FOREIGN KEY ("publication_exception_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processing_data_categories" ADD CONSTRAINT "processing_data_categories_catalogue_id_data_element_catalogue_id_fk" FOREIGN KEY ("catalogue_id") REFERENCES "public"."data_element_catalogue"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processing_transfers" ADD CONSTRAINT "processing_transfers_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;