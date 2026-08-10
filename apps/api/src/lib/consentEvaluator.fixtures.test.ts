/**
 * Fixture tests for the consent scan evaluator.
 *
 *   npx tsx src/lib/consentEvaluator.fixtures.test.ts
 *
 * Written in the standalone style of scoring.test.ts rather than with vitest,
 * because apps/api has no vitest installed — the vitest-style suites in this
 * workspace typecheck but never execute.
 *
 * The evaluator is a pure function, so this needs no database, no network and no
 * browser. Each fixture in __fixtures__/consent-scans is one scan's worth of
 * observations plus the findings it must and must not produce.
 *
 * The case that matters most is consent-mode-v2. Under Consent Mode v2 a tag
 * legitimately loads before consent and transmits a denial signal instead of an
 * identifier. If that ever produces prior_consent_violation, the feature accuses
 * precisely the customers who implemented consent correctly.
 *
 * Four of the five fixtures are hand-built to model real deployment shapes.
 * `first-party-only` is different: it is the recorded shape of an actual scan of
 * trycustodia.com, and it exists because that live run found two bugs no unit test
 * had — the scanner counting its own seeded acceptance cookies as site cookies, and
 * every per-cookie finding collapsing onto one upsert key.
 *
 * `consent-reconciliation-plan.md` still wants real captures for the other four
 * (Cookiebot, OneTrust, no-CMP, Consent Mode v2). A recording drops in unchanged as
 * long as it keeps the same keys.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateConsentScan, type Finding } from './consentEvaluator.js';
import type { TrackerEntry } from './trackerRegistry.js';

const FIXTURE_DIR = path.resolve(
  fileURLToPath(new URL('.', import.meta.url)),
  '__fixtures__/consent-scans'
);

type Fixture = {
  name: string;
  note?: string;
  run: any;
  domain: any;
  observations: any[];
  cookies: any[];
  expect: {
    findingTypes: string[];
    mustNotContain?: string[];
    severities?: Record<string, string>;
    confidences?: Record<string, number>;
    distinctSubjects?: string[];
  };
};

/** Mirrors the scanner's persistence allowlist (consent-reconciliation-plan.md, Phase 2). */
const ALLOWED_QUERY_PARAMS = new Set(['gcs', 'gcd', 'id', 'ev']);

let failures = 0;
let checks = 0;

function check(condition: boolean, label: string, detail = '') {
  checks++;
  if (condition) return;
  failures++;
  console.error(`  FAIL  ${label}${detail ? `\n        ${detail}` : ''}`);
}

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
}

function run() {
  const registry = readJson<TrackerEntry[]>(path.join(FIXTURE_DIR, 'registry.json'));

  const files = fs
    .readdirSync(FIXTURE_DIR)
    .filter(f => f.endsWith('.json') && f !== 'registry.json')
    .sort();

  if (files.length === 0) throw new Error('No fixtures found in ' + FIXTURE_DIR);

  console.log(`Consent evaluator fixtures (${files.length})\n`);

  for (const file of files) {
    const fixture = readJson<Fixture>(path.join(FIXTURE_DIR, file));
    console.log(`- ${fixture.name}  [${file}]`);

    const findings: Finding[] = evaluateConsentScan(
      fixture.run,
      fixture.observations,
      fixture.domain,
      fixture.cookies,
      registry
    );

    const produced: string[] = findings.map(f => f.findingType).sort();
    const expected = [...fixture.expect.findingTypes].sort();

    check(
      JSON.stringify(produced) === JSON.stringify(expected),
      `${file}: finding types`,
      `expected [${expected.join(', ')}]\n        got      [${produced.join(', ')}]`
    );

    for (const forbidden of fixture.expect.mustNotContain ?? []) {
      check(
        !produced.includes(forbidden),
        `${file}: must not emit ${forbidden}`,
        forbidden === 'prior_consent_violation'
          ? 'A Consent Mode ping is not a violation — see the header of this file.'
          : ''
      );
    }

    // Findings that are about a cookie rather than a host are distinguished only by
    // `subject`. Until it existed they all shared the upsert key (domain, type, '')
    // and a domain with eleven unclassified cookies persisted exactly one row.
    if (fixture.expect.distinctSubjects) {
      const subjects = findings.map(f => f.subject).filter(Boolean).sort();
      const wanted = [...fixture.expect.distinctSubjects].sort();
      check(
        JSON.stringify(subjects) === JSON.stringify(wanted),
        `${file}: one finding per subject`,
        `expected [${wanted.join(", ")}] got [${subjects.join(", ")}]`
      );
      check(
        new Set(subjects).size === subjects.length,
        `${file}: subjects are unique`,
        'Duplicate subjects collide on the upsert key and overwrite each other.'
      );
    }

    for (const [type, severity] of Object.entries(fixture.expect.severities ?? {})) {
      const found = findings.find(f => f.findingType === type);
      check(found?.severity === severity, `${file}: ${type} severity`, `expected ${severity}, got ${found?.severity}`);
    }

    for (const [type, confidence] of Object.entries(fixture.expect.confidences ?? {})) {
      const found = findings.find(f => f.findingType === type);
      check(found?.confidence === confidence, `${file}: ${type} confidence`, `expected ${confidence}, got ${found?.confidence}`);
    }

    // Sanitisation is a standing rule, not a per-fixture expectation: evidence is
    // shown to customers and exported, so it must carry no visitor identifier.
    //
    // The rule is not "no URLs" — an origin and path are fine, and the evaluator
    // deliberately cites sampleUrl as evidence. What must never appear is a query
    // parameter outside the allowlist, because that is where tracker URLs carry
    // identifiers, and storing those would put our own ROPA in a worse position
    // than our customers'.
    for (const finding of findings) {
      const evidence = JSON.stringify(finding.evidence ?? {});
      for (const raw of evidence.match(/https?:\/\/[^"\s\\]+/g) ?? []) {
        let params: string[] = [];
        try {
          params = Array.from(new URL(raw).searchParams.keys());
        } catch {
          check(false, `${file}: ${finding.findingType} evidence URL parses`, raw);
          continue;
        }
        const disallowed = params.filter(k => !ALLOWED_QUERY_PARAMS.has(k));
        check(
          disallowed.length === 0,
          `${file}: ${finding.findingType} evidence URL has only allowlisted params`,
          `disallowed: ${disallowed.join(", ")} in ${raw}`
        );
      }
    }
  }

  // Cross-cutting: the info-level finding must never be able to cost score. The
  // compliance pillar only deducts on critical/high, so an evaluator change that
  // promoted consent_mode_only would silently start penalising correct behaviour.
  const consentMode = readJson<Fixture>(path.join(FIXTURE_DIR, 'consent-mode-v2.json'));
  const findings = evaluateConsentScan(
    consentMode.run,
    consentMode.observations,
    consentMode.domain,
    consentMode.cookies,
    registry
  );
  check(
    findings.every(f => f.severity !== 'critical' && f.severity !== 'high'),
    'consent-mode-v2: nothing scoreable',
    'A correctly configured Consent Mode site must not lose compliance points.'
  );

  console.log(`\n${checks - failures}/${checks} assertions passed.`);
  if (failures > 0) {
    console.error(`\n${failures} assertion(s) failed.`);
    process.exit(1);
  }
  console.log('All consent evaluator fixtures passed.');
}

run();
