ALTER TABLE "document_embeddings" RENAME COLUMN "source_type" TO "authority";
ALTER TABLE "document_embeddings" ADD COLUMN "document_type" varchar(50) NOT NULL DEFAULT 'guideline';
DROP INDEX IF EXISTS "idx_embeddings_source";
CREATE INDEX IF NOT EXISTS "idx_embeddings_authority" ON "document_embeddings" ("authority");
CREATE INDEX IF NOT EXISTS "idx_embeddings_doc_type" ON "document_embeddings" ("document_type");
