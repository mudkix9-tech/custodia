CREATE TABLE IF NOT EXISTS "training_modules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"is_global" boolean DEFAULT false,
	"title" varchar(255) NOT NULL,
	"description" text,
	"target_role" varchar(50) DEFAULT 'all',
	"is_mandatory" boolean DEFAULT true,
	"content" jsonb DEFAULT '[]'::jsonb,
	"quiz" jsonb DEFAULT '{"questions": []}'::jsonb,
	"passing_score" integer DEFAULT 70,
	"status" varchar(50) DEFAULT 'draft',
	"recurrence" varchar(50) DEFAULT 'annual',
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "training_completions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"module_id" uuid NOT NULL,
	"status" varchar(50) DEFAULT 'not_started',
	"progress_percent" integer DEFAULT 0,
	"slides_viewed" jsonb DEFAULT '[]'::jsonb,
	"quiz_score" integer,
	"quiz_passed" boolean,
	"quiz_attempts" integer DEFAULT 0,
	"last_attempt_at" timestamp with time zone,
	"quiz_answers" jsonb,
	"certificate_id" varchar(100),
	"certificate_document_id" uuid,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"assigned_by" uuid,
	"assigned_at" timestamp with time zone,
	"due_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "training_completions_certificate_id_unique" UNIQUE("certificate_id"),
	CONSTRAINT "training_completions_user_id_module_id_unique" UNIQUE("user_id","module_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "training_modules" ADD CONSTRAINT "training_modules_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "training_completions" ADD CONSTRAINT "training_completions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "training_completions" ADD CONSTRAINT "training_completions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "training_completions" ADD CONSTRAINT "training_completions_module_id_training_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."training_modules"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "training_completions" ADD CONSTRAINT "training_completions_certificate_document_id_documents_id_fk" FOREIGN KEY ("certificate_document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "training_completions" ADD CONSTRAINT "training_completions_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
