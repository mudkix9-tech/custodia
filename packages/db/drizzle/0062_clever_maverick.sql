ALTER TABLE "vendor_field_provenance" DROP CONSTRAINT "vendor_field_provenance_vendor_field_unq";--> statement-breakpoint
ALTER TABLE "vendor_field_provenance" ADD COLUMN "review_by" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "vendor_field_provenance" ADD CONSTRAINT "vendor_field_provenance_vendor_field_unq" UNIQUE("vendor_id","field_name","source_type");