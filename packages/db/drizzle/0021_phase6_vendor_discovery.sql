ALTER TABLE "vendors" ADD COLUMN "is_auto_discovered" boolean DEFAULT false NOT NULL;

CREATE TABLE IF NOT EXISTS "vendor_discoveries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "discovery_method" varchar(50) NOT NULL,
  "detected_domain" varchar(255) NOT NULL,
  "matched_vendor_id" uuid REFERENCES "vendors"("id") ON DELETE SET NULL,
  "detected_service_name" varchar(255),
  "first_detected_at" timestamptz DEFAULT now(),
  "last_detected_at" timestamptz DEFAULT now(),
  "status" varchar(50) DEFAULT 'undocumented' NOT NULL,
  "resolved_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "resolved_at" timestamptz
);

CREATE INDEX IF NOT EXISTS "idx_vd_org" ON "vendor_discoveries" ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_vd_status" ON "vendor_discoveries" ("status");
CREATE INDEX IF NOT EXISTS "idx_vd_domain" ON "vendor_discoveries" ("detected_domain");
