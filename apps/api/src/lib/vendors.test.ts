/**
 * Fixtures for the vendor module's Sprint 0 remediation.
 *
 *   npx tsx src/lib/vendors.test.ts
 *
 * Standalone style, like `ropaLifecycle.test.ts`, because apps/api has no vitest
 * — the vitest-style suites here typecheck but never execute. Everything under
 * test is pure, so no environment shim is needed.
 *
 * Sprint 0 shipped with no fixtures at all, which is the wrong bet in this
 * repo: `tsc` is the only other static gate and every defect below type-checked
 * perfectly while it was broken.
 *
 *   - A snapshot normaliser that eats newlines returns a valid string. The
 *     reviewer just sees "1 addition, 1 removal" over two blobs, for ever.
 *   - A quota window that reads a timestamp another counter owns returns a
 *     plausible number. It happens to be last month's.
 *   - A risk engine that gates US adequacy on a string no seed contains returns
 *     a confident 20/20. Every US vendor looks high risk and nothing errors.
 *   - A CSV writer that quotes differently from the importer round-trips fine
 *     until a vendor's name contains a comma.
 *
 * None of those fail loudly. That is the whole argument for the file.
 */
import {
  normaliseSubProcessorSnapshot,
  diffSubProcessorSnapshots,
} from './vendorSubProcessors.js';
import { isNewAiWindow, aiWindowReset, TIER_LIMITS } from '../constants/aiQuota.js';
import { calculateVendorRisk, type VendorRiskInput, type OrgVendorRiskInput } from './vendorRisk.js';
import { csvCell, csvRow, csvDocument } from '../utils/csv.js';
import {
  parseCsvRows,
  buildColumnMapping,
  normaliseVendorRow,
  matchCatalogue,
  MATCH_EXACT_DOMAIN,
  AUTO_LINK_THRESHOLD,
  type CatalogueEntry,
} from './vendorImport.js';
import { DPA_STATUS_SIGNED, DPA_STATUS_MISSING, DPA_STATUSES } from '../constants/dpaStatus.js';

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

const at = (s: string) => new Date(`${s}T00:00:00.000Z`);

console.log('\nvendorSubProcessors\n');

// --- the line that destroyed the Article 28(2) diff -----------------------------

// `.replace(/\s+/g, ' ')` collapses \n as well, and the reviewer's diff splits on
// \n. Two snapshots became two single lines, so every detected change rendered as
// exactly one addition and one removal, both unreadable.
const page = [
  'Our sub-processors',
  'Amazon Web Services    Hosting   United States',
  'Twilio Inc.\tSMS delivery\tUnited States',
  'Stripe Payments  Billing  Ireland',
  '© 2026 Example Corp. All rights reserved.',
  'We use cookies to improve your experience.',
  'Privacy Policy',
].join('\n');

const cleaned = normaliseSubProcessorSnapshot(page);

check(cleaned.split('\n').length === 4, 'line structure survives normalisation',
  `Got ${cleaned.split('\n').length} line(s): ${JSON.stringify(cleaned)}`);
check(!/ {2}/.test(cleaned), 'runs of horizontal whitespace collapse to one space');
check(!cleaned.includes('\t'), 'tabs collapse too');
check(!/rights reserved/i.test(cleaned), 'a copyright line is dropped');
check(!/cookies/i.test(cleaned), 'a cookie banner is dropped');
check(!/^Privacy Policy$/m.test(cleaned), 'a bare boilerplate link is dropped');
check(!/\b2026\b/.test(cleaned), 'years are stripped, so a "last updated" line is not a change');

// The regression itself, stated as an assertion rather than as a comment.
check(
  normaliseSubProcessorSnapshot('Alpha\nBeta').includes('\n'),
  'the normaliser does NOT join every line into one',
  'This is the D7 regression: /\\s+/ includes \\n, and the diff splits on \\n.',
);

// --- and the diff that reads it -------------------------------------------------

const before = normaliseSubProcessorSnapshot('Alpha Corp\nBeta Ltd\nGamma GmbH');
const after = normaliseSubProcessorSnapshot('Alpha Corp\nGamma GmbH\nDelta SA\nEpsilon BV');
const d = diffSubProcessorSnapshots(before, after);

check(d.added.length === 2, 'two genuinely new sub-processors are reported as two',
  `Got ${JSON.stringify(d.added)}.`);
check(d.removed.length === 1, 'one departure is reported as one',
  `Got ${JSON.stringify(d.removed)}.`);
check(d.added.includes('Delta SA') && d.added.includes('Epsilon BV'), 'the additions are named');
check(d.removed[0] === 'Beta Ltd', 'the removal is named');
check(
  diffSubProcessorSnapshots(before, before).added.length === 0 &&
  diffSubProcessorSnapshots(before, before).removed.length === 0,
  'an unchanged page produces no diff',
);
check(
  diffSubProcessorSnapshots('  Alpha Corp  \n\n', 'Alpha Corp').added.length === 0,
  'blank lines and stray padding are not a change',
);

// Reordering a published list is not a change of sub-processors, and reporting it
// as one is how a reviewer learns to ignore the alerts.
check(
  diffSubProcessorSnapshots('Alpha\nBeta', 'Beta\nAlpha').added.length === 0,
  'reordering the same names is not a change',
);

console.log('\naiWindow\n');

// --- one timestamp, two counters ------------------------------------------------

check(isNewAiWindow(null, at('2026-08-24')), 'an organisation that has never used AI opens a window');
check(!isNewAiWindow(at('2026-08-01'), at('2026-08-24')), 'same month is the same window');
check(isNewAiWindow(at('2026-07-31'), at('2026-08-01')), 'the last day of July and the first of August differ');
check(isNewAiWindow(at('2025-08-15'), at('2026-08-15')), 'same month, different year, is a new window',
  'Comparing only getMonth() would call August 2025 the current window.');
check(!isNewAiWindow(at('2026-08-31'), at('2026-08-01')), 'a clock skewed backwards inside the month does not reset');

// The D13 defect in its exact shape. `aiLastResetAt` governs `aiQueriesUsed` AND
// `aiDpasAnalyzed`; whichever path notices the rollover must clear both. When the
// DPA path cleared only its own column, a month whose first AI action was a
// copilot query carried the previous month's DPA total forward for ever.
const reset = aiWindowReset(at('2026-09-01'));
check(reset.aiQueriesUsed === 0, 'a rollover clears the copilot counter');
check(reset.aiDpasAnalyzed === 0, 'a rollover clears the DPA counter too',
  'Clearing one and not the other is how the "monthly" quota became a lifetime counter again.');
check(reset.aiLastResetAt.getTime() === at('2026-09-01').getTime(), 'and stamps the window it opened');
check(
  Object.keys(reset).length === 3,
  'a rollover writes exactly the three window columns',
  'A fourth key here means some other counter now rides this window and needs a fixture.',
);

// The allowances are separate keys because they are separate counters. Sharing
// TIER_LIMITS.ai for both made the DPA ceiling look plan-aware while being the
// same hardcoded 2000 it had always been.
check(typeof TIER_LIMITS.professional.dpaAnalyses === 'number', 'a paid tier has a finite DPA allowance');
check(TIER_LIMITS.enterprise.dpaAnalyses === Infinity, 'enterprise is unmetered');
check(
  Object.values(TIER_LIMITS).every((t) => 'dpaAnalyses' in t && 'ai' in t),
  'every tier names both allowances',
  'A tier missing dpaAnalyses falls through to undefined, and `n >= undefined` is false — unmetered by accident.',
);

console.log('\nvendorRisk — US adequacy\n');

// --- D5: the string the whole location factor turns on --------------------------

const usVendor = (mechanisms: string[]): VendorRiskInput => ({
  headquartersCountry: 'US',
  securityCertifications: ['soc2_type2'],
  transferMechanisms: mechanisms,
  knownIncidents: [],
});
const orgVendor: OrgVendorRiskInput = {
  dpaStatus: DPA_STATUS_SIGNED,
  dataCategoriesShared: [],
  dataSubjectVolume: '1K-10K',
  certifications: [],
  dpaClauseCoverage: null,
};

const noDpf = calculateVendorRisk(usVendor(['standard_contractual_clauses']), orgVendor, 0);
const withDpf = calculateVendorRisk(usVendor(['standard_contractual_clauses', 'data_privacy_framework']), orgVendor, 0);

check(noDpf.factors.location.points === 20, 'a US vendor with SCCs alone scores the full location risk',
  `Got ${noDpf.factors.location.points}/20.`);
check(withDpf.factors.location.points === 5, 'a DPF-certified US vendor scores the adequate-country rate',
  `Got ${withDpf.factors.location.points}/20. This is the difference the seed backfill exists to make.`);
check(withDpf.score < noDpf.score, 'and that moves the overall score, not just the factor');
check(
  /DPF/i.test(noDpf.factors.location.detail),
  'the uncertified case says why, in the factor detail the customer reads',
  `Got: ${noDpf.factors.location.detail}`,
);

// The mechanism may be recorded against the catalogue row or against the org's own
// record; the engine unions the two. This is the half of D26 that does work.
check(
  calculateVendorRisk(usVendor([]), { ...orgVendor, transferMechanisms: ['data_privacy_framework'] }, 0)
    .factors.location.points === 5,
  "an organisation's own DPF record counts, not just the catalogue's",
);

// Vocabulary, not spelling: the risk engine lowercases but does not normalise
// synonyms, so `dpf` or `Data Privacy Framework` is not the same string.
check(
  calculateVendorRisk(usVendor(['dpf']), orgVendor, 0).factors.location.points === 20,
  'an abbreviation is NOT accepted as the certification',
  'Three data sources use three vocabularies for this field and nothing normalises between them (audit finding 4).',
);
check(
  calculateVendorRisk(usVendor(['DATA_PRIVACY_FRAMEWORK']), orgVendor, 0).factors.location.points === 5,
  'but case alone does not decide adequacy',
);

// An EU vendor is not affected by any of this.
check(
  calculateVendorRisk({ ...usVendor([]), headquartersCountry: 'DE' }, orgVendor, 0)
    .factors.location.points === 0,
  'an EU vendor scores no location risk regardless of mechanisms',
);
check(
  calculateVendorRisk({ ...usVendor([]), headquartersCountry: null }, orgVendor, 0)
    .factors.location.points === 20,
  'an unknown country is scored as non-adequate, not as safe',
);

console.log('\ndpaStatus vocabulary\n');

check(!DPA_STATUS_MISSING.includes(DPA_STATUS_SIGNED as never), '"signed" is never counted as missing');
check(DPA_STATUS_MISSING.includes('not_started'), 'a DPA nobody has started is missing');
check(DPA_STATUS_MISSING.includes('expired'), 'an expired DPA is missing, not merely stale');
check(
  DPA_STATUS_MISSING.every((s) => DPA_STATUSES.includes(s)),
  'every "missing" status is a status the product actually writes',
  'A typo here silently zeroes the register tile — the column is a varchar(50) with no enum behind it.',
);
check(
  new Set(DPA_STATUSES).size === DPA_STATUSES.length,
  'the vocabulary has no duplicates',
);

console.log('\ncsv\n');

// --- one quoting rule, shared with the importer ---------------------------------

check(csvCell('Acme') === 'Acme', 'a plain value is not quoted');
check(csvCell('Billing, invoicing') === '"Billing, invoicing"', 'a comma forces quoting');
check(csvCell('He said "no"') === '"He said ""no"""', 'an embedded quote is doubled and the cell quoted');
check(csvCell('line one\nline two') === '"line one\nline two"', 'a newline forces quoting');
check(csvCell(null) === '', 'null is an empty cell, not the string "null"');
check(csvCell(undefined) === '', 'so is undefined');
check(csvCell(0) === '0', 'zero survives — it is a risk score, not an absence');
check(csvRow(['a', 'b,c']) === 'a,"b,c"', 'a row quotes only the cells that need it');
check(csvDocument([['h1'], ['v1']]) === 'h1\r\nv1', 'rows are CRLF-separated, which is what Excel expects');

// The vendor export used to always-quote while the ROPA export quoted
// conditionally. Both are valid RFC 4180; having two was the problem.
check(
  csvDocument([['Vendor', 'Country'], ['Acme, Inc.', 'US']]) === 'Vendor,Country\r\n"Acme, Inc.",US',
  'a vendor name containing a comma survives a round trip intact',
);

console.log('\nvendorImport — CSV parsing\n');

// --- Sprint 1, D40: the parser ---------------------------------------------------

check(
  JSON.stringify(parseCsvRows('Name,Country\nAcme,US')) === JSON.stringify([['Name', 'Country'], ['Acme', 'US']]),
  'a plain two-row file parses',
);
check(
  parseCsvRows('"Surname, Ltd",US')[0]?.[0] === 'Surname, Ltd',
  'a quoted field keeps its comma',
);
check(
  parseCsvRows('"say ""hi""",x')[0]?.[0] === 'say "hi"',
  'an escaped quote round-trips',
);
check(parseCsvRows('Name\n\nAcme\n').length === 2, 'blank rows are dropped');
check(parseCsvRows('Name\r\nAcme\r\n').length === 2, 'CRLF files parse like LF ones');
check(parseCsvRows('\uFEFFName\nAcme').length === 2, 'an Excel BOM does not become part of the first header');
check(
  parseCsvRows('Name,Motto\nAcme,"Comma,\nnewline"')[1]?.length === 2,
  'a newline inside quotes is not a row break',
);

console.log('\nvendorImport — header mapping and normalisation\n');

const mapping = buildColumnMapping(['Supplier Name', 'URL', 'HQ Country', 'Data shared', 'Owner', 'Criticality']);
check(mapping.name === 0 && mapping.website === 1 && mapping.country === 2,
  'free-form headers map onto canonical fields',
  JSON.stringify(mapping));
check(mapping.dataCategoriesShared === 3 && mapping.businessOwner === 4 && mapping.criticality === 5,
  'and the domain-specific ones too');

const row = normaliseVendorRow(
  ['Office 365', 'microsoft.com', 'United States', 'Email, HR data', 'Jane Doe', 'high'],
  mapping,
);
check(!('error' in row), 'a well-formed row normalises');
if (!('error' in row)) {
  check(row.name === 'Office 365', 'the name survives');
  check(row.website === 'https://microsoft.com/', 'a bare domain becomes a URL');
  check(row.headquartersCountry === 'US', 'prose country becomes ISO-3166 alpha-2 (D42)');
  check(JSON.stringify(row.dataCategoriesShared) === JSON.stringify(['Email', 'HR data']),
    'a separator-delimited cell becomes a list (D2 write path)');
  check(row.criticality === 'high', 'criticality is from the closed set or nothing');
  check(row.matchCandidate.domain === 'microsoft.com', 'the matcher gets a bare host');
}

const badRow = normaliseVendorRow(['', '', '', '', '', ''], mapping);
check('error' in badRow && /name/i.test(badRow.error), 'a nameless row is rejected with a reason');

const badMail = normaliseVendorRow(['Acme', '', '', '', '', '', 'not-an-email'], { ...mapping, contactEmail: 6 });
check('error' in badMail && /email/i.test(badMail.error), 'an invalid contact email is rejected rather than stored');

const badCrit = normaliseVendorRow(['Acme', '', '', '', '', 'urgent'], mapping);
check('error' in badCrit && /criticality/i.test(badCrit.error), 'an unknown criticality word fails loudly instead of writing null silently');

console.log('\nvendorImport — catalogue matching\n');

const catalogue: CatalogueEntry[] = [
  { id: 'v-ms', name: 'Microsoft 365', website: 'https://www.microsoft365.com', aliases: ['Office 365', 'O365'] },
  { id: 'v-sf', name: 'Salesforce', website: 'https://salesforce.com', aliases: null },
  { id: 'v-zd', name: 'Zendesk', website: 'https://zendesk.com', aliases: null },
];

const byDomain = matchCatalogue({ name: 'Something Else Entirely', domain: 'salesforce.com' }, catalogue);
check(byDomain?.vendorId === 'v-sf' && byDomain.confidence === MATCH_EXACT_DOMAIN,
  'an exact domain beats any name difference');

const byAlias = matchCatalogue({ name: 'office 365', domain: null }, catalogue);
check(byAlias?.vendorId === 'v-ms' && byAlias.method === 'alias',
  "an alias catches what the name misses ('Office 365' never matched Microsoft)");

const byFuzzy = matchCatalogue({ name: 'Saleforce', domain: null }, catalogue);
check(byFuzzy?.vendorId === 'v-sf' && byFuzzy.confidence >= AUTO_LINK_THRESHOLD,
  'a one-letter typo still clears the auto-link threshold',
  byFuzzy ? `confidence ${byFuzzy.confidence}` : 'no match');

check(matchCatalogue({ name: 'Totally Unrelated Consultancy GmbH', domain: null }, catalogue) === null,
  'an unrelated name matches nothing rather than guessing');

check(matchCatalogue({ name: 'zzz', domain: null }, [{ id: 'x', name: 'abc', website: null, aliases: null }]) === null,
  'very short names under the distance floor do not match');

console.log(`\n${checks - failures}/${checks} assertions passed.`);
if (failures > 0) {
  console.log(`${failures} FAILED.`);
  process.exit(1);
}
console.log('vendors OK.\n');
