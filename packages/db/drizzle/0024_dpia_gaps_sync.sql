ALTER TABLE compliance_gaps ADD COLUMN IF NOT EXISTS dpia_id uuid REFERENCES dpias(id) ON DELETE SET NULL;
ALTER TABLE compliance_gaps ADD COLUMN IF NOT EXISTS dpia_risk_id uuid;
ALTER TABLE compliance_gaps ADD COLUMN IF NOT EXISTS source varchar(50) DEFAULT 'gap_scanner';
ALTER TABLE compliance_gaps ADD COLUMN IF NOT EXISTS resolved_reason varchar(100);

CREATE INDEX IF NOT EXISTS idx_gaps_dpia ON compliance_gaps (dpia_id);
CREATE INDEX IF NOT EXISTS idx_gaps_dpia_risk ON compliance_gaps (dpia_id, dpia_risk_id);
