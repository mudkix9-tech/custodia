/**
 * Lazy seeding and lookup for the two org-level ROPA catalogues.
 *
 * Seeded on first read rather than at signup, because every organisation already in
 * the database predates these tables and a migration that back-filled a taxonomy for
 * tenants who may never open the module is work nobody asked for. The cost is one
 * extra upsert on the first `catalogue.*.list` per organisation; after that the
 * `is_seeded` rows exist and `onConflictDoNothing` makes the call a no-op.
 *
 * `db.query.*` is used for reads so the standalone tests can mock them — a
 * `db.select()` here would escape the mock and open a real connection.
 */

import { and, eq, isNull, asc } from 'drizzle-orm';
import { dataElementCatalogue, dataSubjectCategoryCatalogue } from 'db';
import { SEED_DATA_ELEMENTS, SEED_SUBJECT_CATEGORIES } from '../constants/ropaCatalogueSeeds.js';

type Db = any;

/**
 * Idempotent. The `(organization_id, name)` unique constraint is what makes it so:
 * a customer who renamed "Email address" keeps their name and does not get a second
 * copy, and a customer who deleted an entry they did not want does not get it back
 * on the next call — deletion is an archive, and an archived row still occupies the
 * natural key.
 */
export async function ensureCatalogues(db: Db, orgId: string): Promise<void> {
  const [existingElement, existingSubject] = await Promise.all([
    db.query.dataElementCatalogue.findFirst({
      where: and(eq(dataElementCatalogue.organizationId, orgId), eq(dataElementCatalogue.isSeeded, true)),
      columns: { id: true },
    }),
    db.query.dataSubjectCategoryCatalogue.findFirst({
      where: and(eq(dataSubjectCategoryCatalogue.organizationId, orgId), eq(dataSubjectCategoryCatalogue.isSeeded, true)),
      columns: { id: true },
    }),
  ]);

  if (!existingElement) {
    await db.insert(dataElementCatalogue)
      .values(SEED_DATA_ELEMENTS.map((e) => ({
        organizationId: orgId,
        name: e.name,
        elementGroup: e.elementGroup,
        sensitivity: e.sensitivity,
        isSpecialCategory: e.isSpecialCategory ?? false,
        specialCategoryType: e.specialCategoryType ?? null,
        isCriminalData: e.isCriminalData ?? false,
        identifiability: e.identifiability ?? 'direct',
        format: e.format ?? null,
        example: e.example ?? null,
        isSeeded: true,
      })))
      .onConflictDoNothing();
  }

  if (!existingSubject) {
    await db.insert(dataSubjectCategoryCatalogue)
      .values(SEED_SUBJECT_CATEGORIES.map((c) => ({
        organizationId: orgId,
        name: c.name,
        description: c.description ?? null,
        isChild: c.isChild ?? false,
        isVulnerable: c.isVulnerable ?? false,
        isSeeded: true,
      })))
      .onConflictDoNothing();
  }
}

export async function listElements(db: Db, orgId: string, includeArchived = false) {
  await ensureCatalogues(db, orgId);
  return db.query.dataElementCatalogue.findMany({
    where: includeArchived
      ? eq(dataElementCatalogue.organizationId, orgId)
      : and(eq(dataElementCatalogue.organizationId, orgId), isNull(dataElementCatalogue.archivedAt)),
    orderBy: [asc(dataElementCatalogue.elementGroup), asc(dataElementCatalogue.name)],
  });
}

export async function listSubjectCategories(db: Db, orgId: string, includeArchived = false) {
  await ensureCatalogues(db, orgId);
  return db.query.dataSubjectCategoryCatalogue.findMany({
    where: includeArchived
      ? eq(dataSubjectCategoryCatalogue.organizationId, orgId)
      : and(eq(dataSubjectCategoryCatalogue.organizationId, orgId), isNull(dataSubjectCategoryCatalogue.archivedAt)),
    orderBy: [asc(dataSubjectCategoryCatalogue.name)],
  });
}
