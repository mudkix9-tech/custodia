-- Migration: Add ai_guidance_logs table
-- Created manually to bypass interactive TTY terminal prompts and connection pooling issues during schema push.

CREATE TABLE IF NOT EXISTS ai_guidance_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  module varchar(50) NOT NULL,
  entity_id uuid,
  query text,
  response text NOT NULL,
  sources jsonb DEFAULT '[]',
  confidence varchar(20) NOT NULL,
  feedback varchar(15),
  feedback_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_guidance_logs_org ON ai_guidance_logs (organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_guidance_logs_module ON ai_guidance_logs (module);
CREATE INDEX IF NOT EXISTS idx_ai_guidance_logs_entity ON ai_guidance_logs (entity_id);
