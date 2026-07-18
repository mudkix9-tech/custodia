ALTER TABLE organization_vendors ADD COLUMN IF NOT EXISTS dpa_clause_coverage jsonb DEFAULT '{}';
ALTER TABLE organization_vendors ADD COLUMN IF NOT EXISTS last_expiry_notification_tier varchar(50);
ALTER TABLE organization_vendors ADD COLUMN IF NOT EXISTS last_renewal_notification_tier varchar(50);
