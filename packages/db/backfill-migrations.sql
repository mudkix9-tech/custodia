-- Step 1 & 2: Verification queries
-- Check if migration 0023_add_residual_risks is applied
SELECT column_name FROM information_schema.columns WHERE table_name = 'dpia_risks' AND column_name = 'residual_risk_level';

-- Check if migration 0024_dpia_gaps_sync is applied
SELECT column_name FROM information_schema.columns WHERE table_name = 'compliance_gaps' AND column_name = 'dpia_id';

-- Check if migration 0025_gap_metadata_column is applied
SELECT column_name FROM information_schema.columns WHERE table_name = 'compliance_gaps' AND column_name = 'metadata';

-- Check if migration 0029_mysterious_cardiac is applied
SELECT column_name FROM information_schema.columns WHERE table_name = 'regulatory_update_matches' AND column_name = 'matched_chunk_id';

-- Check if migration 0030_safe_jasper_sitwell is applied
SELECT column_name FROM information_schema.columns WHERE table_name = 'regulatory_update_matches' AND column_name = 'acknowledged_at';

-- Check if migration 0031_moaning_northstar is applied
SELECT indexname FROM pg_indexes WHERE indexname = 'idx_gaps_dpia';

-- Check if migration 0032_acoustic_riptide is applied
SELECT indexname FROM pg_indexes WHERE indexname = 'idx_consent_records_cat_acc';

-- Check if migration 0033_nosy_bromley is applied
-- (This one had commented out sql, so maybe no check needed for event_type)
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'consent_records' AND column_name = 'event_type';

-- Check if migration 0034_broad_nekra is applied
SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'consent_daily_summary';

-- Check if migration 0035_slim_moira_mactaggert is applied
SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'rate_limits';

-- Check if migration 0036_naive_vector is applied
SELECT column_name FROM information_schema.columns WHERE table_name = 'action_items' AND column_name = 'category';

-- Check if migration 0037_dashing_invaders is applied
SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'lead_assessments';

-- Check if migration 0038_legal_ser_duncan is applied
SELECT column_name FROM information_schema.columns WHERE table_name = 'lead_assessments' AND column_name = 'marketing_consent';

-- Step 3: Backfill missing migrations
BEGIN;

-- IMPORTANT: You may need to specify the schema if drizzle migrations is stored elsewhere 
-- (e.g. drizzle.__drizzle_migrations instead of public.__drizzle_migrations).

INSERT INTO __drizzle_migrations (hash, created_at)
VALUES
  ('8222d9ee04abff98a22f9800790249bc08e6acfdbf809b582d6475e7dbab8c96', (extract(epoch from now()) * 1000)::bigint), -- 0023_add_residual_risks
  ('9777f54885bcffa0909ef2ab42ab1befd0a70599ad13e826e2b9ad840521cabf', (extract(epoch from now()) * 1000)::bigint), -- 0024_dpia_gaps_sync
  ('c0be19749ea23756f9ec74ad3c9438cedee4d443bb93290c3a68c8b543ea3b4d', (extract(epoch from now()) * 1000)::bigint), -- 0025_gap_metadata_column
  ('722d363856c3f7c89b676067b7bda23328b3860cad51b20ac0632b63365eebc1', (extract(epoch from now()) * 1000)::bigint), -- 0029_mysterious_cardiac
  ('8edf09d87b3422dde6873ecabe04f38bbf56c3bb39051ddfad91e8e240743a93', (extract(epoch from now()) * 1000)::bigint), -- 0030_safe_jasper_sitwell
  ('8ecea9eae846b49c154a9f8c4f14c9231eaaa9ba6f957df746c554bc7cc50796', (extract(epoch from now()) * 1000)::bigint), -- 0031_moaning_northstar
  ('a083df9a19d15c5ed5520add6f8588e4b42433c9d436eedecb06bef4d076b5dc', (extract(epoch from now()) * 1000)::bigint), -- 0032_acoustic_riptide
  ('8ec44a2f51955a869088e19c61d63f72664b3dbfe1c840b5b9ea4c3a3769cbbf', (extract(epoch from now()) * 1000)::bigint), -- 0033_nosy_bromley
  ('3f1f0805a4ad2e9a065c84c51edb337fa486731dc98fee86612dc0e6a48a68c5', (extract(epoch from now()) * 1000)::bigint), -- 0034_broad_nekra
  ('a793eaf5df3b515bf4001ee4c5918f4f68d9255810792160dbc320a011041b3c', (extract(epoch from now()) * 1000)::bigint), -- 0035_slim_moira_mactaggert
  ('da6dd6232f8d52d473a326446c322ed303747fe89f8264214a8eae91e1eb972e', (extract(epoch from now()) * 1000)::bigint), -- 0036_naive_vector
  ('0920473f0bd6c14d20c07274bfad37b3eb6c82ef5af82d11f8a73b47c90f016d', (extract(epoch from now()) * 1000)::bigint), -- 0037_dashing_invaders
  ('c78986f63c965a72c8c9f80c810530a948f987927fc3e7f538f6cdcfc0ccaedf', (extract(epoch from now()) * 1000)::bigint); -- 0038_legal_ser_duncan

COMMIT;

-- Step 4: Verify continuity
SELECT id, hash, created_at FROM __drizzle_migrations ORDER BY id;
