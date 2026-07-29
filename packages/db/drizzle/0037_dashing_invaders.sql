CREATE TABLE "lead_assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255),
	"total_score" integer NOT NULL,
	"risk_level" varchar(50) NOT NULL,
	"snapshot" jsonb NOT NULL,
	"ip_address" varchar(45),
	"user_agent" text,
	"utm_source" varchar(255),
	"utm_medium" varchar(255),
	"utm_campaign" varchar(255),
	"converted_to_org_id" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "lead_assessments" ADD CONSTRAINT "lead_assessments_converted_to_org_id_organizations_id_fk" FOREIGN KEY ("converted_to_org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;