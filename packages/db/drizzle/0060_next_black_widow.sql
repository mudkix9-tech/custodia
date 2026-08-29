-- VD-13: `vendors.dpa_available` boolean -> tri-state varchar.
--
-- The USING clause and the two statements around it are added by hand, which is
-- the one thing this repo otherwise never does. drizzle-kit cannot infer a value
-- mapping for a type change, so what it generated was a bare
--   ALTER COLUMN "dpa_available" SET DATA TYPE varchar(20)
-- and the failure mode of that is not an error: Postgres has an assignment cast
-- from boolean to text, so it applies cleanly and leaves the column holding
-- 'true' and 'false' — two values outside the vocabulary, in a column the risk
-- score and the gap rules read. Verified against a temp table rather than
-- assumed, because the opposite (that it would refuse) is the intuitive answer
-- and it is wrong.
--
-- `false -> 'unindexed'`, deliberately, not `'unavailable'`. The old column was
-- `boolean DEFAULT false`, so every false in the table is a default nobody set —
-- it records that Custodia has not looked, not that the vendor publishes no DPA.
-- Backfilling it as 'unavailable' would manufacture a catalogue assertion about
-- a named third party out of a column default, which is VD-13 restated as data.
--
-- meta/0060_snapshot.json is drizzle's and untouched, so `check:schema` still
-- compares schema.ts against it and a later `generate` produces nothing.

ALTER TABLE "vendors" ALTER COLUMN "dpa_available" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "vendors" ALTER COLUMN "dpa_available" SET DATA TYPE varchar(20)
  USING CASE WHEN "dpa_available" IS TRUE THEN 'available' ELSE 'unindexed' END;--> statement-breakpoint
ALTER TABLE "vendors" ALTER COLUMN "dpa_available" SET DEFAULT 'unindexed';--> statement-breakpoint
UPDATE "vendors" SET "dpa_available" = 'unindexed' WHERE "dpa_available" IS NULL;
