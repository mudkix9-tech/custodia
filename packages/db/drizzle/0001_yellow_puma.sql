CREATE TYPE "public"."subscription_tier" AS ENUM('starter', 'professional', 'agency', 'enterprise');--> statement-breakpoint
CREATE TABLE "active_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(255) NOT NULL,
	"device" varchar(255),
	"browser" varchar(255),
	"ip_address" varchar(45),
	"location" varchar(255),
	"last_active_at" timestamp with time zone DEFAULT now(),
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "custom_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"permissions" jsonb DEFAULT '{}'::jsonb,
	"is_default" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "organizations" ALTER COLUMN "subscription_tier" SET DEFAULT 'starter'::"public"."subscription_tier";--> statement-breakpoint
ALTER TABLE "organizations" ALTER COLUMN "subscription_tier" SET DATA TYPE "public"."subscription_tier" USING "subscription_tier"::"public"."subscription_tier";--> statement-breakpoint
ALTER TABLE "assessment_templates" ADD COLUMN "translations" jsonb DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "sso_enabled" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "sso_provider" varchar(50);--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "sso_connection_id" varchar(255);--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "sso_enforced" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "parent_organization_id" uuid;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "data_region" varchar(50) DEFAULT 'eu-west-1';--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "dedicated_database_host" varchar(500);--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "dedicated_database_status" varchar(50);--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "dedicated_database_provisioned_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "deletion_scheduled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "siem_enabled" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "siem_endpoint_url" varchar(1024);--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "siem_format" varchar(20) DEFAULT 'json';--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "siem_auth_header" text;--> statement-breakpoint
ALTER TABLE "training_modules" ADD COLUMN "language" varchar(10) DEFAULT 'en';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "custom_role_id" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "organization_group_role" varchar(50);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "timezone" varchar(100) DEFAULT 'UTC';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "language" varchar(10) DEFAULT 'en';--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "suggested_for_industries" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "active_sessions" ADD CONSTRAINT "active_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_roles" ADD CONSTRAINT "custom_roles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_as_user" ON "active_sessions" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_parent_organization_id_organizations_id_fk" FOREIGN KEY ("parent_organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_custom_role_id_custom_roles_id_fk" FOREIGN KEY ("custom_role_id") REFERENCES "public"."custom_roles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_consent_records_domain" ON "consent_records" USING btree ("domain_id");--> statement-breakpoint
CREATE INDEX "idx_consent_records_given_at" ON "consent_records" USING btree ("given_at");--> statement-breakpoint
CREATE INDEX "idx_dsar_requests_org_status" ON "dsar_requests" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "idx_dsar_requests_deadline" ON "dsar_requests" USING btree ("deadline_at");--> statement-breakpoint
CREATE INDEX "idx_webhook_deliveries_status" ON "webhook_deliveries" USING btree ("status");