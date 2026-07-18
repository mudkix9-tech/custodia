-- Migration: Add index on language column of document_embeddings table
-- Created manually to bypass interactive TTY terminal prompts.

CREATE INDEX IF NOT EXISTS idx_embeddings_language ON document_embeddings (language);
