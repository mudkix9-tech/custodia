/**
 * Environment defaults for standalone tsx entrypoints — the live scan harness and
 * the consent-scan unit tests.
 *
 * This lives in its own module purely for ordering: ESM evaluates the whole import
 * graph before the first statement of the importing file runs, so setting these in
 * the entrypoint itself would happen *after* `db.js` had already thrown. Importing
 * this module first is the one way to get the assignments in early.
 *
 * `pg.Pool` connects lazily and the harness issues no query, so the placeholder URL
 * is never dialled — it only has to exist. Keeping it a placeholder rather than
 * reading the real `.env` is deliberate: neither a live scan nor a unit test should
 * be one typo away from writing to production.
 */
process.env.DATABASE_URL ||= 'postgres://live-scan-harness:none@127.0.0.1:1/never-connected';
process.env.NODE_ENV ||= 'test';
process.env.WORKER_ROLE ||= 'web';
