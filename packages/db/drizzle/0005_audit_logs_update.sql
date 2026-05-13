ALTER TABLE "audit_logs" DROP COLUMN IF EXISTS "new_value";
ALTER TABLE "audit_logs" ADD COLUMN "user_email" varchar(255);
ALTER TABLE "audit_logs" ADD COLUMN "resource_type" varchar(100);
ALTER TABLE "audit_logs" ADD COLUMN "resource_id" varchar(255);
ALTER TABLE "audit_logs" ADD COLUMN "description" text NOT NULL DEFAULT '';
ALTER TABLE "audit_logs" ADD COLUMN "changes" jsonb;
ALTER TABLE "audit_logs" ADD COLUMN "metadata" jsonb;
ALTER TABLE "audit_logs" ALTER COLUMN "created_at" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "idx_audit_logs_org_id" ON "audit_logs" ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_audit_logs_created_at" ON "audit_logs" ("created_at");
CREATE INDEX IF NOT EXISTS "idx_audit_logs_action" ON "audit_logs" ("action");
CREATE INDEX IF NOT EXISTS "idx_audit_logs_resource_type" ON "audit_logs" ("resource_type");

-- Immutable Ledger Trigger
CREATE OR REPLACE FUNCTION prevent_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit logs are immutable. UPDATE and DELETE are prohibited.';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_immutability ON "audit_logs";
CREATE TRIGGER audit_immutability
  BEFORE UPDATE OR DELETE ON "audit_logs"
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_modification();