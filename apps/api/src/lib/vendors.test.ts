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
  detectDelimiter,
  buildColumnMapping,
  normaliseVendorRow,
  buildCatalogueIndex,
  matchCatalogue,
  MATCH_EXACT_DOMAIN,
  AUTO_LINK_THRESHOLD,
  type CatalogueEntry,
} from './vendorImport.js';
import { DPA_STATUS_SIGNED, DPA_STATUS_MISSING, DPA_STATUSES } from '../constants/dpaStatus.js';
import {
  hasSpecialCategory,
  normaliseDataCategory,
  normaliseDataCategoryList,
  MAX_DATA_CATEGORIES,
} from '../constants/vendorDataCategories.js';
import {
  VENDOR_STATUSES,
  VENDOR_STATUSES_LIVE,
  VENDOR_STATUS_OFFBOARDED,
  isLiveVendorStatus,
} from '../constants/vendorLifecycle.js';
import { classifyActionType, RESOURCE_TABLE_MAP, extractResourceId, generateDescription } from '../utils/auditClassification.js';
import { fieldLabel, NOISE_FIELDS, describeChanges } from './auditTrail.js';

/**
 * `parseCsvRows` returns a discriminated result now, because a file with an
 * unbalanced quote has no honest row list. The helper keeps the assertions
 * readable and fails loudly if a fixture feeds it something unparseable.
 */
function rowsOf(result: ReturnType<typeof parseCsvRows>): string[][] {
  if ('error' in result) throw new Error(`expected rows, got: ${result.error}`);
  return result.rows;
}

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
  JSON.stringify(rowsOf(parseCsvRows('Name,Country\nAcme,US'))) === JSON.stringify([['Name', 'Country'], ['Acme', 'US']]),
  'a plain two-row file parses',
);
check(
  rowsOf(parseCsvRows('"Surname, Ltd",US'))[0]?.[0] === 'Surname, Ltd',
  'a quoted field keeps its comma',
);
check(
  rowsOf(parseCsvRows('"say ""hi""",x'))[0]?.[0] === 'say "hi"',
  'an escaped quote round-trips',
);
check(rowsOf(parseCsvRows('Name\n\nAcme\n')).length === 2, 'blank rows are dropped');
check(rowsOf(parseCsvRows('Name\r\nAcme\r\n')).length === 2, 'CRLF files parse like LF ones');
check(rowsOf(parseCsvRows('\uFEFFName\nAcme')).length === 2, 'an Excel BOM does not become part of the first header');
check(
  rowsOf(parseCsvRows('Name,Motto\nAcme,"Comma,\nnewline"'))[1]?.length === 2,
  'a newline inside quotes is not a row break',
);

// A CRLF terminator is one row break. The previous parser pushed on \r and again
// on \n, and only the blank-row filter hid it \u2014 so a file whose every row was
// genuinely blank in one column would have lost rows.
check(
  JSON.stringify(rowsOf(parseCsvRows('a,b\r\nc,d\r\n'))) === JSON.stringify([['a', 'b'], ['c', 'd']]),
  'CRLF does not produce a phantom row between every real one',
);
check(
  rowsOf(parseCsvRows('Name,Motto\nAcme,"one\r\ntwo"'))[1]?.[1] === 'one\ntwo',
  'a CRLF inside a quoted field is normalised to \\n, so the sub-processor diff can split on it',
);

// D40 hardening: a file we cannot honestly parse is an error, not a one-row
// register whose single vendor is named after the rest of the document.
const unbalanced = parseCsvRows('Name,Country\n"Acme,US\nBeta,GB');
check('error' in unbalanced, 'an unbalanced quote is reported rather than swallowed');
check('error' in unbalanced && unbalanced.error.includes('line 2'),
  'and the error names the line the quote opened on',
  'error' in unbalanced ? unbalanced.error : '');

// A German or French Excel writes semicolons. Read as commas the file has one
// column, so every row fails "a vendor name is required" and the importer looks
// broken rather than mismatched.
check(detectDelimiter('Name;Land;Kategorie\nAcme;DE;CRM') === ';', 'a semicolon file is detected');
check(detectDelimiter('Name\tCountry\nAcme\tUS') === '\t', 'so is a tab-separated one');
check(detectDelimiter('Name,Country\n"Acme, Inc.",US') === ',',
  'a comma inside quotes does not out-vote the real delimiter');
check(
  JSON.stringify(rowsOf(parseCsvRows('Name;Land\nAcme;DE'))) === JSON.stringify([['Name', 'Land'], ['Acme', 'DE']]),
  'and a semicolon file parses into the same shape as a comma one',
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
  // A separator-delimited cell becomes a list, and the list is normalised onto
  // the controlled vocabulary. "Email" and "HR data" are how a spreadsheet says
  // contact details and employment details; storing them verbatim is what made
  // "which vendors receive health data?" a reading exercise instead of a query.
  check(JSON.stringify(row.dataCategoriesShared) === JSON.stringify(['contact_details', 'employment_details']),
    'a separator-delimited cell becomes a normalised list (D2 write path)',
    JSON.stringify(row.dataCategoriesShared));
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

// The index is what stops the matcher re-parsing every catalogue URL for every
// row. It must produce identical answers to the array form, or the optimisation
// has changed the register's contents.
const indexed = buildCatalogueIndex(catalogue);
check(
  matchCatalogue({ name: 'Slack', domain: 'slack.com' }, indexed)?.vendorId
    === matchCatalogue({ name: 'Slack', domain: 'slack.com' }, catalogue)?.vendorId,
  'the prepared index and the raw array agree',
);
check(indexed.byId.get('v-sf')?.name === 'Salesforce', 'the index can name a match for the preview');

console.log('\nvendorDataCategories — the Article 9 vocabulary (D2/D3)\n');

// --- Sprint 1 remediation: the special-category question ------------------------
//
// The first version scanned for English keywords. The module ships in three
// languages, so a German customer typing into a field whose own placeholder is
// German could never trip the Art. 9 factor — and nothing would have said so.

check(hasSpecialCategory(['health_data']), 'a vocabulary key is recognised');
check(hasSpecialCategory(['contact_details']) === false, 'an ordinary key is not');
check(hasSpecialCategory([]) === false, 'an empty list is not special-category');
check(hasSpecialCategory(['Gesundheitsdaten']), 'free-text German health data still trips Article 9');
check(hasSpecialCategory(['données de santé']), 'and French, accents and all');
check(hasSpecialCategory(['Gewerkschaftszugehörigkeit']), 'German trade-union membership too');
check(hasSpecialCategory(['Criminal convictions']), 'Article 10 data escalates with Article 9 data');
check(hasSpecialCategory(['Email address', 'Postal address']) === false,
  'ordinary free text does not false-positive');
check(hasSpecialCategory(['device_and_usage_data']) === false,
  'a known ordinary key short-circuits before the keyword scan — "usage" must not read as a match');

check(normaliseDataCategory('Health data') === 'health_data', 'free text folds onto its key');
check(normaliseDataCategory('Gesundheitsdaten') === 'health_data', 'in German as well');
check(normaliseDataCategory('health_data') === 'health_data', 'a key passes through unchanged');
check(normaliseDataCategory('Widget serial numbers') === 'Widget serial numbers',
  'something we have no key for is kept verbatim rather than forced onto the nearest one');

check(
  JSON.stringify(normaliseDataCategoryList(['Health data', 'health_data', ' Contact '])) ===
    JSON.stringify(['health_data', 'contact_details']),
  'the list normaliser de-duplicates across spellings',
);
check(
  normaliseDataCategoryList(Array.from({ length: 80 }, (_, i) => `Category ${i}`)).length === MAX_DATA_CATEGORIES,
  'and caps the list, so the CSV path cannot write more than the tRPC path allows',
);

// The two write paths must agree. When only the tRPC input carried the cap, an
// import could put 300 values in a column the editor refused to save 51 into.
const importedRow = normaliseVendorRow(
  ['Acme', '', '', 'Gesundheitsdaten; Kontaktdaten', '', ''],
  buildColumnMapping(['Name', 'URL', 'HQ', 'Data shared', 'Owner', 'Criticality']),
);
check(!('error' in importedRow) && hasSpecialCategory(importedRow.dataCategoriesShared),
  'a German spreadsheet column arrives as an Article 9 finding, not as free text nobody reads');

console.log('\nvendorImport — row warnings\n');

const warnMapping = buildColumnMapping(['Name', 'HQ Country']);
const unknownCountry = normaliseVendorRow(['Acme', 'Ruritania'], warnMapping);
check(!('error' in unknownCountry) && unknownCountry.headquartersCountry === null,
  'an unknown country is not guessed at');
check(!('error' in unknownCountry) && unknownCountry.warnings.length === 1,
  'but it is reported — a silently blank country scores as unknown and looks like one nobody filled in');

const knownCountry = normaliseVendorRow(['Acme', 'Germany'], warnMapping);
check(!('error' in knownCountry) && knownCountry.warnings.length === 0,
  'a country we do know produces no noise');

console.log('\nvendorLifecycle — the status vocabulary (D30)\n');

check(VENDOR_STATUSES.includes(VENDOR_STATUS_OFFBOARDED), 'offboarded is a status, not a deletion');
check(VENDOR_STATUSES_LIVE.includes(VENDOR_STATUS_OFFBOARDED) === false,
  'and it is not live, so metrics and chasers can exclude it');
check(VENDOR_STATUSES_LIVE.includes('paused'), 'paused is live — a suspended contract still has the data');
check(isLiveVendorStatus(null), 'a row written before the column meant anything is live, not silently offboarded');
check(isLiveVendorStatus('offboarded') === false, 'and an offboarded one is not');

console.log('\nauditTrail — the vendor trail actually records changes (D33)\n');

// --- Sprint 1 remediation: the middleware wiring --------------------------------
//
// The trail read audit_logs rows back correctly. Nothing was writing diffs into
// them: `actionType` was decided by a `.update` path suffix the vendor router
// does not use, and the before-state table map was keyed on `vendors.org`, a
// path shape the router has never had. Both produce a plausible, empty timeline.

check(classifyActionType('ropa.update') === 'update', 'the suffix convention still works');
check(classifyActionType('vendors.updateOrgVendor') === 'update',
  'and a router that names mutations after what they do is no longer classified as "other"');
check(classifyActionType('vendors.setStatus') === 'update', 'offboarding is an update to the relationship');
check(classifyActionType('vendors.unlinkVendor') === 'delete', 'unlinking is a delete');
check(classifyActionType('vendors.getOrgVendors') === 'other', 'a read is still nothing');

check(RESOURCE_TABLE_MAP['vendors.updateOrgVendor']?.idField === 'vendorId',
  'the before-state lookup uses the catalogue id the router actually passes');
check(RESOURCE_TABLE_MAP['vendors.org'] === undefined,
  'and the path shape that never existed is gone');

check(extractResourceId({ orgVendorId: 'ov-1' }) === 'ov-1',
  'a questionnaire addressed by the join row is filed against it, not logged as null');
check(extractResourceId({ vendorId: 'v-1', orgVendorId: 'ov-1' }) === 'v-1',
  'and the catalogue id still wins where both are present, which is what the timeline filters on');

check(generateDescription('vendors.setStatus', { status: 'offboarded' }) === 'Offboarded the vendor',
  'the most important lifecycle event reads as a sentence');
check(generateDescription('vendors.updateOrgVendor', {}).startsWith('Performed') === false,
  'and an ordinary edit no longer falls through to the raw tRPC path');

check(fieldLabel('dpaStatus') === 'DPA status', 'a regulator-facing label is not "Dpa status"');
check(fieldLabel('deletionCertificateRef').includes('28(3)(g)'),
  'the Art. 28(3)(g) reference says which Article it discharges');
check(NOISE_FIELDS.includes('riskFactors'),
  'the risk blob recomputed on every save stays out of the diff');
check(NOISE_FIELDS.includes('riskScore') === false,
  'but the score itself does not — 62 to 74 is a real event a reader wants');

const rendered = describeChanges({
  dpaStatus: { old: 'not_started', new: 'signed' },
  riskFactors: { old: [{ a: 1 }], new: [{ a: 2 }] },
  lastRiskAssessment: { old: '2026-08-24T00:00:00Z', new: '2026-08-25T00:00:00Z' },
});
check(rendered.length === 1 && rendered[0]?.label === 'DPA status',
  'so one real change renders as one line, not as three',
  JSON.stringify(rendered.map((r) => r.label)));

console.log('\nSprint 2 — vendorCertifications (P-4)\n');

import {
  VENDOR_CERTIFICATIONS,
  normaliseCertification,
  normaliseCertificationList,
  hasCertification,
} from '../constants/vendorCertifications.js';

check(normaliseCertification('SOC 2 Type II') === 'soc2', 'the model spelling maps to the key');
check(normaliseCertification('ISO/IEC 27001:2022') === 'iso27001', 'the certificate spelling maps too');
check(normaliseCertification('PCI-DSS') === 'pci_dss', 'punctuation folds away');
check(normaliseCertification('B Corp') === null, 'an unmatched certification stays unmatched');
check(
  normaliseCertification('soc2') === 'soc2',
  'a canonical key maps to itself',
);
const certList = normaliseCertificationList(['SOC 2 Type II', 'unknown-thing', 'ISO 27001', 'soc2']);
check(certList[0] === 'soc2' && certList[2] === 'iso27001', 'mapped entries come first and dedupe');
check(certList.includes('unknown-thing'), 'an unmapped value is kept verbatim, not dropped');
check(hasCertification(['SOC 2 Type II'], 'soc2'), 'hasCertification sees the mapped form');
check(!hasCertification(['iso27001'], 'soc2'), 'and a recognised non-target answers false, not re-scans');
check(VENDOR_CERTIFICATIONS.length >= 10, 'the vocabulary is worth having');

console.log('\nSprint 2 — probe classification (P-6)\n');

import {
  classifyFetchError,
  classifyResponse,
  evaluateContentSignals,
  isGatedUrl,
} from './vendorProbe.js';

check(classifyResponse(403, '', false) === 'blocked_bot_protection', '403 is a bot block, not bad data');
check(classifyResponse(429, '', false) === 'blocked_bot_protection', '429 likewise');
check(classifyResponse(404, '', false) === 'url_not_found', '404 is a missing URL');
check(classifyResponse(200, '<html>Access Denied</html>', false) === 'blocked_bot_protection',
  'a bot-wall body is recognised even on a 200');
check(classifyResponse(200, '<html>real content</html>', true) === 'gated_content',
  'a login-walled URL classifies as gated');
check(classifyResponse(200, '<html>real content</html>', false) === 'content_mismatch',
  'reachable but signal-less is a mismatch, the honest "we got something else"');
check(classifyFetchError(new Error('This operation was aborted')) === 'timeout', 'an abort is a timeout');
check(evaluateContentSignals('<h1>Data Processing Agreement</h1><p>The controller and processor agree. Signed by both parties.</p>', 'dpa') === 'verified',
  'a real DPA verifies');
check(evaluateContentSignals('<form>Enter your username</form> Data Processing Agreement', 'dpa') !== 'verified',
  'a login wall never verifies, whatever words it borrows');
check(evaluateContentSignals('Sub-processors list with location and purpose of each entity', 'subprocessors') === 'verified',
  'a sub-processor page verifies on list + detail signals');
check(isGatedUrl('https://vendor.com/login?next=/dpa'), 'gating is visible in the URL itself');

console.log('\nSprint 2 — document domain classification (P-7)\n');

import {
  getRegistrableDomain,
  classifyDocumentDomain,
  VENDOR_PARENT_DOMAINS,
} from './vendorDomains.js';

check(getRegistrableDomain('https://www.example.com/legal') === 'example.com', 'scheme, www and path strip');
check(getRegistrableDomain('sub.co.uk') === 'sub.co.uk', 'a multi-label suffix keeps three labels');
check(getRegistrableDomain('a.b.example.com') === 'example.com', 'deep subdomains collapse to the registrable domain');

check(classifyDocumentDomain('https://clickup.com/terms/dpa', 'https://www.clickup.com') === 'same_site',
  'same registrable domain accepts');
check(classifyDocumentDomain('https://trust.netsuite.com/dpa', 'https://www.oracle.com/health', VENDOR_PARENT_DOMAINS) === 'parent_domain',
  'NetSuite under Oracle is an outcome, not a reject — audit D22');
check(classifyDocumentDomain('https://www.tableau.com/legal/dpa', 'https://salesforce.com', VENDOR_PARENT_DOMAINS) === 'parent_domain',
  'Tableau under Salesforce likewise');
check(classifyDocumentDomain('https://random-scammer.ru/dpa', 'https://clickup.com') === 'unknown',
  'an unrelated domain still rejects');
check(Object.keys(VENDOR_PARENT_DOMAINS).length >= 8, 'the parent map covers the audit\'s five lost records and more');

console.log('\nSprint 2 — per-field confidence (P-7)\n');

import {
  fieldConfidence,
  assessCandidate,
} from './vendorFieldConfidence.js';

check(fieldConfidence({ value: 'x', sourceType: 'http_probe', probeStatus: 'verified_probed_success', domainOk: true }) === 90,
  'a verified on-domain probe scores 90');
check(fieldConfidence({ value: 'x', sourceType: 'http_probe', probeStatus: 'verified_probed_success', domainOk: false }) === 60,
  'a verified off-domain (parent) probe scores visibly less');
check(fieldConfidence({ value: null, sourceType: 'ai_grounded' }) === 0,
  'an absent model fact scores nothing');
check(fieldConfidence({ value: 'present', sourceType: 'ai_grounded' }) === 40,
  'a model-only fact sits at the unprobed ceiling of 40');

// The AND gate's exact casualty: a verified DPA with a failed privacy policy.
// Old behaviour: rejected outright. New: accepted into review with the DPA
// leading.
const mixedRecord = {
  dpaUrl: { value: 'u', sourceType: 'http_probe' as const, probeStatus: 'verified_probed_success' as const, domainOk: true, resolvedUrl: 'https://v.com/dpa' },
  privacyPolicyUrl: { value: 'u', sourceType: 'http_probe' as const, probeStatus: 'failed_probed' as const, resolvedUrl: null },
};
const mixedAssessment = assessCandidate('Vendor', 'https://v.com', mixedRecord);
check(mixedAssessment.autoAcceptable || mixedAssessment.confidence > 50,
  'a verified DPA is no longer discarded for a failed privacy policy',
  `confidence=${mixedAssessment.confidence}, auto=${String(mixedAssessment.autoAcceptable)}`);
check(mixedAssessment.perField.privacyPolicyUrl?.decision !== 'accept',
  'while the failed privacy field itself is not silently accepted');

// The bulk-approve bar needs corroboration, not just one good field.
const weakRecord = {
  dpaUrl: { value: null, sourceType: 'ai_grounded' as const },
  headquartersCountry: { value: 'US', sourceType: 'ai_grounded' as const },
};
check(assessCandidate('V', 'https://v.com', weakRecord).autoAcceptable === false,
  'model-only facts cannot bulk-approve themselves');

console.log('\nSprint 2 — sub-processor entity parsing (P-10)\n');

import {
  parseSubProcessorLine,
  diffSubProcessorEntities,
  subProcessorNameKey,
} from './vendorSubProcessorEntities.js';

const pipeRow = parseSubProcessorLine('Twilio Inc. | SMS delivery | US');
check(pipeRow?.name === 'Twilio Inc.', 'a pipe-table row yields its name');
check(pipeRow?.service === 'SMS delivery', 'and its service');
check(pipeRow?.country === 'US', 'and its ISO country');

const parenRow = parseSubProcessorLine('Stripe Payments Europe Ltd (IE)');
check(parenRow?.name === 'Stripe Payments Europe Ltd', 'parenthesised country separates from the name');
check(parenRow?.country === 'IE', 'as an ISO code');

check(parseSubProcessorLine('Amazon Web Services')?.nameKey === subProcessorNameKey('amazon web services'),
  'a bare name parses with a folded key');
check(subProcessorNameKey('Twilio Inc.') === subProcessorNameKey('twilio inc'),
  'case and punctuation do not change identity');
check(parseSubProcessorLine('') === null && parseSubProcessorLine('   ') === null,
  'blank lines parse to nothing');

const urlOnly = parseSubProcessorLine('https://subprocessor.twilio.com/entity/acme');
check(urlOnly !== null && !!urlOnly.website && urlOnly.name.length > 0, 'a bare link names itself after its host');

const prevEntities = ['Alpha | Hosting | IE', 'Beta | SMS | US'].map((l) => parseSubProcessorLine(l)!);
const nextEntities = ['Alpha | Hosting | IE', 'Gamma | Mail | DE'].map((l) => parseSubProcessorLine(l)!);
const entityDiff = diffSubProcessorEntities(prevEntities, nextEntities);
check(entityDiff.added.length === 1 && entityDiff.added[0]?.name === 'Gamma', 'one entity added');
check(entityDiff.removed.length === 1 && entityDiff.removed[0]?.name === 'Beta', 'one entity removed');

console.log('\nSprint 2 — DPF matching (P-5)\n');

import { matchDpfStatus, dpfNameKey, isDpfLapsedByDate } from './vendorDpf.js';
import type { DpfEntry } from './vendorDpf.js';

const dpfEntries: DpfEntry[] = [
  { nameKey: dpfNameKey('Microsoft Corporation'), organisationName: 'Microsoft Corporation', domains: ['microsoft.com'], status: 'active' },
  { nameKey: dpfNameKey('GoDaddy Operating Company'), organisationName: 'GoDaddy Operating Company', domains: [], status: 'active' },
  { nameKey: dpfNameKey('Old Vendor Ltd'), organisationName: 'Old Vendor Ltd', domains: [], status: 'lapsed' },
];

check(matchDpfStatus('Anything Inc.', 'https://azure.microsoft.com', dpfEntries).status === 'active',
  'domain match wins regardless of name');
// The D19 defect in miniature: bidirectional substring made "Go" match "google".
check(matchDpfStatus('Google LLC', null, dpfEntries).status === 'not_found',
  '"Go" does not match "Godaddy" — substring matching stays dead');
check(matchDpfStatus('Microsoft Corporation', null, dpfEntries).status === 'active',
  'exact folded name matches');
check(matchDpfStatus('Old Vendor Limited', null, dpfEntries).status === 'not_found',
  'a differently-folded name does not fuzzy-match');
const lapsed = matchDpfStatus('Old Vendor Ltd', null, dpfEntries);
check(lapsed.status === 'lapsed', 'a lapsed entry reports lapsed rather than hiding');
check(isDpfLapsedByDate({ nextRecertificationDate: '2020-01-01' }) === true, 'an expired recert date reads lapsed');
check(isDpfLapsedByDate({ nextRecertificationDate: '2999-01-01' }) === false, 'a future recert date does not');
check(isDpfLapsedByDate({}) === false, 'no date means no lapse claim');

console.log('\nSprint 2 — candidate assessment mapping\n');

import { buildCatalogueWrites, diffFreshAgainstCatalogue } from './vendorIntelligenceMappers.js';

const catalogueResult = buildCatalogueWrites(
  {
    name: 'ClickUp',
    website: 'https://clickup.com',
    dpaUrl: 'https://clickup.com/terms/dpa',
    privacyPolicyUrl: null,
    subProcessorListUrl: 'https://clickup.com/terms/dpa/subprocessors',
    headquartersCountry: 'US',
    transferMechanisms: [],
    securityCertifications: ['soc2'],
    dataProcessingLocations: [],
  },
  { perField: { dpaUrl: { confidence: 90, decision: 'accept' } }, confidence: 80, autoAcceptable: true, needsConfirmation: [] },
);
check((catalogueResult.columns.dpaUrl as string) === 'https://clickup.com/terms/dpa', 'a present URL writes its column');
check(catalogueResult.columns.privacyPolicyUrl === undefined, 'an absent URL writes no column and no null over it');
check(catalogueResult.provenance.some((r) => r.fieldName === 'dpaUrl' && r.sourceType === 'http_probe' && r.confidence === 90),
  'provenance rows carry source type and confidence');
check(catalogueResult.provenance.every((r) => r.fieldName !== 'transferMechanisms'),
  'empty lists write nothing rather than resetting a known value to []');

const reverifyDiff = diffFreshAgainstCatalogue(
  { dpaUrl: 'https://old.com/dpa', privacyPolicyUrl: 'https://old.com/privacy', subProcessorListUrl: null, headquartersCountry: 'GB' },
  { dpaUrl: 'https://new.com/dpa', privacyPolicyUrl: 'https://old.com/privacy', subProcessorListUrl: null, headquartersCountry: 'GB' },
  { perField: {}, confidence: 0, autoAcceptable: false, needsConfirmation: [] },
);
check(reverifyDiff.length === 1 && reverifyDiff[0]?.field === 'dpaUrl',
  'reverify reports exactly the fields that moved');

console.log(`\n${checks - failures}/${checks} assertions passed.`);
if (failures > 0) {
  console.log(`${failures} FAILED.`);
  process.exit(1);
}
console.log('vendors OK.\n');