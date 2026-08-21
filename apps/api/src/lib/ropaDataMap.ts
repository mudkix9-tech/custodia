/**
 * D41–D43. The three maps a buyer asks to see in a demo and a DPO is asked for in
 * an audit: the flow for one activity, the org-level data map, and the transfer map.
 *
 * All three are *views over the register*, not new data, and that is the design
 * constraint worth stating: nothing here reads a column the Article 30 record does
 * not already hold. A map that could disagree with the record it is drawn from is a
 * second source of truth, and the module has been down that road once already —
 * three divergent Article 30 documents, and which one a customer received depended
 * on which button they pressed (J93).
 *
 * Pure. The callers do the querying; these functions turn rows into a graph.
 */

import { isAdequateDestination, EU_EEA_COUNTRIES } from '../constants/transferDestinations.js';
import { normaliseTransferMechanism } from '../constants/ropaVocabularies.js';

// ---------------------------------------------------------------------------
// D41 — the per-activity flow
// ---------------------------------------------------------------------------

export type FlowNodeKind = 'source' | 'subject' | 'activity' | 'data' | 'recipient' | 'transfer';

export type FlowNode = {
  id: string;
  kind: FlowNodeKind;
  /** English; the web renders its own labels for everything that has a vocabulary. */
  label: string;
  /** Vocabulary key where one exists, so the web can translate instead of printing this. */
  vocab?: { group: string; value: string } | null;
  detail?: string | null;
  /** low | medium | high — drives the accent, and is a fact rather than a judgement. */
  emphasis?: 'low' | 'medium' | 'high';
  meta?: Record<string, unknown>;
};

export type FlowEdge = { from: string; to: string; label?: string | null };

export type ActivityFlow = {
  nodes: FlowNode[];
  edges: FlowEdge[];
  /** Columns, in render order, so the web does not have to know the topology. */
  columns: { kind: FlowNodeKind; nodeIds: string[] }[];
  /**
   * The negative assertions, in the same register as the Article 30 record's: a
   * blank column and "this activity discloses to no one" are different statements
   * and a reader cannot tell them apart from an empty diagram.
   */
  assertions: string[];
};

type ActivityRow = {
  id: string;
  name?: string | null;
  purpose?: string | null;
  lawfulBasis?: string | null;
  role?: string | null;
};

type SubjectRow = { id: string; category?: string | null; isChild?: boolean | null; isVulnerable?: boolean | null; volumeBand?: string | null };
type CategoryRow = {
  id: string;
  category?: string | null;
  categoryGroup?: string | null;
  source?: string | null;
  isSpecialCategory?: boolean | null;
  isCriminalData?: boolean | null;
};
type RecipientRow = { id: string; name?: string | null; role?: string | null; recipientCategory?: string | null; vendorId?: string | null; purpose?: string | null };
type TransferRow = {
  id: string;
  destinationCountry?: string | null;
  destinationEntity?: string | null;
  transferMechanism?: string | null;
  tiaRequired?: boolean | null;
  tiaCompleted?: boolean | null;
  vendorId?: string | null;
};

/**
 * Sources → subjects → activity → data → recipients → transfers.
 *
 * The source column is derived from `processing_data_categories.source` rather than
 * being its own table: Art. 14(2)(f) already required it and Sprint 1 made it
 * recordable, so a separate "systems" model would be a second place to record the
 * same fact and a second place for it to be wrong.
 */
export function buildActivityFlow(input: {
  activity: ActivityRow;
  dataSubjects: SubjectRow[];
  dataCategories: CategoryRow[];
  recipients: RecipientRow[];
  transfers: TransferRow[];
}): ActivityFlow {
  const nodes: FlowNode[] = [];
  const edges: FlowEdge[] = [];
  const { activity, dataSubjects, dataCategories, recipients, transfers } = input;

  const activityId = `activity:${activity.id}`;
  nodes.push({
    id: activityId,
    kind: 'activity',
    label: activity.name ?? 'Untitled activity',
    detail: activity.purpose ?? null,
    emphasis: 'high',
    meta: { lawfulBasis: activity.lawfulBasis ?? null, role: activity.role ?? null },
  });

  // ---- sources ------------------------------------------------------------
  // Deduplicated, because six categories collected from the same web form is one
  // arrow on a diagram and six arrows on a bad one.
  const sources = new Map<string, string[]>();
  for (const c of dataCategories) {
    const source = (c.source ?? '').trim();
    if (!source) continue;
    const list = sources.get(source) ?? [];
    list.push(c.category ?? '');
    sources.set(source, list);
  }
  for (const [source, cats] of sources) {
    const id = `source:${slug(source)}`;
    nodes.push({
      id,
      kind: 'source',
      label: source,
      vocab: { group: 'data_source', value: source },
      detail: `${cats.length} categor${cats.length === 1 ? 'y' : 'ies'}`,
      emphasis: 'low',
    });
    edges.push({ from: id, to: activityId });
  }

  // ---- subjects -----------------------------------------------------------
  for (const s of dataSubjects) {
    const id = `subject:${s.id}`;
    nodes.push({
      id,
      kind: 'subject',
      label: s.category ?? 'Unnamed category',
      detail: s.volumeBand ?? null,
      vocab: s.volumeBand ? { group: 'volume_band', value: s.volumeBand } : null,
      emphasis: s.isChild || s.isVulnerable ? 'high' : 'medium',
      meta: { isChild: !!s.isChild, isVulnerable: !!s.isVulnerable },
    });
    edges.push({ from: id, to: activityId });
  }

  // ---- data ---------------------------------------------------------------
  for (const c of dataCategories) {
    const id = `data:${c.id}`;
    nodes.push({
      id,
      kind: 'data',
      label: c.category ?? 'Unnamed element',
      detail: c.categoryGroup ?? null,
      emphasis: c.isSpecialCategory || c.isCriminalData ? 'high' : 'medium',
      meta: { isSpecialCategory: !!c.isSpecialCategory, isCriminalData: !!c.isCriminalData },
    });
    edges.push({ from: activityId, to: id });
  }

  // ---- recipients ---------------------------------------------------------
  for (const r of recipients) {
    const id = `recipient:${r.id}`;
    nodes.push({
      id,
      kind: 'recipient',
      label: r.name ?? 'Unnamed recipient',
      vocab: r.role ? { group: 'recipient_role', value: r.role } : null,
      detail: r.purpose ?? null,
      emphasis: r.role === 'processor' || r.role === 'sub_processor' ? 'medium' : 'high',
      meta: { vendorId: r.vendorId ?? null, recipientCategory: r.recipientCategory ?? null },
    });
    edges.push({ from: activityId, to: id });
  }

  // ---- transfers ----------------------------------------------------------
  for (const t of transfers) {
    const id = `transfer:${t.id}`;
    const country = (t.destinationCountry ?? '').toUpperCase();
    const mechanism = normaliseTransferMechanism(t.transferMechanism);
    const adequate = isAdequateDestination(country) || EU_EEA_COUNTRIES.includes(country);
    nodes.push({
      id,
      kind: 'transfer',
      label: t.destinationEntity ? `${t.destinationEntity} (${country})` : country,
      vocab: mechanism ? { group: 'transfer_mechanism', value: mechanism } : null,
      // A transfer with no mechanism is the finding, and the map is where it is
      // most visible — hence high emphasis rather than a neutral node.
      emphasis: !mechanism || mechanism === 'pending_assessment' ? 'high' : adequate ? 'low' : 'medium',
      meta: {
        country,
        adequate,
        mechanism,
        tiaRequired: !!t.tiaRequired,
        tiaCompleted: !!t.tiaCompleted,
        vendorId: t.vendorId ?? null,
      },
    });

    // The arrow starts at the recipient where one shares the transfer's vendor —
    // "we send it to Stripe, and Stripe holds it in the US" is one path, not two
    // unrelated facts, and drawing it as two is what makes a data-flow diagram
    // useless for answering onward-transfer questions.
    const via = t.vendorId ? recipients.find((r) => r.vendorId && r.vendorId === t.vendorId) : undefined;
    edges.push({ from: via ? `recipient:${via.id}` : activityId, to: id });
  }

  const columns: ActivityFlow['columns'] = (['source', 'subject', 'activity', 'data', 'recipient', 'transfer'] as FlowNodeKind[])
    .map((kind) => ({ kind, nodeIds: nodes.filter((n) => n.kind === kind).map((n) => n.id) }))
    .filter((c) => c.nodeIds.length > 0);

  const assertions: string[] = [];
  if (recipients.length === 0) assertions.push('No personal data under this activity is disclosed to any recipient.');
  if (transfers.length === 0) assertions.push('No personal data under this activity is transferred to a third country.');
  if (sources.size === 0 && dataCategories.length > 0) assertions.push('The source of the personal data has not been recorded for any category.');

  return { nodes, edges, columns, assertions };
}

// ---------------------------------------------------------------------------
// D42 — the org-level data map
// ---------------------------------------------------------------------------

export type DataMapFilters = {
  dataCategory?: string | null;
  subjectCategory?: string | null;
  country?: string | null;
  vendorId?: string | null;
  recipientName?: string | null;
  specialCategoryOnly?: boolean;
};

export type DataMapRow = {
  activityId: string;
  activityName: string;
  status: string | null;
  role: string | null;
  lawfulBasis: string | null;
  subjectCategories: string[];
  dataCategories: string[];
  specialCategories: string[];
  recipients: { name: string; role: string | null; vendorId: string | null }[];
  countries: string[];
  /** Countries with no adequacy finding — the column a DPO scans first. */
  thirdCountries: string[];
};

/**
 * D42/D44. The filterable org-level map, and with it the three reverse lookups a
 * DPO is asked most often: "which activities process health data", "which send data
 * to the US", "which involve Salesforce".
 *
 * Filtered in memory rather than in SQL because every filter is a predicate over a
 * *child* collection, and the SQL form is four EXISTS subqueries whose result the
 * caller then has to re-join to render anyway. The register is bounded by
 * BULK_SELECTION_CAP-sized reality, not by a warehouse.
 */
export function buildDataMap(rows: DataMapRow[], filters: DataMapFilters = {}): {
  rows: DataMapRow[];
  facets: {
    dataCategories: { value: string; count: number }[];
    subjectCategories: { value: string; count: number }[];
    countries: { value: string; count: number; adequate: boolean }[];
    recipients: { value: string; count: number; vendorId: string | null }[];
  };
} {
  const match = (row: DataMapRow) => {
    if (filters.dataCategory && !row.dataCategories.some((c) => eqi(c, filters.dataCategory!))) return false;
    if (filters.subjectCategory && !row.subjectCategories.some((c) => eqi(c, filters.subjectCategory!))) return false;
    if (filters.country && !row.countries.some((c) => eqi(c, filters.country!))) return false;
    if (filters.vendorId && !row.recipients.some((r) => r.vendorId === filters.vendorId)) return false;
    if (filters.recipientName && !row.recipients.some((r) => eqi(r.name, filters.recipientName!))) return false;
    if (filters.specialCategoryOnly && row.specialCategories.length === 0) return false;
    return true;
  };

  const filtered = rows.filter(match);

  // Facets are computed over *everything*, not over the filtered set. A facet list
  // that shrinks as you filter cannot be used to widen a search, which is the only
  // thing a facet list is for.
  const dataCategories = tally(rows.flatMap((r) => r.dataCategories));
  const subjectCategories = tally(rows.flatMap((r) => r.subjectCategories));
  const countryTally = tally(rows.flatMap((r) => r.countries));
  const recipientTally = new Map<string, { count: number; vendorId: string | null }>();
  for (const row of rows) {
    for (const r of row.recipients) {
      const entry = recipientTally.get(r.name) ?? { count: 0, vendorId: r.vendorId };
      entry.count += 1;
      if (!entry.vendorId && r.vendorId) entry.vendorId = r.vendorId;
      recipientTally.set(r.name, entry);
    }
  }

  return {
    rows: filtered,
    facets: {
      dataCategories,
      subjectCategories,
      countries: countryTally.map((c) => ({
        ...c,
        adequate: isAdequateDestination(c.value) || EU_EEA_COUNTRIES.includes(c.value.toUpperCase()),
      })),
      recipients: [...recipientTally.entries()]
        .map(([value, v]) => ({ value, count: v.count, vendorId: v.vendorId }))
        .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value)),
    },
  };
}

// ---------------------------------------------------------------------------
// D43 — the transfer map
// ---------------------------------------------------------------------------

export type TransferMapEntry = {
  country: string;
  adequate: boolean;
  adequacyScope: string | null;
  transferCount: number;
  activityCount: number;
  /** Mechanism key -> count. Normalised, so the two vocabularies in the column collapse to one. */
  mechanisms: { mechanism: string; count: number }[];
  /** No mechanism at all, or the placeholder the vendor auto-create path writes. */
  unsafeguardedCount: number;
  tiaRequired: number;
  tiaCompleted: number;
  /** The volume bands of the subjects whose data reaches this country. */
  volumeBands: string[];
  entities: string[];
};

/**
 * Every destination country, its mechanism mix, its TIA position and its volume.
 *
 * The one judgement in here is `unsafeguardedCount`, and it is the number the map
 * exists to surface: a transfer whose mechanism does not normalise to a known key
 * — or normalises to `pending_assessment`, which is what the vendor auto-create
 * path writes — has no Chapter V safeguard recorded at all. D43 is the reason it
 * cannot simply be counted by string equality: the column holds English display
 * strings from the UI *and* slugs from automation.
 */
export function buildTransferMap(
  transfers: (TransferRow & { processingActivityId?: string | null; volumeBands?: string[] })[],
  adequacyScopes: Record<string, string> = {},
): TransferMapEntry[] {
  const byCountry = new Map<string, TransferMapEntry & { _activities: Set<string>; _mech: Map<string, number>; _bands: Set<string>; _entities: Set<string> }>();

  for (const t of transfers) {
    const country = (t.destinationCountry ?? '').toUpperCase();
    if (!country) continue;

    let entry = byCountry.get(country);
    if (!entry) {
      entry = {
        country,
        adequate: isAdequateDestination(country) || EU_EEA_COUNTRIES.includes(country),
        adequacyScope: adequacyScopes[country] ?? null,
        transferCount: 0,
        activityCount: 0,
        mechanisms: [],
        unsafeguardedCount: 0,
        tiaRequired: 0,
        tiaCompleted: 0,
        volumeBands: [],
        entities: [],
        _activities: new Set<string>(),
        _mech: new Map<string, number>(),
        _bands: new Set<string>(),
        _entities: new Set<string>(),
      };
      byCountry.set(country, entry);
    }

    entry.transferCount += 1;
    if (t.processingActivityId) entry._activities.add(t.processingActivityId);
    if (t.destinationEntity) entry._entities.add(t.destinationEntity);
    for (const band of t.volumeBands ?? []) entry._bands.add(band);

    const mechanism = normaliseTransferMechanism(t.transferMechanism);
    const key = mechanism ?? 'not_recorded';
    entry._mech.set(key, (entry._mech.get(key) ?? 0) + 1);
    if (!mechanism || mechanism === 'pending_assessment') entry.unsafeguardedCount += 1;

    if (t.tiaRequired) entry.tiaRequired += 1;
    if (t.tiaCompleted) entry.tiaCompleted += 1;
  }

  return [...byCountry.values()]
    .map((e) => ({
      country: e.country,
      adequate: e.adequate,
      adequacyScope: e.adequacyScope,
      transferCount: e.transferCount,
      activityCount: e._activities.size,
      mechanisms: [...e._mech.entries()]
        .map(([mechanism, count]) => ({ mechanism, count }))
        .sort((a, b) => b.count - a.count),
      unsafeguardedCount: e.unsafeguardedCount,
      tiaRequired: e.tiaRequired,
      tiaCompleted: e.tiaCompleted,
      volumeBands: [...e._bands],
      entities: [...e._entities].slice(0, 12),
    }))
    // Unsafeguarded first, then non-adequate, then by volume. The map is read for
    // what is wrong with it, so what is wrong sorts to the top.
    .sort((a, b) =>
      (b.unsafeguardedCount - a.unsafeguardedCount)
      || (Number(a.adequate) - Number(b.adequate))
      || (b.transferCount - a.transferCount)
      || a.country.localeCompare(b.country));
}

// ---------------------------------------------------------------------------

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'unknown';
}

function eqi(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function tally(values: string[]): { value: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const v of values) {
    const key = v.trim();
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}
