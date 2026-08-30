/**
 * Analyst corrections, and the separate step that lets one reach a customer.
 *
 * Extracted from `routers/vendors.ts` for the reason `vendorCandidateReview.ts`
 * gives: the operator console writes the same shared catalogue as the router and
 * must not carry a second copy of the rule.
 *
 * **The two-step shape is deliberate and is not an oversight.** Writing a
 * correction records what a named person found; folding it into the `vendors`
 * column is what makes the product act on it. Doing both at once would make an
 * override indistinguishable from the thing it overrode, which is the whole
 * reason `vendor_field_provenance` was widened to keep the superseded rows.
 *
 * What *was* an oversight is that the second step did not exist. A correction
 * was visible to anything reading provenance and invisible to everything reading
 * the column — including `calculateVendorRisk` — so a session spent correcting
 * headquarters countries moved no score and changed nothing a customer saw
 * (known-concerns §20). `applyCorrectionToColumn` is that step.
 */
import { eq, and } from 'drizzle-orm';
import { vendors, vendorFieldProvenance } from 'db';
import { fieldConfidence } from './vendorFieldConfidence.js';
import { validateAnalystCorrection } from './vendorProvenance.js';

export class CorrectionError extends Error {
  constructor(
    message: string,
    readonly kind: 'not_found' | 'bad_request',
  ) {
    super(message);
    this.name = 'CorrectionError';
  }
}

/**
 * The catalogue columns an analyst correction may be folded into.
 *
 * An explicit allowlist rather than trusting `fieldName` to name a column: this
 * writes a `vendors` column from a string that arrived over the wire, and an
 * unrecognised name has to be refused rather than interpolated into an update.
 * The set is exactly the sourced columns `check:vendor-provenance` guards —
 * identity (name, slug, website, category) is not correctable this way, because
 * the seed asserts it and a provenance row claiming otherwise would misdescribe
 * where it came from.
 */
export const CORRECTABLE_FIELDS = [
  'legalEntityName',
  'headquartersCountry',
  'transferMechanisms',
  'securityCertifications',
  'dataProcessingLocations',
  'dpaUrl',
  'privacyPolicyUrl',
  'subProcessorListUrl',
] as const;

export type CorrectableField = (typeof CORRECTABLE_FIELDS)[number];

export function isCorrectableField(field: string): field is CorrectableField {
  return (CORRECTABLE_FIELDS as readonly string[]).includes(field);
}

export interface SubmitCorrectionInput {
  db: any;
  vendorId: string;
  fieldName: string;
  value: string | number | boolean | string[];
  sourceUrl: string;
  evidenceSnippet: string;
  reviewBy: string;
  /**
   * Attribution, taken from the session by the router and from
   * `PLATFORM_OPERATOR_USER_ID` by the console — never from caller input. A
   * correction is attributable or it is not a correction, and an attribution the
   * caller supplies is one the caller can forge.
   */
  verifiedBy: string | null;
}

/**
 * Record an analyst finding for one field.
 *
 * One standing analyst row per (vendor, field): a correction replaces the
 * previous correction rather than stacking, so "what does a person say about
 * this field" has one answer. The registry and probe rows it supersedes are
 * untouched and still readable.
 */
export async function submitFieldCorrection(input: SubmitCorrectionInput) {
  const { db: dbInstance } = input;

  const [vendor] = await dbInstance
    .select({ id: vendors.id })
    .from(vendors)
    .where(eq(vendors.id, input.vendorId));
  if (!vendor) throw new CorrectionError('Vendor not found', 'not_found');

  const problems = validateAnalystCorrection({
    fieldName: input.fieldName,
    value: input.value,
    verifiedBy: input.verifiedBy,
    evidenceSnippet: input.evidenceSnippet,
    sourceUrl: input.sourceUrl,
    reviewBy: input.reviewBy,
  });
  if (problems.length > 0) throw new CorrectionError(problems.join('; '), 'bad_request');

  const now = new Date();
  const [row] = await dbInstance
    .insert(vendorFieldProvenance)
    .values({
      vendorId: input.vendorId,
      fieldName: input.fieldName,
      value: input.value,
      sourceType: 'analyst',
      sourceUrl: input.sourceUrl,
      confidence: fieldConfidence({ value: input.value, sourceType: 'analyst' }),
      evidenceSnippet: input.evidenceSnippet,
      retrievedAt: now,
      verifiedBy: input.verifiedBy,
      verifiedAt: now,
      reviewBy: new Date(input.reviewBy),
    })
    .onConflictDoUpdate({
      target: [
        vendorFieldProvenance.vendorId,
        vendorFieldProvenance.fieldName,
        vendorFieldProvenance.sourceType,
      ],
      set: {
        value: input.value,
        sourceUrl: input.sourceUrl,
        evidenceSnippet: input.evidenceSnippet,
        retrievedAt: now,
        verifiedBy: input.verifiedBy,
        verifiedAt: now,
        reviewBy: new Date(input.reviewBy),
      },
    })
    .returning();

  return {
    provenance: row,
    supersedes: 'registry, http_probe and trust_centre rows for this field',
  };
}

export interface ApplyCorrectionInput {
  db: any;
  vendorId: string;
  fieldName: string;
}

/**
 * Fold a standing analyst correction into the catalogue column it corrects.
 *
 * Reads the `analyst` provenance row rather than taking a value from the caller,
 * so the column can only ever be set to something a person already recorded with
 * an author, a source URL, an excerpt and a review date behind it. That is what
 * makes this safe to expose: it is not a write endpoint for arbitrary catalogue
 * values, it is a promotion of a row that already passed
 * `validateAnalystCorrection`.
 *
 * Then re-scores every tenant linked to the vendor, because
 * `organization_vendors.risk_score` is denormalised and a corrected headquarters
 * country changes the location factor for all of them.
 */
export async function applyCorrectionToColumn(input: ApplyCorrectionInput) {
  const { db: dbInstance, vendorId, fieldName } = input;

  if (!isCorrectableField(fieldName)) {
    throw new CorrectionError(`${fieldName} is not a correctable catalogue column`, 'bad_request');
  }

  const [correction] = await dbInstance
    .select()
    .from(vendorFieldProvenance)
    .where(
      and(
        eq(vendorFieldProvenance.vendorId, vendorId),
        eq(vendorFieldProvenance.fieldName, fieldName),
        eq(vendorFieldProvenance.sourceType, 'analyst'),
      ),
    );
  if (!correction) {
    throw new CorrectionError(
      `No analyst correction stands for ${fieldName} on this vendor — record one first`,
      'not_found',
    );
  }

  // The provenance row is not rewritten. It already exists, it already passed
  // validation, and this is a promotion of it rather than a new claim — so
  // `retrieved_at` stays the day the person actually read the document, which is
  // what `provenanceAge` decays from. Stamping it now would restart the clock on
  // evidence nobody re-read.
  return dbInstance.transaction(async (tx: any) => {
    await tx
      .update(vendors)
      .set({ [fieldName]: correction.value } as never)
      .where(eq(vendors.id, vendorId));

    const { recalculateVendorRiskForAllOrgs } = await import('../routers/vendors.js');
    const rescored = await recalculateVendorRiskForAllOrgs(tx, vendorId);
    return { column: fieldName, value: correction.value, rescored: rescored.length };
  });
}
