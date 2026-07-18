-- Migration: Recreate document_embeddings and organization_embeddings with vector(3072)
-- Destructive pre-launch migration to change vector dimensions and update organization_embeddings columns.
-- Omits vector index types (ivfflat/hnsw) to bypass the pgvector 2000-dimension indexing limit.
-- Leverages exact flat search which is highly performant and 100% accurate for <10k rows.

DROP TABLE IF EXISTS organization_embeddings CASCADE;
DROP TABLE IF EXISTS document_embeddings CASCADE;

CREATE TABLE document_embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id text NOT NULL,
  source text NOT NULL,
  authority text NOT NULL,
  title text NOT NULL,
  section text,
  category text NOT NULL,
  articles integer[] DEFAULT '{}',
  content text NOT NULL,
  embedding vector(3072) NOT NULL,
  metadata jsonb DEFAULT '{}',
  chunk_index integer NOT NULL,
  total_chunks integer NOT NULL,
  source_url text,
  language text DEFAULT 'en',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_embeddings_category ON document_embeddings (category);
CREATE INDEX idx_embeddings_source ON document_embeddings (source);
CREATE INDEX idx_embeddings_articles ON document_embeddings USING gin (articles);

CREATE TABLE organization_embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  content text NOT NULL,
  content_hash varchar(64),
  metadata jsonb DEFAULT '{}',
  embedding vector(3072) NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, entity_type, entity_id)
);

CREATE INDEX idx_org_embeddings_org ON organization_embeddings (organization_id);
CREATE INDEX idx_org_embeddings_type ON organization_embeddings (entity_type);
