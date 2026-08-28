CREATE TABLE "vendor_sub_proc_acks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"sub_processor_id" uuid NOT NULL,
	"acknowledged_at" timestamp with time zone DEFAULT now() NOT NULL,
	"acknowledged_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vendor_sub_proc_acks_org_sub_unique" UNIQUE("organization_id","sub_processor_id")
);
--> statement-breakpoint
ALTER TABLE "organization_vendors" ADD COLUMN "trust_centre_eu_hosting" boolean;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "sub_processor_list_checked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "vendor_sub_proc_acks" ADD CONSTRAINT "vendor_sub_proc_acks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_sub_proc_acks" ADD CONSTRAINT "vendor_sub_proc_acks_sub_processor_id_vendor_sub_processors_id_fk" FOREIGN KEY ("sub_processor_id") REFERENCES "public"."vendor_sub_processors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_sub_proc_acks" ADD CONSTRAINT "vendor_sub_proc_acks_acknowledged_by_users_id_fk" FOREIGN KEY ("acknowledged_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;