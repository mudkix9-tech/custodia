ALTER TABLE "regulatory_update_matches" ADD COLUMN "matched_chunk_id" uuid;--> statement-breakpoint
ALTER TABLE "regulatory_update_matches" ADD COLUMN "ai_explanation" text;--> statement-breakpoint
ALTER TABLE "regulatory_update_matches" ADD COLUMN "recommended_action" text;--> statement-breakpoint
ALTER TABLE "regulatory_update_matches" ADD COLUMN "confidence" text;--> statement-breakpoint
ALTER TABLE "regulatory_update_matches" ADD COLUMN "match_strength" text;--> statement-breakpoint
ALTER TABLE "regulatory_update_matches" ADD COLUMN "assessed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "regulatory_update_matches" ADD COLUMN "prompt_tokens" integer;--> statement-breakpoint
ALTER TABLE "regulatory_update_matches" ADD COLUMN "completion_tokens" integer;--> statement-breakpoint
ALTER TABLE "regulatory_update_matches" ADD CONSTRAINT "regulatory_update_matches_matched_chunk_id_document_embeddings_id_fk" FOREIGN KEY ("matched_chunk_id") REFERENCES "public"."document_embeddings"("id") ON DELETE set null ON UPDATE no action;