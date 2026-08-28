/**
 * P-11 — the pipeline's evaluation harness.
 *
 * "You cannot improve a pipeline you cannot measure, and the 7% figure in this
 * document had to be derived by counting JSON files."
 *
 * A gold set of hand-verified vendor records; `evaluateExtraction` scores a
 * pipeline run against it, per field, as precision/recall over the *values* the
 * enumerate-and-probe pass returned:
 * `npm run eval:vendors --workspace=apps/api -- --recorded <file.json>`.
 *
 * Sprint 5 removed the model from the pipeline, so what is being measured is
 * now the candidate enumeration and the probes rather than an extraction. The
 * scoring is unchanged, and so is the point of it: recall against this set is
 * how you tell "the vendor publishes no DPA" from "we did not find it".
 */
import fs from 'fs';
import type { ExtractedRecord } from './vendorIntelligence.js';

export interface GoldRecord {
  name: string;
  website: string;
  /** The hand-verified truth for each field. Absent keys are not scored. */
  expected: Partial<Record<string, unknown>>;
}

/**
 * The gold set. Values verified by hand from the vendors' own published pages,
 * August 2026 — small on purpose: better a set someone actually re-verifies
 * than a large one that rots. Extend it as batches run.
 */
export const GOLD_SET: GoldRecord[] = [
  {
    name: 'ClickUp',
    website: 'https://www.clickup.com',
    expected: {
      dpaUrl: 'https://clickup.com/terms/dpa',
      privacyPolicyUrl: 'https://clickup.com/terms/privacy',
      subProcessorListUrl: 'https://clickup.com/terms/dpa/subprocessors',
      headquartersCountry: 'US',
    },
  },
  {
    name: 'OneTrust',
    website: 'https://www.onetrust.com',
    expected: {
      headquartersCountry: 'US',
      dpaUrl: 'https://www.onetrust.com/terms-and-conditions/data-processing-addendum/',
    },
  },
  {
    name: 'Okta',
    website: 'https://www.okta.com',
    expected: {
      headquartersCountry: 'US',
      dpaUrl: 'https://www.okta.com/legal-agreements/data-processing-agreement/',
    },
  },
];

/** Field-level comparison rules: exact for URLs/countries, set-equality otherwise. */
function valuesMatch(field: string, expected: unknown, actual: unknown): boolean {
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual) || actual.length === 0) return false;
    const foldExpected = expected.map((v) => String(v).toLowerCase().replace(/[^a-z0-9]+/g, '')).sort();
    const foldActual = actual.map((v) => String(v).toLowerCase().replace(/[^a-z0-9]+/g, '')).sort();
    return JSON.stringify(foldExpected) === JSON.stringify(foldActual);
  }
  if (typeof expected === 'string' && typeof actual === 'string') {
    if (field === 'headquartersCountry') {
      return expected.toUpperCase() === actual.toUpperCase();
    }
    // URL fields: compare registrable host + path, ignoring scheme/www/trailing slash.
    if (field.toLowerCase().includes('url')) {
      const norm = (u: string) =>
        u.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '');
      return norm(expected) === norm(actual);
    }
  }
  return expected === actual;
}

const SCORABLE_FIELDS = [
  'dpaUrl',
  'privacyPolicyUrl',
  'subProcessorListUrl',
  'headquartersCountry',
  'transferMechanisms',
  'securityCertifications',
] as const;

export interface FieldScore {
  field: string;
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  precision: number;
  recall: number;
}

export interface EvaluationReport {
  evaluatedAt: string;
  records: number;
  fields: FieldScore[];
  overallPrecision: number;
  overallRecall: number;
}

/**
 * Score extracted records (keyed by website domain) against the gold set.
 * Precision: of the fields we returned, how many were right.
 * Recall: of the gold truths, how many did we find.
 */
export function evaluateExtraction(
  results: Array<{ website: string; record: ExtractedRecord }>,
): EvaluationReport {
  const byKey = new Map(results.map((r) => [normaliseKey(r.website), r.record]));

  const tallies = new Map<string, { tp: number; fp: number; fn: number }>();
  for (const field of SCORABLE_FIELDS) tallies.set(field, { tp: 0, fp: 0, fn: 0 });

  let totalTp = 0;
  let totalFp = 0;
  let totalFn = 0;
  let matchedRecords = 0;

  for (const gold of GOLD_SET) {
    const key = normaliseKey(gold.website);
    const record = byKey.get(key);
    if (!record) {
      // Nothing returned for a gold record: every expected field is a miss.
      for (const [field, tally] of tallies) {
        if (gold.expected[field] !== undefined && gold.expected[field] !== null) {
          tally.fn += 1;
          totalFn += 1;
        }
      }
      continue;
    }
    matchedRecords += 1;

    for (const [field, tally] of tallies) {
      const expected = gold.expected[field];
      const actual = (record as Record<string, unknown>)[field];
      const expectedPresent = expected !== undefined && expected !== null &&
        !(Array.isArray(expected) && expected.length === 0);
      const actualPresent = actual !== undefined && actual !== null &&
        !(Array.isArray(actual) && actual.length === 0);

      if (expectedPresent && actualPresent) {
        if (valuesMatch(field, expected, actual)) {
          tally.tp += 1;
          totalTp += 1;
        } else {
          tally.fp += 1;
          tally.fn += 1;
          totalFp += 1;
          totalFn += 1;
        }
      } else if (actualPresent && !expectedPresent) {
        tally.fp += 1;
        totalFp += 1;
      } else if (expectedPresent && !actualPresent) {
        tally.fn += 1;
        totalFn += 1;
      }
    }
  }

  const fields: FieldScore[] = Array.from(tallies.entries()).map(([field, t]) => ({
    field,
    truePositives: t.tp,
    falsePositives: t.fp,
    falseNegatives: t.fn,
    precision: t.tp + t.fp > 0 ? Math.round((t.tp / (t.tp + t.fp)) * 100) : 100,
    recall: t.tp + t.fn > 0 ? Math.round((t.tp / (t.tp + t.fn)) * 100) : 100,
  }));

  return {
    evaluatedAt: new Date().toISOString(),
    records: matchedRecords,
    fields,
    overallPrecision: totalTp + totalFp > 0 ? Math.round((totalTp / (totalTp + totalFp)) * 100) : 100,
    overallRecall: totalTp + totalFn > 0 ? Math.round((totalTp / (totalTp + totalFn)) * 100) : 100,
  };
}

function normaliseKey(website: string): string {
  return website.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
}

// ---------------------------------------------------------------------------
// CLI entry — npm run eval:vendors
// ---------------------------------------------------------------------------

const isMain = process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('vendorEval.ts');

if (isMain) {
  const recordedIdx = process.argv.indexOf('--recorded');
  if (recordedIdx !== -1 && process.argv[recordedIdx + 1]) {
    const raw = JSON.parse(fs.readFileSync(process.argv[recordedIdx + 1]!, 'utf8'));
    const report = evaluateExtraction(raw);
    printReport(report);
    process.exit(0);
  }

  console.log('No --recorded file given; scoring needs a recorded pipeline run.');
  console.log('Usage:');
  console.log('  npm run eval:vendors --workspace=apps/api -- --recorded extractions.json');
  console.log('');
  console.log('extractions.json shape:');
  console.log('  [{ "website": "https://www.clickup.com", "record": { ...sourced... } }]');
  process.exit(0);
}

function printReport(report: EvaluationReport): void {
  console.log(`\nVendor intelligence evaluation — ${report.records} gold records matched`);
  console.log('='.repeat(72));
  console.log('Field'.padEnd(24) + 'Precision'.padEnd(12) + 'Recall'.padEnd(12) + 'TP/FP/FN');
  for (const f of report.fields) {
    console.log(
      f.field.padEnd(24) +
        `${f.precision}%`.padEnd(12) +
        `${f.recall}%`.padEnd(12) +
        `${f.truePositives}/${f.falsePositives}/${f.falseNegatives}`,
    );
  }
  console.log('='.repeat(72));
  console.log(`Overall precision ${report.overallPrecision}% · recall ${report.overallRecall}%`);
}
