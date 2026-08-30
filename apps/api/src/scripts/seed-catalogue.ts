/**
 * Sprint 9 — seed the shared vendor catalogue from the curated core.
 *
 *   npm run seed:catalogue --workspace=apps/api -- --dry-run
 *   npm run seed:catalogue --workspace=apps/api
 *
 * **This is in apps/api and not packages/db, and the reason is Sprint 7's.**
 * It needs `dpfNameKey`, `dpfBaseNameKey` and `matchDpfStatus`, all of which
 * live in `apps/api/src/lib` where `test:vendors` can reach them. Moving the
 * script would mean either duplicating the name fold into `packages/db` or
 * having `packages/db` import from `apps/api`, and the first of those is VD-7
 * exactly — a second copy of a matching rule, somewhere the fixtures cannot
 * see it. `npm run seed:vendors --workspace=packages/db` prints a pointer here.
 *
 * **What it writes, and what it refuses to.** Identity only: name, slug,
 * website, category, and the `parent_entity_id` link. Then one Tier 1 lookup —
 * the DPF register — which can supply `legal_entity_name` and, where the
 * certification is current, `headquarters_country`. Nothing else. The five
 * fields a risk score reads are left absent unless a source produced them,
 * because a value with no evidence renders against a named company's name and
 * is worse than a gap.
 *
 * Every field it does write gets a `vendor_field_provenance` row. That is the
 * sprint's gate: a populated column with no matching provenance entry is a
 * failed seed, and `--verify` re-checks it after the fact.
 *
 * **No sub-processor edges (VD-18).** `vendor_sub_processors` stays empty here.
 * Those come only from a probed `sub_processor_list_url`, so the first snapshot
 * is a real baseline and the Article 28(2) diff means something. Seeding a
 * fabricated baseline would render the first true reading as a mass change
 * against every tenant at once.
 *
 * Idempotent: re-running upserts on `slug` and refreshes provenance rather than
 * duplicating it.
 */
process.env.WORKER_ROLE = 'web';

import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '../../../../.env') });
dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

const { db } = await import('../db.js');
const { vendors, vendorFieldProvenance, vendorSubProcessors } = await import('db');
const { and, eq, inArray, sql } = await import('drizzle-orm');
const fs = await import('node:fs/promises');
const { EOL } = await import('node:os');
const { CATALOGUE_SEED, catalogueEntityCount, validateCatalogueSeed } =
  await import('../constants/vendorEntityMap.js');
const { matchDpfStatus, DEFAULT_DPF_FRAMEWORK } = await import('../lib/vendorDpf.js');
const { loadDpfEntriesFor } = await import('../lib/vendorDpfLookup.js');
const { DPF_PARTICIPANT_URL } = await import('../lib/vendorDpfRegistry.js');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const verifyOnly = args.includes('--verify');

/**
 * Confidence for a registry-sourced field.
 *
 * Tier 1 is the top of the pyramid — an official publisher, machine-readable
 * and dated — but not 100: the register says what an organisation certified,
 * and the join from a catalogue row to a registrant is a name match this
 * codebase makes, not a fact the Department published.
 */
const REGISTRY_CONFIDENCE = 90;

interface SeedOutcome {
  slug: string;
  action: 'created' | 'updated' | 'unchanged';
  entity: string | null;
  legalEntityName: string | null;
  headquartersCountry: string | null;
  dpfStatus: string;
}

async function verifyProvenance(): Promise<number> {
  // The gate, as a query: any populated sourced column with no provenance row.
  // `name`, `slug`, `website` and `category` are identity rather than sourced
  // facts and are deliberately not in this list — the seed asserts them, the
  // probe does not, and a provenance row claiming otherwise would be a lie
  // about where they came from.
  const rows = await db
    .select({
      id: vendors.id,
      name: vendors.name,
      legalEntityName: vendors.legalEntityName,
      headquartersCountry: vendors.headquartersCountry,
      transferMechanisms: vendors.transferMechanisms,
      dpaUrl: vendors.dpaUrl,
      subProcessorListUrl: vendors.subProcessorListUrl,
    })
    .from(vendors);

  const provenance = await db
    .select({ vendorId: vendorFieldProvenance.vendorId, fieldName: vendorFieldProvenance.fieldName })
    .from(vendorFieldProvenance);
  const have = new Set(provenance.map((p: any) => `${p.vendorId}::${p.fieldName}`));

  const sourced: Array<[string, (r: any) => unknown]> = [
    ['legalEntityName', (r) => r.legalEntityName],
    ['headquartersCountry', (r) => r.headquartersCountry],
    ['transferMechanisms', (r) => (Array.isArray(r.transferMechanisms) && r.transferMechanisms.length > 0 ? r.transferMechanisms : null)],
    ['dpaUrl', (r) => r.dpaUrl],
    ['subProcessorListUrl', (r) => r.subProcessorListUrl],
  ];

  let breaches = 0;
  for (const row of rows) {
    for (const [field, read] of sourced) {
      const value = read(row);
      if (value === null || value === undefined || value === '') continue;
      if (have.has(`${row.id}::${field}`)) continue;
      breaches += 1;
      console.log(`  GATE FAIL  ${row.name}: ${field} is populated with no provenance row`);
    }
  }

  // VD-18, as a query rather than as a promise in a comment.
  const edgeRows = await db
    .select({ edges: sql<number>`count(*)::int` })
    .from(vendorSubProcessors);
  const edges = edgeRows[0]?.edges ?? 0;
  if (edges > 0) {
    console.log(`  NOTE  ${edges} sub-processor edge(s) exist. The seed writes none; these must come from a probed list.`);
  }

  return breaches;
}

async function main() {
  const problems = validateCatalogueSeed();
  if (problems.length > 0) {
    console.error('The curated core does not validate:');
    problems.forEach((p) => console.error(`  - ${p}`));
    process.exit(1);
  }

  console.log(
    `Curated core: ${CATALOGUE_SEED.length} products across ${catalogueEntityCount()} legal entities.`,
  );

  if (verifyOnly) {
    const breaches = await verifyProvenance();
    console.log(breaches === 0
      ? '\nGate passed: every sourced column has a provenance row behind it.'
      : `\nGate FAILED: ${breaches} populated column(s) with no provenance.`);
    process.exit(breaches === 0 ? 0 : 1);
  }

  // Entities first, so a product's parent id exists before the product is written.
  const ordered = [...CATALOGUE_SEED].sort((a, b) => (a.entity ? 1 : 0) - (b.entity ? 1 : 0));

  const existing = await db
    .select({ id: vendors.id, slug: vendors.slug, name: vendors.name })
    .from(vendors)
    .where(inArray(vendors.slug, CATALOGUE_SEED.map((e) => e.slug)));
  const idBySlug = new Map<string, string>(existing.map((v: any) => [v.slug as string, v.id as string]));

  const outcomes: SeedOutcome[] = [];

  for (const entry of ordered) {
    const website = `https://${entry.domain}`;
    let vendorId = idBySlug.get(entry.slug) ?? null;

    // Tier 1. The register certifies companies, so the question is asked with
    // the entity's name where the product has one — VD-15 in the one place it
    // most obviously matters.
    const parentEntry = entry.entity
      ? CATALOGUE_SEED.find((e) => e.slug === entry.entity)
      : undefined;
    const registryName = parentEntry ? parentEntry.name : entry.name;

    const entries = await loadDpfEntriesFor(db, [{ name: registryName, website }]);
    const match = matchDpfStatus(registryName, website, entries, DEFAULT_DPF_FRAMEWORK);

    // A registrant found by any status supplies the legal name — knowing who
    // they are does not depend on their certification being current. The
    // country only follows from a *live* certification, because that is what
    // the register actually evidences.
    const legalEntityName = match.entry?.organisationName ?? null;
    const headquartersCountry = match.status === 'active' ? 'US' : null;
    // The participant's own record where the register gave us its id, the
    // register's index otherwise. Never null when there is a match: provenance
    // with no URL is the state VD-13 is about.
    const sourceUrl = match.entry ? (match.entry.sourceUrl ?? DPF_PARTICIPANT_URL) : null;

    const columns: Record<string, unknown> = {
      name: entry.name,
      slug: entry.slug,
      website,
      category: entry.category,
      isGlobal: true,
      ...(legalEntityName ? { legalEntityName } : {}),
      ...(headquartersCountry ? { headquartersCountry } : {}),
    };

    if (!dryRun) {
      if (vendorId) {
        await db.update(vendors).set(columns).where(eq(vendors.id, vendorId));
      } else {
        const [row] = await db.insert(vendors).values(columns as any).returning({ id: vendors.id });
        if (!row) throw new Error(`the catalogue refused ${entry.slug}`);
        vendorId = row.id;
        idBySlug.set(entry.slug, vendorId!);
      }

      if (entry.entity) {
        const parentId = idBySlug.get(entry.entity);
        // A missing parent is a bug in the ordering, not a row to write crooked.
        if (!parentId) throw new Error(`parent ${entry.entity} not seeded before ${entry.slug}`);
        await db.update(vendors).set({ parentEntityId: parentId }).where(eq(vendors.id, vendorId!));
      }

      // Provenance, one row per sourced field, replacing rather than appending
      // so a re-run does not grow the table.
      const writes = [
        legalEntityName ? { fieldName: 'legalEntityName', value: legalEntityName } : null,
        headquartersCountry ? { fieldName: 'headquartersCountry', value: headquartersCountry } : null,
      ].filter(Boolean) as Array<{ fieldName: string; value: string }>;

      if (writes.length > 0) {
        await db.delete(vendorFieldProvenance).where(and(
          eq(vendorFieldProvenance.vendorId, vendorId!),
          inArray(vendorFieldProvenance.fieldName, writes.map((w) => w.fieldName)),
        ));
        await db.insert(vendorFieldProvenance).values(writes.map((w) => ({
          vendorId: vendorId!,
          fieldName: w.fieldName,
          value: w.value,
          sourceType: 'registry',
          sourceUrl,
          confidence: REGISTRY_CONFIDENCE,
          evidenceSnippet:
            `US DPF participant list, ${DEFAULT_DPF_FRAMEWORK}: ` +
            `${match.entry?.organisationName ?? registryName} — ${match.status}`,
          retrievedAt: new Date(),
        })));
      }
    }

    outcomes.push({
      slug: entry.slug,
      action: idBySlug.has(entry.slug) && existing.some((v: any) => v.slug === entry.slug) ? 'updated' : 'created',
      entity: entry.entity ?? null,
      legalEntityName,
      headquartersCountry,
      dpfStatus: match.status,
    });
  }

  const matched = outcomes.filter((o) => o.legalEntityName).length;
  const live = outcomes.filter((o) => o.dpfStatus === 'active').length;
  console.log(`\nResolved against the DPF register: ${matched}/${outcomes.length} named, ${live} with a current certification.`);
  console.log('Unmatched rows keep no legal entity name and no country — absent is a tier.\n');

  for (const o of outcomes.filter((x) => !x.legalEntityName).slice(0, 60)) {
    console.log(`  no registry match: ${o.slug}`);
  }

  if (dryRun) {
    console.log('\nDry run — nothing written.');
    return;
  }

  const breaches = await verifyProvenance();
  console.log(breaches === 0
    ? '\nGate passed: every sourced column has a provenance row behind it.'
    : `\nGate FAILED: ${breaches} populated column(s) with no provenance.`);

  // VD-16. The seed moves the catalogue; it does not move a single customer's
  // score, because `organization_vendors.risk_score` is denormalised and written
  // at link time. This is D5 exactly, and the superseded plan reproduced it.
  console.log('\nNext, or none of this reaches a customer:');
  console.log('  npm run recalc:vendor-risk --workspace=apps/api -- --apply');
  console.log('\nThen, to fill the probed fields (Tier 2/3) for these rows:');
  console.log('  the vendor-intelligence enrichment path — nothing here probes anything.');

  await writeSeedSummary(outcomes, breaches);

  if (breaches > 0) process.exit(1);
}

/**
 * Commit what the run actually produced, dated, beside the fixtures.
 *
 * The programme document quotes five numbers from the seed — 82 rows, 52 with a
 * resolved legal entity, 49 certified, 29 resolved to nothing, 101 provenance
 * rows — across five sections, and they are the whole evidence base for its open
 * question about what coverage the product can promise. None of them had an
 * artefact anywhere: they were read off a console once and retyped. That is the
 * standard the same document sets for the DPF feed and meets there, by
 * committing `dpf-registry-2026-08-29.json` so a change shows up as a diff
 * against a response somebody actually received.
 *
 * So the run writes its own summary and the summary is committed. A later seed
 * that resolves forty rows instead of twenty-nine is then a diff rather than a
 * number nobody can check.
 */
async function writeSeedSummary(
  outcomes: Array<{ slug: string; legalEntityName: string | null; dpfStatus: string }>,
  breaches: number,
): Promise<void> {
  const provenanceRows = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(vendorFieldProvenance);
  const edgeRows = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(vendorSubProcessors);

  const summary = {
    generatedAt: new Date().toISOString().slice(0, 10),
    catalogueRows: outcomes.length,
    resolvedToLegalEntity: outcomes.filter((o) => o.legalEntityName).length,
    currentEuUsCertification: outcomes.filter((o) => o.dpfStatus === 'active').length,
    resolvedToNothing: outcomes.filter((o) => !o.legalEntityName).length,
    productsLinkedToParent: CATALOGUE_SEED.filter((e: any) => e.entity).length,
    legalEntities: catalogueEntityCount(),
    provenanceRows: provenanceRows[0]?.n ?? 0,
    // VD-18: edges arrive only from a probed list, never from a seed. Recorded
    // rather than asserted, so "the graph is empty" stays a checkable claim.
    subProcessorEdges: edgeRows[0]?.n ?? 0,
    provenanceGateBreaches: breaches,
    unresolved: outcomes.filter((o) => !o.legalEntityName).map((o) => o.slug).sort(),
  };

  const target = new URL('../lib/fixtures/catalogue-seed-summary.json', import.meta.url);
  await fs.writeFile(target, JSON.stringify(summary, null, 2) + EOL, 'utf8');
  console.log('');
  console.log('Summary written to lib/fixtures/catalogue-seed-summary.json — commit it.');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
