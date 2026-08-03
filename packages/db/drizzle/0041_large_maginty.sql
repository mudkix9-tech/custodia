ALTER TABLE "organizations" ADD COLUMN "trial_ends_at" timestamp with time zone;

UPDATE "organizations" 
SET "trial_ends_at" = NOW() + INTERVAL '14 days' 
WHERE "subscription_status" = 'trialing';