ALTER TABLE "vendors" ADD COLUMN "parent_entity_id" uuid;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "legal_entity_name" varchar(255);--> statement-breakpoint
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_parent_entity_id_vendors_id_fk" FOREIGN KEY ("parent_entity_id") REFERENCES "public"."vendors"("id") ON DELETE set null ON UPDATE no action;