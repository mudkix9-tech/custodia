-- Migration: Add corpus versioning columns and logs quality metric column
-- Created manually to bypass interactive TTY terminal prompts.

-- Embeddings versioning columns
ALTER TABLE document_embeddings ADD COLUMN IF NOT EXISTS is_current boolean NOT NULL DEFAULT true;
ALTER TABLE document_embeddings ADD COLUMN IF NOT EXISTS superseded_by text;
CREATE INDEX IF NOT EXISTS idx_embeddings_is_current ON document_embeddings (is_current);

-- Logs quality metric column
ALTER TABLE ai_guidance_logs ADD COLUMN IF NOT EXISTS top_similarity real;
