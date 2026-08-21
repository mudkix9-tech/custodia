/**
 * P124. Gap rules for the register, beyond `missing_dpia`.
 *
 * The gap scanner had two ROPA rules — "no lawful basis" and "not updated in a
 * year" — against an Article 30 record with twelve required particulars. A register
 * can therefore be reported as gap-free while recording no retention period, no
 * data subject categories, no recipients and a third-country transfer with no
 * safeguard, which is four findings a supervisory authority would raise on the
 * first page.
 *
 * Every rule here answers a question the completeness scorer already asks
 * (`lib/ropaCompleteness.ts`), and the split between the two is deliberate rather
 * than duplication:
 *
 *   - **The scorer** grades one record while somebody is editing it. It is advisory,
 *     it runs on every keystroke, and its output is a percentage.
 *   - **These rules** find the same problems across the whole register on a
 *     schedule, and their output is a dated, assignable, resolvable gap with a
 *     detection history — which is what "we found it in March and fixed it in
 *     April" needs to be provable.
 *
 * They are kept in their own file rather than appended to `gapRules.ts` because
 * that file is vendor-shaped: every rule in it returns `organization_vendors` rows
 * and links to `/vendors/:id`. Fourteen ROPA rules in the middle of it would be the
 * last place anyone looked for a register finding.
 */

import { db } from '../db.js';
import {
  processingActivities,
  processingDataCategories,
  processingRecipients,
  processingTransfers,
  processingDataSubjects,
  legitimateInterestAssessments,
  organizationVendors,
  vendors,
  retentionSchedules,
  consentRecords,
  consentDomains,
} from 'db';
import { and, eq, isNull, isNotNull, lt, ne, or, sql, inArray } from 'drizzle-orm';

type GapRecord = Record<string, any>;

export type RopaDetectionRule = {
  id: string;
  severity: string;
  gdprArticles: string[];
  detect: (orgId: string) => Promise<GapRecord[]>;
  buildGap: (record: GapRecord) => {
    entityType: string;
    entityId: string;
    gapType: string;
    title: string;
    description: string;
    severity: string;
    gdprArticles?: string[];
    resolutionUrl: string;
  };
};

/**
 * The register minus what should not be scanned.
 *
 * Deleted rows are excluded for the obvious reason. **Archived** rows are excluded
 * for a less obvious one: an archived activity is a record of processing that has
 * stopped, and Art. 30 does not require a stopped activity to have a retention
 * period going forward. Scanning them would fill the queue with findings nobody can
 * act on, because the fix is to un-archive a record that should stay archived.
 *
 * Drafts *are* scanned, and that is a judgement worth stating. A draft is not yet a
 * claim about anything — but a register whose drafts are invisible to the scanner
 * is one where the count of findings drops every time somebody unpublishes rather
 * than fixes. The severity is what carries the difference: a draft's findings are
 * one step lower than the same finding on a published record.
 */
const scannable = () => and(
  isNull(processingActivities.deletedAt),
  or(isNull(processingActivities.status), ne(processingActivities.status, 'archived')),
);

/** Published records answer to a regulator; drafts answer to whoever is writing them. */
const bySeverity = (record: GapRecord, live: string, draft: string) =>
  record.status === 'active' ? live : draft;

const activityColumns = {
  id: processingActivities.id,
  name: processingActivities.name,
  status: processingActivities.status,
  role: processingActivities.role,
  lawfulBasis: processingActivities.lawfulBasis,
  retentionPeriod: processingActivities.retentionPeriod,
  organizationId: processingActivities.organizationId,
};

export const ROPA_DETECTION_RULES: RopaDetectionRule[] = [
  // -------------------------------------------------------------------------
  // Art. 30(1)(f) — retention
  // -------------------------------------------------------------------------
  {
    id: 'ropa_no_retention',
    severity: 'high',
    gdprArticles: ['Article 30(1)(f)', 'Article 5(1)(e)'],
    detect: async (orgId: string) => {
      // The literal 'custom' counts as unset, for the reason the register's own
      // filter gives: the old Custom option wrote it with nowhere to type a period,
      // so a register full of it answers Art. 30(1)(f) with the word "custom".
      return db.select(activityColumns).from(processingActivities).where(and(
        eq(processingActivities.organizationId, orgId),
        scannable(),
        isNull(processingActivities.retentionScheduleId),
        or(
          isNull(processingActivities.retentionPeriod),
          eq(processingActivities.retentionPeriod, ''),
          eq(processingActivities.retentionPeriod, 'custom'),
        ),
        // An activity whose every data category carries its own period has
        // answered the Article at the level it is actually asked at, and flagging
        // it would be telling a careful register to be less precise.
        sql`NOT EXISTS (
          SELECT 1 FROM processing_data_categories pdc
          WHERE pdc.processing_activity_id = ${processingActivities.id}
            AND coalesce(pdc.retention_period, '') NOT IN ('', 'custom')
        )`,
      ));
    },
    buildGap: (record) => ({
      entityType: 'ropa',
      entityId: record.id,
      gapType: 'ropa_no_retention',
      title: `No retention period: ${record.name}`,
      description: 'Article 30(1)(f) requires the envisaged time limits for erasure, and Article 5(1)(e) requires personal data to be kept no longer than necessary. Neither the activity nor any of its data categories records a period.',
      severity: bySeverity(record, 'high', 'medium'),
      resolutionUrl: `/ropa/${record.id}?tab=retention`,
    }),
  },
  {
    id: 'ropa_indefinite_retention_unjustified',
    severity: 'high',
    gdprArticles: ['Article 5(1)(e)'],
    detect: async (orgId: string) => {
      const rows = await db.select({
        id: retentionSchedules.id,
        name: retentionSchedules.name,
        status: retentionSchedules.status,
      }).from(retentionSchedules).where(and(
        eq(retentionSchedules.organizationId, orgId),
        eq(retentionSchedules.periodUnit, 'indefinite'),
        isNull(retentionSchedules.archivedAt),
        or(isNull(retentionSchedules.justification), eq(retentionSchedules.justification, '')),
      ));
      return rows;
    },
    buildGap: (record) => ({
      entityType: 'retention_schedule',
      entityId: record.id,
      gapType: 'ropa_indefinite_retention_unjustified',
      title: `Indefinite retention with no justification: ${record.name}`,
      // Art. 5(1)(e) does not forbid indefinite retention; it forbids undocumented
      // indefinite retention. Stating that distinction in the finding is what stops
      // a customer "fixing" it by inventing a period.
      description: 'This retention schedule keeps personal data indefinitely and records no reason. Storage limitation does not forbid indefinite retention — it requires the controller to be able to demonstrate why the period is no longer than necessary.',
      severity: 'high',
      resolutionUrl: `/ropa/retention/${record.id}`,
    }),
  },
  {
    id: 'ropa_retention_review_overdue',
    severity: 'medium',
    gdprArticles: ['Article 5(1)(e)', 'Article 5(2)'],
    detect: async (orgId: string) => {
      return db.select({
        id: retentionSchedules.id,
        name: retentionSchedules.name,
        nextReviewAt: retentionSchedules.nextReviewAt,
      }).from(retentionSchedules).where(and(
        eq(retentionSchedules.organizationId, orgId),
        eq(retentionSchedules.status, 'active'),
        isNull(retentionSchedules.archivedAt),
        isNotNull(retentionSchedules.nextReviewAt),
        lt(retentionSchedules.nextReviewAt, new Date()),
      ));
    },
    buildGap: (record) => ({
      entityType: 'retention_schedule',
      entityId: record.id,
      gapType: 'ropa_retention_review_overdue',
      title: `Retention schedule overdue for review: ${record.name}`,
      description: 'This schedule passed its own review date. A retention rule that nobody has confirmed is still a rule the organisation is relying on.',
      severity: 'medium',
      resolutionUrl: `/ropa/retention/${record.id}`,
    }),
  },

  // -------------------------------------------------------------------------
  // Art. 30(1)(c) — the two limbs
  // -------------------------------------------------------------------------
  {
    id: 'ropa_no_data_subjects',
    severity: 'high',
    gdprArticles: ['Article 30(1)(c)'],
    detect: async (orgId: string) => {
      return db.select(activityColumns).from(processingActivities).where(and(
        eq(processingActivities.organizationId, orgId),
        scannable(),
        sql`NOT EXISTS (
          SELECT 1 FROM processing_data_subjects pds
          WHERE pds.processing_activity_id = ${processingActivities.id}
        )`,
      ));
    },
    buildGap: (record) => ({
      entityType: 'ropa',
      entityId: record.id,
      gapType: 'ropa_no_data_subjects',
      title: `No categories of data subject: ${record.name}`,
      description: 'Article 30(1)(c) requires the categories of data subject. Without them the record cannot say whose data this is, and a DSAR cannot be scoped against it.',
      severity: bySeverity(record, 'high', 'medium'),
      resolutionUrl: `/ropa/${record.id}?tab=data`,
    }),
  },
  {
    id: 'ropa_no_data_categories',
    severity: 'high',
    gdprArticles: ['Article 30(1)(c)'],
    detect: async (orgId: string) => {
      return db.select(activityColumns).from(processingActivities).where(and(
        eq(processingActivities.organizationId, orgId),
        scannable(),
        sql`NOT EXISTS (
          SELECT 1 FROM processing_data_categories pdc
          WHERE pdc.processing_activity_id = ${processingActivities.id}
        )`,
      ));
    },
    buildGap: (record) => ({
      entityType: 'ropa',
      entityId: record.id,
      gapType: 'ropa_no_data_categories',
      title: `No categories of personal data: ${record.name}`,
      description: 'Article 30(1)(c) requires the categories of personal data. Without them the record describes a purpose and nothing that is being processed for it.',
      severity: bySeverity(record, 'high', 'medium'),
      resolutionUrl: `/ropa/${record.id}?tab=data`,
    }),
  },

  // -------------------------------------------------------------------------
  // Arts. 9 and 10
  // -------------------------------------------------------------------------
  {
    id: 'ropa_special_category_no_condition',
    severity: 'critical',
    gdprArticles: ['Article 9(2)'],
    detect: async (orgId: string) => {
      return db.select({
        id: processingDataCategories.id,
        activityId: processingDataCategories.processingActivityId,
        category: processingDataCategories.category,
        activityName: processingActivities.name,
        status: processingActivities.status,
      })
        .from(processingDataCategories)
        .innerJoin(processingActivities, eq(processingDataCategories.processingActivityId, processingActivities.id))
        .where(and(
          eq(processingActivities.organizationId, orgId),
          scannable(),
          eq(processingDataCategories.isSpecialCategory, true),
          or(
            isNull(processingDataCategories.article9Condition),
            eq(processingDataCategories.article9Condition, ''),
          ),
        ));
    },
    buildGap: (record) => ({
      entityType: 'ropa',
      entityId: record.activityId,
      gapType: 'ropa_special_category_no_condition',
      title: `Special-category data with no Article 9(2) condition: ${record.activityName}`,
      // The prohibition/derogation framing is the point. A record asserting Art. 9
      // processing with no condition documents an engaged prohibition and no route
      // through it, which is the finding an auditor writes up first.
      description: `"${record.category}" is recorded as special-category data. Article 9(1) prohibits processing it unless one of the Article 9(2) conditions applies, and none is recorded — so the register asserts a prohibition is engaged and offers no lawful route through it.`,
      severity: 'critical',
      resolutionUrl: `/ropa/${record.activityId}?tab=data`,
    }),
  },
  {
    id: 'ropa_criminal_data_no_authority',
    severity: 'critical',
    gdprArticles: ['Article 10'],
    detect: async (orgId: string) => {
      return db.select({
        id: processingDataCategories.id,
        activityId: processingDataCategories.processingActivityId,
        category: processingDataCategories.category,
        activityName: processingActivities.name,
        status: processingActivities.status,
      })
        .from(processingDataCategories)
        .innerJoin(processingActivities, eq(processingDataCategories.processingActivityId, processingActivities.id))
        .where(and(
          eq(processingActivities.organizationId, orgId),
          scannable(),
          eq(processingDataCategories.isCriminalData, true),
          or(isNull(processingDataCategories.article10Basis), eq(processingDataCategories.article10Basis, '')),
        ));
    },
    buildGap: (record) => ({
      entityType: 'ropa',
      entityId: record.activityId,
      gapType: 'ropa_criminal_data_no_authority',
      title: `Criminal-offence data with no recorded authority: ${record.activityName}`,
      description: `"${record.category}" is recorded as criminal conviction or offence data. Article 10 requires official authority or a specific Union or Member State authorisation — an Article 9(2) condition does not carry it.`,
      severity: 'critical',
      resolutionUrl: `/ropa/${record.activityId}?tab=data`,
    }),
  },

  // -------------------------------------------------------------------------
  // Art. 6 — the basis and its evidence
  // -------------------------------------------------------------------------
  {
    id: 'ropa_legitimate_interest_no_lia',
    severity: 'high',
    gdprArticles: ['Article 6(1)(f)', 'Article 5(2)'],
    detect: async (orgId: string) => {
      return db.select(activityColumns).from(processingActivities).where(and(
        eq(processingActivities.organizationId, orgId),
        scannable(),
        sql`${processingActivities.lawfulBasis} LIKE 'legitimate_interest%'`,
        sql`NOT EXISTS (
          SELECT 1 FROM legitimate_interest_assessments lia
          WHERE lia.processing_activity_id = ${processingActivities.id}
            AND lia.status <> 'superseded'
        )`,
      ));
    },
    buildGap: (record) => ({
      entityType: 'ropa',
      entityId: record.id,
      gapType: 'ropa_legitimate_interest_no_lia',
      title: `Legitimate interests with no assessment: ${record.name}`,
      description: 'Legitimate interests is the one lawful basis that is a judgement rather than a fact, and Article 5(2) makes the controller responsible for demonstrating that it was made. No legitimate interest assessment exists for this activity.',
      severity: bySeverity(record, 'high', 'medium'),
      resolutionUrl: `/ropa/${record.id}?tab=legal`,
    }),
  },
  {
    id: 'ropa_lia_rejected_basis',
    severity: 'critical',
    gdprArticles: ['Article 6(1)(f)'],
    detect: async (orgId: string) => {
      return db.select({
        id: processingActivities.id,
        name: processingActivities.name,
        status: processingActivities.status,
        liaId: legitimateInterestAssessments.id,
      })
        .from(processingActivities)
        .innerJoin(
          legitimateInterestAssessments,
          eq(legitimateInterestAssessments.processingActivityId, processingActivities.id),
        )
        .where(and(
          eq(processingActivities.organizationId, orgId),
          scannable(),
          sql`${processingActivities.lawfulBasis} LIKE 'legitimate_interest%'`,
          eq(legitimateInterestAssessments.outcome, 'do_not_proceed'),
          ne(legitimateInterestAssessments.status, 'superseded'),
        ));
    },
    buildGap: (record) => ({
      entityType: 'ropa',
      entityId: record.id,
      gapType: 'ropa_lia_rejected_basis',
      title: `The assessment rejected the basis this record relies on: ${record.name}`,
      description: 'The legitimate interest assessment for this activity concluded that the processing should not proceed on that basis, and the register still asserts it. Either the basis is wrong or the assessment is out of date.',
      severity: 'critical',
      resolutionUrl: `/ropa/${record.id}?tab=legal`,
    }),
  },
  {
    id: 'ropa_consent_basis_no_records',
    severity: 'high',
    gdprArticles: ['Article 7(1)'],
    detect: async (orgId: string) => {
      // Art. 7(1) requires the controller to be *able to demonstrate* consent. The
      // rule is deliberately organisation-wide rather than per activity: consent
      // records carry no activity link, so "this activity has no consent records"
      // is not a question the schema can answer, and asking it per activity would
      // report every consent-based activity in an organisation that plainly does
      // collect consent.
      //
      // `consent_records` carries no organization_id — it is scoped through the
      // domain — so the count joins, and a register with no consent domains at all
      // returns zero without touching the records table.
      const [{ value: consentCount } = { value: 0 }] = await db
        .select({ value: sql<number>`count(*)` })
        .from(consentRecords)
        .innerJoin(consentDomains, eq(consentRecords.domainId, consentDomains.id))
        .where(eq(consentDomains.organizationId, orgId));
      if (Number(consentCount ?? 0) > 0) return [];

      return db.select(activityColumns).from(processingActivities).where(and(
        eq(processingActivities.organizationId, orgId),
        scannable(),
        eq(processingActivities.status, 'active'),
        sql`${processingActivities.lawfulBasis} LIKE 'consent%'`,
      ));
    },
    buildGap: (record) => ({
      entityType: 'ropa',
      entityId: record.id,
      gapType: 'ropa_consent_basis_no_records',
      title: `Consent relied on with no consent records: ${record.name}`,
      description: 'This published activity relies on consent, and your organisation holds no consent records at all. Article 7(1) requires the controller to be able to demonstrate that the data subject consented.',
      severity: 'high',
      resolutionUrl: `/ropa/${record.id}?tab=legal`,
    }),
  },

  // -------------------------------------------------------------------------
  // Art. 30(2) — the processor's record
  // -------------------------------------------------------------------------
  {
    id: 'ropa_processor_no_controller',
    severity: 'high',
    gdprArticles: ['Article 30(2)(a)'],
    detect: async (orgId: string) => {
      return db.select(activityColumns).from(processingActivities).where(and(
        eq(processingActivities.organizationId, orgId),
        scannable(),
        eq(processingActivities.role, 'processor'),
        or(isNull(processingActivities.controllerName), eq(processingActivities.controllerName, '')),
      ));
    },
    buildGap: (record) => ({
      entityType: 'ropa',
      entityId: record.id,
      gapType: 'ropa_processor_no_controller',
      title: `Processor record with no controller named: ${record.name}`,
      description: 'Article 30(2)(a) requires a processor’s record to name the controller on whose behalf it acts. Without it this is not an Article 30(2) record.',
      severity: bySeverity(record, 'high', 'medium'),
      resolutionUrl: `/ropa/${record.id}?tab=legal`,
    }),
  },

  // -------------------------------------------------------------------------
  // Art. 30(1)(d) and Art. 28 — recipients
  // -------------------------------------------------------------------------
  {
    id: 'ropa_vendors_without_recipients',
    severity: 'medium',
    gdprArticles: ['Article 30(1)(d)'],
    detect: async (orgId: string) => {
      // The inverse of C34's discovery signal, and both are worth having: discovery
      // asks "which vendors is the register missing", this asks "which activities
      // disclose to no one in an organisation that plainly discloses to someone".
      const [{ value: vendorCount } = { value: 0 }] = await db
        .select({ value: sql<number>`count(*)` })
        .from(organizationVendors)
        .where(eq(organizationVendors.organizationId, orgId));
      if (Number(vendorCount ?? 0) === 0) return [];

      return db.select(activityColumns).from(processingActivities).where(and(
        eq(processingActivities.organizationId, orgId),
        scannable(),
        eq(processingActivities.status, 'active'),
        sql`NOT EXISTS (
          SELECT 1 FROM processing_recipients pr
          WHERE pr.processing_activity_id = ${processingActivities.id}
        )`,
      ));
    },
    buildGap: (record) => ({
      entityType: 'ropa',
      entityId: record.id,
      gapType: 'ropa_vendors_without_recipients',
      title: `Published activity with no recipients recorded: ${record.name}`,
      description: 'This activity is published and names no recipient, while your organisation has vendors linked. Either the activity genuinely discloses to no one — which the register should assert rather than leave blank — or its recipients under Article 30(1)(d) are missing.',
      severity: 'medium',
      resolutionUrl: `/ropa/${record.id}?tab=recipients`,
    }),
  },
  {
    id: 'ropa_recipient_dpa_expired',
    severity: 'high',
    gdprArticles: ['Article 28(3)'],
    detect: async (orgId: string) => {
      return db.select({
        id: processingRecipients.id,
        activityId: processingRecipients.processingActivityId,
        activityName: processingActivities.name,
        status: processingActivities.status,
        recipientName: processingRecipients.name,
        dpaStatus: organizationVendors.dpaStatus,
        dpaExpiresAt: organizationVendors.dpaExpiresAt,
      })
        .from(processingRecipients)
        .innerJoin(processingActivities, eq(processingRecipients.processingActivityId, processingActivities.id))
        .innerJoin(organizationVendors, and(
          eq(organizationVendors.vendorId, processingRecipients.vendorId),
          eq(organizationVendors.organizationId, orgId),
        ))
        .where(and(
          eq(processingActivities.organizationId, orgId),
          scannable(),
          inArray(processingRecipients.role, ['processor', 'sub_processor']),
          or(
            ne(organizationVendors.dpaStatus, 'signed'),
            and(isNotNull(organizationVendors.dpaExpiresAt), lt(organizationVendors.dpaExpiresAt, new Date())),
          ),
        ));
    },
    buildGap: (record) => ({
      entityType: 'ropa',
      entityId: record.activityId,
      gapType: 'ropa_recipient_dpa_expired',
      title: `Processor with no current DPA: ${record.recipientName}`,
      description: `"${record.activityName}" discloses personal data to ${record.recipientName} as a processor, and the data processing agreement is ${record.dpaStatus === 'signed' ? 'expired' : 'not signed'}. Article 28(3) requires processing by a processor to be governed by a contract.`,
      severity: 'high',
      resolutionUrl: `/ropa/${record.activityId}?tab=recipients`,
    }),
  },

  // -------------------------------------------------------------------------
  // Chapter V — transfers
  // -------------------------------------------------------------------------
  {
    id: 'ropa_transfer_no_mechanism',
    severity: 'critical',
    gdprArticles: ['Article 44', 'Article 46'],
    detect: async (orgId: string) => {
      return db.select({
        id: processingTransfers.id,
        activityId: processingTransfers.processingActivityId,
        activityName: processingActivities.name,
        status: processingActivities.status,
        destinationCountry: processingTransfers.destinationCountry,
        transferMechanism: processingTransfers.transferMechanism,
      })
        .from(processingTransfers)
        .innerJoin(processingActivities, eq(processingTransfers.processingActivityId, processingActivities.id))
        .where(and(
          eq(processingActivities.organizationId, orgId),
          scannable(),
          or(
            isNull(processingTransfers.transferMechanism),
            eq(processingTransfers.transferMechanism, ''),
            // The placeholder the vendor auto-create path writes. It reads as a
            // mechanism in the column and is the absence of one.
            eq(processingTransfers.transferMechanism, 'pending_assessment'),
          ),
        ));
    },
    buildGap: (record) => ({
      entityType: 'ropa',
      entityId: record.activityId,
      gapType: 'ropa_transfer_no_mechanism',
      title: `Third-country transfer with no safeguard: ${record.activityName} → ${record.destinationCountry}`,
      description: `Personal data under "${record.activityName}" is transferred to ${record.destinationCountry} and no Chapter V mechanism is recorded. Article 44 permits a transfer only where the conditions of Chapter V are met.`,
      severity: 'critical',
      resolutionUrl: `/ropa/${record.activityId}?tab=transfers`,
    }),
  },
  {
    id: 'ropa_transfer_tia_outstanding',
    severity: 'high',
    gdprArticles: ['Article 46', 'Schrems II'],
    detect: async (orgId: string) => {
      return db.select({
        id: processingTransfers.id,
        activityId: processingTransfers.processingActivityId,
        activityName: processingActivities.name,
        status: processingActivities.status,
        destinationCountry: processingTransfers.destinationCountry,
      })
        .from(processingTransfers)
        .innerJoin(processingActivities, eq(processingTransfers.processingActivityId, processingActivities.id))
        .where(and(
          eq(processingActivities.organizationId, orgId),
          scannable(),
          eq(processingTransfers.tiaRequired, true),
          or(isNull(processingTransfers.tiaCompleted), eq(processingTransfers.tiaCompleted, false)),
        ));
    },
    buildGap: (record) => ({
      entityType: 'ropa',
      entityId: record.activityId,
      gapType: 'ropa_transfer_tia_outstanding',
      title: `Transfer impact assessment outstanding: ${record.activityName} → ${record.destinationCountry}`,
      description: 'This transfer is flagged as needing a transfer impact assessment and none is complete. Schrems II requires the exporter to verify, case by case, whether the destination’s law prevents the safeguard from being effective.',
      severity: 'high',
      resolutionUrl: `/ropa/${record.activityId}?tab=transfers`,
    }),
  },

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------
  {
    id: 'ropa_review_overdue',
    severity: 'medium',
    gdprArticles: ['Article 5(2)', 'Article 30(1)'],
    detect: async (orgId: string) => {
      return db.select({
        ...activityColumns,
        nextReviewAt: processingActivities.nextReviewAt,
      }).from(processingActivities).where(and(
        eq(processingActivities.organizationId, orgId),
        scannable(),
        isNotNull(processingActivities.nextReviewAt),
        lt(processingActivities.nextReviewAt, new Date()),
      ));
    },
    buildGap: (record) => ({
      entityType: 'ropa',
      entityId: record.id,
      gapType: 'ropa_review_overdue',
      title: `Review overdue: ${record.name}`,
      description: 'This activity passed its review date. "When was this last confirmed accurate?" is the first question in an Article 30(4) request and in every ISO 27701 audit.',
      severity: bySeverity(record, 'medium', 'low'),
      resolutionUrl: `/ropa/${record.id}?tab=governance`,
    }),
  },
  {
    id: 'ropa_published_incomplete',
    severity: 'high',
    gdprArticles: ['Article 30(1)'],
    detect: async (orgId: string) => {
      // The denormalised score, which the API keeps in step after every mutation
      // that can move it. Reading it here rather than recomputing means this rule
      // costs one indexed scan instead of five queries per activity.
      return db.select({
        ...activityColumns,
        completenessScore: processingActivities.completenessScore,
        publicationExceptionReason: processingActivities.publicationExceptionReason,
      }).from(processingActivities).where(and(
        eq(processingActivities.organizationId, orgId),
        scannable(),
        eq(processingActivities.status, 'active'),
        lt(processingActivities.completenessScore, 60),
      ));
    },
    buildGap: (record) => ({
      entityType: 'ropa',
      entityId: record.id,
      gapType: 'ropa_published_incomplete',
      title: `Published record is ${record.completenessScore}% complete: ${record.name}`,
      description: record.publicationExceptionReason
        // A recorded exception is accountability evidence, not a defence against
        // the finding — B23's whole design is that it must never be silent.
        ? `This activity was published under a recorded exception and remains substantially incomplete against Article 30(1). The exception given was: "${record.publicationExceptionReason}"`
        : 'This activity is published and answers fewer than 60% of the Article 30(1) particulars the register scores it against.',
      severity: 'high',
      resolutionUrl: `/ropa/${record.id}`,
    }),
  },
];

/** Every gap type this file can produce, so the scanner's resolve pass can be scoped to them. */
export const ROPA_GAP_TYPES: readonly string[] = ROPA_DETECTION_RULES.map((r) => r.id);
