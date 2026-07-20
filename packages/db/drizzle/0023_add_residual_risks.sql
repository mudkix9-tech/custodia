ALTER TABLE dpias ADD COLUMN IF NOT EXISTS residual_risks jsonb DEFAULT '[]';
