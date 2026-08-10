/**
 * Unit tests for toEvaluatorCookies() — which of the cookies a scan saw belong to
 * the site, and which the scanner planted itself.
 *
 *   npx tsx src/workers/consentScan.cookies.test.ts
 *
 * Standalone style, like consentEvaluator.fixtures.test.ts, because apps/api has no
 * vitest — the vitest-style suites here typecheck but never execute.
 *
 * This function has no database and no network in it, but it does live in a module
 * that imports `db.js`, hence the standaloneEnv import. Nothing here issues a query.
 *
 * Both directions matter and each one has already been wrong in production:
 *  - counting the 14 seeded acceptance cookies as the site's made a clean site raise
 *    a dozen unclassified_cookie findings about cookies the scanner put there;
 *  - discriminating on the name alone then suppressed the *real* cookie of any site
 *    running a CMP in our registry, found by a live scan of cookieyes.com.
 */
// Must precede every other import: consentScan.js pulls in db.js, which throws at
// import time without DATABASE_URL. See standaloneEnv.ts.
import '../lib/standaloneEnv.js';

import type { PassResult, ScannedCookie } from '../lib/browserPool.js';
import type { TrackerEntry } from '../lib/trackerRegistry.js';
import { toEvaluatorCookies } from './consentScan.js';

let failures = 0;
let checks = 0;

function check(ok: boolean, label: string, detail = '') {
  checks += 1;
  if (ok) {
    console.log(`  PASS  ${label}`);
  } else {
    failures += 1;
    console.log(`  FAIL  ${label}${detail ? `\n        ${detail}` : ''}`);
  }
}

const REGISTRY: TrackerEntry[] = [
  {
    trackerKey: 'google_analytics_4',
    provider: 'Google',
    matchDomains: ['google-analytics.com'],
    cookiePrefixes: ['_ga', '_gid'],
    requiredCategory: 'analytics',
    consentModeSupported: true,
    consentSignalParams: ['gcs'],
    vendorSlug: 'google',
  },
];

function cookie(name: string, isThirdParty = false): ScannedCookie {
  return { name, domain: 'example.com', path: '/', isThirdParty };
}

function pass(which: PassResult['pass'], names: string[]): PassResult {
  return { pass: which, requests: [], cookies: names.map(n => cookie(n)) };
}

function namesOf(result: ReturnType<typeof toEvaluatorCookies>): string[] {
  return result.map(c => c.cookieName).sort();
}

console.log('\ntoEvaluatorCookies\n');

// --- The original bug: the scanner counting its own cookies ----------------
{
  const planted = new Set(['cookieyes-consent', 'OptanonConsent']);
  const result = toEvaluatorCookies(
    [pass('pre_consent', ['_ga']), pass('post_consent', ['_ga', 'cookieyes-consent', 'OptanonConsent'])],
    REGISTRY,
    planted
  );

  check(
    JSON.stringify(namesOf(result)) === JSON.stringify(['_ga']),
    'seeded cookies that appear only after seeding are not the site\'s',
    `got [${namesOf(result).join(', ')}]`
  );
}

// --- The regression the live scan found -------------------------------------
{
  const planted = new Set(['cookieyes-consent']);
  const result = toEvaluatorCookies(
    // The site runs CookieYes, so it writes this name itself, before any seeding.
    [pass('pre_consent', ['cookieyes-consent', '_ga']), pass('post_consent', ['cookieyes-consent', '_ga'])],
    REGISTRY,
    planted
  );

  check(
    namesOf(result).includes('cookieyes-consent'),
    "a planted name seen in pass 1 is the site's own and is kept",
    `got [${namesOf(result).join(', ')}]`
  );
  check(
    result.length === 2,
    'and it is counted exactly once, not once per pass',
    `got ${result.length}: [${namesOf(result).join(', ')}]`
  );
}

// --- Merging across passes ---------------------------------------------------
{
  const result = toEvaluatorCookies(
    [pass('pre_consent', ['_ga']), pass('post_consent', ['_ga', '_gid'])],
    REGISTRY,
    new Set()
  );

  check(
    JSON.stringify(namesOf(result)) === JSON.stringify(['_ga', '_gid']),
    'a cookie set only after consent is still reported',
    `got [${namesOf(result).join(', ')}]`
  );
}

// --- Classification still applies -------------------------------------------
{
  const result = toEvaluatorCookies([pass('pre_consent', ['_ga', 'sess_id'])], REGISTRY, new Set());
  const ga = result.find(c => c.cookieName === '_ga');
  const unknown = result.find(c => c.cookieName === 'sess_id');

  check(ga?.category === 'analytics', 'a registry cookie keeps its category', `got ${ga?.category}`);
  check(ga?.provider === 'Google', 'a registry cookie keeps its provider', `got ${ga?.provider}`);
  check(Boolean(unknown), 'an unrecognised cookie is still reported (it becomes a finding)');
}

// --- Pass order must not matter ----------------------------------------------
{
  const planted = new Set(['cookieyes-consent']);
  const forwards = toEvaluatorCookies(
    [pass('pre_consent', ['cookieyes-consent']), pass('post_consent', ['cookieyes-consent'])],
    REGISTRY,
    planted
  );
  const backwards = toEvaluatorCookies(
    [pass('post_consent', ['cookieyes-consent']), pass('pre_consent', ['cookieyes-consent'])],
    REGISTRY,
    planted
  );

  check(
    forwards.length === 1 && backwards.length === 1,
    'the pass decides, not the order the passes are given in',
    `forwards ${forwards.length}, backwards ${backwards.length}`
  );
}

// --- The persisted-key truncation bug ----------------------------------------
//
// reconcileFindings() writes observed_host and subject into varchar(255) columns and
// then rebuilds the same key from what it reads back, to decide what this run did not
// re-observe. Keying on the raw finding instead makes an over-long cookie name fail to
// match itself, so the run that wrote the finding resolves it again immediately.
// Cookie names have no length limit — bbc.com already serves an 84-character
// machine-generated one.
{
  const longName = 'x'.repeat(300);
  const findingType = 'unclassified_cookie';
  const observedHost = '';

  const persistedKey = `${findingType}|${observedHost.slice(0, 255)}|${longName.slice(0, 255)}`;
  const rawKey = `${findingType}|${observedHost}|${longName}`;
  // What the database hands back to the sweep, given varchar(255) columns.
  const readBack = `${findingType}|${observedHost.slice(0, 255)}|${longName.slice(0, 255)}`;

  check(
    persistedKey === readBack,
    'the sweep key built from persisted values matches what the database returns',
    'A finding with an over-long subject would be resolved by its own run.'
  );
  check(
    rawKey !== readBack,
    'and the raw-value key genuinely would not have matched (the bug is real)',
    'Truncation is not observable here, so this test proves nothing.'
  );
}

console.log(`\n${checks - failures}/${checks} assertions passed.`);
if (failures > 0) {
  console.log(`${failures} FAILED.`);
  process.exit(1);
}
console.log('toEvaluatorCookies OK.\n');
