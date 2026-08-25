ALTER TABLE "organization_vendors" ADD COLUMN "business_owner" varchar(255);--> statement-breakpoint
ALTER TABLE "organization_vendors" ADD COLUMN "contact_email" varchar(255);--> statement-breakpoint
ALTER TABLE "organization_vendors" ADD COLUMN "criticality" varchar(20);--> statement-breakpoint
ALTER TABLE "organization_vendors" ADD COLUMN "processing_role" varchar(30);--> statement-breakpoint
ALTER TABLE "organization_vendors" ADD COLUMN "offboarded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "organization_vendors" ADD COLUMN "deletion_certificate_ref" varchar(255);