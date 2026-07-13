CREATE TABLE "organization_vendors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"vendor_id" uuid NOT NULL,
	"status" varchar(50) DEFAULT 'active',
	"added_by" uuid,
	"dpa_status" varchar(50) DEFAULT 'not_started',
	"dpa_signed_at" timestamp with time zone,
	"dpa_expires_at" timestamp with time zone,
	"dpa_document_id" uuid,
	"dpa_notes" text,
	"tia_required" boolean DEFAULT false,
	"tia_completed" boolean DEFAULT false,
	"tia_document_id" uuid,
	"data_categories_shared" jsonb DEFAULT '[]'::jsonb,
	"processing_activities" jsonb DEFAULT '[]'::jsonb,
	"purpose" text,
	"last_reviewed_at" timestamp with time zone,
	"next_review_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "vendors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"is_global" boolean DEFAULT false,
	"organization_id" uuid,
	"name" varchar(255) NOT NULL,
	"slug" varchar(100),
	"website" varchar(500),
	"logo_url" varchar(500),
	"description" text,
	"category" varchar(100),
	"headquarters_country" char(2),
	"data_processing_locations" jsonb DEFAULT '[]'::jsonb,
	"dpa_url" varchar(500),
	"dpa_available" boolean DEFAULT false,
	"privacy_policy_url" varchar(500),
	"transfer_mechanisms" jsonb DEFAULT '[]'::jsonb,
	"eu_hosting_available" boolean DEFAULT false,
	"eu_hosting_detail" text,
	"security_certifications" jsonb DEFAULT '[]'::jsonb,
	"encryption_at_rest" boolean,
	"encryption_in_transit" boolean,
	"sub_processor_list_url" varchar(500),
	"sub_processor_notification" varchar(100),
	"typical_data_categories" jsonb DEFAULT '[]'::jsonb,
	"risk_score" integer,
	"risk_level" varchar(20),
	"risk_factors" jsonb DEFAULT '[]'::jsonb,
	"known_incidents" jsonb DEFAULT '[]'::jsonb,
	"regulatory_actions" jsonb DEFAULT '[]'::jsonb,
	"last_verified_at" timestamp with time zone,
	"verified_by" varchar(100),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "organization_vendors" ADD CONSTRAINT "organization_vendors_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_vendors" ADD CONSTRAINT "organization_vendors_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_vendors" ADD CONSTRAINT "organization_vendors_added_by_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;