CREATE TABLE "account" (
	"userId" uuid NOT NULL,
	"type" varchar(255) NOT NULL,
	"provider" varchar(255) NOT NULL,
	"providerAccountId" varchar(255) NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" varchar(255),
	"scope" varchar(255),
	"id_token" text,
	"session_state" varchar(255),
	CONSTRAINT "account_provider_providerAccountId_pk" PRIMARY KEY("provider","providerAccountId")
);
--> statement-breakpoint
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
CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"key_hash" varchar(64) NOT NULL,
	"prefix" varchar(12) NOT NULL,
	"scopes" jsonb DEFAULT '["read"]',
	"allowed_ips" jsonb,
	"last_used_at" timestamp with time zone,
	"request_count" integer DEFAULT 0,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"revoked_by" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now()
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
	"anonymous_session_id" varchar(255),
	"email" varchar(255),
	"status" varchar(50) DEFAULT 'in_progress',
	"overall_score" integer,
	"completed_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"user_id" uuid,
	"user_email" varchar(255),
	"ip_address" varchar(45),
	"user_agent" text,
	"action" varchar(255) NOT NULL,
	"resource_type" varchar(100),
	"resource_id" varchar(255),
	"description" text NOT NULL,
	"changes" jsonb,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "breach_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"breach_id" uuid NOT NULL,
	"notification_type" varchar(50) NOT NULL,
	"recipient" varchar(255),
	"document_id" uuid,
	"content_json" jsonb,
	"status" varchar(50) DEFAULT 'draft',
	"sent_at" timestamp with time zone,
	"acknowledged_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "breach_remediation_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"breach_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"priority" varchar(20) DEFAULT 'medium',
	"assigned_to" uuid,
	"due_at" timestamp with time zone,
	"status" varchar(50) DEFAULT 'pending',
	"completed_at" timestamp with time zone,
	"completion_notes" text,
	"evidence_document_id" uuid,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "breaches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"reference_number" varchar(50) NOT NULL,
	"title" varchar(255) NOT NULL,
	"discovered_at" timestamp with time zone NOT NULL,
	"discovered_by" uuid,
	"discovery_method" varchar(100),
	"notification_deadline" timestamp with time zone NOT NULL,
	"breach_type" varchar(100) NOT NULL,
	"breach_cause" varchar(100),
	"description" text NOT NULL,
	"data_categories_affected" jsonb DEFAULT '[]',
	"data_subjects_affected" jsonb DEFAULT '[]',
	"estimated_records_affected" integer,
	"estimated_individuals_affected" integer,
	"affected_systems" jsonb DEFAULT '[]',
	"risk_to_individuals" varchar(20),
	"risk_assessment_detail" text,
	"notify_authority" boolean,
	"authority_notified_at" timestamp with time zone,
	"authority_reference" varchar(255),
	"notify_individuals" boolean,
	"individuals_notified_at" timestamp with time zone,
	"individual_notification_method" varchar(100),
	"status" varchar(50) DEFAULT 'detected',
	"root_cause" text,
	"lessons_learned" text,
	"resolved_at" timestamp with time zone,
	"vendor_originated" boolean DEFAULT false,
	"vendor_id" uuid,
	"vendor_notification_date" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "breaches_reference_number_unique" UNIQUE("reference_number")
);
--> statement-breakpoint
CREATE TABLE "client_processing_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"processing_activity_id" uuid NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "client_activity_unq" UNIQUE("client_id","processing_activity_id")
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"legal_name" varchar(255),
	"contact_name" varchar(255),
	"contact_email" varchar(255),
	"country_code" char(2),
	"industry" varchar(100),
	"dpa_status" varchar(50) DEFAULT 'not_started',
	"dpa_signed_at" timestamp with time zone,
	"dpa_expires_at" timestamp with time zone,
	"dpa_document_id" uuid,
	"portal_enabled" boolean DEFAULT false,
	"portal_token" varchar(255),
	"compliance_summary" jsonb DEFAULT '{}'::jsonb,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone,
	CONSTRAINT "clients_portal_token_unique" UNIQUE("portal_token")
);
--> statement-breakpoint
CREATE TABLE "compliance_gaps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" uuid NOT NULL,
	"gap_type" varchar(100) NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"severity" varchar(20) NOT NULL,
	"gdpr_articles" jsonb DEFAULT '[]'::jsonb,
	"status" varchar(50) DEFAULT 'open',
	"resolution_url" varchar(500),
	"resolved_at" timestamp with time zone,
	"resolved_by" uuid,
	"dismissed_at" timestamp with time zone,
	"dismissed_by" uuid,
	"dismissal_reason" text,
	"first_detected_at" timestamp with time zone DEFAULT now(),
	"last_detected_at" timestamp with time zone DEFAULT now(),
	"detection_count" integer DEFAULT 1,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "compliance_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"report_type" varchar(50) NOT NULL,
	"score_total" integer NOT NULL,
	"category_scores" jsonb NOT NULL,
	"score_breakdown" jsonb NOT NULL,
	"top_gaps" jsonb DEFAULT '[]'::jsonb,
	"document_id" uuid,
	"generated_by" uuid,
	"snapshot_date" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "consent_cookies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"domain_id" uuid NOT NULL,
	"cookie_name" varchar(255) NOT NULL,
	"cookie_domain" varchar(255),
	"cookie_path" varchar(255) DEFAULT '/',
	"category" varchar(50) NOT NULL,
	"provider" varchar(255),
	"purpose" text,
	"expiry" varchar(100),
	"is_third_party" boolean DEFAULT false,
	"auto_classified" boolean DEFAULT false,
	"classification_confidence" numeric(3, 2),
	"manually_verified" boolean DEFAULT false,
	"discovered_at" timestamp with time zone DEFAULT now(),
	"last_seen_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "consent_domains" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"client_id" uuid,
	"domain" varchar(255) NOT NULL,
	"banner_config" jsonb DEFAULT '{}',
	"categories" jsonb DEFAULT '["necessary", "analytics", "marketing", "functional"]',
	"gcm_v2_enabled" boolean DEFAULT false,
	"tcf_enabled" boolean DEFAULT false,
	"last_scan_at" timestamp with time zone,
	"scan_frequency" varchar(20) DEFAULT 'weekly',
	"script_id" varchar(100) NOT NULL,
	"total_pageviews_30d" integer DEFAULT 0,
	"consent_rate_30d" numeric(5, 2),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "consent_domains_script_id_unique" UNIQUE("script_id")
);
--> statement-breakpoint
CREATE TABLE "consent_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"domain_id" uuid NOT NULL,
	"consent_id" varchar(255) NOT NULL,
	"categories_accepted" jsonb NOT NULL,
	"categories_rejected" jsonb DEFAULT '[]',
	"ip_hash" varchar(64),
	"country_code" varchar(2),
	"policy_version_id" uuid,
	"banner_version" varchar(50),
	"interaction_type" varchar(50),
	"tcf_string" text,
	"gcm_consent_state" jsonb,
	"given_at" timestamp with time zone DEFAULT now(),
	"withdrawn_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "document_embeddings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_type" varchar(50) NOT NULL,
	"source_reference" varchar(255),
	"source_url" varchar(500),
	"content" text NOT NULL,
	"content_hash" varchar(64),
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"embedding" vector(1536),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"uploader_id" uuid,
	"filename" varchar(255) NOT NULL,
	"original_name" varchar(255) NOT NULL,
	"mime_type" varchar(100),
	"size_bytes" integer,
	"s3_key" varchar(500) NOT NULL,
	"encryption_key_id" varchar(255),
	"status" varchar(50) DEFAULT 'active',
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "dpia_measures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dpia_risk_id" uuid NOT NULL,
	"description" text NOT NULL,
	"status" varchar(50) DEFAULT 'planned',
	"implemented_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "dpia_risks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dpia_id" uuid NOT NULL,
	"description" text NOT NULL,
	"likelihood" integer,
	"severity" integer,
	"initial_risk_score" integer,
	"residual_risk_score" integer,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "dpias" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"processing_activity_ids" jsonb DEFAULT '[]'::jsonb,
	"processing_description" text,
	"necessity_assessment" text,
	"proportionality_assessment" text,
	"overall_risk_level" varchar(20),
	"residual_risk_level" varchar(20),
	"requires_prior_consultation" boolean DEFAULT false,
	"status" varchar(50) DEFAULT 'draft',
	"version" integer DEFAULT 1,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"last_reviewed_at" timestamp with time zone,
	"next_review_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "dsar_communications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dsar_id" uuid NOT NULL,
	"direction" varchar(10) NOT NULL,
	"type" varchar(50) NOT NULL,
	"channel" varchar(50),
	"subject" varchar(255),
	"body" text,
	"sent_by" uuid,
	"sent_at" timestamp with time zone DEFAULT now(),
	"email_message_id" varchar(255),
	"delivered_at" timestamp with time zone,
	"opened_at" timestamp with time zone,
	"attachments" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "dsar_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"reference_number" varchar(50) NOT NULL,
	"request_type" varchar(50) NOT NULL,
	"subject_name" varchar(255) NOT NULL,
	"subject_email" varchar(255) NOT NULL,
	"subject_identifier" jsonb,
	"subject_verified" boolean DEFAULT false,
	"verification_method" varchar(100),
	"verification_date" timestamp with time zone,
	"source" varchar(50),
	"original_message" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deadline_at" timestamp with time zone NOT NULL,
	"extended" boolean DEFAULT false,
	"extension_reason" text,
	"extended_deadline_at" timestamp with time zone,
	"status" varchar(50) DEFAULT 'new',
	"refusal_reason" varchar(100),
	"refusal_detail" text,
	"completed_at" timestamp with time zone,
	"completed_by" uuid,
	"data_package_url" varchar(500),
	"data_package_format" varchar(20),
	"data_package_expires_at" timestamp with time zone,
	"assigned_to" uuid,
	"inbound_email_address" varchar(255),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "dsar_requests_reference_number_unique" UNIQUE("reference_number"),
	CONSTRAINT "dsar_requests_inbound_email_address_unique" UNIQUE("inbound_email_address")
);
--> statement-breakpoint
CREATE TABLE "dsar_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dsar_id" uuid NOT NULL,
	"system_name" varchar(255) NOT NULL,
	"vendor_id" uuid,
	"search_instructions" text,
	"priority" varchar(20) DEFAULT 'normal',
	"related_activities" jsonb DEFAULT '[]'::jsonb,
	"data_categories" jsonb DEFAULT '[]'::jsonb,
	"status" varchar(50) DEFAULT 'pending',
	"data_found" boolean,
	"data_description" text,
	"action_taken" varchar(100),
	"action_detail" text,
	"evidence_document_id" uuid,
	"completed_by" uuid,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "legitimate_interest_assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"processing_activity_id" uuid NOT NULL,
	"purpose_test_legitimate_interest" text NOT NULL,
	"purpose_test_is_lawful" boolean DEFAULT true,
	"purpose_test_evidence" text,
	"necessity_test_is_necessary" text NOT NULL,
	"necessity_test_alternatives" text,
	"necessity_test_conclusion" text,
	"balancing_test_impact" text NOT NULL,
	"balancing_test_expectation" text,
	"balancing_test_safeguards" text,
	"balancing_test_overrides" text NOT NULL,
	"outcome" varchar(50) NOT NULL,
	"assessed_by" uuid,
	"assessed_at" timestamp with time zone DEFAULT now(),
	"next_review_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "notification_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid,
	"type" varchar(100) NOT NULL,
	"title" varchar(255) NOT NULL,
	"body" text NOT NULL,
	"action_url" varchar(500),
	"channel" varchar(50) NOT NULL,
	"priority" varchar(20) DEFAULT 'normal',
	"status" varchar(50) DEFAULT 'pending',
	"attempts" integer DEFAULT 0,
	"max_attempts" integer DEFAULT 3,
	"last_attempt_at" timestamp with time zone,
	"next_retry_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"error" text,
	"email_to" varchar(255),
	"email_message_id" varchar(255),
	"slack_response" jsonb,
	"payload" jsonb,
	"scheduled_for" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "organization_embeddings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"document_id" uuid,
	"content" text NOT NULL,
	"content_hash" varchar(64),
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"embedding" vector(1536),
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "organization_integrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"provider" varchar(50) NOT NULL,
	"provider_account_id" varchar(255),
	"provider_account_name" varchar(255),
	"access_token" text NOT NULL,
	"refresh_token" text,
	"token_type" varchar(50) DEFAULT 'Bearer',
	"expires_at" timestamp with time zone,
	"scopes" jsonb DEFAULT '[]',
	"status" varchar(50) DEFAULT 'active',
	"last_error" text,
	"last_used_at" timestamp with time zone,
	"last_sync_at" timestamp with time zone,
	"connected_by" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "unique_org_provider" UNIQUE("organization_id","provider")
);
--> statement-breakpoint
CREATE TABLE "organization_vendors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"vendor_id" uuid NOT NULL,
	"status" varchar(50) DEFAULT 'active',
	"added_by" uuid,
	"dpa_status" varchar(50) DEFAULT 'not_started',
	"dpa_signed_at" timestamp with time zone,
	"dpa_expires_at" timestamp with time zone,
	"dpa_document_id" uuid,
	"dpa_notes" text,
	"tia_required" boolean DEFAULT false,
	"tia_completed" boolean DEFAULT false,
	"tia_document_id" uuid,
	"data_categories_shared" jsonb DEFAULT '[]'::jsonb,
	"processing_activities" jsonb DEFAULT '[]'::jsonb,
	"purpose" text,
	"using_eu_hosting" boolean DEFAULT false,
	"risk_score" integer,
	"risk_level" varchar(20),
	"last_reviewed_at" timestamp with time zone,
	"next_review_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"legal_name" varchar(255),
	"registration_number" varchar(100),
	"country_code" char(2) NOT NULL,
	"address" jsonb,
	"eu_representative" jsonb,
	"has_dpo" boolean DEFAULT false,
	"dpo_name" varchar(255),
	"dpo_email" varchar(255),
	"dpo_is_external" boolean DEFAULT false,
	"lead_supervisory_authority" varchar(100),
	"compliance_score" integer DEFAULT 0,
	"last_assessment_at" timestamp with time zone,
	"next_review_due_at" timestamp with time zone,
	"onboarding_completed" boolean DEFAULT false,
	"onboarding_dismissed" boolean DEFAULT false,
	"onboarding_step" integer DEFAULT 0,
	"onboarding_completed_at" timestamp with time zone,
	"stripe_customer_id" varchar(255),
	"paddle_customer_id" varchar(255),
	"paddle_subscription_id" varchar(255),
	"subscription_tier" varchar(50) DEFAULT 'starter',
	"subscription_status" varchar(50) DEFAULT 'trialing',
	"ai_queries_used" integer DEFAULT 0,
	"ai_dpas_analyzed" integer DEFAULT 0,
	"ai_last_reset_at" timestamp with time zone DEFAULT now(),
	"settings" jsonb DEFAULT '{}'::jsonb,
	"branding" jsonb DEFAULT '{}'::jsonb,
	"slack_webhook_url" varchar(500),
	"notification_preferences" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "pending_signups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"anonymous_session_id" varchar(255),
	"assessment_id" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "policy_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"policy_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"content_html" text NOT NULL,
	"content_markdown" text NOT NULL,
	"content_json" jsonb,
	"change_summary" text,
	"change_type" varchar(50),
	"diff_from_previous" jsonb,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "privacy_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"type" varchar(50) NOT NULL,
	"name" varchar(255) NOT NULL,
	"language" varchar(10) DEFAULT 'en',
	"current_version_id" uuid,
	"published_at" timestamp with time zone,
	"sync_with_ropa" boolean DEFAULT false,
	"embed_url" varchar(500),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "processing_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"client_id" uuid,
	"name" varchar(255) NOT NULL,
	"description" text,
	"purpose" text NOT NULL,
	"lawful_basis" varchar(50) NOT NULL,
	"lawful_basis_detail" text,
	"lia_id" uuid,
	"data_subject_categories" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"estimated_data_subjects" varchar(50),
	"processing_type" jsonb DEFAULT '[]'::jsonb,
	"is_systematic_monitoring" boolean DEFAULT false,
	"involves_special_categories" boolean DEFAULT false,
	"special_categories" jsonb DEFAULT '[]'::jsonb,
	"involves_children" boolean DEFAULT false,
	"retention_period" varchar(100),
	"retention_justification" text,
	"retention_review_date" timestamp with time zone,
	"deletion_procedure" text,
	"security_measures" jsonb DEFAULT '[]'::jsonb,
	"security_measures_detail" text,
	"status" varchar(50) DEFAULT 'draft',
	"risk_level" varchar(20) DEFAULT 'low',
	"requires_dpia" boolean DEFAULT false,
	"dpia_id" uuid,
	"last_reviewed_at" timestamp with time zone,
	"next_review_at" timestamp with time zone,
	"reviewed_by" uuid,
	"version" integer DEFAULT 1,
	"previous_version_id" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "processing_data_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"processing_activity_id" uuid NOT NULL,
	"category" varchar(100) NOT NULL,
	"category_group" varchar(100) NOT NULL,
	"description" text,
	"source" varchar(100),
	"source_detail" text,
	"is_special_category" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "processing_recipients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"processing_activity_id" uuid NOT NULL,
	"recipient_type" varchar(50) NOT NULL,
	"name" varchar(255) NOT NULL,
	"vendor_id" uuid,
	"purpose" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "processing_transfers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"processing_activity_id" uuid NOT NULL,
	"destination_country" char(2) NOT NULL,
	"destination_entity" varchar(255),
	"vendor_id" uuid,
	"transfer_mechanism" varchar(100) NOT NULL,
	"mechanism_detail" text,
	"tia_required" boolean DEFAULT false,
	"tia_completed" boolean DEFAULT false,
	"tia_risk_level" varchar(20),
	"tia_document_id" uuid,
	"supplementary_measures" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "regulatory_impact_assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"regulatory_update_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"affected_activities" jsonb NOT NULL,
	"affected_vendors" jsonb DEFAULT '[]'::jsonb,
	"affected_transfers" jsonb DEFAULT '[]'::jsonb,
	"recommended_actions" jsonb DEFAULT '[]'::jsonb,
	"status" varchar(50) DEFAULT 'unread',
	"acknowledged_by" uuid,
	"acknowledged_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "idx_ria_unique" UNIQUE("regulatory_update_id","organization_id")
);
--> statement-breakpoint
CREATE TABLE "regulatory_updates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" varchar(50) NOT NULL,
	"source_name" varchar(255) NOT NULL,
	"source_url" varchar(500) NOT NULL,
	"title" varchar(500) NOT NULL,
	"summary" text NOT NULL,
	"key_changes" jsonb DEFAULT '[]'::jsonb,
	"original_language" char(2) DEFAULT 'en',
	"category" varchar(100),
	"severity" varchar(20) DEFAULT 'info',
	"affects_regions" jsonb DEFAULT '["EU"]'::jsonb,
	"affects_articles" jsonb DEFAULT '[]'::jsonb,
	"impact_rules" jsonb DEFAULT '[]'::jsonb,
	"status" varchar(50) DEFAULT 'draft',
	"reviewed_by" varchar(100),
	"published_at" timestamp with time zone,
	"effective_date" date,
	"content_hash" varchar(64),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "regulatory_updates_content_hash_unique" UNIQUE("content_hash")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"sessionToken" varchar(255) PRIMARY KEY NOT NULL,
	"userId" uuid NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "training_completions" (
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
CREATE TABLE "training_modules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"is_global" boolean DEFAULT false,
	"title" varchar(255) NOT NULL,
	"description" text,
	"target_role" varchar(50) DEFAULT 'all',
	"is_mandatory" boolean DEFAULT true,
	"content" jsonb DEFAULT '[]'::jsonb,
	"quiz" jsonb DEFAULT '{"questions":[]}'::jsonb,
	"passing_score" integer DEFAULT 70,
	"status" varchar(50) DEFAULT 'draft',
	"recurrence" varchar(50) DEFAULT 'annual',
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "transfer_impact_assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"vendor_id" uuid,
	"org_vendor_id" uuid,
	"processing_transfer_id" uuid,
	"destination_country" char(2) NOT NULL,
	"data_categories" jsonb DEFAULT '[]'::jsonb,
	"transfer_mechanism" varchar(100) NOT NULL,
	"mechanism_detail" text,
	"surveillance_laws_exist" boolean,
	"surveillance_laws_detail" text,
	"independent_dpa_exists" boolean,
	"effective_remedies_exist" boolean,
	"relevant_case_law" text,
	"legal_assessment_conclusion" varchar(50),
	"legal_assessment_detail" text,
	"technical_measures" jsonb DEFAULT '[]'::jsonb,
	"organizational_measures" jsonb DEFAULT '[]'::jsonb,
	"contractual_measures" jsonb DEFAULT '[]'::jsonb,
	"measures_detail" text,
	"residual_risk_level" varchar(20),
	"residual_risk_justification" text,
	"conclusion" varchar(50),
	"conditions" text,
	"status" varchar(50) DEFAULT 'draft',
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"next_review_at" timestamp with time zone,
	"last_reviewed_at" timestamp with time zone,
	"document_id" uuid,
	"version" integer DEFAULT 1,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"email" varchar(255) NOT NULL,
	"email_verified" timestamp with time zone,
	"name" varchar(255) NOT NULL,
	"avatar_url" varchar(500),
	"image" text,
	"password_hash" varchar(255),
	"auth_provider" varchar(50),
	"auth_provider_id" varchar(255),
	"mfa_enabled" boolean DEFAULT false,
	"mfa_secret" varchar(255),
	"role" varchar(50) DEFAULT 'member' NOT NULL,
	"permissions" jsonb DEFAULT '[]'::jsonb,
	"token_invalidated_at" timestamp with time zone,
	"last_training_completed_at" timestamp with time zone,
	"policy_acknowledged_at" timestamp with time zone,
	"notification_overrides" jsonb DEFAULT '{}'::jsonb,
	"last_login_at" timestamp with time zone,
	"invited_at" timestamp with time zone,
	"invited_by" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "vendor_sub_processors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_vendor_id" uuid NOT NULL,
	"sub_processor_vendor_id" uuid,
	"name" varchar(255),
	"service" varchar(255),
	"country" char(2),
	"website" varchar(500),
	"purpose" text,
	"data_categories" jsonb DEFAULT '[]'::jsonb,
	"processing_locations" jsonb DEFAULT '[]'::jsonb,
	"added_at" timestamp with time zone DEFAULT now(),
	"removed_at" timestamp with time zone,
	"notified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "vendors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"is_global" boolean DEFAULT false,
	"organization_id" uuid,
	"name" varchar(255) NOT NULL,
	"slug" varchar(100),
	"website" varchar(500),
	"logo_url" varchar(500),
	"description" text,
	"category" varchar(100),
	"dsar_search_instructions" text,
	"headquarters_country" char(2),
	"data_processing_locations" jsonb DEFAULT '[]'::jsonb,
	"dpa_url" varchar(500),
	"dpa_available" boolean DEFAULT false,
	"privacy_policy_url" varchar(500),
	"transfer_mechanisms" jsonb DEFAULT '[]'::jsonb,
	"eu_hosting_available" boolean DEFAULT false,
	"eu_hosting_detail" text,
	"security_certifications" jsonb DEFAULT '[]'::jsonb,
	"encryption_at_rest" boolean,
	"encryption_in_transit" boolean,
	"sub_processor_list_url" varchar(500),
	"sub_processor_notification" varchar(100),
	"typical_data_categories" jsonb DEFAULT '[]'::jsonb,
	"risk_score" integer,
	"risk_level" varchar(20),
	"risk_factors" jsonb DEFAULT '[]'::jsonb,
	"known_incidents" jsonb DEFAULT '[]'::jsonb,
	"regulatory_actions" jsonb DEFAULT '[]'::jsonb,
	"last_verified_at" timestamp with time zone,
	"verified_by" varchar(100),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "verificationToken" (
	"identifier" varchar(255) NOT NULL,
	"token" varchar(255) NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "verificationToken_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
CREATE TABLE "webhook_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"webhook_id" uuid NOT NULL,
	"event_id" varchar(100) NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"payload" jsonb NOT NULL,
	"status" varchar(50) DEFAULT 'pending',
	"attempts" integer DEFAULT 0,
	"max_attempts" integer DEFAULT 5,
	"response_status" integer,
	"response_body" text,
	"response_time_ms" integer,
	"last_error" text,
	"next_retry_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "webhooks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"url" varchar(1024) NOT NULL,
	"events" jsonb NOT NULL,
	"secret" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_revoked_by_users_id_fk" FOREIGN KEY ("revoked_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_answers" ADD CONSTRAINT "assessment_answers_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_answers" ADD CONSTRAINT "assessment_answers_question_id_assessment_templates_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."assessment_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "breach_notifications" ADD CONSTRAINT "breach_notifications_breach_id_breaches_id_fk" FOREIGN KEY ("breach_id") REFERENCES "public"."breaches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "breach_notifications" ADD CONSTRAINT "breach_notifications_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "breach_notifications" ADD CONSTRAINT "breach_notifications_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "breach_remediation_tasks" ADD CONSTRAINT "breach_remediation_tasks_breach_id_breaches_id_fk" FOREIGN KEY ("breach_id") REFERENCES "public"."breaches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "breach_remediation_tasks" ADD CONSTRAINT "breach_remediation_tasks_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "breach_remediation_tasks" ADD CONSTRAINT "breach_remediation_tasks_evidence_document_id_documents_id_fk" FOREIGN KEY ("evidence_document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "breaches" ADD CONSTRAINT "breaches_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "breaches" ADD CONSTRAINT "breaches_discovered_by_users_id_fk" FOREIGN KEY ("discovered_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "breaches" ADD CONSTRAINT "breaches_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_processing_activities" ADD CONSTRAINT "client_processing_activities_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_processing_activities" ADD CONSTRAINT "client_processing_activities_processing_activity_id_processing_activities_id_fk" FOREIGN KEY ("processing_activity_id") REFERENCES "public"."processing_activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_gaps" ADD CONSTRAINT "compliance_gaps_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_gaps" ADD CONSTRAINT "compliance_gaps_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_gaps" ADD CONSTRAINT "compliance_gaps_dismissed_by_users_id_fk" FOREIGN KEY ("dismissed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_reports" ADD CONSTRAINT "compliance_reports_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_reports" ADD CONSTRAINT "compliance_reports_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_reports" ADD CONSTRAINT "compliance_reports_generated_by_users_id_fk" FOREIGN KEY ("generated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_cookies" ADD CONSTRAINT "consent_cookies_domain_id_consent_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."consent_domains"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_domains" ADD CONSTRAINT "consent_domains_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_domains" ADD CONSTRAINT "consent_domains_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_domain_id_consent_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."consent_domains"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_policy_version_id_policy_versions_id_fk" FOREIGN KEY ("policy_version_id") REFERENCES "public"."policy_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploader_id_users_id_fk" FOREIGN KEY ("uploader_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dpia_measures" ADD CONSTRAINT "dpia_measures_dpia_risk_id_dpia_risks_id_fk" FOREIGN KEY ("dpia_risk_id") REFERENCES "public"."dpia_risks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dpia_risks" ADD CONSTRAINT "dpia_risks_dpia_id_dpias_id_fk" FOREIGN KEY ("dpia_id") REFERENCES "public"."dpias"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dpias" ADD CONSTRAINT "dpias_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dpias" ADD CONSTRAINT "dpias_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dsar_communications" ADD CONSTRAINT "dsar_communications_dsar_id_dsar_requests_id_fk" FOREIGN KEY ("dsar_id") REFERENCES "public"."dsar_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dsar_communications" ADD CONSTRAINT "dsar_communications_sent_by_users_id_fk" FOREIGN KEY ("sent_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dsar_requests" ADD CONSTRAINT "dsar_requests_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dsar_requests" ADD CONSTRAINT "dsar_requests_completed_by_users_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dsar_requests" ADD CONSTRAINT "dsar_requests_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dsar_tasks" ADD CONSTRAINT "dsar_tasks_dsar_id_dsar_requests_id_fk" FOREIGN KEY ("dsar_id") REFERENCES "public"."dsar_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dsar_tasks" ADD CONSTRAINT "dsar_tasks_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dsar_tasks" ADD CONSTRAINT "dsar_tasks_evidence_document_id_documents_id_fk" FOREIGN KEY ("evidence_document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dsar_tasks" ADD CONSTRAINT "dsar_tasks_completed_by_users_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legitimate_interest_assessments" ADD CONSTRAINT "legitimate_interest_assessments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legitimate_interest_assessments" ADD CONSTRAINT "legitimate_interest_assessments_processing_activity_id_processing_activities_id_fk" FOREIGN KEY ("processing_activity_id") REFERENCES "public"."processing_activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legitimate_interest_assessments" ADD CONSTRAINT "legitimate_interest_assessments_assessed_by_users_id_fk" FOREIGN KEY ("assessed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_queue" ADD CONSTRAINT "notification_queue_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_queue" ADD CONSTRAINT "notification_queue_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_embeddings" ADD CONSTRAINT "organization_embeddings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_embeddings" ADD CONSTRAINT "organization_embeddings_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_integrations" ADD CONSTRAINT "organization_integrations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_integrations" ADD CONSTRAINT "organization_integrations_connected_by_users_id_fk" FOREIGN KEY ("connected_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_vendors" ADD CONSTRAINT "organization_vendors_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_vendors" ADD CONSTRAINT "organization_vendors_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_vendors" ADD CONSTRAINT "organization_vendors_added_by_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_signups" ADD CONSTRAINT "pending_signups_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_versions" ADD CONSTRAINT "policy_versions_policy_id_privacy_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."privacy_policies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_versions" ADD CONSTRAINT "policy_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "privacy_policies" ADD CONSTRAINT "privacy_policies_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processing_activities" ADD CONSTRAINT "processing_activities_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processing_activities" ADD CONSTRAINT "processing_activities_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processing_activities" ADD CONSTRAINT "processing_activities_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processing_activities" ADD CONSTRAINT "processing_activities_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processing_data_categories" ADD CONSTRAINT "processing_data_categories_processing_activity_id_processing_activities_id_fk" FOREIGN KEY ("processing_activity_id") REFERENCES "public"."processing_activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processing_recipients" ADD CONSTRAINT "processing_recipients_processing_activity_id_processing_activities_id_fk" FOREIGN KEY ("processing_activity_id") REFERENCES "public"."processing_activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processing_transfers" ADD CONSTRAINT "processing_transfers_processing_activity_id_processing_activities_id_fk" FOREIGN KEY ("processing_activity_id") REFERENCES "public"."processing_activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processing_transfers" ADD CONSTRAINT "processing_transfers_tia_document_id_documents_id_fk" FOREIGN KEY ("tia_document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regulatory_impact_assessments" ADD CONSTRAINT "regulatory_impact_assessments_regulatory_update_id_regulatory_updates_id_fk" FOREIGN KEY ("regulatory_update_id") REFERENCES "public"."regulatory_updates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regulatory_impact_assessments" ADD CONSTRAINT "regulatory_impact_assessments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regulatory_impact_assessments" ADD CONSTRAINT "regulatory_impact_assessments_acknowledged_by_users_id_fk" FOREIGN KEY ("acknowledged_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_completions" ADD CONSTRAINT "training_completions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_completions" ADD CONSTRAINT "training_completions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_completions" ADD CONSTRAINT "training_completions_module_id_training_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."training_modules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_completions" ADD CONSTRAINT "training_completions_certificate_document_id_documents_id_fk" FOREIGN KEY ("certificate_document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_completions" ADD CONSTRAINT "training_completions_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_modules" ADD CONSTRAINT "training_modules_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfer_impact_assessments" ADD CONSTRAINT "transfer_impact_assessments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfer_impact_assessments" ADD CONSTRAINT "transfer_impact_assessments_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfer_impact_assessments" ADD CONSTRAINT "transfer_impact_assessments_org_vendor_id_organization_vendors_id_fk" FOREIGN KEY ("org_vendor_id") REFERENCES "public"."organization_vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfer_impact_assessments" ADD CONSTRAINT "transfer_impact_assessments_processing_transfer_id_processing_transfers_id_fk" FOREIGN KEY ("processing_transfer_id") REFERENCES "public"."processing_transfers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfer_impact_assessments" ADD CONSTRAINT "transfer_impact_assessments_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfer_impact_assessments" ADD CONSTRAINT "transfer_impact_assessments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_sub_processors" ADD CONSTRAINT "vendor_sub_processors_parent_vendor_id_vendors_id_fk" FOREIGN KEY ("parent_vendor_id") REFERENCES "public"."vendors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_sub_processors" ADD CONSTRAINT "vendor_sub_processors_sub_processor_vendor_id_vendors_id_fk" FOREIGN KEY ("sub_processor_vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_webhook_id_webhooks_id_fk" FOREIGN KEY ("webhook_id") REFERENCES "public"."webhooks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_ak_org" ON "api_keys" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_ak_hash" ON "api_keys" USING btree ("key_hash");--> statement-breakpoint
CREATE INDEX "idx_ak_prefix" ON "api_keys" USING btree ("prefix");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_org_id" ON "audit_logs" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_created_at" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_action" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_resource_type" ON "audit_logs" USING btree ("resource_type");--> statement-breakpoint
CREATE INDEX "idx_cpa_client" ON "client_processing_activities" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_cpa_activity" ON "client_processing_activities" USING btree ("processing_activity_id");--> statement-breakpoint
CREATE INDEX "idx_embeddings_vector" ON "document_embeddings" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "idx_embeddings_source" ON "document_embeddings" USING btree ("source_type");--> statement-breakpoint
CREATE INDEX "idx_embeddings_hash" ON "document_embeddings" USING btree ("content_hash");--> statement-breakpoint
CREATE INDEX "idx_nq_pending" ON "notification_queue" USING btree ("status","priority","created_at") WHERE "notification_queue"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "idx_nq_org" ON "notification_queue" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_nq_retry" ON "notification_queue" USING btree ("next_retry_at") WHERE "notification_queue"."status" = 'failed' AND "notification_queue"."attempts" < "notification_queue"."max_attempts";--> statement-breakpoint
CREATE INDEX "idx_org_embeddings_org" ON "organization_embeddings" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_org_embeddings_vector" ON "organization_embeddings" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "idx_oi_org" ON "organization_integrations" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_oi_provider" ON "organization_integrations" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "idx_ria_org" ON "regulatory_impact_assessments" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_ria_status" ON "regulatory_impact_assessments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_ru_status" ON "regulatory_updates" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_ru_severity" ON "regulatory_updates" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "idx_ru_published" ON "regulatory_updates" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "idx_wd_webhook" ON "webhook_deliveries" USING btree ("webhook_id");--> statement-breakpoint
CREATE INDEX "idx_wd_retry" ON "webhook_deliveries" USING btree ("next_retry_at");--> statement-breakpoint
CREATE INDEX "idx_wh_org" ON "webhooks" USING btree ("organization_id");