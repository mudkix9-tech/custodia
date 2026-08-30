CREATE TABLE "vendor_extraction_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" uuid NOT NULL,
	"kind" varchar(20) NOT NULL,
	"doc_type" varchar(30),
	"field_name" varchar(100),
	"url" text,
	"locator" jsonb,
	"note" text,
	"authored_by" uuid,
	"authored_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_applied_at" timestamp with time zone,
	"last_matched_at" timestamp with time zone,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vendor_extraction_rules_unq" UNIQUE("vendor_id","kind","doc_type","field_name","url")
);
--> statement-breakpoint
CREATE TABLE "vendor_probe_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" uuid,
	"vendor_id" uuid,
	"url" text NOT NULL,
	"doc_type" varchar(30) NOT NULL,
	"http_status" integer,
	"outcome" varchar(40),
	"text" text DEFAULT '' NOT NULL,
	"is_pdf" boolean DEFAULT false NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vendor_extraction_rules" ADD CONSTRAINT "vendor_extraction_rules_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_extraction_rules" ADD CONSTRAINT "vendor_extraction_rules_authored_by_users_id_fk" FOREIGN KEY ("authored_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_probe_documents" ADD CONSTRAINT "vendor_probe_documents_candidate_id_vendor_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."vendor_candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_probe_documents" ADD CONSTRAINT "vendor_probe_documents_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_ver_vendor" ON "vendor_extraction_rules" USING btree ("vendor_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "vendor_probe_documents_candidate_url_unq" ON "vendor_probe_documents" USING btree ("candidate_id","url") WHERE candidate_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "vendor_probe_documents_vendor_url_unq" ON "vendor_probe_documents" USING btree ("vendor_id","url") WHERE vendor_id IS NOT NULL;