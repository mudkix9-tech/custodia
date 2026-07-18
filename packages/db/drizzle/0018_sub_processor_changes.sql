ALTER TABLE vendors ADD COLUMN IF NOT EXISTS sub_processor_list_hash text;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS sub_processor_list_snapshot text;

CREATE TABLE IF NOT EXISTS vendor_sub_processor_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  org_vendor_id uuid NOT NULL REFERENCES organization_vendors(id) ON DELETE CASCADE,
  detected_at timestamptz DEFAULT now() NOT NULL,
  previous_hash text NOT NULL,
  new_hash text NOT NULL,
  previous_snapshot text,
  new_snapshot text,
  status varchar(50) DEFAULT 'pending_review' NOT NULL,
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  notes text
);

CREATE INDEX IF NOT EXISTS idx_vspc_org ON vendor_sub_processor_changes(organization_id);
CREATE INDEX IF NOT EXISTS idx_vspc_org_vendor ON vendor_sub_processor_changes(org_vendor_id);
