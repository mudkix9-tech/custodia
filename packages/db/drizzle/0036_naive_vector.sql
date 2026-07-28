ALTER TABLE "action_items" ADD COLUMN "category" varchar(100);--> statement-breakpoint
ALTER TABLE "action_items" ADD COLUMN "gdpr_articles" integer[];--> statement-breakpoint
ALTER TABLE "assessment_templates" ADD COLUMN "max_risk_weight" integer DEFAULT 10;--> statement-breakpoint
ALTER TABLE "assessment_templates" ADD COLUMN "gdpr_articles" integer[];--> statement-breakpoint
ALTER TABLE "pending_signups" ADD COLUMN "marketing_consent" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "marketing_consent" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "assessment_answers" ADD CONSTRAINT "assessment_answers_assessment_id_question_id_unique" UNIQUE("assessment_id","question_id");