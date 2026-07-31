-- Data repair for migration 0039: jsonb columns that previously used a stringified
-- JSON literal as their column DEFAULT (e.g. jsonb('scopes').default('[]')). Any row
-- that received that old default is storing the JSON string "[]"/"{}", not an actual
-- array/object, and app code written against the corrected schema will break on
-- exactly those rows. Changing the column DEFAULT (done in 0039_gigantic_medusa.sql)
-- only affects future inserts, so existing rows must be repaired separately.
--
-- Run this manually against each target database (dev/staging/prod) after applying
-- 0039_gigantic_medusa.sql. It is safe to re-run: the WHERE clauses only match rows
-- still storing a JSON string, so already-repaired rows are skipped.
--
-- Inspect counts first:
--   SELECT count(*) FROM api_keys WHERE jsonb_typeof(scopes) = 'string';
--   SELECT count(*) FROM organization_integrations WHERE jsonb_typeof(scopes) = 'string';
--   SELECT count(*) FROM consent_domains WHERE jsonb_typeof(banner_config) = 'string' OR jsonb_typeof(categories) = 'string';
--   SELECT count(*) FROM consent_records WHERE jsonb_typeof(categories_rejected) = 'string';
--   SELECT count(*) FROM breaches WHERE jsonb_typeof(data_categories_affected) = 'string' OR jsonb_typeof(data_subjects_affected) = 'string' OR jsonb_typeof(affected_systems) = 'string';

BEGIN;

UPDATE api_keys
SET scopes = (scopes #>> '{}')::jsonb
WHERE jsonb_typeof(scopes) = 'string';

UPDATE organization_integrations
SET scopes = (scopes #>> '{}')::jsonb
WHERE jsonb_typeof(scopes) = 'string';

UPDATE consent_domains
SET banner_config = (banner_config #>> '{}')::jsonb
WHERE jsonb_typeof(banner_config) = 'string';

UPDATE consent_domains
SET categories = (categories #>> '{}')::jsonb
WHERE jsonb_typeof(categories) = 'string';

UPDATE consent_records
SET categories_rejected = (categories_rejected #>> '{}')::jsonb
WHERE jsonb_typeof(categories_rejected) = 'string';

UPDATE breaches
SET data_categories_affected = (data_categories_affected #>> '{}')::jsonb
WHERE jsonb_typeof(data_categories_affected) = 'string';

UPDATE breaches
SET data_subjects_affected = (data_subjects_affected #>> '{}')::jsonb
WHERE jsonb_typeof(data_subjects_affected) = 'string';

UPDATE breaches
SET affected_systems = (affected_systems #>> '{}')::jsonb
WHERE jsonb_typeof(affected_systems) = 'string';

COMMIT;
