CREATE TABLE "audit_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"articles" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"evidence_type" varchar(30) DEFAULT 'document_link' NOT NULL,
	"url" text,
	"collected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"valid_until" timestamp with time zone,
	"uploaded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "audit_evidence" ADD CONSTRAINT "audit_evidence_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_evidence" ADD CONSTRAINT "audit_evidence_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_audit_evidence_org" ON "audit_evidence" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_audit_evidence_org_valid" ON "audit_evidence" USING btree ("organization_id","valid_until");