ALTER TABLE compliance_gaps ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}';
