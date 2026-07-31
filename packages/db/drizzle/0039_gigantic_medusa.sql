ALTER TABLE "api_keys" ALTER COLUMN "scopes" SET DEFAULT '["read"]'::jsonb;--> statement-breakpoint
ALTER TABLE "breaches" ALTER COLUMN "data_categories_affected" SET DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "breaches" ALTER COLUMN "data_subjects_affected" SET DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "breaches" ALTER COLUMN "affected_systems" SET DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "consent_domains" ALTER COLUMN "banner_config" SET DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "consent_domains" ALTER COLUMN "categories" SET DEFAULT '["necessary","analytics","marketing","functional"]'::jsonb;--> statement-breakpoint
ALTER TABLE "consent_records" ALTER COLUMN "categories_rejected" SET DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "documents" ALTER COLUMN "size_bytes" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "organization_integrations" ALTER COLUMN "scopes" SET DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "assessment_templates" ADD COLUMN "remediation_guidance" text;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_as_token_hash" ON "active_sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "idx_consent_records_consent_id" ON "consent_records" USING btree ("consent_id");--> statement-breakpoint
CREATE INDEX "idx_documents_org" ON "documents" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_dsar_tasks_dsar" ON "dsar_tasks" USING btree ("dsar_id");--> statement-breakpoint
CREATE INDEX "idx_ov_vendor" ON "organization_vendors" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX "idx_processing_activities_org" ON "processing_activities" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_users_org" ON "users" USING btree ("organization_id");--> statement-breakpoint
ALTER TABLE "organization_vendors" ADD CONSTRAINT "organization_vendors_org_vendor_unq" UNIQUE("organization_id","vendor_id");