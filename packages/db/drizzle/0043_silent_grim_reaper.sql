ALTER TABLE "consent_findings" DROP CONSTRAINT "uq_consent_finding_domain_type_host";--> statement-breakpoint
ALTER TABLE "consent_findings" ADD COLUMN "subject" varchar(255) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "consent_findings" ADD CONSTRAINT "uq_consent_finding_domain_type_host" UNIQUE("domain_id","finding_type","observed_host","subject");