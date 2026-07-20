CREATE TABLE "regulatory_update_matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"regulatory_update_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"matched_entity_type" text NOT NULL,
	"matched_entity_id" uuid NOT NULL,
	"similarity_score" real NOT NULL,
	"detected_at" timestamp with time zone DEFAULT now(),
	"status" text DEFAULT 'pending_assessment'
);
--> statement-breakpoint
ALTER TABLE "regulatory_update_matches" ADD CONSTRAINT "regulatory_update_matches_regulatory_update_id_regulatory_updates_id_fk" FOREIGN KEY ("regulatory_update_id") REFERENCES "public"."regulatory_updates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regulatory_update_matches" ADD CONSTRAINT "regulatory_update_matches_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_reg_matches_org" ON "regulatory_update_matches" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_reg_matches_update" ON "regulatory_update_matches" USING btree ("regulatory_update_id");--> statement-breakpoint
CREATE INDEX "idx_reg_matches_similarity" ON "regulatory_update_matches" USING btree ("similarity_score");--> statement-breakpoint