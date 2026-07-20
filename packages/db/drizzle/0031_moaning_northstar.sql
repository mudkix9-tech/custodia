ALTER TABLE "regulatory_update_matches" DROP CONSTRAINT "regulatory_update_matches_acknowledged_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "dpias" ALTER COLUMN "last_mitigation_reminder_sent_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "dpias" ALTER COLUMN "last_mitigation_reminder_sent_at" SET DATA TYPE timestamp with time zone USING ("last_mitigation_reminder_sent_at"#>>'{}')::timestamp with time zone;--> statement-breakpoint
ALTER TABLE "regulatory_update_matches" ALTER COLUMN "confidence" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "regulatory_update_matches" ALTER COLUMN "match_strength" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "custom_roles" ADD COLUMN "entity_scope" varchar(20) DEFAULT 'own';--> statement-breakpoint
ALTER TABLE "regulatory_update_matches" ADD CONSTRAINT "regulatory_update_matches_acknowledged_by_users_id_fk" FOREIGN KEY ("acknowledged_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_gaps_dpia" ON "compliance_gaps" USING btree ("dpia_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_gaps_dpia_risk" ON "compliance_gaps" USING btree ("dpia_id","dpia_risk_id");