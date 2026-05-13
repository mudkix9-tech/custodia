CREATE TABLE "action_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"gdpr_article_reference" varchar(255),
	"priority" varchar(50) NOT NULL,
	"status" varchar(50) DEFAULT 'open',
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "assessment_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"selected_option" text NOT NULL,
	"risk_score" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "assessment_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_text" text NOT NULL,
	"category" varchar(100) NOT NULL,
	"options" jsonb NOT NULL,
	"depends_on" jsonb,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"email" varchar(255),
	"status" varchar(50) DEFAULT 'in_progress',
	"overall_score" integer,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_answers" ADD CONSTRAINT "assessment_answers_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_answers" ADD CONSTRAINT "assessment_answers_question_id_assessment_templates_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."assessment_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;