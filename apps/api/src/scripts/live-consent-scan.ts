/**
 * Live consent-scan harness — runs the real two-pass scanner against real sites.
 *
 *   npx tsx src/scripts/live-consent-scan.ts <domain> [domain ...]
 *
 * Deliberately not part of `npm run check`: it needs the network and a Chrome, and
 * a third party can change their CMP between runs. The fixture suite stays the
 * gate; this exists because all three of the bugs it asserts on were invisible to
 * the fixtures and only appeared against a live page.
 *
 * It imports the scanner's own helpers rather than reimplementing them, so a
 * regression in production code fails here instead of being papered over by a copy
 * that drifted. Importing `consentScan.js` pulls in `db.js`, which throws unless
 * DATABASE_URL is set; `standaloneEnv.ts` supplies a placeholder that is never
 * dialled, so the harness reaches no database.
 */
// Must precede every other import: it sets the env vars that db.js asserts on at
// import time. See standaloneEnv.ts for why it cannot be inlined here.
import '../lib/standaloneEnv.js';

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  getBrowserCluster,
  scanDomainTwoPass,
  type TwoPassScanResult,
} from '../lib/browserPool.js';
import { CMP_REGISTRY, detectCmp } from '../lib/cmpRegistry.js';
import { evaluateConsentScan, type Finding } from '../lib/consentEvaluator.js';
import type { TrackerEntry } from '../lib/trackerRegistry.js';
import {
  allAcceptanceCookies,
  enrichPass,
  resolvePostConsentMethod,
  toEvaluatorCookies,
} from '../workers/consentScan.js';

let failures = 0;
let checks = 0;

function check(ok: boolean, label: string, detail = '') {
  checks += 1;
  if (ok) {
    console.log(`      PASS  ${label}`);
  } else {
    failures += 1;
    console.log(`      FAIL  ${label}${detail ? `\n            ${detail}` : ''}`);
  }
}

/**
 * The real 64-entry seed, mapped the way loadTrackerRegistry() maps it. Read from
 * disk rather than the database so the harness needs no cluster.
 */
function loadSeededRegistry(): TrackerEntry[] {
  const seedPath = path.resolve(
    fileURLToPath(new URL('.', import.meta.url)),
    '../../../../packages/db/src/seed-data/trackers.json'
  );
  const raw = JSON.parse(readFileSync(seedPath, 'utf-8')) as any[];
  return raw.map(r => ({
    trackerKey: r.tracker_key,
    provider: r.provider,
    matchDomains: r.match_domains ?? [],
    cookiePrefixes: r.cookie_prefixes ?? [],
    requiredCategory: r.required_category,
    consentModeSupported: r.consent_mode_supported ?? false,
    consentSignalParams: r.consent_signal_params ?? [],
    vendorSlug: r.vendor_slug ?? null,
  }));
}

/**
 * Bug 1 — RFC 6265 octets in acceptance cookie values.
 *
 * Proves both directions against a live CDP session: the registry's literal values
 * are rejected by Network.setCookies, and the encoded ones are accepted. A
 * one-directional test would still pass if toCookieOctets() started returning its
 * input unchanged.
 */
async function verifyCookieOctets(): Promise<void> {
  console.log('\n  Bug 1 — acceptance cookies survive Network.setCookies');

  const cluster = await getBrowserCluster();
  const domain = 'example.com';

  const rawCookies = CMP_REGISTRY.flatMap(cmp =>
    cmp.acceptanceCookies.map(c => ({
      name: c.name,
      value: c.value,
      domain: '.' + domain,
      path: '/',
    }))
  );
  const encodedCookies = allAcceptanceCookies(domain);
  const illegal = rawCookies.filter(c => /[\s,;\\"]/.test(c.value));

  await cluster.execute(async ({ page }: any) => {
    const client = await page.createCDPSession();

    const rawBatch = await client
      .send('Network.setCookies', { cookies: rawCookies })
      .then(() => true)
      .catch(() => false);

    const encodedBatch = await client
      .send('Network.setCookies', { cookies: encodedCookies })
      .then(() => true)
      .catch((e: any) => String(e?.message ?? e));

    console.log(
      `      ${rawCookies.length} acceptance cookies, ` +
      `${illegal.length} carry octets RFC 6265 excludes ` +
      `(${illegal.map(c => c.name).join(', ')})`
    );

    check(
      illegal.length > 0,
      'registry still contains values needing encoding',
      'If this fails the regression can no longer be reproduced and the test is vacuous.'
    );
    check(
      rawBatch === false,
      'unencoded batch is rejected by CDP (the original bug)',
      'CDP accepted the raw values, so this no longer reproduces.'
    );
    check(
      encodedBatch === true,
      'encoded batch is accepted by CDP',
      typeof encodedBatch === 'string' ? encodedBatch : ''
    );

    // Per-cookie fallback: one poisoned entry must not cost the other thirteen.
    const poisoned = [
      { name: 'x-broken', value: 'a;b,c"d', domain: '.' + domain, path: '/' },
      ...encodedCookies,
    ];
    const poisonedBatch = await client
      .send('Network.setCookies', { cookies: poisoned })
      .then(() => true)
      .catch(() => false);

    let landed = 0;
    if (!poisonedBatch) {
      for (const cookie of poisoned) {
        await client
          .send('Network.setCookies', { cookies: [cookie] })
          .then(() => { landed += 1; })
          .catch(() => {});
      }
    }

    check(
      poisonedBatch === false && landed === encodedCookies.length,
      'per-cookie fallback lands the good cookies when one entry is bad',
      `batch=${poisonedBatch} landed=${landed}/${encodedCookies.length}`
    );

    await client.detach();
  });
}

/** The upsert key reconcileFindings() uses, and the key its stale sweep rebuilds. */
function upsertKey(f: Finding): string {
  return `${f.findingType}|${f.observedHost}|${f.subject ?? ''}`;
}

/** The same key before migration 0043 added `subject`. */
function legacyUpsertKey(f: Finding): string {
  return `${f.findingType}|${f.observedHost}`;
}

async function scanSite(domain: string, registry: TrackerEntry[]): Promise<void> {
  console.log(`\n${'='.repeat(72)}\n  ${domain}\n${'='.repeat(72)}`);

  const seedCookies = allAcceptanceCookies(domain);
  const plantedNames = new Set(seedCookies.map(c => c.name));

  let scan: TwoPassScanResult;
  try {
    scan = await scanDomainTwoPass(`https://${domain}`, {
      consentCookies: seedCookies,
      allowClickFallback: true,
    });
  } catch (err: any) {
    failures += 1;
    console.log(`      FAIL  scan threw: ${err?.message ?? err}`);
    return;
  }

  if (scan.pre.navigationError || scan.post.navigationError) {
    console.log(
      `      note: navigation error ` +
      `pre=${scan.pre.navigationError ?? '-'} post=${scan.post.navigationError ?? '-'}`
    );
  }

  const detected = detectCmp(
    scan.pre.requests.map(r => r.host),
    scan.pre.cookies.map(c => c.name)
  );

  // reconcileDomain() does not hand the scanner's raw method to the evaluator: an
  // undetected CMP means the seeding cannot be trusted, and resolving that down to
  // `unknown` is what lowers finding confidence. Mirroring it here keeps the harness
  // honest — passing the raw value would silently test a more confident path than
  // production ever takes.
  const postConsentMethod = resolvePostConsentMethod(
    scan.postConsentMethod,
    detected?.key ?? null
  );

  console.log(
    `      cmp=${detected?.name ?? 'none detected'} method=${postConsentMethod}` +
    (postConsentMethod === scan.postConsentMethod ? '' : ` (scanner: ${scan.postConsentMethod})`) +
    ` pre_hosts=${scan.pre.requests.length} post_hosts=${scan.post.requests.length}`
  );

  // --- Bug 1, live: the seeded cookies actually reached the page -------------
  console.log('\n  Bug 1 — seeded cookies present in pass 2');
  const postNames = new Set(scan.post.cookies.map(c => c.name));
  const preNames = new Set(scan.pre.cookies.map(c => c.name));
  const landedPlanted = [...plantedNames].filter(n => postNames.has(n));
  const plantedInPre = [...plantedNames].filter(n => preNames.has(n));

  check(
    landedPlanted.length > 0,
    `pass 2 carries seeded acceptance cookies (${landedPlanted.length} present)`,
    'None landed — Network.setCookies is failing again, so pass 2 is not consented.'
  );

  // --- Bug 2: seeded cookies must not be counted as the site's --------------
  //
  // A name we plant is not proof the scanner set it: a site running one of the
  // registry's CMPs writes that exact name itself. Pass 1 is never seeded, so
  // presence there is the discriminator — those must survive, and only the names
  // that appear for the first time in pass 2 may be dropped.
  console.log("\n  Bug 2 — seeded cookies excluded from the site's cookie set");
  const cookies = toEvaluatorCookies([scan.pre, scan.post], registry, plantedNames);
  const unfiltered = toEvaluatorCookies([scan.pre, scan.post], registry, new Set<string>());
  const reported = new Set(cookies.map(c => c.cookieName));

  const scannerOnly = landedPlanted.filter(n => !preNames.has(n));
  const siteOwned = plantedInPre;
  const leaked = scannerOnly.filter(n => reported.has(n));
  const suppressed = siteOwned.filter(n => !reported.has(n));

  console.log(
    `      cookies_found=${cookies.length} ` +
    `(unfiltered would report ${unfiltered.length}, ` +
    `+${scannerOnly.length} of the scanner's own)` +
    (siteOwned.length
      ? `; ${siteOwned.length} planted name(s) are genuinely the site's: ${siteOwned.join(', ')}`
      : '')
  );

  check(
    leaked.length === 0,
    'no scanner-planted cookie is reported as a site cookie',
    `Leaked: ${leaked.join(', ')}`
  );
  check(
    suppressed.length === 0,
    "the site's own cookies survive even when we plant the same name",
    `Suppressed: ${suppressed.join(', ')}`
  );
  check(
    unfiltered.length - cookies.length === scannerOnly.length,
    'the filter removes exactly the cookies the scanner planted',
    `filtered ${unfiltered.length - cookies.length}, scanner-only ${scannerOnly.length}`
  );

  const observations = [
    ...enrichPass(scan.pre, registry, new Map<string, string>()),
    ...enrichPass(scan.post, registry, new Map<string, string>()),
  ];

  const findings = evaluateConsentScan(
    { postConsentMethod },
    observations,
    {
      domain,
      categories: ['necessary', 'analytics', 'marketing', 'functional'],
      gcmV2Enabled: false,
      tcfEnabled: false,
      cmp: detected?.key ?? null,
      knownVendorSlugs: [],
    },
    cookies,
    registry
  );

  // --- Bug 3: one row per finding, not one row per run ----------------------
  console.log('\n  Bug 3 — every finding keeps its own row');
  const keys = findings.map(upsertKey);
  const distinct = new Set(keys);
  const legacyDistinct = new Set(findings.map(legacyUpsertKey));

  console.log(
    `      findings=${findings.length} rows_persisted=${distinct.size} ` +
    `(before migration 0043: ${legacyDistinct.size})`
  );

  const byType = new Map<string, number>();
  for (const f of findings) byType.set(f.findingType, (byType.get(f.findingType) ?? 0) + 1);
  for (const [type, n] of [...byType].sort()) console.log(`        ${type}: ${n}`);

  check(
    distinct.size === findings.length,
    'every finding has a distinct upsert key',
    `${findings.length} findings collapse to ${distinct.size} rows; collisions: ` +
    keys.filter((k, i) => keys.indexOf(k) !== i).join(' , ')
  );

  // The stale sweep rebuilds the key from persisted columns. Without `subject` the
  // run that created a per-cookie finding would immediately resolve all but one.
  const sweptKeys = new Set(
    findings.map(f => `${f.findingType}|${f.observedHost}|${f.subject ?? ''}`)
  );
  const wouldSelfResolve = findings.filter(f => !sweptKeys.has(upsertKey(f)));
  check(
    wouldSelfResolve.length === 0,
    'stale sweep re-derives every key it just wrote',
    `${wouldSelfResolve.length} findings would be auto-resolved by their own run.`
  );

  const perSubject = findings.filter(f => f.subject);
  if (perSubject.length > 1) {
    console.log(
      `      ${perSubject.length} per-subject findings: ` +
      perSubject.map(f => f.subject).slice(0, 8).join(', ') +
      (perSubject.length > 8 ? ' …' : '')
    );

    // Only findings with no host are distinguished by subject alone; a duplicate
    // there is a collapsed row. A subject repeated across *different* hosts is
    // correct and expected — one tracker proxied through several hostnames files one
    // finding per host, and the upsert-key check above is what covers those.
    const hostless = perSubject.filter(f => !f.observedHost);
    const dupes = hostless
      .map(f => f.subject)
      .filter((s, i, all) => all.indexOf(s) !== i);

    check(
      dupes.length === 0,
      'host-less findings, which are keyed on subject alone, carry unique subjects',
      `Duplicated: ${dupes.join(', ')}`
    );
  }
}

async function main() {
  const targets = process.argv.slice(2);
  if (targets.length === 0) {
    console.error('usage: tsx src/scripts/live-consent-scan.ts <domain> [domain ...]');
    process.exit(2);
  }

  const registry = loadSeededRegistry();
  console.log(`Live consent scan — ${registry.length} tracker registry entries loaded.`);

  try {
    await verifyCookieOctets();
    for (const target of targets) {
      await scanSite(target.replace(/^https?:\/\//, '').replace(/\/.*$/, ''), registry);
    }
  } finally {
    const cluster = await getBrowserCluster();
    await cluster.idle().catch(() => {});
    await cluster.close().catch(() => {});
  }

  console.log(`\n${'='.repeat(72)}`);
  console.log(`${checks - failures}/${checks} assertions passed.`);
  if (failures > 0) {
    console.log(`${failures} FAILED.`);
    process.exit(1);
  }
  console.log('Live scan clean.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
