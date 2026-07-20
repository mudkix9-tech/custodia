ALTER TABLE compliance_gaps ADD COLUMN IF NOT EXISTS mitigation_due_date timestamp with time zone;
