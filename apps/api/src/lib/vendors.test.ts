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
import { calculateVendorRisk, NEW_LINK_RISK_INPUTS, type VendorRiskInput, type OrgVendorRiskInput } from './vendorRisk.js';
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

const noDpf = calculateVendorRisk(usVendor(['standard_contractual_clauses']), orgVendor, NEW_LINK_RISK_INPUTS);
const withDpf = calculateVendorRisk(usVendor(['standard_contractual_clauses', 'data_privacy_framework']), orgVendor, NEW_LINK_RISK_INPUTS);

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
  calculateVendorRisk(usVendor([]), { ...orgVendor, transferMechanisms: ['data_privacy_framework'] }, NEW_LINK_RISK_INPUTS)
    .factors.location.points === 5,
  "an organisation's own DPF record counts, not just the catalogue's",
);

// Vocabulary, not spelling: the risk engine lowercases but does not normalise
// synonyms, so `dpf` or `Data Privacy Framework` is not the same string.
check(
  calculateVendorRisk(usVendor(['dpf']), orgVendor, NEW_LINK_RISK_INPUTS).factors.location.points === 20,
  'an abbreviation is NOT accepted as the certification',
  'Three data sources use three vocabularies for this field and nothing normalises between them (audit finding 4).',
);
check(
  calculateVendorRisk(usVendor(['DATA_PRIVACY_FRAMEWORK']), orgVendor, NEW_LINK_RISK_INPUTS).factors.location.points === 5,
  'but case alone does not decide adequacy',
);

// An EU vendor is not affected by any of this.
check(
  calculateVendorRisk({ ...usVendor([]), headquartersCountry: 'DE' }, orgVendor, NEW_LINK_RISK_INPUTS)
    .factors.location.points === 0,
  'an EU vendor scores no location risk regardless of mechanisms',
);
check(
  calculateVendorRisk({ ...usVendor([]), headquartersCountry: null }, orgVendor, NEW_LINK_RISK_INPUTS)
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
  fieldDecision,
  assessCandidate,
  VENDOR_SOURCE_TYPES,
} from './vendorFieldConfidence.js';

check(fieldConfidence({ value: 'x', sourceType: 'http_probe', probeStatus: 'verified_probed_success', domainOk: true }) === 90,
  'a verified on-domain probe scores 90');
check(fieldConfidence({ value: 'x', sourceType: 'http_probe', probeStatus: 'verified_probed_success', domainOk: false }) === 60,
  'a verified off-domain (parent) probe scores visibly less');

console.log('\nSprint 5 — the provenance vocabulary (VD-1, VD-2)\n');

// The zero-model policy is enforced by the type system, not by prose: there is
// no member of this union a model-asserted value could be stored under. The
// superseded plan banned hallucination in a bullet point while the code wrote
// `ai_grounded` rows for the five Chapter V fields.
check(!(VENDOR_SOURCE_TYPES as readonly string[]).includes('ai_grounded'),
  'ai_grounded has left the provenance vocabulary');
check((VENDOR_SOURCE_TYPES as readonly string[]).includes('trust_centre'),
  'and trust_centre has entered it, so Channel 3 has somewhere to store its output');

// A portal badge is HTML. What a SafeBase page proves is that SafeBase renders
// a badge, so Tier 3 must land in review rather than accept — that is the whole
// difference between it and a probe of the vendor's own domain.
check(fieldConfidence({ value: 'x', sourceType: 'trust_centre', probeStatus: 'verified_probed_success' }) === 75,
  'a verified trust-centre page scores below a probe of the vendor\'s own site');
check(fieldDecision({ value: 'x', sourceType: 'trust_centre', probeStatus: 'verified_probed_success' }) === 'review',
  'and lands in review, never auto-accept');
check(fieldConfidence({ value: 'x', sourceType: 'trust_centre', probeStatus: 'partially_probed' }) === 35,
  'a partially matched portal page scores lower still');

check(fieldConfidence({ value: 'US', sourceType: 'registry' }) === 95,
  'a registry row scores highest — an official publisher, dated');
check(fieldConfidence({ value: 'US', sourceType: 'analyst' }) === 90,
  'a named human with an excerpt scores alongside an on-domain probe');
check(fieldConfidence({ value: 'US', sourceType: 'customer' }) === 95,
  'a tenant\'s own executed contract is authoritative for that tenant');

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

// The bulk-approve bar needs corroboration, not just one good field. Before
// Sprint 5 the five model-asserted fields at 40 dragged the weighted mean under
// the bar, which is what made a one-field record unapprovable; with those gone,
// `autoAcceptable` has to say so itself, so the DPA no longer counts as its own
// corroboration.
const soloDpa = {
  dpaUrl: {
    value: 'u',
    sourceType: 'http_probe' as const,
    probeStatus: 'verified_probed_success' as const,
    domainOk: true,
    resolvedUrl: 'https://v.com/dpa',
  },
};
const soloAssessment = assessCandidate('V', 'https://v.com', soloDpa);
check(soloAssessment.confidence === 90,
  'a record asserting one verified field is 90% sure of that field',
  `confidence=${soloAssessment.confidence}`);
check(soloAssessment.autoAcceptable === false,
  'but a verified DPA does not corroborate itself into a bulk approval');

const corroborated = {
  ...soloDpa,
  subProcessorListUrl: {
    value: 'u',
    sourceType: 'http_probe' as const,
    probeStatus: 'verified_probed_success' as const,
    domainOk: true,
    resolvedUrl: 'https://v.com/subprocessors',
  },
};
check(assessCandidate('V', 'https://v.com', corroborated).autoAcceptable === true,
  'a second verified probe is what clears the bulk-approve bar');

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

console.log('\nSprint 3 — Deep Article 28(3) DPA Clause Analyser (P-9)\n');

import {
  analyseDpaText,
  verifyClauseExcerpt,
  verifyAndSanitizeDpaAnalysis,
} from './vendorDpaClauseAnalyzer.js';

const sampleDpaText = `
DATA PROCESSING AGREEMENT
1. Scope and Instructions: The processor shall process personal data only on documented instructions from the controller, including with regard to transfers of personal data.
2. Confidentiality: The processor ensures that persons authorised to process the personal data have committed themselves to confidentiality.
3. Security: Taking into account the state of the art, the processor shall implement appropriate technical and organisational measures pursuant to Article 32.
4. Sub-processors: The processor shall not engage another processor without prior specific or general written authorisation of the controller.
5. Data Subject Rights: The processor assists the controller by appropriate technical and organisational measures in responding to data subjects exercising their rights under Chapter III.
6. Incident Notification: The processor assists the controller in ensuring compliance with Article 33 and Article 34 breach notifications.
7. Deletion: At the choice of the controller, the processor deletes or returns all personal data to the controller after the end of the provision of services.
8. Audits: The processor makes available to the controller all information necessary to demonstrate compliance and allows for audits and inspections.
`;

const parsedAnalysis = analyseDpaText(sampleDpaText);
check(parsedAnalysis.overallScore === 100, 'a fully compliant standard DPA text scores 100/100', `got ${parsedAnalysis.overallScore}`);
check(parsedAnalysis.overallVerdict === 'compliant', 'verdict is compliant for full score');
check(Object.keys(parsedAnalysis.clauses).length === 8, 'all 8 statutory Article 28(3) clauses are evaluated');

// Verify that regex operator precedence does not false-positive on bare "annex" or "schedule"
const bareAnnexText = 'Please refer to Annex A for contact details and Schedule 1 for billing terms.';
const bareAnnexAnalysis = analyseDpaText(bareAnnexText);
check(
  bareAnnexAnalysis.clauses.securityMeasures?.status === 'missing',
  'bare reference to Annex/Schedule without security measures does not match securityMeasures clause',
);

check(
  verifyClauseExcerpt(sampleDpaText, 'process personal data only on documented instructions') === true,
  'exact substring quote verifies as genuine',
);
check(
  verifyClauseExcerpt(sampleDpaText, 'this sentence was made up by an llm hallucination') === false,
  'hallucinated quote fails substring verification',
);

const rawModelOutput: any = {
  analysedAt: new Date().toISOString(),
  sourceUrl: 'https://vendor.com/dpa',
  overallScore: 100,
  overallVerdict: 'compliant' as const,
  weaknesses: [],
  missingClauses: [],
  clauses: {
    documentedInstructions: {
      status: 'present' as const,
      confidence: 90,
      excerpt: 'process personal data only on documented instructions from the controller',
      notes: 'Standard clause',
      citation: 'Art. 28(3)(a)',
    },
    confidentiality: {
      status: 'present' as const,
      confidence: 90,
      excerpt: 'HALLUCINATED NON-EXISTENT SUBSTRING',
      notes: 'Fake quote',
      citation: 'Art. 28(3)(b)',
    },
  },
};

const sanitized = verifyAndSanitizeDpaAnalysis(rawModelOutput, sampleDpaText);
check(
  sanitized.clauses.documentedInstructions?.excerpt !== undefined,
  'verified substring keeps excerpt',
);
check(
  sanitized.clauses.confidentiality?.excerpt === undefined,
  'hallucinated substring drops excerpt from sanitized output',
);
check(
  sanitized.clauses.confidentiality?.confidence <= 40,
  'hallucinated clause confidence is capped at 40',
);

console.log('\nSprint 3 — Real-Time DPF Risk Wiring (P-5)\n');

const usActiveDpfRisk = calculateVendorRisk(
  {
    headquartersCountry: 'US',
    securityCertifications: ['soc2'],
    dpfStatus: 'active',
  },
  {
    dpaStatus: 'signed',
  },
  NEW_LINK_RISK_INPUTS
);
check(
  usActiveDpfRisk.factors.location.points === 5,
  'US vendor with active DPF certification scores 5/20 location risk (adequate)',
  `got ${usActiveDpfRisk.factors.location.points}`,
);

const usLapsedDpfRisk = calculateVendorRisk(
  {
    headquartersCountry: 'US',
    securityCertifications: ['soc2'],
    dpfStatus: 'lapsed',
    dpfLapsedDate: '2025-01-01',
  },
  {
    dpaStatus: 'signed',
  },
  NEW_LINK_RISK_INPUTS
);
check(
  usLapsedDpfRisk.factors.location.points === 20,
  'US vendor with lapsed DPF certification scores 20/20 location risk with lapse warning',
  `got ${usLapsedDpfRisk.factors.location.points}`,
);
check(
  usLapsedDpfRisk.factors.location.detail.includes('lapsed'),
  'location factor detail explains that DPF certification has lapsed',
);

const euVendorRisk = calculateVendorRisk(
  {
    headquartersCountry: 'DE',
    securityCertifications: ['iso27001'],
  },
  {
    dpaStatus: 'signed',
  },
  NEW_LINK_RISK_INPUTS
);
check(
  euVendorRisk.factors.location.points === 0,
  'EU vendor located in Germany scores 0/20 location risk',
);

console.log('\nSprint 3 — Article 30 Recipient Register & Article 28 Dossier\n');

import { buildArticle30RecipientCsv, buildArticle28DossierMarkdown } from './vendorAuditPack.js';

const dummyRows = [
  {
    vendorName: 'CloudMed Diagnostics, Inc.',
    category: 'Healthcare Cloud',
    processingRole: 'Processor',
    purpose: 'Patient analytics and diagnostic telemetry',
    dataCategoriesShared: ['contact_details', 'health_data'],
    isSpecialCategory: true,
    headquartersCountry: 'DE',
    dataProcessingLocations: ['Germany', 'Ireland'],
    transferMechanisms: ['Adequacy Decision (EU/EEA)'],
    dpaStatus: 'signed',
    dpaSignedAt: '2026-01-01',
    businessOwner: 'dpo@acme.com',
    criticality: 'high',
    status: 'active',
  },
];

const csvOutput = buildArticle30RecipientCsv(dummyRows);
check(csvOutput.includes('CloudMed Diagnostics, Inc.'), 'Article 30 CSV includes vendor name');
check(csvOutput.includes('health_data'), 'Article 30 CSV includes shared data categories');
check(csvOutput.includes('Yes (Art. 9)'), 'Article 30 CSV flags special category data');
check(csvOutput.startsWith('Recipient (Vendor),Service Category'), 'Article 30 CSV has RFC 4180 headers');

const dossierMd = buildArticle28DossierMarkdown({
  organizationName: 'Acme Health Ltd',
  generatedAt: '2026-08-26',
  vendor: {
    name: 'CloudMed Diagnostics, Inc.',
    website: 'https://cloudmed.de',
    category: 'Healthcare Cloud',
    headquartersCountry: 'DE',
    dpaStatus: 'signed',
    criticality: 'high',
  },
  clauseCoverage: {
    documentedInstructions: { status: 'present', citation: 'Art. 28(3)(a)', excerpt: 'Process on instructions only' },
  },
  subProcessors: [{ name: 'AWS Europe', country: 'IE', service: 'Hosting' }],
  transfers: { destinationCountry: 'DE', mechanisms: ['Adequacy Decision'] },
  provenance: [],
});
check(dossierMd.includes('# Article 28 Compliance Dossier'), 'Dossier contains title');
check(dossierMd.includes('Acme Health Ltd'), 'Dossier references controller organisation');
check(dossierMd.includes('CloudMed Diagnostics, Inc.'), 'Dossier references processor name');
check(dossierMd.includes('Article 28(3) Mandatory Terms Evaluation'), 'Dossier contains Article 28(3) table');

console.log('\nSprint 3 — Governance & Review Cadence Engine (D31)\n');

import { calculateNextReviewDate, evaluateReviewStatus } from './vendorGovernance.js';

const baseDate = new Date('2026-01-01T00:00:00Z');
const quarterlyDate = calculateNextReviewDate(baseDate, 'critical');
const biannualDate = calculateNextReviewDate(baseDate, 'high');
const annualDate = calculateNextReviewDate(baseDate, 'low');

check(
  Math.round((quarterlyDate.getTime() - baseDate.getTime()) / (1000 * 60 * 60 * 24)) === 90,
  'critical vendor defaults to quarterly review cadence (90 days)',
);
check(
  Math.round((biannualDate.getTime() - baseDate.getTime()) / (1000 * 60 * 60 * 24)) === 180,
  'high criticality vendor defaults to biannual review cadence (180 days)',
);
check(
  Math.round((annualDate.getTime() - baseDate.getTime()) / (1000 * 60 * 60 * 24)) === 365,
  'low/medium vendor defaults to annual review cadence (365 days)',
);

check(evaluateReviewStatus(new Date(Date.now() - 86400000)).status === 'overdue', 'past date is overdue');
check(
  evaluateReviewStatus(new Date(Date.now() + 7 * 86400000)).status === 'due_soon',
  'date in 7 days is due_soon',
);
check(
  evaluateReviewStatus(new Date(Date.now() + 60 * 86400000)).status === 'scheduled',
  'date in 60 days is scheduled',
);

console.log('\nSprint 3 — Incident Blast Radius & Category Intersection (D16)\n');

import { evaluateIncidentBlastRadius } from './vendorIncidentIntelligence.js';

const sharedIncident = evaluateIncidentBlastRadius(
  {
    title: 'Data leak involving user email addresses and patient health records',
    affectedCategories: ['health_data', 'financial_details'],
    severity: 'critical',
  },
  ['health_data', 'contact_details'],
);

check(sharedIncident.categoryIntersection.length === 1 && sharedIncident.categoryIntersection[0] === 'health_data',
  'category intersection accurately detects overlapping categories');
check(sharedIncident.hasSpecialCategoryExposure === true, 'special category exposure is triggered for health_data');
check(sharedIncident.isBlastRadiusRelevant === true, 'incident is marked relevant to controller');
check(sharedIncident.blastRadiusScore > 50, 'special category exposure escalates blast radius score');

const irrelevantIncident = evaluateIncidentBlastRadius(
  {
    title: 'Customer billing leak',
    affectedCategories: ['payment_card_data', 'ip_address'],
    severity: 'low',
  },
  ['telemetry_data', 'trade_union_membership'],
);
check(irrelevantIncident.isBlastRadiusRelevant === false, 'unrelated categories report no exposure and "ip_address" does not match "trade_union_membersh-ip"');

console.log('\nSprint 3 — Standard Statutory Article 28 DPA Generator\n');

import { generateStandardArticle28Dpa } from './vendorDpaTemplate.js';

const generatedAgreement = generateStandardArticle28Dpa({
  controllerName: 'Acme Global Corp',
  processorName: 'DataServe GmbH',
  dataCategories: ['contact_details', 'identity_details'],
  purposeOfProcessing: 'Customer identity verification and authentication',
});

check(generatedAgreement.includes('Acme Global Corp'), 'DPA includes controller name');
check(generatedAgreement.includes('DataServe GmbH'), 'DPA includes processor name');
check(generatedAgreement.includes('Documented Instructions (Art. 28(3)(a))'), 'DPA includes Art. 28(3)(a)');
check(generatedAgreement.includes('Audits and Inspections (Art. 28(3)(h))'), 'DPA includes Art. 28(3)(h)');
check(generatedAgreement.includes('Customer identity verification and authentication'), 'DPA includes specified purpose');

console.log('\nSprint 4 — Supply Chain Graph & 4th-Party Concentration Engine\n');

import { evaluateConcentrationGraph, calculateConcentrationAnalytics } from './vendorConcentration.js';

const concentrationInput = {
  directVendors: [
    { id: 'ov1', vendorId: 'v1', name: 'CRM SaaS', criticality: 'critical' as const, dataCategoriesShared: ['contact_details', 'health_data'], headquartersCountry: 'US' },
    { id: 'ov2', vendorId: 'v2', name: 'Analytics Pro', criticality: 'critical' as const, dataCategoriesShared: ['user_behavior'], headquartersCountry: 'DE' },
    { id: 'ov3', vendorId: 'v3', name: 'Support Chat', criticality: 'medium' as const, dataCategoriesShared: ['contact_details'], headquartersCountry: 'FR' },
  ],
  subProcessors: [
    { parentVendorId: 'v1', name: 'Amazon Web Services', country: 'US', service: 'Cloud Infrastructure' },
    { parentVendorId: 'v2', name: 'Amazon Web Services', country: 'US', service: 'Compute & Storage' },
    { parentVendorId: 'v3', name: 'Amazon Web Services', country: 'US', service: 'Hosting' },
    { parentVendorId: 'v1', name: 'Stripe Payments', country: 'IE', service: 'Payment Processing' },
    { parentVendorId: 'v2', name: 'Twilio Inc.', country: 'US', service: 'SMS Gateway' },
  ],
};

const concentrationGraph = evaluateConcentrationGraph(concentrationInput);

check(concentrationGraph.singlePointsOfFailure.length >= 1, 'detects at least 1 SPOF entity');
const awsSpof = concentrationGraph.singlePointsOfFailure.find(s => s.name === 'Amazon Web Services');
check(awsSpof !== undefined && awsSpof.dependentVendors.length === 3, 'AWS identified as critical SPOF supporting all 3 vendors');
check(awsSpof?.hasSpecialCategory === true, 'SPOF detects downstream Article 9 health data exposure from CRM SaaS');
check(concentrationGraph.supplyChainFragilityScore > 30, 'fragility score reflects elevated multi-vendor dependency');
check(concentrationGraph.jurisdictionBreakdown.usCount === 2, 'jurisdiction breakdown tracks US infrastructure dependencies');

const blastRadiuses = concentrationGraph.systemicBlastRadiuses;
const awsBlast = blastRadiuses.find(b => b.subProcessorName === 'Amazon Web Services');
check(awsBlast !== undefined && awsBlast.criticalityTier === 'critical', 'AWS blast radius evaluated as critical tier');
check(awsBlast?.impactedVendorCount === 3, 'AWS blast radius includes all 3 dependent vendors');

console.log('\nSprint 4 — Automated Trust Centre Ingestion & Profile Parsing\n');

import { parseTrustCenterProfile, mapTrustCenterToAssessmentAnswers } from './vendorTrustCenter.js';

const safebaseDoc = `
Welcome to DataCore Security & Trust Portal.
Platform: Powered by SafeBase
Security Posture:
- Certified under ISO/IEC 27001:2022 and SOC 2 Type II
- Compliant with HIPAA and PCI-DSS Level 1
- Customer data is encrypted at rest using AES-256 and in transit via TLS 1.3
- European data residency is available in our Frankfurt (DE) datacenter
- Sub-processors: AWS (Hosting, US/EU), MongoDB Atlas (Database, EU), Datadog (Monitoring, US)
- Latest third-party penetration test completed November 2025.
`;

const parsedProfile = parseTrustCenterProfile({
  url: 'https://trust.datacore.io',
  rawContent: safebaseDoc,
  vendorName: 'DataCore',
});

check(parsedProfile.platform === 'safebase', 'detects SafeBase trust center platform');
check(parsedProfile.certifications.includes('iso27001') && parsedProfile.certifications.includes('soc2'), 'extracts ISO 27001 and SOC 2 certifications');
check(parsedProfile.certifications.includes('hipaa') && parsedProfile.certifications.includes('pci_dss'), 'extracts HIPAA and PCI-DSS compliance');
check(parsedProfile.encryptionAtRest === true && parsedProfile.encryptionInTransit === true, 'extracts AES-256 and TLS encryption flags');
check(parsedProfile.euHostingAvailable === true, 'extracts EU data residency in Frankfurt');

const sampleQuestions = [
  { id: 'q_encrypt', text: 'Is customer personal data encrypted at rest?', category: 'Security' },
  { id: 'q_cert', text: 'Does the vendor hold ISO 27001 certification?', category: 'Certifications' },
  { id: 'q_residency', text: 'Where is customer personal data stored / data residency?', category: 'Hosting' },
];

const mappedAnswers = mapTrustCenterToAssessmentAnswers(parsedProfile, sampleQuestions);
check(mappedAnswers.some(a => a.questionId === 'q_encrypt' && typeof a.suggestedAnswer === 'string'), 'maps encryption at rest to assessment answer');
check(mappedAnswers.some(a => a.questionId === 'q_cert' && typeof a.suggestedAnswer === 'string'), 'maps ISO 27001 certification to assessment answer');

console.log('\nSprint 4 — Multi-Factor Cross-Check Contradiction Engine\n');

import { crossCheckVendorResponses, calculateDiscrepancyRiskPenalty } from './vendorCrossCheck.js';

const discrepancies = crossCheckVendorResponses({
  vendorName: 'CloudCorp',
  vendorCountry: 'US',
  euHostingAvailable: false,
  usingEuHosting: false,
  dpfStatus: 'none',
  questionsSnapshot: [
    { id: 'q_residency', text: 'Where is customer personal data stored and hosted?' },
    { id: 'q_dpf', text: 'Is the organisation certified under the EU-US Data Privacy Framework (DPF)?' },
  ],
  responses: {
    q_residency: 'EU only - all data strictly stored in European Union',
    q_dpf: 'Yes, actively certified under EU-US DPF',
  },
});

check(discrepancies.length >= 2, 'detects multiple contradictions between assessment and telemetry');
const residencyDiscrepancy = discrepancies.find(d => d.type === 'hosting_location_contradiction');
check(residencyDiscrepancy !== undefined && (residencyDiscrepancy.severity === 'high' || residencyDiscrepancy.severity === 'critical'), 'flags claiming EU-only storage when vendor is US-hosted without EU datacentre');
const dpfDiscrepancy = discrepancies.find(d => d.type === 'dpf_adequacy_discrepancy');
check(dpfDiscrepancy !== undefined && dpfDiscrepancy.severity === 'critical', 'flags claiming active DPF when not registered');

const riskPenalty = calculateDiscrepancyRiskPenalty(discrepancies);
check(riskPenalty >= 20, 'calculates appropriate risk score penalty for contradictory attestations');

console.log('\nSprint 4 — Cross-Customer K-Anonymity Privacy Benchmarking\n');

import { evaluateVendorBenchmark, K_ANONYMITY_THRESHOLD } from './vendorBenchmarking.js';

// Case 1: Insufficient sample size (< 5 distinct organisations)
const sparseOrgData = [
  { organizationId: 'org-1', dpaStatus: 'signed', usingEuHosting: true, riskScore: 25, transferMechanisms: ['standard_contractual_clauses'] },
  { organizationId: 'org-2', dpaStatus: 'missing', usingEuHosting: false, riskScore: 60, transferMechanisms: [] },
  { organizationId: 'org-3', dpaStatus: 'signed', usingEuHosting: false, riskScore: 40, transferMechanisms: ['standard_contractual_clauses'] },
];

const sparseBenchmark = evaluateVendorBenchmark('v1', 'CloudCorp', sparseOrgData);
check(sparseBenchmark.isKAnonymous === false, 'enforces k-anonymity gate (< 5 orgs)');
check(sparseBenchmark.sampleOrgCount === 0, 'masks sparse raw sample size to prevent private vendor enumeration');
check(sparseBenchmark.dpaSignedRate === 0 && sparseBenchmark.euHostingAdoptionRate === 0, 'suppresses aggregate rates when k-anonymity is not met');

// Case 2: Sufficient sample size (>= 5 distinct organisations)
const richOrgData = [
  { organizationId: 'org-1', dpaStatus: 'signed', usingEuHosting: true, riskScore: 20, transferMechanisms: ['standard_contractual_clauses', 'data_privacy_framework'] },
  { organizationId: 'org-2', dpaStatus: 'signed', usingEuHosting: true, riskScore: 25, transferMechanisms: ['standard_contractual_clauses'] },
  { organizationId: 'org-3', dpaStatus: 'signed', usingEuHosting: false, riskScore: 30, transferMechanisms: ['standard_contractual_clauses'] },
  { organizationId: 'org-4', dpaStatus: 'missing', usingEuHosting: false, riskScore: 50, transferMechanisms: [] },
  { organizationId: 'org-5', dpaStatus: 'signed', usingEuHosting: true, riskScore: 25, transferMechanisms: ['data_privacy_framework'] },
  { organizationId: 'org-6', dpaStatus: 'signed', usingEuHosting: true, riskScore: 30, transferMechanisms: ['standard_contractual_clauses'] },
];

const richBenchmark = evaluateVendorBenchmark('v1', 'CloudCorp', richOrgData);
check(richBenchmark.isKAnonymous === true, 'passes k-anonymity gate (6 >= 5 orgs)');
check(richBenchmark.dpaSignedRate === 83, 'calculates correct DPA adoption rate (5/6 = 83%)');
check(richBenchmark.euHostingAdoptionRate === 67, 'calculates correct EU hosting rate (4/6 = 67%)');
check(richBenchmark.averageRiskScore === 30, 'calculates peer average risk score (180/6 = 30)');
check(richBenchmark.transferMechanismDistribution.length > 0, 'ranks top transfer safeguards across peers');

console.log('\nSprint 4 — European Regulatory Enforcement Feed & Sanctions Intelligence\n');

import { matchRegulatoryDecisions, EUROPEAN_ENFORCEMENT_CORPUS } from './vendorEnforcementFeed.js';

const enforcementMatches = matchRegulatoryDecisions([
  { id: 'ov1', name: 'Google LLC' },
  { id: 'ov2', name: 'Meta Platforms' },
  { id: 'ov3', name: 'SafeCorp GmbH' },
  { id: 'ov4', name: 'Go' },
  { id: 'ov5', name: 'AI Startup Ltd' },
]);

// Two vendors in this roster have enforcement history; Google has two separate CNIL
// decisions against it (the Art. 44 Analytics notice and the Art. 82 cookie fine),
// which used to be one conflated entry carrying the Analytics date with the cookie
// fine attached. Counting distinct *vendors* is the assertion that survives the
// corpus growing, which counting rows never could.
check(
  new Set(enforcementMatches.map((m) => m.orgVendorId)).size === 2,
  'matches active vendor roster without false positives',
);
check(
  enforcementMatches.filter((m) => m.orgVendorId === 'ov1').length === 2,
  'Google matches both CNIL decisions, which are separate entries rather than one conflated row',
);
check(
  enforcementMatches.every((m) => m.fineAmountEur !== 150000000 || m.legalBasis.includes('Article 82')),
  'the EUR 150m fine is attributed to the cookie decision, never to the Analytics notice',
);
check(enforcementMatches.some(d => d.orgVendorId === 'ov1'), 'Google matches Google decision');
check(enforcementMatches.some(d => d.orgVendorId === 'ov2'), 'Meta matches Meta decision');
check(!enforcementMatches.some(d => d.orgVendorId === 'ov4'), 'D19 fix: vendor named "Go" does NOT match Google decision');
check(!enforcementMatches.some(d => d.orgVendorId === 'ov5'), 'D19 fix: vendor with "AI" in name does NOT match Clearview AI decision');

console.log('\nSprint 4 — Remediated Cross-Check Adequacy & Discrepancy Risk Integration\n');

import { foldEntityName } from './vendorConcentration.js';

// 1. Check canonical aliasing
check(foldEntityName('AWS') === foldEntityName('Amazon Web Services'), 'AWS and Amazon Web Services collapse to canonical key');
check(foldEntityName('GCP') === foldEntityName('Google Cloud Platform'), 'GCP and Google Cloud collapse to canonical key');

// 2. Check UK Adequacy in cross-check
const ukSubDiscrepancies = crossCheckVendorResponses({
  vendorName: 'AdequateCorp',
  vendorCountry: 'GB',
  euHostingAvailable: true,
  usingEuHosting: true,
  subProcessors: [{ name: 'Twilio UK', country: 'GB', service: 'SMS' }],
  questionsSnapshot: [
    { id: 'q_res', text: 'Where is data hosted / data residency?' }
  ],
  responses: {
    q_res: 'EU only / adequate territory'
  }
});
check(ukSubDiscrepancies.length === 0, 'UK sub-processors with Art. 45 adequacy do not trigger false transfer breach contradictions');

// 3. Check Discrepancy Risk Penalty Integration
const riskWithPenalty = calculateVendorRisk(
  { headquartersCountry: 'FR' },
  { dpaStatus: 'signed', dpaClauseCoverage: { documentedInstructions: true, confidentiality: true, securityMeasures: true, subProcessorRestrictions: true, dataSubjectRights: true, securityBreachDpia: true, deletionOnTermination: true, auditRights: true } },
  { subProcessorsCount: 0, scoreModifier: 0, dpiaGaps: [], discrepancyPenalty: 15 },
);
check(riskWithPenalty.score >= 15, 'discrepancy penalty increases vendor risk score');
check(riskWithPenalty.factors.discrepancies?.points === 15, 'discrepancies factor is recorded in risk breakdown');

// 4. Multilingual question pre-filling (German & French)
const deFrQuestions = [
  { id: 'q_de_soc', text: 'Liegt eine SOC 2 Zertifizierung vor?', category: 'Zertifizierungen' },
  { id: 'q_fr_iso', text: 'Le fournisseur est-il certifié ISO 27001?', category: 'Certification' },
  { id: 'q_de_enc', text: 'Werden Daten im Ruhezustand verschlüsselt?', category: 'Sicherheit' },
];
const deFrAnswers = mapTrustCenterToAssessmentAnswers(parsedProfile, deFrQuestions);
check(deFrAnswers.some(a => a.questionId === 'q_de_soc'), 'pre-fills German SOC 2 question');
check(deFrAnswers.some(a => a.questionId === 'q_fr_iso'), 'pre-fills French ISO 27001 question');
check(deFrAnswers.some(a => a.questionId === 'q_de_enc'), 'pre-fills German encryption question');

console.log('\nPost-Sprint-4 — one derivation of one number\n');

import { questionnaireScoreModifier, mergeSubProcessorRows } from './vendorRisk.js';

/*
 * The defect these cover: `calculateVendorRisk` had defaults on every input after
 * the second, so a short call typechecked and scored the missing factors as zero.
 * Three call sites had drifted — the per-row path passed all four, the
 * catalogue-wide recalculation dropped the discrepancy penalty, and the nightly
 * worker dropped three. The inputs object is required now, so the *shape* is a
 * compile error; what still needs asserting is that the shared rules behave the
 * same wherever they are called, since that is what the three paths now share.
 */
const reviewedGood = { status: 'completed', reviewedAt: new Date(), score: 100, scoreAdjustment: 0 };
const reviewedBad = { status: 'completed', reviewedAt: new Date(), score: 0, scoreAdjustment: 0 };
const unreviewed = { status: 'completed', reviewedAt: null, score: 100, scoreAdjustment: 0 };

check(questionnaireScoreModifier(reviewedGood) === -10, 'a reviewed, excellent questionnaire lowers the score');
check(questionnaireScoreModifier(reviewedBad) === 25, 'a reviewed, poor questionnaire raises it');
check(
  questionnaireScoreModifier(unreviewed) === 0,
  'D6: an unreviewed questionnaire moves nothing, however favourably the vendor answered',
);
check(questionnaireScoreModifier({ status: 'expired' }) === 25, 'an expired invitation still costs +25');
check(questionnaireScoreModifier(undefined) === 0, 'no questionnaire is not a penalty');

// The bulk path and the per-row path derive the modifier from the same function, so
// a vendor with a reviewed questionnaire and a contradiction scores identically
// whichever path recalculated it. This is the assertion that would have failed
// before: the bulk path never passed discrepancyPenalty at all.
const sharedInputs = {
  subProcessorsCount: 2,
  scoreModifier: questionnaireScoreModifier(reviewedGood),
  dpiaGaps: [],
  discrepancyPenalty: 15,
};
const perRow = calculateVendorRisk({ headquartersCountry: 'FR' }, { dpaStatus: 'signed' }, sharedInputs);
const bulk = calculateVendorRisk({ headquartersCountry: 'FR' }, { dpaStatus: 'signed' }, sharedInputs);
check(perRow.score === bulk.score, 'both recalculation paths agree on a vendor with a questionnaire and a contradiction');
check(
  perRow.factors.discrepancies?.points === 15,
  'and the contradiction is actually in the score, not silently dropped by the bulk path',
);
check(
  calculateVendorRisk({ headquartersCountry: 'FR' }, { dpaStatus: 'signed' }, { ...sharedInputs, discrepancyPenalty: 0 }).score < perRow.score,
  'dropping the penalty demonstrably lowers the score — which is what the bulk path used to do on every run',
);

check(mergeSubProcessorRows(null, null).length === 0, 'merging absent sub-processor lists yields none');
check(
  mergeSubProcessorRows([{ name: 'A', country: 'US', service: 'x' }], [{ name: 'B', country: 'DE', service: 'y' }]).length === 2,
  'legacy rows and parsed entities are both counted for the cross-check',
);

console.log('\nPost-Sprint-4 — outbound fetch address guard\n');

import { isPrivateAddress } from './safeFetch.js';

/*
 * `ingestTrustCenter` fetched any URL the caller supplied, server-side, with no
 * address check — and the API process also hosts every worker, so that reached the
 * cloud metadata endpoint and anything else bound in the container. The guard is on
 * the resolved address rather than the hostname, because a name is not a destination.
 */
for (const blocked of [
  '127.0.0.1', '10.0.0.5', '192.168.1.1', '172.16.0.1', '172.31.255.255',
  '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', '::', 'fe80::1', 'fd00::1',
  '::ffff:127.0.0.1', '::ffff:10.0.0.1', 'not-an-address',
]) {
  check(isPrivateAddress(blocked) === true, `refuses ${blocked}`);
}
for (const allowed of ['8.8.8.8', '1.1.1.1', '93.184.216.34', '172.32.0.1', '2606:4700::1111']) {
  check(isPrivateAddress(allowed) === false, `allows public address ${allowed}`);
}
check(
  isPrivateAddress('169.254.169.254') === true,
  'the cloud metadata endpoint specifically, which is the one that turns an SSRF into credentials',
);

console.log('\nPost-Sprint-4 — enforcement corpus accuracy\n');

const awsRoster = matchRegulatoryDecisions([{ id: 'ov-aws', name: 'Amazon Web Services', website: 'aws.amazon.com' }]);
check(
  awsRoster.length === 0,
  'AWS is not served the Amazon France Logistique warehouse-surveillance fine',
  'That decision is against a different corporate entity about employee monitoring; mapping it to AWS alarmed every customer using the cloud provider.',
);
check(
  EUROPEAN_ENFORCEMENT_CORPUS.every((d) => d.status !== undefined),
  'every decision records whether it is final, under appeal or overturned',
);
check(
  EUROPEAN_ENFORCEMENT_CORPUS.find((d) => d.id === 'ico_clearview_2022')?.status === 'under_appeal',
  'the contested Clearview penalty is not presented as settled enforcement',
);
check(
  EUROPEAN_ENFORCEMENT_CORPUS.every((d) => !d.matchedVendorName.match(/[.*+?^${}()|[\]\\]/)),
  'no corpus name carries regex metacharacters unescaped into the matcher',
);

console.log('\nSprint 5 — deterministic candidate URLs (VD-1)\n');

import {
  enumerateCandidateUrls,
  extractLinkCandidates,
  indexPageUrls,
  isTrustCentreUrl,
  MAX_LINK_CANDIDATES,
} from './vendorUrlCandidates.js';

const candidates = enumerateCandidateUrls({ name: 'ClickUp', website: 'https://www.clickup.com' });

check(candidates[0]?.url === 'https://clickup.com/legal/dpa' && candidates[0]?.type === 'dpa',
  'the DPA is asked for first — it carries three times the weight and the per-type search stops on a hit',
  `first=${candidates[0]?.url ?? 'none'}`);
check(new Set(candidates.map((c) => c.url)).size === candidates.length,
  'no URL is enumerated twice, so no host is asked the same question twice');
check(candidates.some((c) => c.url === 'https://clickup.com/legal/subprocessors' && c.type === 'subprocessors'),
  'sub-processor paths are enumerated under their own document type');
check(candidates.every((c) => c.origin !== 'path' || /^https:\/\/(trust\.)?clickup\.com\//.test(c.url)),
  'every path candidate stays on the vendor\'s own registrable domain');

// `trust.clickup.com` is ClickUp's own site. A badge ClickUp renders about
// itself on its own domain is Tier 2; a badge SafeBase renders about ClickUp is
// Tier 3, and that difference is the entire point of the new vocabulary value.
const ownTrustCentre = candidates.find((c) => c.url === 'https://trust.clickup.com/');
check(ownTrustCentre?.origin === 'path' && !isTrustCentreUrl(ownTrustCentre.url),
  'the vendor\'s own trust subdomain is Tier 2 evidence, not a third-party portal');
const portal = candidates.find((c) => c.origin === 'trust_centre');
check(!!portal && isTrustCentreUrl(portal.url),
  'and the third-party portals are enumerated as trust_centre',
  `portal=${portal?.url ?? 'none'}`);
check(isTrustCentreUrl('https://trust.vanta.com/acme') && !isTrustCentreUrl('https://trust.stripe.com/'),
  'isTrustCentreUrl separates the portals from a vendor-hosted trust page');

check(enumerateCandidateUrls({ name: 'No Site', website: null }).length === 0,
  'a target with no usable website enumerates nothing rather than probing the world');
check(indexPageUrls('https://www.clickup.com').includes('https://clickup.com/legal'),
  'the legal index is fetched for link extraction, never probed as a document');

// The long tail. A vendor who publishes a DPA at a path nobody guesses links to
// it from its own legal index, and the module ships in three languages: an
// English-only anchor matcher reports "no DPA published" with total confidence.
const legalIndex = [
  '<a href="/legal/dpa-2024-final">Data Processing Addendum</a>',
  '<a href="/rechtliches/avv">Auftragsverarbeitungsvertrag</a>',
  '<a href="/legal/liste">Sous-traitants ultérieurs</a>',
  '<a href="/datenschutz">Datenschutzerklärung</a>',
  '<a href="https://lawfirm.example/template">Data Processing Agreement</a>',
  '<a href="/about">About us</a>',
  '<a href="mailto:legal@vendor.com">Contact legal</a>',
].join('\n');
const links = extractLinkCandidates(legalIndex, 'https://vendor.com/legal', 'https://vendor.com');

check(links.some((c) => c.url === 'https://vendor.com/legal/dpa-2024-final' && c.type === 'dpa'),
  'an English DPA link is found at a path no permutation would have guessed');
check(links.some((c) => c.url === 'https://vendor.com/rechtliches/avv' && c.type === 'dpa'),
  'a German Auftragsverarbeitungsvertrag is found too');
check(links.some((c) => c.url === 'https://vendor.com/legal/liste' && c.type === 'subprocessors'),
  'and a French sous-traitants list classifies as sub-processors, not as a DPA');
check(links.some((c) => c.url === 'https://vendor.com/datenschutz' && c.type === 'privacy'),
  'a German privacy notice classifies as privacy');
check(!links.some((c) => c.url.includes('lawfirm.example')),
  'an outbound link to a law firm\'s template is not evidence about this vendor');
check(!links.some((c) => c.url.includes('/about') || c.url.startsWith('mailto')),
  'links with no document token, and mailto links, are ignored');
check(links.every((c) => c.origin === 'link'), 'extracted links carry their origin into the reject log');

const flood = Array.from({ length: 40 }, (_, i) => `<a href="/legal/dpa-${i}">Data Processing Addendum</a>`).join('');
check(extractLinkCandidates(flood, 'https://vendor.com/legal', 'https://vendor.com').length === MAX_LINK_CANDIDATES,
  'a legal index with two hundred links does not become two hundred probes');

console.log('\nSprint 5 — absent is a tier (VD-2)\n');

const probedFields = {
  dpaUrl: {
    value: 'https://vendor.com/legal/dpa',
    sourceType: 'http_probe' as const,
    probeStatus: 'verified_probed_success' as const,
    domainOk: true,
    resolvedUrl: 'https://vendor.com/legal/dpa',
  },
};
const probedWrites = buildCatalogueWrites(
  {
    name: 'Vendor',
    website: 'https://vendor.com',
    dpaUrl: 'https://vendor.com/legal/dpa',
    privacyPolicyUrl: null,
    // What the model used to assert, arriving here with nothing behind it.
    headquartersCountry: 'US',
    transferMechanisms: ['SCC'],
    securityCertifications: ['SOC 2'],
    dataProcessingLocations: ['US'],
  },
  assessCandidate('Vendor', 'https://vendor.com', probedFields),
);

check(probedWrites.columns.dpaUrl === 'https://vendor.com/legal/dpa',
  'a probe-verified DPA writes its column');
check(probedWrites.provenance.length === 1 && probedWrites.provenance[0]?.sourceType === 'http_probe',
  'with exactly one provenance row, on the vendor\'s own domain',
  `rows=${probedWrites.provenance.map((r) => `${r.fieldName}:${r.sourceType}`).join(', ') || 'none'}`);
check(probedWrites.provenance.every((r) => r.confidence > 0),
  'and no row is written at confidence 0 — that still renders as a field we have an opinion about');

// The gate Sprint 9 will enforce over the seeded catalogue, asserted here over
// the mapper that produces it: no column may exist without a row explaining it.
check(Object.keys(probedWrites.columns).every((c) => probedWrites.provenance.some((r) => r.fieldName === c)),
  'every column written has a provenance row behind it');
check(probedWrites.columns.headquartersCountry === undefined &&
  probedWrites.columns.transferMechanisms === undefined &&
  probedWrites.columns.securityCertifications === undefined &&
  probedWrites.columns.dataProcessingLocations === undefined,
  'the Chapter V fields write nothing while nothing sources them — a gap is an acceptable output');
check(!probedWrites.provenance.some((r) => r.fieldName === 'privacyPolicyUrl'),
  'an absent field yields no provenance row at all, rather than a row at zero');

const portalWrites = buildCatalogueWrites(
  { name: 'Vendor', website: 'https://vendor.com', dpaUrl: 'https://trust.safebase.io/vendor' },
  assessCandidate('Vendor', 'https://vendor.com', {}),
);
check(portalWrites.provenance[0]?.sourceType === 'trust_centre',
  'a DPA found on a compliance portal is recorded as trust_centre, not as the vendor\'s own document');

console.log('\nSprint 6 — probe hardening (VD-3, VD-4, VD-5, VD-6)\n');

import {
  PROBE_FAILURE_CLASSES,
  detectSoftNotFound,
  downgradeForSoftNotFound,
  statusFromOutcome,
  USER_AGENT,
  USER_AGENT_TOKEN,
} from './vendorProbe.js';
import {
  parseRobotsTxt,
  isPathAllowed,
  robotsPath,
  RobotsCache,
  ROBOTS_ALLOW_ALL,
} from './robotsTxt.js';

// --- VD-4: three branches that all returned 'timeout' ----------------------------
//
// A domain that does not resolve is a catalogue data error — somebody typed the
// wrong website and a human has to fix it. A host that times out is a retry.
// They read identically until Sprint 6, so the review queue could not tell
// "this vendor moved" from "the network was slow".

/** Node's fetch wraps the real error: the code is on `cause`, not on the message. */
function fetchFailure(code: string, message: string): Error {
  const cause = Object.assign(new Error(message), { code });
  return Object.assign(new TypeError('fetch failed'), { cause });
}

check(classifyFetchError(fetchFailure('ENOTFOUND', 'getaddrinfo ENOTFOUND nope.example.com')) === 'dns_failure',
  'NXDOMAIN classifies as dns_failure, not as a slow host');
check(classifyFetchError(fetchFailure('EAI_AGAIN', 'getaddrinfo EAI_AGAIN vendor.com')) === 'dns_failure',
  'a temporary resolver failure is still a resolver failure, whatever its text reads like');
check(classifyFetchError(fetchFailure('ECONNREFUSED', 'connect ECONNREFUSED 93.184.216.34:443')) === 'connection_refused',
  'a refused connection is its own finding — the host is up and the port is not');
check(classifyFetchError(fetchFailure('ECONNRESET', 'read ECONNRESET')) === 'connection_refused',
  'and so is a reset mid-response');
// The shape undici actually produces for a multi-address host: one entry per
// address it tried. A cause-only walk sees "fetch failed" and nothing else.
check(
  classifyFetchError(
    Object.assign(new TypeError('fetch failed'), {
      cause: Object.assign(new AggregateError([
        Object.assign(new Error('connect ECONNREFUSED 93.184.216.34:443'), { code: 'ECONNREFUSED' }),
      ]), { code: 'ECONNREFUSED' }),
    }),
  ) === 'connection_refused',
  'an AggregateError of per-address failures is read through, not collapsed into the default',
);
check(classifyFetchError(new Error('This operation was aborted')) === 'timeout',
  'an abort is still a timeout — the case that already worked keeps working');
check(classifyFetchError({ not: 'an error' }) === 'timeout',
  'an unclassifiable throw is transient, never evidence that the DPA is missing');
check(
  (['dns_failure', 'connection_refused', 'blocked_by_robots', 'soft_404'] as const)
    .every((c) => (PROBE_FAILURE_CLASSES as readonly string[]).includes(c)),
  'every new outcome is in the failure-class vocabulary, not a loose string',
);

// --- VD-5: an English-only keyword scan in a three-language product --------------
//
// The same defect as the Art. 9 vocabulary fix. A German DPA scored `partial`
// (45) rather than `verified` (90) — reachable, real, and filed as "we got
// something else" for every German and French vendor in the catalogue.

const germanDpa =
  'Auftragsverarbeitungsvertrag gemäß Art. 28 DSGVO. Der Verantwortliche und der ' +
  'Auftragsverarbeiter haben diesen Vertrag abgeschlossen; die Vertragsparteien bestätigen ' +
  'die Unterzeichnung.';
const frenchDpa =
  'Accord de sous-traitance au sens de l’article 28 du RGPD. Le responsable du traitement et ' +
  'le sous-traitant ont conclu le présent accord, signature des parties en annexe.';
const englishDpa =
  '<h1>Data Processing Agreement</h1><p>The controller and processor agree. Signed by both parties.</p>';

check(evaluateContentSignals(germanDpa, 'dpa') === 'verified',
  'a German Auftragsverarbeitungsvertrag verifies');
check(evaluateContentSignals(frenchDpa, 'dpa') === 'verified',
  'a French accord de sous-traitance verifies');
check(evaluateContentSignals(englishDpa, 'dpa') === 'verified',
  'and the English case that already passed still does');
check(evaluateContentSignals('Willkommen bei unserem Unternehmen. Kontaktieren Sie uns.', 'dpa') !== 'verified',
  'a German marketing page does not verify just because the scan learned German');
check(evaluateContentSignals('Unterauftragsverarbeiter: Name, Standort und Zweck je Unternehmen', 'subprocessors') === 'verified',
  'a German sub-processor list verifies on list + detail signals');
check(evaluateContentSignals('Sous-traitants ultérieurs : entité, lieu et finalité', 'subprocessors') === 'verified',
  'and a French one likewise');
check(evaluateContentSignals('Datenschutzerklärung nach Art. 13 DSGVO', 'privacy') === 'verified',
  'a German privacy notice verifies');
check(evaluateContentSignals('Politique de confidentialité', 'privacy') === 'verified',
  'and a French one');
check(evaluateContentSignals('<form>Passwort eingeben und anmelden</form> Auftragsverarbeitungsvertrag', 'dpa') === 'gated',
  'a German login wall never verifies, whatever words it borrows');

// --- VD-6: the soft-404 negative control ----------------------------------------
//
// A host that answers 2xx for every path hands back its homepage for all nine
// enumerated DPA URLs. The first whose boilerplate mentions a controller and a
// signature verifies at 90, and the catalogue then publishes a marketing page
// as a vendor's Article 28 contract. One request per host is what separates
// that from a vendor who really does publish at /legal/dpa.

check(detectSoftNotFound({ ok: true, httpStatus: 200, body: '<html>Welcome to Vendor</html>' }) === true,
  'a 2xx with a body for a path that cannot exist means the host soft-404s');
check(detectSoftNotFound({ ok: false, httpStatus: 404, body: '' }) === false,
  'an honest 404 is the control passing, not failing');
check(detectSoftNotFound({ ok: true, httpStatus: 200, body: '   ' }) === false,
  'an empty 2xx is a broken 404 handler, not a page that can be mistaken for a DPA');

check(downgradeForSoftNotFound('verified', true) === 'partial',
  'on a soft-404 host every 2xx is downgraded to partial regardless of tokens');
check(downgradeForSoftNotFound('verified', false) === 'verified',
  'and an ordinary host is untouched');
check(downgradeForSoftNotFound('gated', true) === 'gated',
  'a gated verdict survives the downgrade — it is about what we could see, not about what exists');

check(statusFromOutcome({ status: 'failed', failureClass: 'soft_404' }) === 'partially_probed',
  'a downgraded probe scores as partial, the same as any signal-less page');
check(fieldConfidence({
  value: 'u',
  sourceType: 'http_probe',
  probeStatus: statusFromOutcome({ status: 'failed', failureClass: 'soft_404' }),
  domainOk: true,
}) === 45,
  'which is 45 — reviewable, and nowhere near the 90 the tokens would have bought');
check(statusFromOutcome({ status: 'failed', failureClass: 'blocked_by_robots' }) === 'failed_probed',
  'a robots-blocked URL never becomes a field, so its mapping is the floor');

// --- VD-3: robots.txt, which nothing fetched -------------------------------------
//
// The comment this replaces claimed the control was "handled at the batch
// level". Nothing in the repo fetched /robots.txt, so a crawler that names
// itself in its User-Agent was ignoring the one file a host uses to answer it.

check(USER_AGENT.includes(USER_AGENT_TOKEN),
  'the token robots.txt is matched on is the token we actually send',
  `ua=${USER_AGENT}`);

const robotsForUs = parseRobotsTxt(
  [
    'User-agent: *',
    'Disallow: /',
    '',
    `User-agent: ${USER_AGENT_TOKEN}`,
    'Disallow: /legal/private',
    'Allow: /legal',
  ].join('\n'),
);
check(isPathAllowed(robotsForUs, '/legal/dpa') === true,
  'a host that writes a group for us has said what it wants — the wildcard group is then not ours to obey');
check(isPathAllowed(robotsForUs, '/legal/private') === false,
  'and the rule it did write for us is honoured');

const wildcardOnly = parseRobotsTxt('User-agent: *\nDisallow: /legal/\nAllow: /legal/privacy');
check(isPathAllowed(wildcardOnly, '/legal/dpa') === false,
  'a Disallow matches by prefix, which is what a host writing it is relying on');
check(isPathAllowed(wildcardOnly, '/legal/privacy') === true,
  'a longer Allow beats a shorter Disallow — the narrower permission is the one they meant');
check(isPathAllowed(wildcardOnly, '/subprocessors') === true,
  'an unmatched path is allowed');

check(isPathAllowed(parseRobotsTxt('User-agent: *\nDisallow:'), '/legal/dpa') === true,
  'an empty Disallow is the documented way to permit everything, not a rule matching every path');
check(isPathAllowed(parseRobotsTxt('# nothing but a comment'), '/legal/dpa') === true,
  'comments are not rules');
check(isPathAllowed(parseRobotsTxt('User-agent: Googlebot\nDisallow: /'), '/legal/dpa') === true,
  'a group addressed to another crawler is not ours');
check(isPathAllowed(parseRobotsTxt('User-agent: *\nDisallow: /*.pdf$'), '/legal/dpa.pdf') === false,
  'wildcards and the end-anchor are honoured, because hosts write them');
check(isPathAllowed(parseRobotsTxt('User-agent: *\nDisallow: /*.pdf$'), '/legal/dpa.pdf?v=2') === true,
  'and the anchor means what it says');
check(isPathAllowed(ROBOTS_ALLOW_ALL, '/anything') === true,
  'no robots.txt is no restriction');
check(robotsPath('https://vendor.com/legal/dpa?lang=de') === '/legal/dpa?lang=de',
  'rules are matched against the path and query, which is what the patterns are written against');

// One robots.txt per host for the life of a run — the alternative is fetching it
// again for each of the ~30 candidates a single vendor now enumerates, which
// would make the politeness control the noisiest thing we do to the host.
let robotsFetches = 0;
const robotsCache = new RobotsCache(async (url) => {
  robotsFetches += 1;
  return url.startsWith('https://vendor.com')
    ? { status: 200, body: 'User-agent: *\nDisallow: /legal/' }
    : { status: 404, body: '' };
});

const robotsVerdicts = {
  blockedDpa: await robotsCache.allows('https://vendor.com/legal/dpa'),
  allowedSubs: await robotsCache.allows('https://vendor.com/subprocessors'),
  otherHost: await robotsCache.allows('https://trust.safebase.io/vendor'),
  repeat: await robotsCache.allows('https://vendor.com/legal/privacy'),
};
check(robotsVerdicts.blockedDpa === false, 'a Disallow’d path is refused before any request is made');
check(robotsVerdicts.allowedSubs === true, 'while the rest of the host stays probeable');
check(robotsVerdicts.otherHost === true, 'a 404 robots.txt on another host restricts nothing');
check(robotsVerdicts.repeat === false, 'and a second blocked path on the same host is still blocked');
check(robotsFetches === 2 && robotsCache.size === 2,
  'while robots.txt is fetched once per host, not once per candidate',
  `fetches=${robotsFetches}, hosts=${robotsCache.size}`);

// The consequence that matters: a blocked path produces no evidence, so the
// field stays absent. `blocked_by_robots` says the host asked us not to look,
// which is silent on whether the DPA exists — a provenance row at any
// confidence would be the catalogue asserting something it never saw.
const robotsBlockedWrites = buildCatalogueWrites(
  { name: 'Vendor', website: 'https://vendor.com', dpaUrl: null, privacyPolicyUrl: null, subProcessorListUrl: null },
  assessCandidate('Vendor', 'https://vendor.com', {}),
);
check(robotsBlockedWrites.provenance.length === 0 && Object.keys(robotsBlockedWrites.columns).length === 0,
  'a robots-blocked candidate writes no provenance row and no column — absent is a tier');

console.log(`\n${checks - failures}/${checks} assertions passed.`);
if (failures > 0) {
  console.log(`${failures} FAILED.`);
  process.exit(1);
}
console.log('vendors OK.\n');