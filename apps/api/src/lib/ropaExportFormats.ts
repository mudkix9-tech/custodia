/**
 * J95/J97/J98. The formats the canonical Article 30 record is rendered into.
 *
 * `ropaArticle30.ts` builds the dataset; this turns it into the files people
 * actually ask for. Keeping the two apart is what stops the four regulator packs
 * becoming four divergent readings of the register — the CNIL sheet and the ICO
 * sheet disagree about columns, not about facts.
 *
 * **XLSX, not CSV, is what a regulator asks for** (J95), and one sheet per object
 * rather than one wide sheet: a data category has its own Art. 9(2) condition and
 * its own retention period, and flattening it into the activity row means either
 * losing it or repeating the activity six times. Six related sheets is the shape
 * every supervisory authority's own template already uses.
 *
 * ## The regulator packs (J97)
 *
 * Each authority publishes its own register template and expects its own columns
 * in its own language. What they share is the Article; what differs is the
 * labelling, the ordering, and — for CNIL and AEPD — the split into separate
 * *responsable de traitement* and *sous-traitant* sheets, which the canonical
 * record already carries as `controllerActivities` and `processorSections`.
 *
 * The column definitions are deliberately data, not code. Adding the Italian
 * Garante's template is then a table entry rather than a new renderer, and every
 * pack keeps reading the same dataset — which is the property that makes them
 * consistent with the PDF, and with each other.
 */

import * as XLSX from 'xlsx';
import type { Article30Activity, Article30Record } from './ropaArticle30.js';
import { flattenActivities } from './ropaArticle30.js';
import { csvCell } from '../utils/csv.js';

// ---------------------------------------------------------------------------
// Cell helpers.
// ---------------------------------------------------------------------------

const joinList = (values: readonly string[]): string => (values.length ? values.join('; ') : '');
const day = (value: Date | string | null | undefined): string =>
  value ? new Date(value).toISOString().slice(0, 10) : '';
const yesNo = (value: boolean): string => (value ? 'Yes' : 'No');

const titleCase = (value: string | null | undefined): string =>
  (value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

const categoryNames = (a: Article30Activity) => a.dataCategories.map((c) => c.category);
const subjectNames = (a: Article30Activity) => a.dataSubjectCategories.map((s) => s.category);
const recipientNames = (a: Article30Activity) => a.recipients.map((r) => r.name);

/**
 * 30(1)(e) as one cell.
 *
 * An adequate destination is labelled as such rather than shown with a blank
 * safeguard, because "Norway — adequacy decision" and "Norway — no safeguard
 * recorded" read identically once the mechanism column is empty, and only one of
 * them is a finding.
 */
const transferCell = (a: Article30Activity): string =>
  a.transfers.length === 0
    ? 'None'
    : a.transfers
        .map((t) =>
          t.isAdequate
            ? `${t.destinationCountry} (adequate destination)`
            : `${t.destinationCountry} — ${titleCase(t.mechanism)}`,
        )
        .join('; ');

/** 30(1)(f). Per-category periods where they exist, the activity's otherwise. */
const retentionCell = (a: Article30Activity): string => {
  const perCategory = a.dataCategories
    .filter((c) => c.retentionPeriod)
    .map((c) => `${c.category}: ${c.retentionPeriod}${c.retentionTrigger ? ` (from ${titleCase(c.retentionTrigger)})` : ''}`);
  if (perCategory.length > 0) return perCategory.join('; ');
  return a.retentionPeriod || 'Not recorded';
};

/** Art. 9(2) and Art. 10, as the citation an auditor looks for. */
const specialCategoryCell = (a: Article30Activity): string => {
  const rows = a.dataCategories
    .filter((c) => c.isSpecialCategory || c.isCriminalData)
    .map((c) => {
      if (c.isCriminalData) return `${c.category}: Article 10${c.article10Basis ? ` — ${c.article10Basis}` : ' — no basis recorded'}`;
      const condition = c.article9Condition ? `Article 9(2)(${c.article9Condition})` : 'no Article 9(2) condition recorded';
      const law = c.article9NationalLawBasis ? ` — ${c.article9NationalLawBasis}` : '';
      return `${c.category}: ${condition}${law}`;
    });
  return rows.length > 0 ? rows.join('; ') : 'None';
};

// ---------------------------------------------------------------------------
// J95 — the canonical workbook: one sheet per object.
// ---------------------------------------------------------------------------

type Sheet = { name: string; rows: Array<Record<string, unknown>> };

export function article30Sheets(record: Article30Record): Sheet[] {
  const all = flattenActivities(record);
  const nameOf = new Map(all.map((a) => [a.id, a.name]));

  const controllerSheet: Sheet = {
    // 31 characters is Excel's own limit on a sheet name; longer ones are
    // silently truncated by the writer and then collide.
    name: 'Controller record',
    rows: record.controllerActivities.map((a) => ({
      'Reference': a.reference,
      'Activity': a.name,
      'Purpose (Art. 30(1)(b))': a.purpose,
      'Description': a.description || '',
      'Lawful basis (Art. 6)': titleCase(a.lawfulBasis),
      'Lawful basis detail': a.lawfulBasisDetail || '',
      'LIA outcome': a.liaOutcome ? titleCase(a.liaOutcome) : a.lawfulBasis === 'legitimate_interests' ? 'No assessment recorded' : 'n/a',
      'Data subjects (Art. 30(1)(c))': joinList(subjectNames(a)) || 'Not recorded',
      'Data categories (Art. 30(1)(c))': joinList(categoryNames(a)) || 'Not recorded',
      'Special category / criminal data': specialCategoryCell(a),
      'Recipients (Art. 30(1)(d))': joinList(recipientNames(a)) || 'None',
      'Third-country transfers (Art. 30(1)(e))': transferCell(a),
      'Retention (Art. 30(1)(f))': retentionCell(a),
      'Security measures (Art. 30(1)(g))': joinList(a.securityMeasures.map(titleCase)) || 'Not recorded',
      'Automated decision-making (Art. 22)': yesNo(a.automatedDecisionMaking),
      'DPIA required': yesNo(a.requiresDpia),
      'DPIA': a.dpiaTitle || '',
      'Risk level': titleCase(a.riskLevel),
      'Status': titleCase(a.status),
      'Business owner': a.businessOwner || '',
      'Privacy owner': a.privacyOwner || '',
      'Last reviewed': day(a.lastReviewedAt),
      'Next review': day(a.nextReviewAt),
      'Completeness (%)': a.completenessScore,
    })),
  };

  const processorSheet: Sheet = {
    name: 'Processor record',
    rows: record.processorSections.flatMap((section) =>
      section.activities.map((a) => ({
        'Reference': a.reference,
        'Controller (Art. 30(2)(a))': section.controller.legalName || section.controller.name,
        'Controller contact': section.controller.contactEmail || '',
        'Controller representative': section.controller.representative || 'None designated',
        "Controller's DPO": section.controller.dpoName || 'None designated',
        'Categories of processing (Art. 30(2)(b))':
          joinList(section.processingCategories.map(titleCase)) || a.purpose,
        'Activity': a.name,
        'Data categories': joinList(categoryNames(a)) || 'Not recorded',
        'Data subjects': joinList(subjectNames(a)) || 'Not recorded',
        'Sub-processors and recipients': joinList(recipientNames(a)) || 'None',
        'Third-country transfers (Art. 30(2)(c))': transferCell(a),
        'Security measures (Art. 30(2)(d))': joinList(a.securityMeasures.map(titleCase)) || 'Not recorded',
        'Retention': retentionCell(a),
        'Status': titleCase(a.status),
      })),
    ),
  };

  const subjectsSheet: Sheet = {
    name: 'Data subjects',
    rows: all.flatMap((a) =>
      a.dataSubjectCategories.map((s) => ({
        'Activity reference': a.reference,
        'Activity': a.name,
        'Category': s.category,
        'Volume band': titleCase(s.volumeBand),
        'Children': yesNo(s.isChild),
        'Vulnerable': yesNo(s.isVulnerable),
      })),
    ),
  };

  const categoriesSheet: Sheet = {
    name: 'Data categories',
    rows: all.flatMap((a) =>
      a.dataCategories.map((c) => ({
        'Activity reference': a.reference,
        'Activity': a.name,
        'Category': c.category,
        'Group': c.group,
        'Special category': yesNo(c.isSpecialCategory),
        'Special category type': titleCase(c.specialCategoryType),
        'Article 9(2) condition': c.article9Condition ? `9(2)(${c.article9Condition})` : '',
        'Article 9(2) national law': c.article9NationalLawBasis || '',
        'Criminal offence data (Art. 10)': yesNo(c.isCriminalData),
        'Article 10 basis': c.article10Basis || '',
        'Identifiability': titleCase(c.identifiability),
        'Source': titleCase(c.source),
        'Retention period': c.retentionPeriod || '',
        'Retention trigger': titleCase(c.retentionTrigger),
      })),
    ),
  };

  const recipientsSheet: Sheet = {
    name: 'Recipients',
    rows: all.flatMap((a) =>
      a.recipients.map((r) => ({
        'Activity reference': a.reference,
        'Activity': a.name,
        'Recipient': r.name,
        'Category of recipient': titleCase(r.category),
        'Role in law': titleCase(r.role),
        'Purpose of disclosure': r.purpose || '',
      })),
    ),
  };

  const transfersSheet: Sheet = {
    name: 'Transfers',
    rows: all.flatMap((a) =>
      a.transfers.map((t) => ({
        'Activity reference': a.reference,
        'Activity': a.name,
        'Destination country': t.destinationCountry,
        'Destination entity': t.destinationEntity || '',
        'Adequate destination': yesNo(t.isAdequate),
        'Transfer mechanism': titleCase(t.mechanism),
        'Safeguard documentation (Art. 30(1)(e))': t.safeguardEvidence,
        'TIA completed': yesNo(t.tiaCompleted),
        'TIA residual risk': titleCase(t.tiaRiskLevel),
      })),
    ),
  };

  const retentionSheet: Sheet = {
    name: 'Retention',
    rows: all.map((a) => ({
      'Activity reference': a.reference,
      'Activity': a.name,
      'Retention period': a.retentionPeriod || 'Not recorded',
      'Justification': a.retentionJustification || '',
      'Deletion procedure': a.deletionProcedure || '',
      'Per-category periods': a.dataCategories.filter((c) => c.retentionPeriod).length,
    })),
  };

  // The assertions sheet is not decoration. A register with no transfers renders
  // an empty Transfers sheet, and an empty sheet is the ambiguity the negative
  // assertions exist to remove — so the workbook carries them explicitly, per
  // record and for the register as a whole.
  const assertionsSheet: Sheet = {
    name: 'Assertions',
    rows: [
      ...record.assertions.map((text) => ({ Scope: 'Register', 'Activity': '', Assertion: text })),
      ...all.flatMap((a) => a.assertions.map((text) => ({ Scope: 'Activity', 'Activity': a.name, Assertion: text }))),
    ],
  };

  const coverSheet: Sheet = {
    name: 'Controller identity',
    rows: [
      { Field: 'Controller', Value: record.controller.legalName || record.controller.name },
      { Field: 'Trading name', Value: record.controller.name },
      { Field: 'Country', Value: record.controller.countryCode || '' },
      { Field: 'Address', Value: record.controller.address || 'Not recorded' },
      { Field: 'Contact', Value: record.controller.contactEmail || 'Not recorded' },
      { Field: 'Representative (Art. 27)', Value: record.controller.representative || 'None designated' },
      { Field: 'Data protection officer', Value: record.controller.dpoName || 'None designated' },
      { Field: 'DPO contact', Value: record.controller.dpoEmail || '' },
      { Field: 'Generated', Value: record.generatedAt.toISOString() },
      { Field: 'Controller records', Value: String(record.counts.controller) },
      { Field: 'Processor records', Value: String(record.counts.processor) },
      { Field: 'Scope', Value: record.filterSummary || 'The complete register' },
    ],
  };

  return [
    coverSheet,
    controllerSheet,
    processorSheet,
    subjectsSheet,
    categoriesSheet,
    recipientsSheet,
    transfersSheet,
    retentionSheet,
    assertionsSheet,
  ];
}

/**
 * Sheets to a workbook buffer.
 *
 * A sheet with no rows still gets created, with its headers, from an explicit
 * `headers` fallback — SheetJS derives columns from the first row and produces a
 * nameless empty sheet otherwise, which reads as a broken export rather than as
 * "nothing to report".
 */
export function sheetsToXlsx(sheets: Sheet[], emptyHeaders: Record<string, string[]> = {}): Buffer {
  const book = XLSX.utils.book_new();

  for (const sheet of sheets) {
    const headers = emptyHeaders[sheet.name];
    const worksheet = sheet.rows.length
      ? XLSX.utils.json_to_sheet(sheet.rows)
      : XLSX.utils.aoa_to_sheet([headers ?? ['No records']]);

    // Column widths from the content, capped. Excel opens a workbook with
    // 8-character columns otherwise, and every Article 30 cell is a sentence.
    if (sheet.rows.length) {
      const keys = Object.keys(sheet.rows[0]!);
      (worksheet as any)['!cols'] = keys.map((key) => ({
        wch: Math.min(60, Math.max(
          key.length + 2,
          ...sheet.rows.slice(0, 200).map((row) => String(row[key] ?? '').length + 2),
        )),
      }));
    }

    XLSX.utils.book_append_sheet(book, worksheet, sheet.name.slice(0, 31));
  }

  return XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

export function article30Xlsx(record: Article30Record): Buffer {
  return sheetsToXlsx(article30Sheets(record));
}

// ---------------------------------------------------------------------------
// J97 — regulator template packs.
// ---------------------------------------------------------------------------

type Column = { header: string; value: (a: Article30Activity, record: Article30Record) => string };

export type RegulatorTemplate = {
  id: string;
  /** The authority's own name for the document. */
  title: string;
  authority: string;
  /** Language the column headers are in, so the caller can name the file. */
  language: string;
  /** Whether controller and processor records go on separate sheets. */
  splitByRole: boolean;
  controllerColumns: Column[];
  processorColumns: Column[];
};

const commonControllerValues = {
  name: (a: Article30Activity) => a.name,
  purpose: (a: Article30Activity) => a.purpose,
  basis: (a: Article30Activity) => titleCase(a.lawfulBasis),
  subjects: (a: Article30Activity) => joinList(subjectNames(a)),
  categories: (a: Article30Activity) => joinList(categoryNames(a)),
  recipients: (a: Article30Activity) => joinList(recipientNames(a)) || 'None',
  transfers: transferCell,
  retention: retentionCell,
  security: (a: Article30Activity) => joinList(a.securityMeasures.map(titleCase)) || 'Not recorded',
};

/**
 * The four packs, plus the EDPB exchange shape.
 *
 * The headers are in the authority's own language on purpose. A CNIL register
 * submitted with English column headings is a document the *contrôleur* has to
 * translate before reading, and the point of the pack is that it does not.
 */
export const REGULATOR_TEMPLATES: Record<string, RegulatorTemplate> = {
  cnil: {
    id: 'cnil',
    title: 'Registre des activités de traitement',
    authority: 'CNIL (France)',
    language: 'fr',
    splitByRole: true,
    controllerColumns: [
      { header: "N° de fiche", value: (a) => a.reference },
      { header: "Nom du traitement", value: commonControllerValues.name },
      { header: "Finalités", value: commonControllerValues.purpose },
      { header: "Base légale", value: commonControllerValues.basis },
      { header: "Catégories de personnes concernées", value: commonControllerValues.subjects },
      { header: "Catégories de données", value: commonControllerValues.categories },
      { header: "Données sensibles (art. 9) / infractions (art. 10)", value: specialCategoryCell },
      { header: "Destinataires", value: commonControllerValues.recipients },
      { header: "Transferts hors UE", value: commonControllerValues.transfers },
      { header: "Durée de conservation", value: commonControllerValues.retention },
      { header: "Mesures de sécurité", value: commonControllerValues.security },
      { header: "AIPD requise", value: (a) => (a.requiresDpia ? 'Oui' : 'Non') },
      { header: "Responsable interne", value: (a) => a.privacyOwner || a.businessOwner || '' },
    ],
    processorColumns: [
      { header: "N° de fiche", value: (a) => a.reference },
      { header: "Responsable de traitement", value: (a) => a.clientName || 'Non renseigné' },
      { header: "Catégories de traitements", value: commonControllerValues.purpose },
      { header: "Catégories de données", value: commonControllerValues.categories },
      { header: "Transferts hors UE", value: commonControllerValues.transfers },
      { header: "Mesures de sécurité", value: commonControllerValues.security },
      { header: "Sous-traitants ultérieurs", value: commonControllerValues.recipients },
    ],
  },

  ico: {
    id: 'ico',
    title: 'Record of processing activities',
    authority: 'ICO (United Kingdom)',
    language: 'en',
    splitByRole: true,
    controllerColumns: [
      { header: 'Reference', value: (a) => a.reference },
      { header: 'Name of processing activity', value: commonControllerValues.name },
      { header: 'Purpose of processing', value: commonControllerValues.purpose },
      { header: 'Lawful basis', value: commonControllerValues.basis },
      { header: 'Special category / criminal offence condition', value: specialCategoryCell },
      { header: 'Categories of individuals', value: commonControllerValues.subjects },
      { header: 'Categories of personal data', value: commonControllerValues.categories },
      { header: 'Categories of recipients', value: (a) => joinList(a.recipients.map((r) => r.category || r.name)) || 'None' },
      { header: 'Transfers to third countries', value: commonControllerValues.transfers },
      { header: 'Safeguards for transfers', value: (a) => (a.transfers.length ? a.transfers.map((t) => t.safeguardEvidence).join(' | ') : 'Not applicable') },
      { header: 'Retention schedule', value: commonControllerValues.retention },
      { header: 'Technical and organisational security measures', value: commonControllerValues.security },
      { header: 'DPIA reference', value: (a) => a.dpiaTitle || (a.requiresDpia ? 'Required — not recorded' : 'Not required') },
    ],
    processorColumns: [
      { header: 'Reference', value: (a) => a.reference },
      { header: 'Controller name and contact details', value: (a) => a.clientName || 'Not recorded' },
      { header: 'Categories of processing', value: commonControllerValues.purpose },
      { header: 'Transfers to third countries', value: commonControllerValues.transfers },
      { header: 'Safeguards for transfers', value: (a) => (a.transfers.length ? a.transfers.map((t) => t.safeguardEvidence).join(' | ') : 'Not applicable') },
      { header: 'Technical and organisational security measures', value: commonControllerValues.security },
    ],
  },

  dsk: {
    id: 'dsk',
    title: 'Verzeichnis von Verarbeitungstätigkeiten',
    authority: 'Datenschutzkonferenz (Deutschland)',
    language: 'de',
    splitByRole: true,
    controllerColumns: [
      { header: 'Lfd. Nr.', value: (a) => a.reference },
      { header: 'Bezeichnung der Verarbeitungstätigkeit', value: commonControllerValues.name },
      { header: 'Zweck der Verarbeitung', value: commonControllerValues.purpose },
      { header: 'Rechtsgrundlage', value: commonControllerValues.basis },
      { header: 'Kategorien betroffener Personen', value: commonControllerValues.subjects },
      { header: 'Kategorien personenbezogener Daten', value: commonControllerValues.categories },
      { header: 'Besondere Kategorien (Art. 9/10)', value: specialCategoryCell },
      { header: 'Kategorien von Empfängern', value: (a) => joinList(a.recipients.map((r) => r.category || r.name)) || 'Keine' },
      { header: 'Übermittlungen an Drittländer', value: commonControllerValues.transfers },
      { header: 'Löschfristen', value: commonControllerValues.retention },
      { header: 'Technische und organisatorische Maßnahmen', value: commonControllerValues.security },
      { header: 'DSFA erforderlich', value: (a) => (a.requiresDpia ? 'Ja' : 'Nein') },
      { header: 'Risikostufe', value: (a) => titleCase(a.riskLevel) },
    ],
    processorColumns: [
      { header: 'Lfd. Nr.', value: (a) => a.reference },
      { header: 'Verantwortlicher', value: (a) => a.clientName || 'Nicht erfasst' },
      { header: 'Kategorien von Verarbeitungen', value: commonControllerValues.purpose },
      { header: 'Übermittlungen an Drittländer', value: commonControllerValues.transfers },
      { header: 'Technische und organisatorische Maßnahmen', value: commonControllerValues.security },
    ],
  },

  aepd: {
    id: 'aepd',
    title: 'Registro de actividades de tratamiento',
    authority: 'AEPD (España)',
    language: 'es',
    splitByRole: true,
    controllerColumns: [
      { header: 'Referencia', value: (a) => a.reference },
      { header: 'Actividad de tratamiento', value: commonControllerValues.name },
      { header: 'Fines del tratamiento', value: commonControllerValues.purpose },
      { header: 'Base jurídica', value: commonControllerValues.basis },
      { header: 'Categorías de interesados', value: commonControllerValues.subjects },
      { header: 'Categorías de datos personales', value: commonControllerValues.categories },
      { header: 'Categorías especiales (art. 9/10)', value: specialCategoryCell },
      { header: 'Categorías de destinatarios', value: commonControllerValues.recipients },
      { header: 'Transferencias internacionales', value: commonControllerValues.transfers },
      { header: 'Plazos de supresión', value: commonControllerValues.retention },
      { header: 'Medidas técnicas y organizativas', value: commonControllerValues.security },
    ],
    processorColumns: [
      { header: 'Referencia', value: (a) => a.reference },
      { header: 'Responsable del tratamiento', value: (a) => a.clientName || 'No consta' },
      { header: 'Categorías de tratamientos', value: commonControllerValues.purpose },
      { header: 'Transferencias internacionales', value: commonControllerValues.transfers },
      { header: 'Medidas técnicas y organizativas', value: commonControllerValues.security },
    ],
  },
};

export const REGULATOR_TEMPLATE_IDS = Object.keys(REGULATOR_TEMPLATES) as Array<keyof typeof REGULATOR_TEMPLATES>;

export function regulatorXlsx(record: Article30Record, templateId: string): Buffer {
  const template = REGULATOR_TEMPLATES[templateId];
  if (!template) throw new Error(`Unknown regulator template: ${templateId}`);

  const render = (activities: Article30Activity[], columns: Column[]) =>
    activities.map((a) => {
      const row: Record<string, string> = {};
      for (const column of columns) row[column.header] = column.value(a, record);
      return row;
    });

  const processorActivities = record.processorSections.flatMap((s) =>
    s.activities.map((a) => ({ ...a, clientName: s.controller.legalName || s.controller.name })),
  );

  const sheets: Sheet[] = [
    {
      name: template.language === 'fr' ? 'Responsable' : template.language === 'de' ? 'Verantwortlicher' : template.language === 'es' ? 'Responsable' : 'Controller',
      rows: render(record.controllerActivities, template.controllerColumns),
    },
    {
      name: template.language === 'fr' ? 'Sous-traitant' : template.language === 'de' ? 'Auftragsverarbeiter' : template.language === 'es' ? 'Encargado' : 'Processor',
      rows: render(processorActivities, template.processorColumns),
    },
  ];

  const emptyHeaders: Record<string, string[]> = {
    [sheets[0]!.name]: template.controllerColumns.map((c) => c.header),
    [sheets[1]!.name]: template.processorColumns.map((c) => c.header),
  };

  return sheetsToXlsx(sheets, emptyHeaders);
}

// ---------------------------------------------------------------------------
// J97/J98 — the EDPB-shaped exchange format.
// ---------------------------------------------------------------------------

/**
 * JSON keyed by Article, not by our column names.
 *
 * The point of an exchange format is that the receiving system does not have to
 * know Custodia's schema: `article_30_1_c` means the same thing to anyone who has
 * read the Regulation, and `dataSubjectCategories` means whatever our schema.ts
 * says today. Migration in and out of the product is J98's real argument, and a
 * customer who cannot get their register back out will not put it in.
 */
export function article30Json(record: Article30Record): unknown {
  const activity = (a: Article30Activity) => ({
    reference: a.reference,
    name: a.name,
    role: a.role,
    status: a.status,
    article_30_1_b_purposes: a.purpose,
    lawful_basis: { article_6: a.lawfulBasis, detail: a.lawfulBasisDetail, lia_outcome: a.liaOutcome },
    article_30_1_c_data_subjects: a.dataSubjectCategories,
    article_30_1_c_data_categories: a.dataCategories,
    article_30_1_d_recipients: a.recipients,
    article_30_1_e_transfers: a.transfers,
    article_30_1_f_retention: {
      period: a.retentionPeriod,
      justification: a.retentionJustification,
      deletion_procedure: a.deletionProcedure,
      per_category: a.dataCategories
        .filter((c) => c.retentionPeriod)
        .map((c) => ({ category: c.category, period: c.retentionPeriod, trigger: c.retentionTrigger })),
    },
    article_30_1_g_security: { measures: a.securityMeasures, detail: a.securityMeasuresDetail },
    article_22: a.automatedDecisionMaking
      ? { profiling: a.profiling, logic: a.admLogic, significance: a.admSignificance, human_intervention: a.admHumanIntervention }
      : null,
    accountability: {
      risk_level: a.riskLevel,
      dpia_required: a.requiresDpia,
      dpia: a.dpiaTitle,
      business_owner: a.businessOwner,
      privacy_owner: a.privacyOwner,
      last_reviewed_at: a.lastReviewedAt,
      next_review_at: a.nextReviewAt,
      approval_state: a.approvalState,
      completeness_score: a.completenessScore,
    },
    negative_assertions: a.assertions,
  });

  return {
    format: 'edpb-ropa-exchange',
    version: '1.0',
    generated_at: record.generatedAt.toISOString(),
    scope: record.filterSummary || 'complete register',
    article_30_1_a_controller: record.controller,
    article_30_1_records: record.controllerActivities.map(activity),
    article_30_2_records: record.processorSections.map((section) => ({
      article_30_2_a_controller: section.controller,
      article_30_2_b_categories_of_processing: section.processingCategories,
      activities: section.activities.map(activity),
    })),
    register_assertions: record.assertions,
    counts: record.counts,
  };
}

// ---------------------------------------------------------------------------
// CSV, kept for round-tripping with the importer.
// ---------------------------------------------------------------------------

/**
 * J94. The whole register as CSV, server-side.
 *
 * The register page's own button exports what the browser has loaded and says so;
 * this is the one that means the register. The column set matches the importer's
 * so a round trip stays lossless — which is why the lawful basis stays a
 * canonical key rather than a translated label.
 */
export function article30Csv(record: Article30Record): string {
  const headers = [
    'reference', 'name', 'purpose', 'lawful_basis', 'lawful_basis_detail', 'role', 'controller',
    'data_subjects', 'data_categories', 'special_categories', 'recipients', 'transfers',
    'retention', 'security_measures', 'automated_decisions', 'dpia_required', 'risk_level',
    'status', 'business_owner', 'privacy_owner', 'next_review', 'completeness',
  ];

  const rows = flattenActivities(record).map((a) => [
    a.reference, a.name, a.purpose, a.lawfulBasis, a.lawfulBasisDetail || '', a.role, a.clientName || '',
    joinList(subjectNames(a)), joinList(categoryNames(a)), specialCategoryCell(a),
    joinList(recipientNames(a)) || 'None', transferCell(a), retentionCell(a),
    joinList(a.securityMeasures), yesNo(a.automatedDecisionMaking), yesNo(a.requiresDpia),
    a.riskLevel || '', a.status, a.businessOwner || '', a.privacyOwner || '',
    day(a.nextReviewAt), String(a.completenessScore),
  ]);

  return [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
}
