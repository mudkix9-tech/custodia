-- Hand-edited, and only for the value mapping drizzle-kit cannot infer — the
-- same exception `0060` is. What it generated was three bare `SET NOT NULL`
-- pairs, which fail outright on any row where the column is currently NULL, and
-- NULL is exactly what every rule written before this migration used for the
-- discriminators it did not need.
--
-- Why the columns are moving at all: they are part of
-- `vendor_extraction_rules_unq`, and Postgres treats NULLs in a unique
-- constraint as distinct. So the key never fired for any rule that left one
-- unset — which is every rule — and re-teaching a pin stacked a second
-- identical row rather than replacing it. Same trap `consent_findings` records
-- and the same fix (`observed_host` defaulting to '').
--
-- The DDL below is drizzle's, untouched; `meta/0064_snapshot.json` is drizzle's
-- and untouched too, so `check:schema` still compares against something it wrote.
UPDATE "vendor_extraction_rules" SET "doc_type" = '' WHERE "doc_type" IS NULL;--> statement-breakpoint
UPDATE "vendor_extraction_rules" SET "field_name" = '' WHERE "field_name" IS NULL;--> statement-breakpoint
UPDATE "vendor_extraction_rules" SET "url" = '' WHERE "url" IS NULL;--> statement-breakpoint
ALTER TABLE "vendor_extraction_rules" ALTER COLUMN "doc_type" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "vendor_extraction_rules" ALTER COLUMN "doc_type" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "vendor_extraction_rules" ALTER COLUMN "field_name" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "vendor_extraction_rules" ALTER COLUMN "field_name" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "vendor_extraction_rules" ALTER COLUMN "url" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "vendor_extraction_rules" ALTER COLUMN "url" SET NOT NULL;
