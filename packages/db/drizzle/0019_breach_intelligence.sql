ALTER TABLE vendors ADD COLUMN IF NOT EXISTS aliases text[] DEFAULT ARRAY[]::text[];

CREATE TABLE IF NOT EXISTS vendor_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_slug text NOT NULL,
  incident_type text NOT NULL,
  title text NOT NULL,
  summary text,
  source_url text,
  source_name text,
  incident_date date,
  detected_at timestamptz DEFAULT now(),
  severity text DEFAULT 'medium' NOT NULL,
  affected_data_categories text[] DEFAULT ARRAY[]::text[],
  fine_amount decimal,
  fine_currency text,
  status text DEFAULT 'published' NOT NULL
);

CREATE TABLE IF NOT EXISTS organization_vendor_incident_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES organization_vendors(id) ON DELETE CASCADE,
  incident_id uuid NOT NULL REFERENCES vendor_incidents(id) ON DELETE CASCADE,
  status text DEFAULT 'unread' NOT NULL,
  acknowledged_by uuid REFERENCES users(id) ON DELETE SET NULL,
  acknowledged_at timestamptz,
  action_notes text
);

CREATE INDEX IF NOT EXISTS idx_vi_slug ON vendor_incidents(vendor_slug);
CREATE INDEX IF NOT EXISTS idx_ovia_org ON organization_vendor_incident_alerts(organization_id);
CREATE INDEX IF NOT EXISTS idx_ovia_vendor ON organization_vendor_incident_alerts(vendor_id);
CREATE INDEX IF NOT EXISTS idx_ovia_incident ON organization_vendor_incident_alerts(incident_id);
