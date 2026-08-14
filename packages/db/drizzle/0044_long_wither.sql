ALTER TABLE "processing_activities" ADD COLUMN "role" varchar(20) DEFAULT 'controller' NOT NULL;--> statement-breakpoint
ALTER TABLE "processing_activities" ADD COLUMN "controller_name" varchar(255);