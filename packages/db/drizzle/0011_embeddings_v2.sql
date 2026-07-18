DROP TABLE IF EXISTS "document_embeddings";

CREATE TABLE "document_embeddings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "document_id" text NOT NULL,
  "source" text NOT NULL,
  "authority" text NOT NULL,
  "title" text NOT NULL,
  "section" text,
  "category" text NOT NULL,
  "articles" integer[] DEFAULT '{}',
  "content" text NOT NULL,
  "embedding" vector(1536) NOT NULL,
  "metadata" jsonb DEFAULT '{}',
  "chunk_index" integer NOT NULL,
  "total_chunks" integer NOT NULL,
  "source_url" text,
  "language" text DEFAULT 'en',
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE INDEX idx_embeddings_vector ON document_embeddings
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX idx_embeddings_category ON document_embeddings (category);
CREATE INDEX idx_embeddings_source ON document_embeddings (source);
CREATE INDEX idx_embeddings_articles ON document_embeddings USING gin (articles);
