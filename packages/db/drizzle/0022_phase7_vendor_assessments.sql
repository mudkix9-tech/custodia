CREATE TABLE IF NOT EXISTS "vendor_assessment_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid REFERENCES "organizations"("id") ON DELETE CASCADE,
  "name" varchar(255) NOT NULL,
  "description" text,
  "questions" jsonb NOT NULL,
  "is_default" boolean DEFAULT false NOT NULL,
  "created_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "vendor_assessments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "vendor_id" uuid NOT NULL REFERENCES "organization_vendors"("id") ON DELETE CASCADE,
  "template_id" uuid NOT NULL REFERENCES "vendor_assessment_templates"("id") ON DELETE RESTRICT,
  "status" varchar(50) DEFAULT 'draft' NOT NULL,
  "sent_at" timestamptz,
  "completed_at" timestamptz,
  "expires_at" timestamptz,
  "recipient_email" varchar(255) NOT NULL,
  "recipient_name" varchar(255),
  "access_token" varchar(255) NOT NULL UNIQUE,
  "questions_snapshot" jsonb NOT NULL,
  "responses" jsonb DEFAULT '{}' NOT NULL,
  "score" integer,
  "ai_summary" text,
  "score_adjustment" integer DEFAULT 0 NOT NULL,
  "reviewed_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "reviewed_at" timestamptz,
  "reminder_count" integer DEFAULT 0 NOT NULL,
  "last_reminder_sent_at" timestamptz,
  "respondent_email" varchar(255),
  "respondent_ip" varchar(45),
  "submission_locked" boolean DEFAULT false NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_va_org" ON "vendor_assessments" ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_va_vendor" ON "vendor_assessments" ("vendor_id");
CREATE INDEX IF NOT EXISTS "idx_va_token" ON "vendor_assessments" ("access_token");
CREATE INDEX IF NOT EXISTS "idx_va_status" ON "vendor_assessments" ("status");

-- Trigger to prevent modifying completed/locked submissions
CREATE OR REPLACE FUNCTION check_vendor_assessment_immutability()
RETURNS TRIGGER AS $$
BEGIN
  IF (OLD.status = 'completed' OR OLD.status = 'expired' OR OLD.submission_locked = true) THEN
    IF (NEW.responses IS DISTINCT FROM OLD.responses OR 
        NEW.questions_snapshot IS DISTINCT FROM OLD.questions_snapshot OR
        NEW.score IS DISTINCT FROM OLD.score OR
        NEW.recipient_email IS DISTINCT FROM OLD.recipient_email OR
        NEW.access_token IS DISTINCT FROM OLD.access_token) THEN
      RAISE EXCEPTION 'Cannot modify completed or locked vendor assessment responses/metadata.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_vendor_assessments_immutability
BEFORE UPDATE ON "vendor_assessments"
FOR EACH ROW
EXECUTE FUNCTION check_vendor_assessment_immutability();
