ALTER TABLE organization_vendors ADD COLUMN IF NOT EXISTS risk_factors jsonb DEFAULT '{}';
ALTER TABLE organization_vendors ADD COLUMN IF NOT EXISTS last_risk_assessment timestamptz;
ALTER TABLE organization_vendors ADD COLUMN IF NOT EXISTS certifications text[] DEFAULT '{}';
ALTER TABLE organization_vendors ADD COLUMN IF NOT EXISTS contract_renewal_date date;
ALTER TABLE organization_vendors ADD COLUMN IF NOT EXISTS data_subject_volume varchar(50) DEFAULT '<1K';
ALTER TABLE organization_vendors ALTER COLUMN risk_score SET DEFAULT 0;
