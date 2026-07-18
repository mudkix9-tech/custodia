ALTER TABLE "vendors" ADD COLUMN "is_privacy_friendly" boolean DEFAULT false NOT NULL;
ALTER TABLE "organization_vendors" ADD COLUMN "dpa_analysis_status" varchar(50) DEFAULT 'not_analyzed' NOT NULL;
ALTER TABLE "organization_vendors" ADD COLUMN "dpa_ai_analysis" jsonb DEFAULT '{}';

CREATE TABLE IF NOT EXISTS "vendor_questionnaires" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "vendor_id" uuid NOT NULL REFERENCES "vendors"("id") ON DELETE CASCADE,
  "org_vendor_id" uuid NOT NULL REFERENCES "organization_vendors"("id") ON DELETE CASCADE,
  "token" uuid DEFAULT gen_random_uuid() NOT NULL UNIQUE,
  "status" varchar(50) DEFAULT 'draft' NOT NULL,
  "prompt_version" varchar(100) DEFAULT 'v1' NOT NULL,
  "questions" jsonb NOT NULL,
  "answers" jsonb DEFAULT '[]',
  "ai_score" integer,
  "ai_analysis" jsonb DEFAULT '{}',
  "score_modifier" integer DEFAULT 0 NOT NULL,
  "submitted_at" timestamptz,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_vq_org" ON "vendor_questionnaires" ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_vq_vendor" ON "vendor_questionnaires" ("vendor_id");
CREATE INDEX IF NOT EXISTS "idx_vq_token" ON "vendor_questionnaires" ("token");
