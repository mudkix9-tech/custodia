/**
 * Fixtures for the export formats.
 *
 *   npx tsx src/lib/ropaExportFormats.test.ts
 *
 * Standalone style, like `assessments.test.ts`. `ropaExportFormats.ts` imports
 * only `xlsx` and the types from `ropaArticle30.ts`, so nothing here needs a
 * database — which is the whole reason the *builder* and the *renderers* are two
 * modules.
 *
 * These exist because an export is the one output nobody looks at until a
 * regulator does. A workbook whose sheets are unnamed, whose empty sheets have no
 * headers, or whose Article 9(2) column silently prints an empty string for a
 * category with no condition recorded, is a document that reads as complete and
 * is not — and `tsc` sees a valid `Buffer` in every one of those cases.
 */
import * as XLSX from 'xlsx';
import {
  article30Sheets,
  article30Xlsx,
  article30Csv,
  article30Json,
  regulatorXlsx,
  REGULATOR_TEMPLATES,
  REGULATOR_TEMPLATE_IDS,
} from './ropaExportFormats.js';
import { NEGATIVE_ASSERTIONS, type Article30Record, type Article30Activity } from './ropaArticle30.js';

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

const activity = (over: Partial<Article30Activity> = {}): Article30Activity => ({
  id: '11111111-1111-4111-8111-111111111111',
  reference: 'PA-11111111',
  name: 'Payroll administration',
  role: 'controller',
  status: 'active',
  purpose: 'Calculating and paying employee salaries and statutory deductions.',
  description: null,
  lawfulBasis: 'legal_obligation',
  lawfulBasisDetail: null,
  liaStatus: null,
  liaOutcome: null,
  dataSubjectCategories: [{ category: 'Employees', volumeBand: '100_999', isChild: false, isVulnerable: false }],
  dataCategories: [{
    category: 'Salary and compensation',
    group: 'Financial',
    isSpecialCategory: false,
    specialCategoryType: null,
    article9Condition: null,
    article9NationalLawBasis: null,
    isCriminalData: false,
    article10Basis: null,
    identifiability: 'direct',
    source: 'directly_from_subject',
    retentionPeriod: '6 years',
    retentionTrigger: 'end_of_employment',
  }],
  recipients: [{ name: 'HMRC', category: 'public_authority', role: 'independent_controller', purpose: null }],
  transfers: [],
  retentionPeriod: '6 years after employment',
  retentionJustification: 'Statutory retention period for payroll records.',
  deletionProcedure: null,
  securityMeasures: ['encryption_at_rest', 'access_controls'],
  securityMeasuresDetail: null,
  automatedDecisionMaking: false,
  profiling: false,
  admLogic: null,
  admSignificance: null,
  admHumanIntervention: null,
  riskLevel: 'low',
  requiresDpia: false,
  dpiaTitle: null,
  dpiaStatus: null,
  businessOwner: 'Ana Diaz',
  privacyOwner: 'Bo Chen',
  lastReviewedAt: null,
  nextReviewAt: null,
  approvalState: 'approved',
  completenessScore: 92,
  createdAt: new Date('2026-01-05T09:00:00.000Z'),
  updatedAt: new Date('2026-08-01T09:00:00.000Z'),
  clientId: null,
  clientName: null,
  assertions: [NEGATIVE_ASSERTIONS.noTransfers, NEGATIVE_ASSERTIONS.noSpecialCategories],
  ...over,
});

const record = (over: Partial<Article30Record> = {}): Article30Record => ({
  generatedAt: new Date('2026-08-19T10:00:00.000Z'),
  controller: {
    name: 'Custodia',
    legalName: 'Custodia Ltd',
    address: '1 Example Street, Dublin, D01 X1X1',
    countryCode: 'IE',
    contactEmail: 'dpo@example.com',
    representative: null,
    dpoName: 'Ana Diaz',
    dpoEmail: 'dpo@example.com',
  },
  controllerActivities: [activity()],
  processorSections: [],
  assertions: [NEGATIVE_ASSERTIONS.noProcessorRecords],
  counts: { controller: 1, processor: 0, withTransfers: 0, withSpecialCategories: 0, total: 1 },
  filterSummary: null,
  ...over,
});

/** Read a workbook back out of its own buffer, which is the only real check. */
const readBack = (buffer: Buffer) => XLSX.read(buffer, { type: 'buffer' });

console.log('\nropaExportFormats\n');

// --- the canonical workbook ----------------------------------------------------

const sheets = article30Sheets(record());
check(sheets.length === 9, 'nine sheets — one per object, plus identity and assertions');
check(
  sheets.every((s) => s.name.length <= 31),
  'every sheet name is within Excel’s 31-character limit',
  'Longer names are silently truncated by the writer and then collide.',
);

const book = readBack(article30Xlsx(record()));
check(book.SheetNames.includes('Controller record'), 'the controller sheet is present');
check(book.SheetNames.includes('Processor record'), 'the processor sheet is present even with no processor records');
check(book.SheetNames.includes('Assertions'), 'the assertions sheet is present');

const controllerRows = XLSX.utils.sheet_to_json(book.Sheets['Controller record']!) as any[];
check(controllerRows.length === 1, 'one row per controller activity');
check(
  controllerRows[0]!['Third-country transfers (Art. 30(1)(e))'] === 'None',
  'no transfers prints "None", not an empty cell',
  'A blank cell cannot be told apart from a column nobody filled in.',
);
check(
  controllerRows[0]!['Special category / criminal data'] === 'None',
  'no special categories prints "None"',
);
check(
  String(controllerRows[0]!['Retention (Art. 30(1)(f))']).includes('Salary and compensation: 6 years'),
  'per-category retention wins over the activity-level period',
);
check(
  controllerRows[0]!['LIA outcome'] === 'n/a',
  'the LIA column reads n/a where the basis is not legitimate interests',
);

const liRows = XLSX.utils.sheet_to_json(
  readBack(article30Xlsx(record({
    controllerActivities: [activity({ lawfulBasis: 'legitimate_interests', liaOutcome: null })],
  }))).Sheets['Controller record']!,
) as any[];
check(
  liRows[0]!['LIA outcome'] === 'No assessment recorded',
  'legitimate interests with no assessment says so in the workbook',
  'Rather than leaving the cell blank, which reads as "not applicable".',
);

// --- the empty register --------------------------------------------------------

const emptyBook = readBack(article30Xlsx(record({
  controllerActivities: [],
  counts: { controller: 0, processor: 0, withTransfers: 0, withSpecialCategories: 0, total: 0 },
})));
check(
  emptyBook.SheetNames.length === 9,
  'an empty register still produces every sheet',
  'A missing sheet reads as a broken export rather than as "nothing to report".',
);

// --- Article 9(2) and Article 10 -----------------------------------------------

const specialBook = readBack(article30Xlsx(record({
  controllerActivities: [activity({
    dataCategories: [
      { category: 'Occupational health', group: 'Health', isSpecialCategory: true, specialCategoryType: 'health_data', article9Condition: 'b', article9NationalLawBasis: 'Safety, Health and Welfare at Work Act 2005', isCriminalData: false, article10Basis: null, identifiability: 'direct', source: null, retentionPeriod: null, retentionTrigger: null },
      { category: 'Vetting outcome', group: 'Background', isSpecialCategory: false, specialCategoryType: null, article9Condition: null, article9NationalLawBasis: null, isCriminalData: true, article10Basis: null, identifiability: 'direct', source: null, retentionPeriod: null, retentionTrigger: null },
    ],
  })],
})));
const specialCell = String((XLSX.utils.sheet_to_json(specialBook.Sheets['Controller record']!)[0] as any)['Special category / criminal data']);
check(specialCell.includes('Article 9(2)(b)'), 'the Art. 9(2) condition reaches the workbook');
check(specialCell.includes('Safety, Health and Welfare at Work Act 2005'), 'so does the national law it cites');
check(
  specialCell.includes('Article 10 — no basis recorded'),
  'criminal data with no Art. 10 basis says so rather than printing an empty string',
  'That absence is the finding; a blank cell hides it.',
);

// --- transfers -----------------------------------------------------------------

const transferBook = readBack(article30Xlsx(record({
  controllerActivities: [activity({
    transfers: [
      { destinationCountry: 'NO', destinationEntity: null, isAdequate: true, mechanism: 'adequacy', mechanismDetail: null, safeguardEvidence: 'Adequacy decision 2000/518/EC', tiaCompleted: false, tiaRiskLevel: null },
      { destinationCountry: 'US', destinationEntity: 'Vendor Inc', isAdequate: false, mechanism: 'scc_2021', mechanismDetail: null, safeguardEvidence: '2021 Standard Contractual Clauses; Module 2; executed 2024-03-01; annexes complete', tiaCompleted: true, tiaRiskLevel: 'medium' },
    ],
    assertions: [],
  })],
})));
const transferRows = XLSX.utils.sheet_to_json(transferBook.Sheets['Transfers']!) as any[];
check(transferRows.length === 2, 'each transfer gets its own row on the transfers sheet');
check(
  String((XLSX.utils.sheet_to_json(transferBook.Sheets['Controller record']!)[0] as any)['Third-country transfers (Art. 30(1)(e))']).includes('adequate destination'),
  'an adequate destination is labelled as such rather than shown with a blank safeguard',
  '"Norway — no safeguard recorded" and "Norway — adequacy decision" read alike once the mechanism column is empty, and only one is a finding.',
);
check(
  String(transferRows[1]!['Safeguard documentation (Art. 30(1)(e))']).includes('Module 2'),
  'the mechanism-specific evidence Sprint 1 added reaches the export',
  'It reached none of the three documents this replaces.',
);

// --- the processor record ------------------------------------------------------

const agency = record({
  controllerActivities: [],
  processorSections: [{
    controller: {
      name: 'Acme Retail',
      legalName: 'Acme Retail GmbH',
      address: 'Hauptstraße 1, Berlin',
      countryCode: 'DE',
      contactEmail: 'privacy@acme.example',
      representative: null,
      dpoName: 'Chris Weber',
      dpoEmail: 'dpo@acme.example',
    },
    processingCategories: ['email_marketing', 'analytics'],
    activities: [activity({ role: 'processor', clientName: 'Acme Retail' })],
  }],
  counts: { controller: 0, processor: 1, withTransfers: 0, withSpecialCategories: 0, total: 1 },
  assertions: [],
});

const agencyRows = XLSX.utils.sheet_to_json(readBack(article30Xlsx(agency)).Sheets['Processor record']!) as any[];
check(
  agencyRows[0]!['Controller (Art. 30(2)(a))'] === 'Acme Retail GmbH',
  'the processor record names the client, not the agency',
  'N114. Every processor record the module produced before this named the agency’s own DPO as the controller’s.',
);
check(
  agencyRows[0]!["Controller's DPO"] === 'Chris Weber',
  "and carries the client's own data protection officer",
);
check(
  String(agencyRows[0]!['Categories of processing (Art. 30(2)(b))']).includes('Email Marketing'),
  'Art. 30(2)(b) comes from the client relationship where it is recorded there',
);

// --- regulator packs -----------------------------------------------------------

check(REGULATOR_TEMPLATE_IDS.length === 4, 'four regulator templates ship');

for (const id of REGULATOR_TEMPLATE_IDS) {
  const template = REGULATOR_TEMPLATES[id]!;
  const pack = readBack(regulatorXlsx(agency, id));
  check(pack.SheetNames.length === 2, `${id}: controller and processor are separate sheets`);

  const processorSheet = pack.Sheets[pack.SheetNames[1]!]!;
  const rows = XLSX.utils.sheet_to_json(processorSheet) as any[];
  check(rows.length === 1, `${id}: the processor sheet carries the record`);

  const headers = Object.keys(rows[0]!);
  check(
    headers.every((h) => template.processorColumns.some((c) => c.header === h)),
    `${id}: every column header comes from the template definition`,
  );

  // The controller sheet is empty for this fixture, which is the case that
  // silently produces a nameless sheet with no headers if the writer is handed
  // an empty array.
  const controllerSheet = pack.Sheets[pack.SheetNames[0]!]!;
  const controllerHeader = XLSX.utils.sheet_to_json(controllerSheet, { header: 1 })[0] as string[];
  check(
    Array.isArray(controllerHeader) && controllerHeader.length === template.controllerColumns.length,
    `${id}: an empty sheet still carries its headers`,
    'Otherwise a register with no controller records exports a blank page the authority cannot read.',
  );
}

check(
  REGULATOR_TEMPLATES.cnil!.controllerColumns.some((c) => c.header === 'Finalités'),
  'the CNIL pack is headed in French',
  'A register submitted with English headings is a document the contrôleur has to translate first.',
);
check(
  REGULATOR_TEMPLATES.dsk!.controllerColumns.some((c) => c.header === 'Zweck der Verarbeitung'),
  'the DSK pack is headed in German',
);

let unknownRejected = false;
try {
  regulatorXlsx(record(), 'garante');
} catch {
  unknownRejected = true;
}
check(unknownRejected, 'an unknown template id is refused rather than producing an empty file');

// --- CSV -----------------------------------------------------------------------

const csv = article30Csv(record());
const csvLines = csv.split('\r\n');
check(csvLines.length === 2, 'the CSV is a header and one row');
check(csvLines[0]!.startsWith('reference,name,purpose,lawful_basis'), 'the CSV header is the importer’s column set');
check(
  article30Csv(record({
    controllerActivities: [activity({ purpose: 'Payroll, pensions and statutory deductions.' })],
  })).includes('"Payroll, pensions and statutory deductions."'),
  'a value containing a comma is quoted',
);
check(
  article30Csv(record({
    controllerActivities: [activity({ name: 'He said "hello"' })],
  })).includes('"He said ""hello"""'),
  'a value containing a quote is escaped by doubling it',
);

// --- JSON ----------------------------------------------------------------------

const json = article30Json(record()) as any;
check(json.format === 'edpb-ropa-exchange', 'the JSON declares its format');
check(
  Object.keys(json.article_30_1_records[0]).some((k) => k.startsWith('article_30_1_')),
  'the JSON is keyed by Article rather than by our column names',
  'A receiving system should not have to know schema.ts.',
);
check(
  json.article_30_1_records[0].negative_assertions.length === 2,
  'the negative assertions travel with the record',
);
check(json.article_30_2_records.length === 0, 'no processor sections means an empty array, not a missing key');
check(
  (article30Json(agency) as any).article_30_2_records[0].article_30_2_a_controller.legalName === 'Acme Retail GmbH',
  'the processor section carries the controller identity',
);

console.log(`\n${checks - failures}/${checks} assertions passed.`);
if (failures > 0) {
  console.log(`${failures} FAILED.`);
  process.exit(1);
}
console.log('ropaExportFormats OK.\n');
