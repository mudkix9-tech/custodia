/**
 * J93/J94/N114. One canonical Article 30 record, built on the server.
 *
 * Before this, the module produced three different Article 30 documents and none
 * of them was complete. `export.generatePdf` rendered nine fields per activity
 * through `ropa-record`; the audit pack rendered eight through `ropa-register`;
 * the register's CSV button exported whatever the browser had loaded — twenty-five
 * rows of an eight-column table, described in the UI as an export of the register.
 * Each read the Sprint 0 field set, so everything Sprints 1 and 2 added — Art. 9(2)
 * conditions, Art. 10 bases, per-category retention, mechanism-specific transfer
 * evidence, recipient roles, Art. 22 fields, owners, review state — was absent from
 * every regulator-facing output the product had.
 *
 * This module is the single source those outputs now read. It has three jobs:
 *
 *   1. **All seven sub-paragraphs.** 30(1)(a)–(g) and 30(2)(a)–(d), each mapped to
 *      the columns that answer it, rather than to the columns the first template
 *      happened to render.
 *
 *   2. **Negative assertions.** "No transfers to third countries" is a *statement*
 *      an Article 30 record has to make; a blank cell is not it. A supervisory
 *      authority reading a blank transfers column cannot tell whether the
 *      controller has no transfers or has not filled the column in, and those are
 *      very different findings. Every field that can be legitimately empty gets an
 *      explicit assertion — see `NEGATIVE_ASSERTIONS`.
 *
 *   3. **Controller identity.** 30(1)(a) wants the controller's name and contact
 *      details, and those of the representative and the DPO where they exist. For
 *      the processor record (30(2)(a)) that identity is the *client's*, not the
 *      organisation's — which is N114, and which the old templates got wrong for
 *      every agency using the product.
 *
 * The builder is deliberately separate from the renderers. The same dataset feeds
 * the PDF, the XLSX, the CSV, the EDPB JSON and the four regulator template packs;
 * if each built its own view of "an activity", they would diverge the way the two
 * PDFs already had.
 */

import { and, eq, inArray, isNull } from 'drizzle-orm';
import {
  processingActivities,
  processingDataCategories,
  processingDataSubjects,
  processingRecipients,
  processingTransfers,
  clients,
  clientProcessingActivities,
  organizations,
  users,
  legitimateInterestAssessments,
  dpias,
} from 'db';
import { isAdequateDestination } from '../constants/transferDestinations.js';

// ---------------------------------------------------------------------------
// The wire shape.
// ---------------------------------------------------------------------------

export type Article30Party = {
  name: string;
  legalName: string | null;
  address: string | null;
  countryCode: string | null;
  contactEmail: string | null;
  /** Art. 27 representative, where the controller is not established in the EU. */
  representative: string | null;
  dpoName: string | null;
  dpoEmail: string | null;
};

export type Article30Transfer = {
  destinationCountry: string;
  destinationEntity: string | null;
  /** Whether Chapter V is engaged at all. An adequate destination is not a 'transfer' in the sense 30(1)(e) asks about — it is one that needs no safeguard documented. */
  isAdequate: boolean;
  mechanism: string;
  mechanismDetail: string | null;
  /** 30(1)(e)'s second limb: "the documentation of suitable safeguards". */
  safeguardEvidence: string;
  tiaCompleted: boolean;
  tiaRiskLevel: string | null;
};

export type Article30Activity = {
  id: string;
  reference: string;
  name: string;
  role: string;
  status: string;
  /** 30(1)(b) */
  purpose: string;
  description: string | null;
  lawfulBasis: string;
  lawfulBasisDetail: string | null;
  /** F55. The LIA's outcome, shown beside the basis where the basis is legitimate interests. */
  liaStatus: string | null;
  liaOutcome: string | null;
  /** 30(1)(c), first limb */
  dataSubjectCategories: Array<{ category: string; volumeBand: string | null; isChild: boolean; isVulnerable: boolean }>;
  /** 30(1)(c), second limb */
  dataCategories: Array<{
    category: string;
    group: string;
    isSpecialCategory: boolean;
    specialCategoryType: string | null;
    article9Condition: string | null;
    article9NationalLawBasis: string | null;
    isCriminalData: boolean;
    article10Basis: string | null;
    identifiability: string | null;
    source: string | null;
    retentionPeriod: string | null;
    retentionTrigger: string | null;
  }>;
  /** 30(1)(d) */
  recipients: Array<{ name: string; category: string | null; role: string | null; purpose: string | null }>;
  /** 30(1)(e) */
  transfers: Article30Transfer[];
  /** 30(1)(f) */
  retentionPeriod: string | null;
  retentionJustification: string | null;
  deletionProcedure: string | null;
  /** 30(1)(g) */
  securityMeasures: string[];
  securityMeasuresDetail: string | null;
  /** Art. 22 — not part of Art. 30, but the record is where a reader looks for it. */
  automatedDecisionMaking: boolean;
  profiling: boolean;
  admLogic: string | null;
  admSignificance: string | null;
  admHumanIntervention: string | null;
  /** Accountability context. */
  riskLevel: string | null;
  requiresDpia: boolean;
  dpiaTitle: string | null;
  dpiaStatus: string | null;
  businessOwner: string | null;
  privacyOwner: string | null;
  lastReviewedAt: Date | null;
  nextReviewAt: Date | null;
  approvalState: string | null;
  completenessScore: number;
  createdAt: Date | null;
  updatedAt: Date | null;
  /** N114. Present only on processor records. */
  clientId?: string | null;
  clientName?: string | null;
  /** The assertions this record makes about what it does *not* do. */
  assertions: string[];
};

export type Article30ProcessorSection = {
  /** 30(2)(a). The controller this processing is carried out for. */
  controller: Article30Party;
  /** 30(2)(b). Recorded on the client relationship, not per activity. */
  processingCategories: string[];
  activities: Article30Activity[];
};

export type Article30Record = {
  generatedAt: Date;
  /** The org, as controller. 30(1)(a). */
  controller: Article30Party;
  /** 30(1) — processing the organisation carries out in its own right. */
  controllerActivities: Article30Activity[];
  /** 30(2) — processing carried out on behalf of each client. */
  processorSections: Article30ProcessorSection[];
  /** Register-level statements, so an empty section is a claim rather than a gap. */
  assertions: string[];
  counts: {
    controller: number;
    processor: number;
    withTransfers: number;
    withSpecialCategories: number;
    total: number;
  };
  /** Where the export was narrowed, so the document says so on its face. */
  filterSummary: string | null;
};

// ---------------------------------------------------------------------------
// Negative assertions.
//
// The wording is English and lives here rather than in the catalogue, because
// these sentences are *content of the record* rather than UI chrome: they are what
// the document asserts, and a locale-shifting assertion is a different assertion.
// J101 (locale-aware exports) is where translating the register itself belongs,
// and it is a P2 that has to translate the whole document rather than half of it.
// ---------------------------------------------------------------------------

export const NEGATIVE_ASSERTIONS = {
  noTransfers: 'No personal data under this activity is transferred to a third country or international organisation.',
  noSpecialCategories: 'This activity does not involve special categories of personal data within the meaning of Article 9(1).',
  noCriminalData: 'This activity does not involve personal data relating to criminal convictions or offences within the meaning of Article 10.',
  noRecipients: 'Personal data under this activity is not disclosed to any recipient outside the controller.',
  noAutomatedDecisions: 'This activity does not involve automated decision-making, including profiling, producing legal or similarly significant effects.',
  noProcessorRecords: 'The organisation does not carry out processing on behalf of another controller. No record under Article 30(2) is required.',
  noControllerRecords: 'The organisation carries out no processing as controller in its own right.',
  noRepresentative: 'The controller is established in the Union; no representative is designated under Article 27.',
  noDpo: 'No data protection officer is designated. The controller has assessed that Article 37(1) does not apply.',
} as const;

// ---------------------------------------------------------------------------
// Loading.
// ---------------------------------------------------------------------------

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];

function formatAddress(address: unknown): string | null {
  if (!address || typeof address !== 'object') return null;
  const a = address as Record<string, unknown>;
  const parts = [a.street, a.line1, a.line2, a.postalCode, a.city, a.region, a.country]
    .filter((p): p is string => typeof p === 'string' && p.trim().length > 0);
  return parts.length > 0 ? parts.join(', ') : null;
}

function formatParty(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value.trim() || null;
  if (typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  const name = typeof v.name === 'string' ? v.name : null;
  const email = typeof v.email === 'string' ? v.email : null;
  const address = formatAddress(v.address ?? v);
  const parts = [name, email, address].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : null;
}

/**
 * 30(1)(e) second limb, as a sentence rather than an enum.
 *
 * The mechanism alone is not the documentation the Article asks for — "SCCs" says
 * nothing about *which* clauses, executed when, under which module. The
 * mechanism-specific fields Sprint 1 added are exactly the evidence, and this is
 * where they finally reach a regulator-facing document.
 */
function safeguardEvidence(transfer: any): string {
  const mechanism = String(transfer.transferMechanism || '').toLowerCase();
  const bits: string[] = [];

  if (mechanism.includes('scc') || mechanism.includes('standard')) {
    if (transfer.sccYear) bits.push(`${transfer.sccYear} Standard Contractual Clauses`);
    if (transfer.sccModule) bits.push(`Module ${transfer.sccModule}`);
    if (transfer.executionDate) bits.push(`executed ${new Date(transfer.executionDate).toISOString().slice(0, 10)}`);
    bits.push(transfer.annexesComplete ? 'annexes complete' : 'annexes incomplete');
  } else if (mechanism.includes('bcr')) {
    if (transfer.bcrReference) bits.push(`Binding Corporate Rules, reference ${transfer.bcrReference}`);
  } else if (mechanism.includes('adequacy')) {
    if (transfer.adequacyDecisionReference) bits.push(`Adequacy decision ${transfer.adequacyDecisionReference}`);
  } else if (mechanism.includes('dpf') || mechanism.includes('framework')) {
    if (transfer.dpfCertificationNumber) bits.push(`Data Privacy Framework certification ${transfer.dpfCertificationNumber}`);
    if (transfer.dpfScope) bits.push(`scope: ${transfer.dpfScope}`);
    if (transfer.dpfExpiryDate) bits.push(`expires ${new Date(transfer.dpfExpiryDate).toISOString().slice(0, 10)}`);
  } else if (mechanism.includes('49') || mechanism.includes('derogation')) {
    if (transfer.article49SubReason) bits.push(`Article 49(1)(${transfer.article49SubReason})`);
    if (transfer.article49Justification) bits.push(transfer.article49Justification);
  }

  if (transfer.mechanismDetail) bits.push(String(transfer.mechanismDetail));
  if (bits.length === 0) return 'No safeguard documentation recorded.';
  return bits.join('; ');
}

function buildActivity(
  activity: any,
  children: {
    subjects: any[];
    categories: any[];
    recipients: any[];
    transfers: any[];
  },
  context: {
    userNames: Map<string, string>;
    lia: { status: string; outcome: string | null } | null;
    dpia: { title: string; status: string } | null;
    clientName?: string | null;
  },
): Article30Activity {
  const specialCategories = children.categories.filter((c) => c.isSpecialCategory);
  const criminalData = children.categories.filter((c) => c.isCriminalData);

  const assertions: string[] = [];
  if (children.transfers.length === 0) assertions.push(NEGATIVE_ASSERTIONS.noTransfers);
  if (specialCategories.length === 0) assertions.push(NEGATIVE_ASSERTIONS.noSpecialCategories);
  if (criminalData.length === 0) assertions.push(NEGATIVE_ASSERTIONS.noCriminalData);
  if (children.recipients.length === 0) assertions.push(NEGATIVE_ASSERTIONS.noRecipients);
  if (!activity.involvesAutomatedDecisionMaking) assertions.push(NEGATIVE_ASSERTIONS.noAutomatedDecisions);

  return {
    id: activity.id,
    // A short, stable human reference. Auditors cite records; a uuid is not a
    // citation anybody reads back over a phone.
    reference: `PA-${String(activity.id).slice(0, 8).toUpperCase()}`,
    name: activity.name,
    role: activity.role || 'controller',
    status: activity.status || 'draft',
    purpose: activity.purpose,
    description: activity.description ?? null,
    lawfulBasis: activity.lawfulBasis,
    lawfulBasisDetail: activity.lawfulBasisDetail ?? null,
    liaStatus: context.lia?.status ?? null,
    liaOutcome: context.lia?.outcome ?? null,
    dataSubjectCategories: children.subjects.map((s) => ({
      category: s.category,
      volumeBand: s.volumeBand ?? null,
      isChild: !!s.isChild,
      isVulnerable: !!s.isVulnerable,
    })),
    dataCategories: children.categories.map((c) => ({
      category: c.category,
      group: c.categoryGroup,
      isSpecialCategory: !!c.isSpecialCategory,
      specialCategoryType: c.specialCategoryType ?? null,
      article9Condition: c.article9Condition ?? null,
      article9NationalLawBasis: c.article9NationalLawBasis ?? null,
      isCriminalData: !!c.isCriminalData,
      article10Basis: c.article10Basis ?? null,
      identifiability: c.identifiability ?? null,
      source: c.source ?? null,
      retentionPeriod: c.retentionPeriod ?? null,
      retentionTrigger: c.retentionTrigger ?? null,
    })),
    recipients: children.recipients.map((r) => ({
      name: r.name,
      category: r.recipientCategory ?? null,
      role: r.role ?? null,
      purpose: r.purpose ?? null,
    })),
    transfers: children.transfers.map((t) => ({
      destinationCountry: t.destinationCountry,
      destinationEntity: t.destinationEntity ?? null,
      isAdequate: isAdequateDestination(t.destinationCountry),
      mechanism: t.transferMechanism,
      mechanismDetail: t.mechanismDetail ?? null,
      safeguardEvidence: safeguardEvidence(t),
      tiaCompleted: !!t.tiaCompleted,
      tiaRiskLevel: t.tiaRiskLevel ?? null,
    })),
    retentionPeriod: activity.retentionPeriod ?? null,
    retentionJustification: activity.retentionJustification ?? null,
    deletionProcedure: activity.deletionProcedure ?? null,
    securityMeasures: asStringArray(activity.securityMeasures),
    securityMeasuresDetail: activity.securityMeasuresDetail ?? null,
    automatedDecisionMaking: !!activity.involvesAutomatedDecisionMaking,
    profiling: !!activity.involvesProfiling,
    admLogic: activity.admLogic ?? null,
    admSignificance: activity.admSignificance ?? null,
    admHumanIntervention: activity.admHumanIntervention ?? null,
    riskLevel: activity.riskLevel ?? null,
    requiresDpia: !!activity.requiresDpia,
    dpiaTitle: context.dpia?.title ?? null,
    dpiaStatus: context.dpia?.status ?? null,
    businessOwner: activity.businessOwnerId ? context.userNames.get(activity.businessOwnerId) ?? null : null,
    privacyOwner: activity.privacyOwnerId ? context.userNames.get(activity.privacyOwnerId) ?? null : null,
    lastReviewedAt: activity.lastReviewedAt ?? null,
    nextReviewAt: activity.nextReviewAt ?? null,
    approvalState: activity.approvalState ?? null,
    completenessScore: activity.completenessScore ?? 0,
    createdAt: activity.createdAt ?? null,
    updatedAt: activity.updatedAt ?? null,
    clientId: activity.clientId ?? null,
    clientName: context.clientName ?? null,
    assertions,
  };
}

/**
 * J94. The whole register, from the database, regardless of what any browser has
 * loaded.
 *
 * `where` is the caller's — the same predicate array `buildRegisterFilters`
 * produces, so a filtered export (J96) and the full one are the same code path
 * with a different argument. The organisation predicate is added here rather than
 * expected from the caller, because this function is the one place every export
 * goes through and an export that leaks another tenant's register is the worst
 * possible failure of this module.
 *
 * Five queries plus the lookups, not five per activity: a 400-activity register
 * exported per-row is two thousand round trips against a 512MB box that also runs
 * Chromium.
 */
export async function buildArticle30Record(
  dbc: any,
  orgId: string,
  opts: { where?: any[]; filterSummary?: string | null; limit?: number } = {},
): Promise<Article30Record> {
  const [org] = await dbc.select().from(organizations).where(eq(organizations.id, orgId));
  if (!org) throw new Error('Organisation not found');

  const predicates = [
    eq(processingActivities.organizationId, orgId),
    isNull(processingActivities.deletedAt),
    ...(opts.where ?? []),
  ];

  let query = dbc.select().from(processingActivities).where(and(...predicates));
  if (opts.limit) query = query.limit(opts.limit);
  const activities: any[] = await query;

  const ids = activities.map((a) => a.id);
  const [subjects, categories, recipients, transfers] = ids.length
    ? await Promise.all([
        dbc.select().from(processingDataSubjects).where(inArray(processingDataSubjects.processingActivityId, ids)),
        dbc.select().from(processingDataCategories).where(inArray(processingDataCategories.processingActivityId, ids)),
        dbc.select().from(processingRecipients).where(inArray(processingRecipients.processingActivityId, ids)),
        dbc.select().from(processingTransfers).where(inArray(processingTransfers.processingActivityId, ids)),
      ])
    : [[], [], [], []];

  const bucket = (rows: any[]) => {
    const map = new Map<string, any[]>();
    for (const row of rows) {
      const list = map.get(row.processingActivityId);
      if (list) list.push(row);
      else map.set(row.processingActivityId, [row]);
    }
    return map;
  };
  const bySubject = bucket(subjects as any[]);
  const byCategory = bucket(categories as any[]);
  const byRecipient = bucket(recipients as any[]);
  const byTransfer = bucket(transfers as any[]);

  // Owners, so the record names a person rather than a uuid.
  const ownerIds = [...new Set(activities.flatMap((a) => [a.businessOwnerId, a.privacyOwnerId]).filter(Boolean))] as string[];
  const owners: any[] = ownerIds.length
    ? await dbc.select({ id: users.id, name: users.name, email: users.email }).from(users).where(inArray(users.id, ownerIds))
    : [];
  const userNames = new Map<string, string>(owners.map((u) => [u.id, u.name || u.email]));

  // F55. The LIA outcome beside the basis, which is what makes a
  // legitimate-interests entry readable rather than merely asserted.
  const liaRows: any[] = ids.length
    ? await dbc.select().from(legitimateInterestAssessments)
        .where(and(
          eq(legitimateInterestAssessments.organizationId, orgId),
          inArray(legitimateInterestAssessments.processingActivityId, ids),
        ))
    : [];
  const liaByActivity = new Map<string, { status: string; outcome: string | null }>();
  for (const row of liaRows) {
    // A superseded assessment is history; the record shows the current one.
    if (row.status === 'superseded') continue;
    liaByActivity.set(row.processingActivityId, { status: row.status, outcome: row.outcome ?? null });
  }

  const dpiaIds = [...new Set(activities.map((a) => a.dpiaId).filter(Boolean))] as string[];
  const dpiaRows: any[] = dpiaIds.length
    ? await dbc.select({ id: dpias.id, title: dpias.title, status: dpias.status }).from(dpias)
        .where(and(eq(dpias.organizationId, orgId), inArray(dpias.id, dpiaIds)))
    : [];
  const dpiaById = new Map<string, { title: string; status: string }>(
    dpiaRows.map((d) => [d.id, { title: d.title, status: d.status }]),
  );

  // N114. Which client each processor activity is carried out for.
  //
  // Two links exist and they disagree: `processing_activities.client_id` is what
  // the old exports read, and `client_processing_activities` is what the UI
  // actually writes (D16). Both are consulted, the join table first, because a
  // record assigned through the interface is the one a customer believes exists.
  const links: any[] = ids.length
    ? await dbc.select().from(clientProcessingActivities).where(inArray(clientProcessingActivities.processingActivityId, ids))
    : [];
  const clientIdByActivity = new Map<string, string>();
  for (const link of links) clientIdByActivity.set(link.processingActivityId, link.clientId);
  for (const activity of activities) {
    if (activity.clientId && !clientIdByActivity.has(activity.id)) {
      clientIdByActivity.set(activity.id, activity.clientId);
    }
  }

  const clientIds = [...new Set(clientIdByActivity.values())];
  const clientRows: any[] = clientIds.length
    ? await dbc.select().from(clients).where(and(eq(clients.organizationId, orgId), inArray(clients.id, clientIds)))
    : [];
  const clientById = new Map<string, any>(clientRows.map((c) => [c.id, c]));

  const controllerActivities: Article30Activity[] = [];
  const processorByClient = new Map<string, Article30Activity[]>();

  for (const activity of activities) {
    const clientId = clientIdByActivity.get(activity.id);
    const client = clientId ? clientById.get(clientId) : null;

    const built = buildActivity(
      activity,
      {
        subjects: bySubject.get(activity.id) ?? [],
        categories: byCategory.get(activity.id) ?? [],
        recipients: byRecipient.get(activity.id) ?? [],
        transfers: byTransfer.get(activity.id) ?? [],
      },
      {
        userNames,
        lia: liaByActivity.get(activity.id) ?? null,
        dpia: activity.dpiaId ? dpiaById.get(activity.dpiaId) ?? null : null,
        clientName: client?.name ?? null,
      },
    );

    // The split is by *role*, not by whether a client happens to be linked. A
    // controller activity carried out for a named client is still a controller
    // record — an agency doing its own marketing to a client's contacts is the
    // case — and filing it under Art. 30(2) would assert a processor relationship
    // the organisation has not claimed. Where the role says processor and no
    // client is linked, the record stays under 30(2) with the client unnamed,
    // because that gap is the finding rather than something to hide by
    // reclassifying the row.
    const isProcessorRecord = built.role === 'processor';

    if (isProcessorRecord) {
      const key = clientId ?? '__unassigned__';
      const list = processorByClient.get(key);
      if (list) list.push(built);
      else processorByClient.set(key, [built]);
    } else {
      controllerActivities.push(built);
    }
  }

  const orgParty: Article30Party = {
    name: org.name,
    legalName: org.legalName ?? null,
    address: formatAddress(org.address),
    countryCode: org.countryCode ?? null,
    contactEmail: org.dpoEmail ?? null,
    representative: formatParty(org.euRepresentative),
    dpoName: org.hasDpo ? org.dpoName ?? null : null,
    dpoEmail: org.hasDpo ? org.dpoEmail ?? null : null,
  };

  const processorSections: Article30ProcessorSection[] = [...processorByClient.entries()]
    .map(([clientId, list]) => {
      const client = clientId === '__unassigned__' ? null : clientById.get(clientId);
      return {
        controller: client
          ? {
              name: client.name,
              legalName: client.legalName ?? null,
              address: formatAddress(client.controllerAddress) ?? null,
              countryCode: client.countryCode ?? null,
              contactEmail: client.contactEmail ?? null,
              representative: formatParty(client.controllerRepresentative),
              dpoName: client.controllerDpoName ?? null,
              dpoEmail: client.controllerDpoEmail ?? null,
            }
          : {
              // Named rather than omitted. Art. 30(2)(a) requires the controller
              // to be identified, and "not recorded" is the honest rendering of a
              // processor record that does not identify one.
              name: 'Controller not recorded',
              legalName: null,
              address: null,
              countryCode: null,
              contactEmail: null,
              representative: null,
              dpoName: null,
              dpoEmail: null,
            },
        processingCategories: asStringArray(client?.processingCategories),
        activities: list,
      };
    })
    .sort((a, b) => a.controller.name.localeCompare(b.controller.name));

  const assertions: string[] = [];
  if (processorSections.length === 0) assertions.push(NEGATIVE_ASSERTIONS.noProcessorRecords);
  if (controllerActivities.length === 0) assertions.push(NEGATIVE_ASSERTIONS.noControllerRecords);
  if (!orgParty.representative) assertions.push(NEGATIVE_ASSERTIONS.noRepresentative);
  if (!orgParty.dpoName) assertions.push(NEGATIVE_ASSERTIONS.noDpo);

  const all = [...controllerActivities, ...processorSections.flatMap((s) => s.activities)];

  return {
    generatedAt: new Date(),
    controller: orgParty,
    controllerActivities,
    processorSections,
    assertions,
    counts: {
      controller: controllerActivities.length,
      processor: all.length - controllerActivities.length,
      withTransfers: all.filter((a) => a.transfers.length > 0).length,
      withSpecialCategories: all.filter((a) => a.dataCategories.some((c) => c.isSpecialCategory)).length,
      total: all.length,
    },
    filterSummary: opts.filterSummary ?? null,
  };
}

/** Every activity in the record, controller and processor alike, in one list. */
export function flattenActivities(record: Article30Record): Article30Activity[] {
  return [...record.controllerActivities, ...record.processorSections.flatMap((s) => s.activities)];
}
