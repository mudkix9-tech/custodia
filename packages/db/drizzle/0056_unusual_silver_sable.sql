CREATE TABLE "vendor_intake_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"requested_by" uuid,
	"requester_name" varchar(255),
	"requester_email" varchar(255),
	"vendor_name" varchar(255) NOT NULL,
	"vendor_website" varchar(500),
	"category" varchar(100),
	"business_owner" varchar(255),
	"purpose" text,
	"data_categories" jsonb DEFAULT '[]'::jsonb,
	"estimated_data_subjects" varchar(50),
	"criticality" varchar(20) DEFAULT 'medium',
	"status" varchar(50) DEFAULT 'pending_review' NOT NULL,
	"review_notes" text,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"created_vendor_id" uuid,
	"created_org_vendor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organization_vendors" ADD COLUMN "review_cadence" varchar(30) DEFAULT 'annual';--> statement-breakpoint
ALTER TABLE "vendor_intake_requests" ADD CONSTRAINT "vendor_intake_requests_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_intake_requests" ADD CONSTRAINT "vendor_intake_requests_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_intake_requests" ADD CONSTRAINT "vendor_intake_requests_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_intake_requests" ADD CONSTRAINT "vendor_intake_requests_created_vendor_id_vendors_id_fk" FOREIGN KEY ("created_vendor_id") REFERENCES "public"."vendors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_intake_requests" ADD CONSTRAINT "vendor_intake_requests_created_org_vendor_id_organization_vendors_id_fk" FOREIGN KEY ("created_org_vendor_id") REFERENCES "public"."organization_vendors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_vir_org_status" ON "vendor_intake_requests" USING btree ("organization_id","status");