import { 
  pgTable, 
  uuid, 
  varchar, 
  boolean,
  integer,
  bigint,
  timestamp, 
  jsonb,
  text,
  char,
  primaryKey,
  numeric,
  vector,
  index,
  unique,
  date,
  pgEnum,
  real,
  uniqueIndex
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

export const subscriptionTierEnum = pgEnum('subscription_tier', ['starter', 'professional', 'agency', 'enterprise']);

// ============================================================================
// CORE ENTITIES
// ============================================================================

export const organizations = pgTable('organizations', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  legalName: varchar('legal_name', { length: 255 }),
  registrationNumber: varchar('registration_number', { length: 100 }),
  
  countryCode: char('country_code', { length: 2 }).notNull(),
  address: jsonb('address'),
  euRepresentative: jsonb('eu_representative'),
  
  hasDpo: boolean('has_dpo').default(false),
  dpoName: varchar('dpo_name', { length: 255 }),
  dpoEmail: varchar('dpo_email', { length: 255 }),
  dpoIsExternal: boolean('dpo_is_external').default(false),
  
  leadSupervisoryAuthority: varchar('lead_supervisory_authority', { length: 100 }),

  // SSO fields
  ssoEnabled: boolean('sso_enabled').default(false),
  ssoProvider: varchar('sso_provider', { length: 50 }),
  ssoConnectionId: varchar('sso_connection_id', { length: 255 }),
  ssoEnforced: boolean('sso_enforced').default(false),

  // Multi-entity fields
  parentOrganizationId: uuid('parent_organization_id').references((): any => organizations.id), // self-referencing, added in constraints or relations

  dataRegion: varchar('data_region', { length: 50 }).default('eu-west-1'),
  dedicatedDatabaseHost: varchar('dedicated_database_host', { length: 500 }),
  dedicatedDatabaseStatus: varchar('dedicated_database_status', { length: 50 }),
  dedicatedDatabaseProvisionedAt: timestamp('dedicated_database_provisioned_at', { withTimezone: true }),



  
  complianceScore: integer('compliance_score').default(0),
  lastAssessmentAt: timestamp('last_assessment_at', { withTimezone: true }),
  nextReviewDueAt: timestamp('next_review_due_at', { withTimezone: true }),

  // Onboarding
  onboardingCompleted: boolean('onboarding_completed').default(false),
  onboardingDismissed: boolean('onboarding_dismissed').default(false),
  onboardingStep: integer('onboarding_step').default(0),
  onboardingCompletedAt: timestamp('onboarding_completed_at', { withTimezone: true }),

  // Subscription (Paddle)
  stripeCustomerId: varchar('stripe_customer_id', { length: 255 }),
  paddleCustomerId: varchar('paddle_customer_id', { length: 255 }),
  deletionScheduledAt: timestamp('deletion_scheduled_at', { withTimezone: true }),
  paddleSubscriptionId: varchar('paddle_subscription_id', { length: 255 }),
  subscriptionTier: subscriptionTierEnum('subscription_tier').default('professional'),
  subscriptionStatus: varchar('subscription_status', { length: 50 }).default('trialing'),
  trialEndsAt: timestamp('trial_ends_at', { withTimezone: true }),
  
  // AI Rate Limiting
  aiQueriesUsed: integer('ai_queries_used').default(0),
  aiDpasAnalyzed: integer('ai_dpas_analyzed').default(0),
  aiLastResetAt: timestamp('ai_last_reset_at', { withTimezone: true }).defaultNow(),

  settings: jsonb('settings').default({}),
  branding: jsonb('branding').default({}),

  
  // Notifications
  slackWebhookUrl: varchar('slack_webhook_url', { length: 500 }),
  notificationPreferences: jsonb('notification_preferences').default({}),

  // SIEM Settings
  siemEnabled: boolean('siem_enabled').default(false),
  siemEndpointUrl: varchar('siem_endpoint_url', { length: 1024 }),
  siemFormat: varchar('siem_format', { length: 20 }).default('json'),
  // TODO(security): stored in plaintext — needs app-level encryption (KMS/envelope), not yet implemented.
  siemAuthHeader: text('siem_auth_header'),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});


export const customRoles = pgTable('custom_roles', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  permissions: jsonb('permissions').default({}),
  entityScope: varchar('entity_scope', { length: 20 }).default('own'), // 'own' | 'group'
  isDefault: boolean('is_default').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id),
  
  email: varchar('email', { length: 255 }).notNull().unique(),
  emailVerified: timestamp('email_verified', { withTimezone: true }),
  name: varchar('name', { length: 255 }).notNull(),
  avatarUrl: varchar('avatar_url', { length: 500 }),
  image: text('image'),
  
  passwordHash: varchar('password_hash', { length: 255 }),
  authProvider: varchar('auth_provider', { length: 50 }),
  authProviderId: varchar('auth_provider_id', { length: 255 }),
  mfaEnabled: boolean('mfa_enabled').default(false),
  // TODO(security): stored in plaintext — needs app-level encryption (KMS/envelope), not yet implemented.
  mfaSecret: varchar('mfa_secret', { length: 255 }),
  
  customRoleId: uuid('custom_role_id').references(() => customRoles.id, { onDelete: 'set null' }),
  role: varchar('role', { length: 50 }).notNull().default('member'),
  organizationGroupRole: varchar('organization_group_role', { length: 50 }), // e.g. group_admin
  permissions: jsonb('permissions').default([]),
  
  tokenInvalidatedAt: timestamp('token_invalidated_at', { withTimezone: true }),
  marketingConsent: boolean('marketing_consent').default(false),
  
  lastTrainingCompletedAt: timestamp('last_training_completed_at', { withTimezone: true }),
  policyAcknowledgedAt: timestamp('policy_acknowledged_at', { withTimezone: true }),
  
  notificationOverrides: jsonb('notification_overrides').default({}),
  timezone: varchar('timezone', { length: 100 }).default('UTC'),
  language: varchar('language', { length: 10 }).default('en'),
  
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  invitedAt: timestamp('invited_at', { withTimezone: true }),
  invitedBy: uuid('invited_by'),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => {
  return {
    orgIdx: index('idx_users_org').on(table.organizationId),
  };
});

export const documents = pgTable('documents', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  uploaderId: uuid('uploader_id').references(() => users.id),

  filename: varchar('filename', { length: 255 }).notNull(),
  originalName: varchar('original_name', { length: 255 }).notNull(),
  mimeType: varchar('mime_type', { length: 100 }),
  sizeBytes: bigint('size_bytes', { mode: 'number' }),

  s3Key: varchar('s3_key', { length: 500 }).notNull(),
  encryptionKeyId: varchar('encryption_key_id', { length: 255 }),

  status: varchar('status', { length: 50 }).default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => {
  return {
    orgIdx: index('idx_documents_org').on(table.organizationId),
  };
});

// ============================================================================
// CLIENTS
// ============================================================================

export const clients = pgTable('clients', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  
  name: varchar('name', { length: 255 }).notNull(),
  legalName: varchar('legal_name', { length: 255 }),
  contactName: varchar('contact_name', { length: 255 }),
  contactEmail: varchar('contact_email', { length: 255 }),
  countryCode: char('country_code', { length: 2 }),
  industry: varchar('industry', { length: 100 }),
  
  dpaStatus: varchar('dpa_status', { length: 50 }).default('not_started'),
  dpaSignedAt: timestamp('dpa_signed_at', { withTimezone: true }),
  dpaExpiresAt: timestamp('dpa_expires_at', { withTimezone: true }),
  dpaDocumentId: uuid('dpa_document_id'),
  
  portalEnabled: boolean('portal_enabled').default(false),
  // TODO(security): unauthenticated-access token stored in plaintext — should be hashed at rest like apiKeys.keyHash, not yet implemented.
  portalToken: varchar('portal_token', { length: 255 }).unique(),
  
  complianceSummary: jsonb('compliance_summary').default({}),
  notes: text('notes'),

  // -------------------------------------------------------------------------
  // N114. Art. 30(2)(a) requires the processor's record to name "each controller
  // on behalf of which the processor is acting" — and, where applicable, that
  // controller's representative and data protection officer.
  //
  // The agency case is the whole point: forty clients, forty Art. 30(2) records,
  // each of which has to carry *that client's* identity rather than the agency's.
  // `name` and `contactEmail` were all there was, so every processor record the
  // module produced named the agency's own DPO as the controller's.
  // -------------------------------------------------------------------------
  controllerAddress: jsonb('controller_address'),
  controllerRepresentative: jsonb('controller_representative'),
  controllerDpoName: varchar('controller_dpo_name', { length: 255 }),
  controllerDpoEmail: varchar('controller_dpo_email', { length: 255 }),
  // Art. 30(2)(b): "the categories of processing carried out on behalf of each
  // controller". A record-level field, not a per-activity one — it is the
  // relationship that is being described.
  processingCategories: jsonb('processing_categories').$type<string[]>().default([]),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

// ============================================================================
// ROPA (Records of Processing Activities)
// ============================================================================

export const processingActivities = pgTable('processing_activities', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  clientId: uuid('client_id').references(() => clients.id),
  
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  purpose: text('purpose').notNull(),

  // Article 30 splits into (1) for controllers and (2) for processors: the two
  // records answer different questions, and an auditor reads them separately.
  // Defaults to 'controller' — the register predates this column, and every row
  // in it was written on the controller assumption.
  role: varchar('role', { length: 20 }).default('controller').notNull(),
  // Art. 30(1)(a): the controller a processor acts for. Only meaningful when
  // role = 'processor'.
  controllerName: varchar('controller_name', { length: 255 }),

  lawfulBasis: varchar('lawful_basis', { length: 50 }).notNull(),
  lawfulBasisDetail: text('lawful_basis_detail'),
  
  liaId: uuid('lia_id'),
  
  dataSubjectCategories: jsonb('data_subject_categories').notNull().default([]),
  estimatedDataSubjects: varchar('estimated_data_subjects', { length: 50 }),
  
  processingType: jsonb('processing_type').default([]),
  isSystematicMonitoring: boolean('is_systematic_monitoring').default(false),
  involvesSpecialCategories: boolean('involves_special_categories').default(false),
  specialCategories: jsonb('special_categories').default([]),
  involvesChildren: boolean('involves_children').default(false),

  // Art. 22. The flags alone are not the record: 22(3) and Art. 13(2)(f)/14(2)(g)
  // require the *logic involved* and the significance and envisaged consequences to
  // be describable, and 22(3) requires the safeguard — a human who can intervene.
  // A register that says "yes, we profile" and stops there answers none of that.
  involvesProfiling: boolean('involves_profiling').default(false),
  involvesAutomatedDecisionMaking: boolean('involves_automated_decision_making').default(false),
  admLogic: text('adm_logic'),
  admSignificance: text('adm_significance'),
  admHumanIntervention: text('adm_human_intervention'),
  
  retentionPeriod: varchar('retention_period', { length: 100 }),
  retentionJustification: text('retention_justification'),
  retentionReviewDate: timestamp('retention_review_date', { withTimezone: true }),
  deletionProcedure: text('deletion_procedure'),

  // E47/E48. The schedule this activity retains under, and the date its clock runs
  // from. The free-text `retention_period` above stays: attaching a schedule is an
  // upgrade rather than a migration, and the two disagree loudly rather than
  // silently — `retentionAnswer()` prefers the schedule and the register says so.
  //
  // `retentionAnchorAt` is what makes a disposal date computable. A period is
  // meaningless without the event it runs from, and for most activities that event
  // is not the row's creation date — an employment record's clock starts when the
  // employment ends. Null means "the trigger has not happened yet", which is a
  // different statement from "the period has not elapsed" and is why the disposal
  // report can distinguish them.
  retentionScheduleId: uuid('retention_schedule_id'),
  retentionAnchorAt: timestamp('retention_anchor_at', { withTimezone: true }),
  
  securityMeasures: jsonb('security_measures').default([]),
  securityMeasuresDetail: text('security_measures_detail'),
  
  status: varchar('status', { length: 50 }).default('draft'),
  riskLevel: varchar('risk_level', { length: 20 }).default('low'),
  requiresDpia: boolean('requires_dpia').default(false),
  dpiaId: uuid('dpia_id'),
  
  lastReviewedAt: timestamp('last_reviewed_at', { withTimezone: true }),
  nextReviewAt: timestamp('next_review_at', { withTimezone: true }),
  reviewedBy: uuid('reviewed_by').references(() => users.id),

  // B19. The three columns above existed and nothing ever wrote them, because
  // nothing said how often the record was supposed to be looked at. A cadence is
  // what turns "reviewed on the 3rd" into "overdue since the 3rd" — the register
  // cannot have an overdue queue without one. Null means the organisation default
  // (settings.ropaReviewCadenceMonths) applies; 0 means this activity is
  // deliberately exempt, which is a different statement from "nobody decided".
  reviewCadenceMonths: integer('review_cadence_months'),

  // B20. Separate from `status` on purpose. Status is what the record *is* to a
  // reader of the register; approval is what has happened to it internally, and
  // collapsing the two would mean an activity could not be both published and
  // awaiting re-approval — which is the ordinary state of a record someone has
  // just edited.
  approvalState: varchar('approval_state', { length: 20 }).default('draft').notNull(),
  approvalRequestedBy: uuid('approval_requested_by').references(() => users.id),
  approvalRequestedAt: timestamp('approval_requested_at', { withTimezone: true }),
  currentReviewerId: uuid('current_reviewer_id').references(() => users.id),
  approvedBy: uuid('approved_by').references(() => users.id),
  approvedAt: timestamp('approved_at', { withTimezone: true }),

  // B22. Archiving is not deleting and it is not just a status change: a reader
  // needs to know when it happened and who did it, and a restore needs somewhere to
  // put the status back to. Without `statusBeforeArchive` every restored activity
  // comes back as a draft, silently unpublishing a record that was live.
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  archivedBy: uuid('archived_by').references(() => users.id),
  statusBeforeArchive: varchar('status_before_archive', { length: 50 }),

  // B24. Activities come in families — "Recruitment (UK)", "Recruitment (DE)" — and
  // the provenance is worth keeping: it is the first thing someone checks when two
  // records disagree.
  duplicatedFromId: uuid('duplicated_from_id'),

  // K103/L108. A free tag vocabulary, because the axes customers filter on are
  // theirs (system, department, product line) and no enum survives contact with
  // that. A jsonb array of strings, filtered with a containment test.
  tags: jsonb('tags').default([]).notNull(),

  // K103. Denormalised from `scoreActivity`, which is a pure function of the
  // activity and its four child tables. Recomputed by the API after every mutation
  // that can move it (see refreshCompleteness in routers/ropa.ts). It exists so the
  // register can *filter and sort* on completeness: computing it per row at query
  // time means loading every activity's children to answer "show me everything
  // under 50%", which is the one question the score was built to answer.
  completenessScore: integer('completeness_score').default(0).notNull(),

  // Two owners, because they are two different people and the register needs both.
  // The business owner is who actually knows what the activity does; the privacy
  // owner is who answers for it. An unowned activity is the one that goes stale,
  // and there was no way to record either.
  businessOwnerId: uuid('business_owner_id').references(() => users.id),
  privacyOwnerId: uuid('privacy_owner_id').references(() => users.id),

  // The publication gate. 'active' used to be a costume — any activity could wear it
  // with no name, basis, subjects or retention. Now the server refuses, unless an
  // exception is recorded, named and dated: a register that can be forced past its
  // own gate silently is worse than one with no gate.
  publishedAt: timestamp('published_at', { withTimezone: true }),
  publishedBy: uuid('published_by').references(() => users.id),
  publicationExceptionReason: text('publication_exception_reason'),
  publicationExceptionBy: uuid('publication_exception_by').references(() => users.id),
  publicationExceptionAt: timestamp('publication_exception_at', { withTimezone: true }),
  
  version: integer('version').default(1),
  previousVersionId: uuid('previous_version_id'),
  
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  source: varchar('source', { length: 50 }).default('template'),
}, (table) => {
  return {
    orgIdx: index('idx_processing_activities_org').on(table.organizationId),
    // K102/K103 filter and sort inside one organisation on every request, and the
    // register list is the most-hit query in the product. R143 asks for exactly
    // these; they are here because the filters that need them land in this sprint.
    orgStatusIdx: index('idx_processing_activities_org_status').on(table.organizationId, table.status),
    orgUpdatedIdx: index('idx_processing_activities_org_updated').on(table.organizationId, table.updatedAt),
    // B19's overdue queue is `next_review_at < now()` across the whole register.
    orgReviewIdx: index('idx_processing_activities_org_review').on(table.organizationId, table.nextReviewAt),
    deletedIdx: index('idx_processing_activities_deleted').on(table.deletedAt),
  };
});

export const reconsentFlags = pgTable('reconsent_flags', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  processingActivityId: uuid('processing_activity_id').notNull().references(() => processingActivities.id, { onDelete: 'cascade' }),
  reason: text('reason').notNull(),
  confidence: varchar('confidence', { length: 20 }), // 'high', 'medium', 'advisory', 'ambiguous'
  detectedAt: timestamp('detected_at', { withTimezone: true }).defaultNow(),
  status: varchar('status', { length: 50 }).default('flagged'), // 'flagged' | 'dismissed' | 'campaign_launched'
  dismissedBy: uuid('dismissed_by').references(() => users.id),
  dismissedAt: timestamp('dismissed_at', { withTimezone: true }),

  // P125. The generalised evaluation writes a material_change_event and, where the
  // verdict includes re-consent, one of these — so the existing queue keeps working
  // and the two records agree about why. Null on every flag written before Sprint 4.
  materialChangeEventId: uuid('material_change_event_id'),
});

export const clientProcessingActivities = pgTable('client_processing_activities', {
  id: uuid('id').defaultRandom().primaryKey(),
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  processingActivityId: uuid('processing_activity_id').notNull().references(() => processingActivities.id, { onDelete: 'cascade' }),
  
  notes: text('notes'),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => {
  return {
    clientIdx: index('idx_cpa_client').on(table.clientId),
    activityIdx: index('idx_cpa_activity').on(table.processingActivityId),
    unq: unique('client_activity_unq').on(table.clientId, table.processingActivityId),
  };
});

/**
 * F55. The Art. 6(1)(f) three-part test, written down.
 *
 * The table shipped with the schema and nothing ever wrote a row: there was no
 * interface, no link from the activity, and `processing_activities.lia_id` sat
 * empty next to every register entry claiming legitimate interests. That is the
 * one lawful basis that *requires* documented reasoning — Art. 5(2) and the ICO's
 * own guidance both put the burden on the controller — so a register asserting it
 * without an LIA is asserting something it cannot evidence.
 *
 * The five narrative columns were `NOT NULL`, which is why a draft could not be
 * saved: a balancing test is written over a week, not in one sitting, and a form
 * that refuses to keep half an answer is a form people finish in a Word document
 * instead. They are nullable now and the *outcome* is what `status` gates.
 */
export const legitimateInterestAssessments = pgTable('legitimate_interest_assessments', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  processingActivityId: uuid('processing_activity_id').notNull().references(() => processingActivities.id, { onDelete: 'cascade' }),

  // 'draft' | 'completed' | 'superseded'. A completed LIA is one the API has
  // checked has an answer in all three parts and an outcome; nothing else may be
  // completed, because "completed" is what the publication gate reads.
  status: varchar('status', { length: 20 }).default('draft').notNull(),
  title: varchar('title', { length: 255 }),

  purposeTestLegitimateInterest: text('purpose_test_legitimate_interest'),
  purposeTestIsLawful: boolean('purpose_test_is_lawful').default(true),
  purposeTestEvidence: text('purpose_test_evidence'),
  // WP217's third purpose-test limb: whose interest is it, and how substantial.
  // 'controller' | 'third_party' | 'both', and 'compelling' | 'moderate' | 'minor'.
  purposeTestBeneficiary: varchar('purpose_test_beneficiary', { length: 30 }),
  purposeTestImportance: varchar('purpose_test_importance', { length: 30 }),

  necessityTestIsNecessary: text('necessity_test_is_necessary'),
  necessityTestAlternatives: text('necessity_test_alternatives'),
  necessityTestConclusion: text('necessity_test_conclusion'),
  // Art. 5(1)(c). "Could you do this with less data?" is the question that
  // separates necessary from convenient, and it was not being asked.
  necessityTestProportionate: boolean('necessity_test_proportionate'),

  balancingTestImpact: text('balancing_test_impact'),
  balancingTestExpectation: text('balancing_test_expectation'),
  balancingTestSafeguards: text('balancing_test_safeguards'),
  balancingTestOverrides: text('balancing_test_overrides'),
  // The four factors that decide a balancing test in practice, kept as their own
  // columns because "does this involve children?" is a question a reviewer scans
  // for and should not have to read three paragraphs to answer.
  balancingTestInvolvesChildren: boolean('balancing_test_involves_children').default(false),
  balancingTestInvolvesSpecialCategory: boolean('balancing_test_involves_special_category').default(false),
  balancingTestRelationship: text('balancing_test_relationship'),
  // Art. 21(1) is not optional for this basis: the right to object must be
  // offered, and how it is offered is part of the assessment.
  objectionMechanism: text('objection_mechanism'),
  optOutOffered: boolean('opt_out_offered').default(false),

  // 'proceed' | 'proceed_with_safeguards' | 'do_not_proceed'
  outcome: varchar('outcome', { length: 50 }),
  outcomeRationale: text('outcome_rationale'),

  // Supporting material, as [{ name, url, note }]. A DPIA, a consultation
  // response or a signed-off memo is what turns an assessment into evidence.
  evidence: jsonb('evidence').$type<LiaEvidenceRow[]>().default([]).notNull(),

  assessedBy: uuid('assessed_by').references(() => users.id),
  assessedAt: timestamp('assessed_at', { withTimezone: true }).defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  nextReviewAt: timestamp('next_review_at', { withTimezone: true }),
  lastReviewedAt: timestamp('last_reviewed_at', { withTimezone: true }),

  version: integer('version').default(1).notNull(),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  activityIdx: index('idx_lia_activity').on(table.processingActivityId),
  orgIdx: index('idx_lia_org').on(table.organizationId, table.status),
}));

export type LiaEvidenceRow = {
  id: string;
  name: string;
  url?: string | null;
  note?: string | null;
};

// ---------------------------------------------------------------------------
// Register operations — review, approval, versioning, work and discussion.
//
// The register had a lifecycle in name only: `last_reviewed_at`, `next_review_at`,
// `reviewed_by`, `version` and `previous_version_id` were all columns nothing ever
// wrote. These six tables are what those columns were waiting for.
//
// Every one of them is org-scoped in its own right as well as through the activity.
// That is redundant on paper and load-bearing in practice: the tenancy guard reads
// each write statement on its own, and a child table that can only prove itself
// through a join is a child table somebody eventually forgets to join.
// ---------------------------------------------------------------------------

/**
 * B19. "I have read this record and it is accurate as at today" — the act an
 * auditor asks for and the register could not record.
 *
 * Append-only. An attestation is a statement a named person made on a date, so
 * correcting one means making another, and the score and version it was made
 * against are copied in rather than joined: what matters later is what the record
 * looked like when somebody signed it off, not what it looks like now.
 */
export const processingActivityAttestations = pgTable('processing_activity_attestations', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  processingActivityId: uuid('processing_activity_id').notNull().references(() => processingActivities.id, { onDelete: 'cascade' }),

  attestedBy: uuid('attested_by').notNull().references(() => users.id),
  attestedAt: timestamp('attested_at', { withTimezone: true }).defaultNow().notNull(),

  // What was actually asserted. Free text, because "accurate except that the
  // retention period is under review" is a more honest attestation than a tick.
  statement: text('statement'),

  // The state of the record at the moment of signing.
  scoreAtAttestation: integer('score_at_attestation'),
  versionAtAttestation: integer('version_at_attestation'),
  nextReviewAt: timestamp('next_review_at', { withTimezone: true }),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  activityIdx: index('idx_paa_activity').on(table.processingActivityId, table.attestedAt),
  orgIdx: index('idx_paa_org').on(table.organizationId),
}));

/**
 * B20. One row per approval decision — requested, then approved or rejected.
 *
 * The row is created `pending` when review is requested and closed by the decision;
 * nothing deletes or rewrites a closed one. That is what makes it the "immutable
 * approval record" the audit asks for, and it is why the current state also lives
 * on `processing_activities` — reading the register should not mean replaying a log.
 */
export const processingActivityApprovals = pgTable('processing_activity_approvals', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  processingActivityId: uuid('processing_activity_id').notNull().references(() => processingActivities.id, { onDelete: 'cascade' }),

  requestedBy: uuid('requested_by').notNull().references(() => users.id),
  requestedAt: timestamp('requested_at', { withTimezone: true }).defaultNow().notNull(),
  requestNote: text('request_note'),
  reviewerId: uuid('reviewer_id').references(() => users.id),

  // 'pending' | 'approved' | 'rejected' | 'withdrawn'
  decision: varchar('decision', { length: 20 }).default('pending').notNull(),
  decidedBy: uuid('decided_by').references(() => users.id),
  decidedAt: timestamp('decided_at', { withTimezone: true }),
  // Not optional for a rejection: "no" without a reason is not a decision anyone
  // can act on, and the API refuses one.
  decisionReason: text('decision_reason'),

  // The snapshot taken when the decision was made, so "what did I approve?" has an
  // answer that does not depend on nobody having edited the record since.
  versionId: uuid('version_id'),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  activityIdx: index('idx_papr_activity').on(table.processingActivityId, table.requestedAt),
  orgIdx: index('idx_papr_org').on(table.organizationId),
  // The state machine allows exactly one open request per activity. A partial
  // unique index enforces that in the database rather than in whichever procedure
  // happens to run first.
  onePending: uniqueIndex('idx_papr_one_pending').on(table.processingActivityId)
    .where(sql`decision = 'pending'`),
}));

/**
 * B21. A point-in-time copy of the whole record — the activity row and its four
 * child tables — taken when something makes the current state worth keeping.
 *
 * A jsonb snapshot rather than a shadow table per entity, because the thing being
 * preserved is the *document* an approver signed or a regulator was shown. A shadow
 * schema would have to be migrated in step with the live one forever, and the first
 * time it drifted every historic version would silently start reading differently.
 * The cost is that a snapshot is not queryable field by field, which is the right
 * trade: nobody filters the register on what it said in March.
 */
export const processingActivityVersions = pgTable('processing_activity_versions', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  processingActivityId: uuid('processing_activity_id').notNull().references(() => processingActivities.id, { onDelete: 'cascade' }),

  version: integer('version').notNull(),
  // 'approved' | 'published' | 'manual' | 'pre_restore'
  reason: varchar('reason', { length: 30 }).notNull(),
  note: text('note'),

  snapshot: jsonb('snapshot').notNull(),
  // Copied out of the snapshot so the version list renders without parsing every
  // blob.
  score: integer('score'),
  status: varchar('status', { length: 50 }),

  // I90. sha256 over the snapshot in canonical form (lib/contentHash.ts). The
  // register can be *proved* unaltered rather than asserted to be: a regulator
  // holding an exported pack can recompute the digest of what it was given and
  // compare it against what the approval recorded. Nullable because versions
  // taken before 0048 have no hash and inventing one would be worse than saying
  // so.
  contentHash: varchar('content_hash', { length: 64 }),

  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  activityIdx: index('idx_pav_activity').on(table.processingActivityId, table.version),
  orgIdx: index('idx_pav_org').on(table.organizationId),
  // Version numbers are per activity and allocated by the API. The constraint is
  // what makes two concurrent snapshots fail loudly instead of producing two
  // different documents both calling themselves v4.
  unq: unique('processing_activity_versions_activity_version_unq').on(table.processingActivityId, table.version),
}));

/**
 * M110. Work arising from a record, attached to the record.
 *
 * "Complete the retention section" is the sentence a DPO says twenty times a week,
 * and there was nowhere to put it: the notification and queue infrastructure has
 * existed since the DSAR module, and nothing turned a register gap into work.
 * `section` deep-links the assignee to the tab that needs filling in.
 */
export const processingActivityTasks = pgTable('processing_activity_tasks', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  processingActivityId: uuid('processing_activity_id').notNull().references(() => processingActivities.id, { onDelete: 'cascade' }),

  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  // One of the editor's tab ids, so the task can link to the field it is about.
  section: varchar('section', { length: 40 }),

  assigneeId: uuid('assignee_id').references(() => users.id),
  dueDate: timestamp('due_date', { withTimezone: true }),
  // 'open' | 'in_progress' | 'done' | 'cancelled'
  status: varchar('status', { length: 20 }).default('open').notNull(),
  priority: varchar('priority', { length: 20 }).default('normal').notNull(),

  createdBy: uuid('created_by').references(() => users.id),
  completedBy: uuid('completed_by').references(() => users.id),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  // Set once the reminder worker has emailed about this task's due date, so a
  // nightly job does not send the same reminder every night.
  reminderSentAt: timestamp('reminder_sent_at', { withTimezone: true }),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  activityIdx: index('idx_pat_activity').on(table.processingActivityId, table.status),
  assigneeIdx: index('idx_pat_assignee').on(table.assigneeId, table.status),
  orgIdx: index('idx_pat_org').on(table.organizationId),
}));

/**
 * M111. "Why is this retention five years?" — asked where the answer belongs.
 *
 * `field` is nullable: a comment is either about the record or about one field of
 * it, and threading is one level deep (`parentId`), which is what a discussion
 * about a form field actually needs. Soft-deleted rather than removed, because a
 * thread with a hole in it reads as tampering in an audit context.
 */
export const processingActivityComments = pgTable('processing_activity_comments', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  processingActivityId: uuid('processing_activity_id').notNull().references(() => processingActivities.id, { onDelete: 'cascade' }),
  parentId: uuid('parent_id'),

  // A form field name, or null for a comment about the record as a whole.
  field: varchar('field', { length: 80 }),
  body: text('body').notNull(),
  // User ids named in the comment. Stored rather than re-parsed, so that editing
  // the body later cannot retrospectively change who was notified.
  mentions: jsonb('mentions').default([]).notNull(),

  authorId: uuid('author_id').notNull().references(() => users.id),
  resolvedBy: uuid('resolved_by').references(() => users.id),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => ({
  activityIdx: index('idx_pac_activity').on(table.processingActivityId, table.createdAt),
  orgIdx: index('idx_pac_org').on(table.organizationId),
}));

/**
 * K104. A named set of register filters.
 *
 * Shared views are org-wide by design — the point of "Unowned high-risk transfers"
 * is that the whole privacy team looks at the same list. `defaultForRole` is what
 * makes a viewer's register open on something useful without anyone configuring it.
 */
export const ropaSavedViews = pgTable('ropa_saved_views', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),

  name: varchar('name', { length: 120 }).notNull(),
  description: text('description'),
  // The `list` input minus pagination, validated against the same zod schema the
  // procedure uses — so a stored view cannot smuggle in a filter the API rejects.
  filters: jsonb('filters').default({}).notNull(),
  isShared: boolean('is_shared').default(false).notNull(),
  // 'owner' | 'admin' | 'member' | 'viewer', or null for none.
  defaultForRole: varchar('default_for_role', { length: 20 }),

  createdBy: uuid('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  orgIdx: index('idx_rsv_org').on(table.organizationId),
  // One name per author per org: saving "My queue" twice should update the view,
  // not leave two of them in the picker.
  unq: unique('ropa_saved_views_org_author_name_unq').on(table.organizationId, table.createdBy, table.name),
}));

// ---------------------------------------------------------------------------
// Org-level catalogues.
//
// Every activity was recording its data elements and its subject categories as
// free text, so "Email address", "email", "E-mail addr." and "Email Address" were
// four different things and "which activities process health data?" — the question
// a DPO is asked most often — had no answer. These two tables are the shared
// vocabulary the child rows point at.
//
// They are *org-scoped*, unlike `vendors`, which is a shared catalogue: a
// customer's taxonomy is their own, and one tenant renaming an element must not
// rewrite another's register. Seeded rows are marked so a reset can tell what the
// customer added from what shipped with the product.
//
// Child rows keep a denormalised copy of the name (see `processing_data_categories.
// category`), so renaming or archiving a catalogue entry cannot silently rewrite
// what a register said at the time it was published.
// ---------------------------------------------------------------------------

export const dataElementCatalogue = pgTable('data_element_catalogue', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),

  name: varchar('name', { length: 120 }).notNull(),
  // `group` is a reserved word; the column matches `processing_data_categories.category_group`.
  elementGroup: varchar('element_group', { length: 100 }).notNull(),
  description: text('description'),

  // Art. 9(1) is not a synonym for "sensitive". An element can be commercially
  // sensitive (salary, bank details) without being a special category, and treating
  // the two as one field is how a register ends up claiming Art. 9 processing it
  // does not do — or missing the Art. 9 processing it does.
  sensitivity: varchar('sensitivity', { length: 20 }).default('standard').notNull(),
  isSpecialCategory: boolean('is_special_category').default(false).notNull(),
  specialCategoryType: varchar('special_category_type', { length: 50 }),
  isCriminalData: boolean('is_criminal_data').default(false).notNull(),

  // direct | indirect | pseudonymised | anonymous. Recital 26: anonymous data is
  // outside the Regulation entirely, and pseudonymised data is not — which is the
  // distinction a register has to be able to make and could not.
  identifiability: varchar('identifiability', { length: 20 }).default('direct').notNull(),

  format: varchar('format', { length: 50 }),
  example: text('example'),

  isSeeded: boolean('is_seeded').default(false).notNull(),
  archivedAt: timestamp('archived_at', { withTimezone: true }),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => {
  return {
    orgIdx: index('idx_data_element_catalogue_org').on(table.organizationId),
    // The natural key. Seeding is idempotent because of it, and it is what stops
    // an import creating "Email address" a second time.
    unq: unique('data_element_catalogue_org_name_unq').on(table.organizationId, table.name),
  };
});

export const dataSubjectCategoryCatalogue = pgTable('data_subject_category_catalogue', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),

  name: varchar('name', { length: 120 }).notNull(),
  description: text('description'),

  // Art. 8 and Recital 38 for children; Recital 75 for vulnerable subjects. Both
  // feed DPIA screening (Art. 35(3)) rather than being decoration.
  isChild: boolean('is_child').default(false).notNull(),
  isVulnerable: boolean('is_vulnerable').default(false).notNull(),

  isSeeded: boolean('is_seeded').default(false).notNull(),
  archivedAt: timestamp('archived_at', { withTimezone: true }),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => {
  return {
    orgIdx: index('idx_data_subject_category_catalogue_org').on(table.organizationId),
    unq: unique('data_subject_category_catalogue_org_name_unq').on(table.organizationId, table.name),
  };
});

// Art. 30(1)(c), first limb. Until this table the register held the subject
// categories as a jsonb array of strings on the activity, displayed in the list,
// warned about when empty, and editable nowhere in the product — only the
// onboarding templates ever wrote it.
//
// `processing_activities.data_subject_categories` is kept in sync as a flat array
// of the names below, because the CSV export, both PDF templates, the audit pack
// and the embeddings all read it. That mirror is written by the API on every
// mutation here and is derived, never authoritative.
export const processingDataSubjects = pgTable('processing_data_subjects', {
  id: uuid('id').defaultRandom().primaryKey(),
  processingActivityId: uuid('processing_activity_id').notNull().references(() => processingActivities.id, { onDelete: 'cascade' }),
  catalogueId: uuid('catalogue_id').references(() => dataSubjectCategoryCatalogue.id, { onDelete: 'set null' }),

  // Denormalised from the catalogue at the time the link was made.
  category: varchar('category', { length: 120 }).notNull(),
  isChild: boolean('is_child').default(false).notNull(),
  isVulnerable: boolean('is_vulnerable').default(false).notNull(),

  // Art. 35(3)(b)'s "large scale" is a judgement, and a band is what a DPO can
  // actually answer. EDPB WP248 asks for the number of subjects "either as a
  // specific number or as a proportion".
  volumeBand: varchar('volume_band', { length: 30 }),
  jurisdictions: jsonb('jurisdictions').default([]),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => {
  return {
    activityIdx: index('idx_processing_data_subjects_activity').on(table.processingActivityId),
    // One row per category per activity: listing "Employees" twice is a data-entry
    // slip, not a fact about the processing.
    unq: unique('processing_data_subjects_activity_category_unq').on(table.processingActivityId, table.category),
  };
});

export const processingDataCategories = pgTable('processing_data_categories', {
  id: uuid('id').defaultRandom().primaryKey(),
  processingActivityId: uuid('processing_activity_id').notNull().references(() => processingActivities.id, { onDelete: 'cascade' }),
  
  // Denormalised from the catalogue, and still writable free-hand: a register that
  // refuses anything not already in the taxonomy is a register people keep in a
  // spreadsheet instead.
  catalogueId: uuid('catalogue_id').references(() => dataElementCatalogue.id, { onDelete: 'set null' }),
  category: varchar('category', { length: 100 }).notNull(),
  categoryGroup: varchar('category_group', { length: 100 }).notNull(),
  description: text('description'),
  
  source: varchar('source', { length: 100 }),
  sourceDetail: text('source_detail'),
  
  isSpecialCategory: boolean('is_special_category').default(false),

  // Art. 9(2). The boolean says the prohibition in 9(1) is engaged; these say which
  // of the ten conditions lifts it. Without them the register asserts special-category
  // processing and offers no lawful route for it, which is the finding an auditor
  // writes up. 9(2)(b), (h), (i) and (j) additionally require Union or Member State
  // law — hence the citation field, which is not optional for those four.
  specialCategoryType: varchar('special_category_type', { length: 50 }),
  article9Condition: varchar('article_9_condition', { length: 10 }),
  article9NationalLawBasis: text('article_9_national_law_basis'),

  // Art. 10. Criminal convictions and offences are not an Art. 9 category, and
  // conflating the two is the most common mistake in a hand-built register: they
  // need official authority or a specific legal authorisation, not an Art. 9(2)
  // condition.
  isCriminalData: boolean('is_criminal_data').default(false).notNull(),
  article10Basis: text('article_10_basis'),

  identifiability: varchar('identifiability', { length: 20 }),
  necessityJustification: text('necessity_justification'),

  // Art. 30(1)(f) is per category, not per activity. One retention answer for an
  // activity that holds a CV and an audit trail is wrong for at least one of them,
  // and the per-activity dropdown was the only place a period could be recorded.
  retentionPeriod: varchar('retention_period', { length: 100 }),
  retentionTrigger: varchar('retention_trigger', { length: 100 }),
  retentionJustification: text('retention_justification'),

  // E47. The schedule this category retains under, where one applies. Per category
  // rather than only per activity because that is the level Art. 30(1)(f) is
  // actually answered at — a recruitment activity keeps the CV for six months and
  // the equal-opportunities monitoring data for six years, under two different laws.
  retentionScheduleId: uuid('retention_schedule_id'),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const processingRecipients = pgTable('processing_recipients', {
  id: uuid('id').defaultRandom().primaryKey(),
  processingActivityId: uuid('processing_activity_id').notNull().references(() => processingActivities.id, { onDelete: 'cascade' }),
  
  recipientType: varchar('recipient_type', { length: 50 }).notNull(),
  // Art. 30(1)(d) asks for the *categories* of recipient. The named recipient is
  // what a DPO wants and what this table stored; the category is what the Article
  // requires and what a record has to show when the name is commercially
  // confidential or the list is long. Both, not either.
  recipientCategory: varchar('recipient_category', { length: 100 }),
  name: varchar('name', { length: 255 }).notNull(),
  // processor | joint_controller | independent_controller | sub_processor.
  // `recipient_type` says what kind of organisation it is ('vendor', 'other');
  // this says what it is in law, which decides whether Art. 28 applies, whether
  // Art. 26 applies, and whether a disclosure is a transfer of controllership.
  role: varchar('role', { length: 30 }),
  vendorId: uuid('vendor_id'),
  purpose: text('purpose'),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const processingTransfers = pgTable('processing_transfers', {
  id: uuid('id').defaultRandom().primaryKey(),
  processingActivityId: uuid('processing_activity_id').notNull().references(() => processingActivities.id, { onDelete: 'cascade' }),
  
  destinationCountry: char('destination_country', { length: 2 }).notNull(),
  destinationEntity: varchar('destination_entity', { length: 255 }),
  vendorId: uuid('vendor_id'),
  
  transferMechanism: varchar('transfer_mechanism', { length: 100 }).notNull(),
  mechanismDetail: text('mechanism_detail'),

  // Art. 46 and 49 evidence. "SCCs" on its own is not a Chapter V record: the 2010
  // clauses were repealed with effect from 27 December 2022, so the year decides
  // whether the transfer is covered at all, and the module decides which parties'
  // obligations apply (C2C, C2P, P2P, P2C). Annex II is the security schedule an
  // auditor asks to see; without it the clauses are unexecuted.
  sccYear: varchar('scc_year', { length: 10 }),
  sccModule: varchar('scc_module', { length: 20 }),
  annexesComplete: boolean('annexes_complete').default(false),
  executionDate: timestamp('execution_date', { withTimezone: true }),
  expiryDate: timestamp('expiry_date', { withTimezone: true }),
  signatories: text('signatories'),
  documentId: uuid('document_id').references(() => documents.id),

  bcrReference: varchar('bcr_reference', { length: 255 }),
  adequacyDecisionReference: varchar('adequacy_decision_reference', { length: 255 }),

  // Art. 49 is a derogation, not a mechanism, and each sub-paragraph carries its own
  // conditions — (a) explicit informed consent, (b) contract necessity, (g) a public
  // register. Recording "Derogation (Art. 49)" without saying which one, and why,
  // documents nothing.
  article49SubReason: varchar('article_49_sub_reason', { length: 50 }),
  article49Justification: text('article_49_justification'),

  // The Data Privacy Framework covers only *certified* entities, and only within the
  // scope they certified for — an HR-data transfer to an importer certified for
  // non-HR data alone has no mechanism. Certification lapses annually, which is why
  // the expiry is a column and not a note.
  dpfCertificationNumber: varchar('dpf_certification_number', { length: 100 }),
  dpfScope: varchar('dpf_scope', { length: 20 }),
  dpfExpiryDate: timestamp('dpf_expiry_date', { withTimezone: true }),
  
  tiaRequired: boolean('tia_required').default(false),
  tiaCompleted: boolean('tia_completed').default(false),
  tiaRiskLevel: varchar('tia_risk_level', { length: 20 }),
  tiaDocumentId: uuid('tia_document_id').references(() => documents.id),
  
  supplementaryMeasures: jsonb('supplementary_measures').default([]),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// ============================================================================
// DPIA (Data Protection Impact Assessment)
// ============================================================================

/**
 * F56. The Art. 35(1) question, asked and answered on the record.
 *
 * A DPIA is either required or it is not, and the Regulation puts the burden of
 * *showing which* on the controller — the EDPB is explicit that where the nine
 * criteria are considered and a DPIA is judged unnecessary, the reasoning must be
 * documented (WP248 rev.01). The register had `requires_dpia`, a boolean flipped
 * by a special-category checkbox, and no record of anybody deciding anything.
 *
 * A new screening supersedes rather than overwrites, because "we screened this in
 * March and it did not need one" is the statement being preserved, and it stops
 * being true when the processing changes.
 */
export const dpiaScreenings = pgTable('dpia_screenings', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  processingActivityId: uuid('processing_activity_id').notNull().references(() => processingActivities.id, { onDelete: 'cascade' }),

  // { [criterionId]: true | false }. An unanswered criterion is simply absent,
  // which is a different statement from "no" and is scored as such.
  answers: jsonb('answers').$type<Record<string, boolean>>().default({}).notNull(),
  // The criterion ids that came back true, denormalised so the list renders and
  // the PDF prints without re-deriving the verdict.
  criteriaMet: jsonb('criteria_met').$type<string[]>().default([]).notNull(),
  // Entries from the national Art. 35(4) blacklists that matched.
  blacklistMatches: jsonb('blacklist_matches').$type<string[]>().default([]).notNull(),

  // 'required' | 'recommended' | 'not_required' — what the criteria say.
  verdict: varchar('verdict', { length: 20 }),
  // What the organisation decided, where it differs. An override is allowed —
  // Art. 35(3) is a non-exhaustive list and a controller may reasonably conclude
  // either way — but it is never allowed to be silent.
  decision: varchar('decision', { length: 20 }),
  // Required by the API whenever `decision` is set. This is the column the whole
  // table exists for: a "no DPIA required" with no rationale is the finding.
  rationale: text('rationale'),

  // Which national supervisory authority's list was applied, so a screening done
  // under the Irish list is not silently reread as a German one.
  jurisdiction: char('jurisdiction', { length: 2 }),

  // Set once a DPIA has been opened from this screening.
  dpiaId: uuid('dpia_id'),

  // 'open' | 'decided' | 'superseded'
  status: varchar('status', { length: 20 }).default('open').notNull(),
  supersededById: uuid('superseded_by_id'),

  screenedBy: uuid('screened_by').references(() => users.id),
  screenedAt: timestamp('screened_at', { withTimezone: true }),
  nextReviewAt: timestamp('next_review_at', { withTimezone: true }),

  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  activityIdx: index('idx_dpia_screenings_activity').on(table.processingActivityId, table.createdAt),
  orgIdx: index('idx_dpia_screenings_org').on(table.organizationId, table.status),
}));

export const dpias = pgTable('dpias', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),

  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  processingActivityIds: jsonb('processing_activity_ids').default([]),

  processingDescription: text('processing_description'),
  necessityAssessment: text('necessity_assessment'),
  proportionalityAssessment: text('proportionality_assessment'),

  overallRiskLevel: varchar('overall_risk_level', { length: 20 }),
  residualRiskLevel: varchar('residual_risk_level', { length: 20 }),
  requiresPriorConsultation: boolean('requires_prior_consultation').default(false),

  status: varchar('status', { length: 50 }).default('draft'),
  version: integer('version').default(1),

  approvedBy: uuid('approved_by').references(() => users.id),
  approvedAt: timestamp('approved_at', { withTimezone: true }),

  lastReviewedAt: timestamp('last_reviewed_at', { withTimezone: true }),
  nextReviewAt: timestamp('next_review_at', { withTimezone: true }),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  residualRisks: jsonb('residual_risks').$type<DpiaResidualRiskRow[]>().default([]),
  lastMitigationReminderSentAt: timestamp('last_mitigation_reminder_sent_at', { withTimezone: true }),

  // -------------------------------------------------------------------------
  // F57. What Art. 35(7) actually asks for, and what Art. 35(2) and (9) add.
  //
  // The table held (b) and (c) and nothing else. A DPIA without the systematic
  // description in 35(7)(a), the DPO advice required by 35(2), and either a
  // record of consulting data subjects or a reason for not doing so under 35(9)
  // is not a DPIA a supervisory authority would accept — it is a risk register
  // with a title.
  // -------------------------------------------------------------------------

  // 35(7)(a): the nature, scope, context and purposes, and — where the basis is
  // legitimate interests — the interest pursued.
  purposes: text('purposes'),
  scopeDescription: text('scope_description'),
  contextDescription: text('context_description'),
  legitimateInterestPursued: text('legitimate_interest_pursued'),
  dataFlowDescription: text('data_flow_description'),

  // 35(2). The DPO advice, and — because the controller is the one who decides —
  // whether it was followed, with a reason where it was not.
  dpoConsulted: boolean('dpo_consulted').default(false),
  dpoOpinion: text('dpo_opinion'),
  // 'approve' | 'approve_with_conditions' | 'object'
  dpoOpinionOutcome: varchar('dpo_opinion_outcome', { length: 30 }),
  dpoOpinionBy: uuid('dpo_opinion_by').references(() => users.id),
  dpoOpinionAt: timestamp('dpo_opinion_at', { withTimezone: true }),
  dpoAdviceFollowed: boolean('dpo_advice_followed'),
  dpoAdviceDepartureReason: text('dpo_advice_departure_reason'),

  // 35(9). "Where appropriate, the controller shall seek the views of data
  // subjects." Not seeking them is a legitimate answer; not recording that you
  // considered it is not.
  consultationSought: boolean('consultation_sought').default(false),
  consultationMethod: varchar('consultation_method', { length: 60 }),
  consultationSummary: text('consultation_summary'),
  consultationNotSoughtReason: text('consultation_not_sought_reason'),
  consultationAt: timestamp('consultation_at', { withTimezone: true }),

  // Sign-off. Separate from `approved_by` on purpose: that column records the
  // internal approval workflow, this one records the controller decision about
  // whether the processing may proceed and on what conditions.
  // 'proceed' | 'proceed_with_conditions' | 'do_not_proceed'
  signOffDecision: varchar('sign_off_decision', { length: 30 }),
  signOffConditions: text('sign_off_conditions'),
  signedOffBy: uuid('signed_off_by').references(() => users.id),
  signedOffAt: timestamp('signed_off_at', { withTimezone: true }),

  // Art. 36. Where the residual risk stays high, the authority has to be asked
  // before processing starts, and the reference it gives back is the evidence.
  priorConsultationStatus: varchar('prior_consultation_status', { length: 30 }),
  priorConsultationAuthority: varchar('prior_consultation_authority', { length: 120 }),
  priorConsultationSubmittedAt: timestamp('prior_consultation_submitted_at', { withTimezone: true }),
  priorConsultationReference: varchar('prior_consultation_reference', { length: 120 }),
  priorConsultationResponse: text('prior_consultation_response'),
  priorConsultationRespondedAt: timestamp('prior_consultation_responded_at', { withTimezone: true }),

  // Which built-in template this was started from (lib/dpiaTemplates.ts), so a
  // reader can tell a tailored CCTV assessment from a blank one.
  templateId: varchar('template_id', { length: 60 }),
  screeningId: uuid('screening_id'),

  ownerId: uuid('owner_id').references(() => users.id),
  reviewCadenceMonths: integer('review_cadence_months'),

  createdBy: uuid('created_by').references(() => users.id),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => ({
  orgIdx: index('idx_dpias_org').on(table.organizationId, table.status),
  reviewIdx: index('idx_dpias_review').on(table.organizationId, table.nextReviewAt),
}));

/**
 * F57. The same jsonb-snapshot bargain `processing_activity_versions` makes, for
 * the same reason: what a sign-off signed is a document, and a shadow schema per
 * entity drifts. A DPIA is versioned on sign-off and on request.
 */
export const dpiaVersions = pgTable('dpia_versions', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  dpiaId: uuid('dpia_id').notNull().references(() => dpias.id, { onDelete: 'cascade' }),

  version: integer('version').notNull(),
  // 'signed_off' | 'manual' | 'reviewed'
  reason: varchar('reason', { length: 30 }).notNull(),
  note: text('note'),

  snapshot: jsonb('snapshot').notNull(),
  // I90's hash, applied here too: a sign-off nobody can prove was not edited
  // afterwards is not a sign-off.
  contentHash: varchar('content_hash', { length: 64 }),
  status: varchar('status', { length: 50 }),
  residualRiskLevel: varchar('residual_risk_level', { length: 20 }),

  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  dpiaIdx: index('idx_dpia_versions_dpia').on(table.dpiaId, table.version),
  orgIdx: index('idx_dpia_versions_org').on(table.organizationId),
  unq: unique('dpia_versions_dpia_version_unq').on(table.dpiaId, table.version),
}));


/**
 * Shapes stored in jsonb columns.
 *
 * A bare `jsonb()` infers `unknown`, which cannot be indexed, iterated or passed
 * anywhere — so every consumer reached for a cast and the contents went
 * unchecked. `$type` is TS-only metadata and emits no SQL, so adding it is not a
 * schema change and `check:schema` stays clean.
 */
export type DpiaResidualRiskRow = {
  id: string;
  description: string;
  riskCategory: 'confidentiality' | 'integrity' | 'availability' | 'unlawful_processing' | 'discrimination' | 'other';
  likelihood: 'low' | 'medium' | 'high';
  severity: 'low' | 'medium' | 'high';
  residualRiskLevel: 'low' | 'medium' | 'high' | 'critical';
  relatedVendorId?: string | null;
  relatedProcessingActivityId?: string | null;
  mitigationRequired: boolean;
  mitigationDescription?: string | null;
  mitigationOwner?: string | null;
  mitigationDueDate?: string | null;
  mitigationStatus: 'not_started' | 'in_progress' | 'completed';
  prePopulatedType?: 'missing_dpa' | 'clause_gaps' | 'missing_certs' | 'high_risk_flag' | null;
  alreadyReflectedInBaseScore?: boolean | null;
};

export type AssessmentTemplateQuestion = {
  id: string;
  text: string;
  category?: string;
  type?: 'choice' | 'text';
  options?: Array<{ text: string; score: number }>;
};

export type VendorQuestionnaireQuestion = {
  id: string;
  text: string;
  category: string;
  rationale: string;
};

export type VendorQuestionnaireAnswer = {
  questionId: string;
  textAnswer: string;
};

/**
 * F57. A risk in an Art. 35(7)(c) sense, which is a risk *to the data subject* —
 * not to the business.
 *
 * `likelihood` and `severity` were integers with no scale attached and no residual
 * pair, so a matrix could not be drawn: there was one score before mitigation and
 * one after, and nothing said what either meant. The new columns are the four
 * corners of the matrix plus the two things that make a risk actionable — who it
 * happens to, and where it comes from.
 */
export const dpiaRisks = pgTable('dpia_risks', {
  id: uuid('id').defaultRandom().primaryKey(),
  dpiaId: uuid('dpia_id').notNull().references(() => dpias.id, { onDelete: 'cascade' }),

  description: text('description').notNull(),
  likelihood: integer('likelihood'),
  severity: integer('severity'),
  initialRiskScore: integer('initial_risk_score'),
  residualRiskScore: integer('residual_risk_score'),

  // The other half of the matrix. Without these, "residual_risk_score" is a number
  // somebody typed rather than a position the measures moved the risk to.
  residualLikelihood: integer('residual_likelihood'),
  residualSeverity: integer('residual_severity'),

  // 'illegitimate_access' | 'unwanted_modification' | 'disappearance' are the CNIL
  // triad; the rest cover the harms Recital 75 names. Free-form would have made
  // "which risks recur across our register?" unanswerable again.
  riskCategory: varchar('risk_category', { length: 40 }),
  // Recital 75's harms, as [{ type }] — discrimination, identity theft, financial
  // loss, reputational damage, loss of confidentiality, de-pseudonymisation.
  harms: jsonb('harms').$type<string[]>().default([]).notNull(),
  affectedSubjects: text('affected_subjects'),
  sourceOfRisk: text('source_of_risk'),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  dpiaIdx: index('idx_dpia_risks_dpia').on(table.dpiaId),
}));

export const dpiaMeasures = pgTable('dpia_measures', {
  id: uuid('id').defaultRandom().primaryKey(),
  dpiaRiskId: uuid('dpia_risk_id').notNull().references(() => dpiaRisks.id, { onDelete: 'cascade' }),

  description: text('description').notNull(),
  status: varchar('status', { length: 50 }).default('planned'),
  implementedAt: timestamp('implemented_at', { withTimezone: true }),

  // Art. 35(7)(d) asks for the measures "envisaged to address the risks",
  // which means measures somebody has agreed to deliver by a date. A row with
  // neither is a sentence, and the DPIA gets signed off on the strength of it.
  measureType: varchar('measure_type', { length: 30 }),
  ownerId: uuid('owner_id').references(() => users.id),
  dueDate: timestamp('due_date', { withTimezone: true }),
  effectiveness: varchar('effectiveness', { length: 20 }),
  evidence: text('evidence'),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  riskIdx: index('idx_dpia_measures_risk').on(table.dpiaRiskId),
}));

// ============================================================================
// VENDORS
// ============================================================================

export const vendors = pgTable('vendors', {
  id: uuid('id').defaultRandom().primaryKey(),
  isGlobal: boolean('is_global').default(false),
  organizationId: uuid('organization_id').references(() => organizations.id),
  
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 100 }),
  website: varchar('website', { length: 500 }),
  logoUrl: varchar('logo_url', { length: 500 }),
  description: text('description'),
  category: varchar('category', { length: 100 }),
  dsarSearchInstructions: text('dsar_search_instructions'),
  suggestedForIndustries: jsonb('suggested_for_industries').default([]),
  
  headquartersCountry: char('headquarters_country', { length: 2 }),
  dataProcessingLocations: jsonb('data_processing_locations').default([]),
  dpaUrl: varchar('dpa_url', { length: 500 }),
  dpaAvailable: boolean('dpa_available').default(false),
  privacyPolicyUrl: varchar('privacy_policy_url', { length: 500 }),
  
  transferMechanisms: jsonb('transfer_mechanisms').$type<string[]>().default([]),
  euHostingAvailable: boolean('eu_hosting_available').default(false),
  euHostingDetail: text('eu_hosting_detail'),
  
  securityCertifications: jsonb('security_certifications').$type<string[]>().default([]),
  encryptionAtRest: boolean('encryption_at_rest'),
  encryptionInTransit: boolean('encryption_in_transit'),
  
  subProcessorListUrl: varchar('sub_processor_list_url', { length: 500 }),
  subProcessorNotification: varchar('sub_processor_notification', { length: 100 }),
  subProcessorListHash: text('sub_processor_list_hash'),
  subProcessorListSnapshot: text('sub_processor_list_snapshot'),
  aliases: text('aliases').array().default(sql`ARRAY[]::text[]`),
  
  typicalDataCategories: jsonb('typical_data_categories').default([]),
  
  riskScore: integer('risk_score'),
  riskLevel: varchar('risk_level', { length: 20 }),
  riskFactors: jsonb('risk_factors').default([]),
  
  knownIncidents: jsonb('known_incidents').$type<Array<{ date: string; description?: string }>>().default([]),
  regulatoryActions: jsonb('regulatory_actions').default([]),
  
  lastVerifiedAt: timestamp('last_verified_at', { withTimezone: true }),
  verifiedBy: varchar('verified_by', { length: 100 }),
  isPrivacyFriendly: boolean('is_privacy_friendly').default(false).notNull(),
  isAutoDiscovered: boolean('is_auto_discovered').default(false).notNull(),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const organizationVendors = pgTable('organization_vendors', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  vendorId: uuid('vendor_id').notNull().references(() => vendors.id),
  
  status: varchar('status', { length: 50 }).default('active'),
  addedBy: uuid('added_by').references(() => users.id),
  
  dpaStatus: varchar('dpa_status', { length: 50 }).default('not_started'),
  dpaSignedAt: timestamp('dpa_signed_at', { withTimezone: true }),
  dpaExpiresAt: timestamp('dpa_expires_at', { withTimezone: true }),
  dpaDocumentId: uuid('dpa_document_id'),
  dpaNotes: text('dpa_notes'),
  
  tiaRequired: boolean('tia_required').default(false),
  tiaCompleted: boolean('tia_completed').default(false),
  tiaDocumentId: uuid('tia_document_id'),
  
  dataCategoriesShared: jsonb('data_categories_shared').$type<string[]>().default([]),
  processingActivities: jsonb('processing_activities').default([]),
  purpose: text('purpose'),
  usingEuHosting: boolean('using_eu_hosting').default(false),
  // The safeguard THIS organisation relies on, which is not always the one the
  // shared catalogue records: an org may have signed its own SCCs, or know of a
  // DPF certification the catalogue has not caught up with. `lib/vendorRisk.ts`
  // and the third-country gap rule have unioned this with `vendors.transfer_mechanisms`
  // since they were written -- against a column that did not exist, so the org
  // half was always empty and an org that had closed its Art. 44 gap still saw
  // it reported (audit D26).
  transferMechanisms: jsonb('transfer_mechanisms').$type<string[]>().default([]),
  
  riskScore: integer('risk_score').default(0).notNull(),
  riskLevel: varchar('risk_level', { length: 20 }),
  riskFactors: jsonb('risk_factors').default({}),
  lastRiskAssessment: timestamp('last_risk_assessment', { withTimezone: true }),
  certifications: text('certifications').array().default(sql`ARRAY[]::text[]`),
  contractRenewalDate: date('contract_renewal_date'),
  dataSubjectVolume: varchar('data_subject_volume', { length: 50 }).default('<1K'), // '<1K' | '1K-10K' | '10K-100K' | '100K+'
  dpaClauseCoverage: jsonb('dpa_clause_coverage').default({}),
  lastExpiryNotificationTier: varchar('last_expiry_notification_tier', { length: 50 }),
  lastRenewalNotificationTier: varchar('last_renewal_notification_tier', { length: 50 }),
  dpaAnalysisStatus: varchar('dpa_analysis_status', { length: 50 }).default('not_analyzed').notNull(),
  dpaAiAnalysis: jsonb('dpa_ai_analysis').default({}),
  
  // -------------------------------------------------------------------------
  // D32. The register could say a vendor exists and nothing about the
  // relationship: who owns it, who to chase, how much it matters, what role the
  // vendor plays. Art. 30(1)(d) asks the last question and the DPO asks the rest.
  //
  // `processing_role` is the Art. 28 distinction — processor, joint controller
  // (Art. 26), or independent controller — because obligations follow it: only a
  // processor signs the clause checklist, and a joint controller needs an
  // arrangement that no DPA template supplies.
  // -------------------------------------------------------------------------
  businessOwner: varchar('business_owner', { length: 255 }),
  contactEmail: varchar('contact_email', { length: 255 }),
  criticality: varchar('criticality', { length: 20 }), // 'low' | 'medium' | 'high' | 'critical'
  processingRole: varchar('processing_role', { length: 30 }), // 'processor' | 'joint_controller' | 'independent_controller'

  // -------------------------------------------------------------------------
  // D30. Offboarding. A register that can only grow stops being evidence the
  // moment the first contract ends: Art. 28(3)(g) is about what happens at the
  // end of processing, and "end of processing" had no representation here.
  // `offboarded_at` ends the relationship; `deletion_certificate_ref` records
  // the Art. 28(3)(g) assurance that the data came back or was deleted.
  // -------------------------------------------------------------------------
  offboardedAt: timestamp('offboarded_at', { withTimezone: true }),
  deletionCertificateRef: varchar('deletion_certificate_ref', { length: 255 }),

  lastReviewedAt: timestamp('last_reviewed_at', { withTimezone: true }),
  nextReviewAt: timestamp('next_review_at', { withTimezone: true }),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => {
  return {
    orgVendorUnq: unique('organization_vendors_org_vendor_unq').on(table.organizationId, table.vendorId),
    vendorIdx: index('idx_ov_vendor').on(table.vendorId),
  };
});

export const vendorDiscoveries = pgTable('vendor_discoveries', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  discoveryMethod: varchar('discovery_method', { length: 50 }).notNull(), // 'website_scan' | 'dns_analysis'
  detectedDomain: varchar('detected_domain', { length: 255 }).notNull(),
  matchedVendorId: uuid('matched_vendor_id').references(() => vendors.id, { onDelete: 'set null' }),
  detectedServiceName: varchar('detected_service_name', { length: 255 }),
  firstDetectedAt: timestamp('first_detected_at', { withTimezone: true }).defaultNow(),
  lastDetectedAt: timestamp('last_detected_at', { withTimezone: true }).defaultNow(),
  status: varchar('status', { length: 50 }).default('undocumented').notNull(), // 'undocumented' | 'added_to_register' | 'dismissed' | 'false_positive'
  resolvedBy: uuid('resolved_by').references(() => users.id, { onDelete: 'set null' }),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
});

export const vendorDiscoveriesRelations = relations(vendorDiscoveries, ({ one }) => ({
  organization: one(organizations, {
    fields: [vendorDiscoveries.organizationId],
    references: [organizations.id],
  }),
  matchedVendor: one(vendors, {
    fields: [vendorDiscoveries.matchedVendorId],
    references: [vendors.id],
  }),
  resolvedByUser: one(users, {
    fields: [vendorDiscoveries.resolvedBy],
    references: [users.id],
  }),
}));

export const vendorAssessmentTemplates = pgTable('vendor_assessment_templates', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }), // null = system template
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  questions: jsonb('questions').$type<AssessmentTemplateQuestion[]>().notNull(),
  isDefault: boolean('is_default').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const vendorAssessmentTemplatesRelations = relations(vendorAssessmentTemplates, ({ one }) => ({
  organization: one(organizations, {
    fields: [vendorAssessmentTemplates.organizationId],
    references: [organizations.id],
  }),
}));

export const vendorAssessments = pgTable('vendor_assessments', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  vendorId: uuid('vendor_id').notNull().references(() => organizationVendors.id, { onDelete: 'cascade' }),
  templateId: uuid('template_id').notNull().references(() => vendorAssessmentTemplates.id),
  status: varchar('status', { length: 50 }).default('draft').notNull(), // 'draft' | 'sent' | 'in_progress' | 'completed' | 'expired'
  sentAt: timestamp('sent_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  recipientEmail: varchar('recipient_email', { length: 255 }).notNull(),
  recipientName: varchar('recipient_name', { length: 255 }),
  // TODO(security): unauthenticated-access token stored in plaintext — should be hashed at rest like apiKeys.keyHash, not yet implemented.
  accessToken: varchar('access_token', { length: 255 }).notNull().unique(), // for unauthenticated vendor access
  questionsSnapshot: jsonb('questions_snapshot').notNull(), // snapshot of template questions at send time
  responses: jsonb('responses').default({}).notNull(),
  score: integer('score'), // 0-100 base score
  aiSummary: text('ai_summary'),
  scoreAdjustment: integer('score_adjustment').default(0).notNull(), // bounded modifier (e.g. 0 to -20)
  reviewedBy: uuid('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  reminderCount: integer('reminder_count').default(0).notNull(), // idempotency reminder counter
  lastReminderSentAt: timestamp('last_reminder_sent_at', { withTimezone: true }),
  respondentEmail: varchar('respondent_email', { length: 255 }),
  respondentIp: varchar('respondent_ip', { length: 45 }), // captured under legitimate interest audit trail
  submissionLocked: boolean('submission_locked').default(false).notNull(),
});

export const vendorAssessmentsRelations = relations(vendorAssessments, ({ one }) => ({
  organization: one(organizations, {
    fields: [vendorAssessments.organizationId],
    references: [organizations.id],
  }),
  orgVendor: one(organizationVendors, {
    fields: [vendorAssessments.vendorId],
    references: [organizationVendors.id],
  }),
  template: one(vendorAssessmentTemplates, {
    fields: [vendorAssessments.templateId],
    references: [vendorAssessmentTemplates.id],
  }),
  reviewer: one(users, {
    fields: [vendorAssessments.reviewedBy],
    references: [users.id],
  }),
}));

export const vendorSubProcessors = pgTable('vendor_sub_processors', {
  id: uuid('id').defaultRandom().primaryKey(),
  parentVendorId: uuid('parent_vendor_id').notNull().references(() => vendors.id, { onDelete: 'cascade' }),
  subProcessorVendorId: uuid('sub_processor_vendor_id').references(() => vendors.id),
  
  name: varchar('name', { length: 255 }),
  service: varchar('service', { length: 255 }),
  country: char('country', { length: 2 }),
  website: varchar('website', { length: 500 }),
  
  purpose: text('purpose'),
  dataCategories: jsonb('data_categories').default([]),
  processingLocations: jsonb('processing_locations').default([]),
  
  addedAt: timestamp('added_at', { withTimezone: true }).defaultNow(),
  removedAt: timestamp('removed_at', { withTimezone: true }),
  notifiedAt: timestamp('notified_at', { withTimezone: true }),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const vendorSubProcessorChanges = pgTable('vendor_sub_processor_changes', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  orgVendorId: uuid('org_vendor_id').notNull().references(() => organizationVendors.id, { onDelete: 'cascade' }),
  detectedAt: timestamp('detected_at', { withTimezone: true }).defaultNow().notNull(),
  previousHash: text('previous_hash').notNull(),
  newHash: text('new_hash').notNull(),
  previousSnapshot: text('previous_snapshot'),
  newSnapshot: text('new_snapshot'),
  status: varchar('status', { length: 50 }).default('pending_review').notNull(),
  reviewedBy: uuid('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  notes: text('notes'),
});

export const vendorIncidents = pgTable('vendor_incidents', {
  id: uuid('id').defaultRandom().primaryKey(),
  vendorSlug: text('vendor_slug').notNull(),
  incidentType: varchar('incident_type', { length: 50 }).notNull(), // 'breach' | 'fine' | 'enforcement' | 'investigation'
  title: text('title').notNull(),
  summary: text('summary'),
  sourceUrl: text('source_url'),
  sourceName: text('source_name'),
  incidentDate: date('incident_date'),
  detectedAt: timestamp('detected_at', { withTimezone: true }).defaultNow(),
  severity: varchar('severity', { length: 50 }).default('medium').notNull(), // 'low' | 'medium' | 'high' | 'critical'
  affectedDataCategories: text('affected_data_categories').array().default(sql`ARRAY[]::text[]`),
  fineAmount: numeric('fine_amount'),
  fineCurrency: varchar('fine_currency', { length: 10 }),
  status: varchar('status', { length: 50 }).default('published').notNull(), // 'draft' | 'published'
});

export const organizationVendorIncidentAlerts = pgTable('organization_vendor_incident_alerts', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  orgVendorId: uuid('vendor_id').notNull().references(() => organizationVendors.id, { onDelete: 'cascade' }),
  incidentId: uuid('incident_id').notNull().references(() => vendorIncidents.id, { onDelete: 'cascade' }),
  status: varchar('status', { length: 50 }).default('unread').notNull(), // 'unread' | 'acknowledged' | 'action_taken' | 'dismissed'
  acknowledgedBy: uuid('acknowledged_by').references(() => users.id, { onDelete: 'set null' }),
  acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
  actionNotes: text('action_notes'),
});

export const transferImpactAssessments = pgTable('transfer_impact_assessments', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  
  vendorId: uuid('vendor_id').references(() => vendors.id),
  orgVendorId: uuid('org_vendor_id').references(() => organizationVendors.id),
  processingTransferId: uuid('processing_transfer_id').references(() => processingTransfers.id),
  
  // Step 1: Transfer details
  destinationCountry: char('destination_country', { length: 2 }).notNull(),
  dataCategories: jsonb('data_categories').default([]),
  transferMechanism: varchar('transfer_mechanism', { length: 100 }).notNull(),
  mechanismDetail: text('mechanism_detail'),
  
  // Step 2: Legal assessment
  surveillanceLawsExist: boolean('surveillance_laws_exist'),
  surveillanceLawsDetail: text('surveillance_laws_detail'),
  independentDpaExists: boolean('independent_dpa_exists'),
  effectiveRemediesExist: boolean('effective_remedies_exist'),
  relevantCaseLaw: text('relevant_case_law'),
  legalAssessmentConclusion: varchar('legal_assessment_conclusion', { length: 50 }),
  legalAssessmentDetail: text('legal_assessment_detail'),
  
  // Step 3: Supplementary measures
  technicalMeasures: jsonb('technical_measures').default([]),
  organizationalMeasures: jsonb('organizational_measures').default([]),
  contractualMeasures: jsonb('contractual_measures').default([]),
  measuresDetail: text('measures_detail'),
  
  // Step 4: Residual risk
  residualRiskLevel: varchar('residual_risk_level', { length: 20 }),
  residualRiskJustification: text('residual_risk_justification'),
  
  // Step 5: Conclusion
  conclusion: varchar('conclusion', { length: 50 }),
  conditions: text('conditions'),
  
  // Approval
  status: varchar('status', { length: 50 }).default('draft'),
  approvedBy: uuid('approved_by').references(() => users.id),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  
  // Review cycle
  nextReviewAt: timestamp('next_review_at', { withTimezone: true }),
  lastReviewedAt: timestamp('last_reviewed_at', { withTimezone: true }),
  
  // Document
  documentId: uuid('document_id'),
  
  // Version
  version: integer('version').default(1),

  // -------------------------------------------------------------------------
  // F58. Recommendations 01/2020 has six steps and the table stopped at five.
  //
  // Step 1 is "know your transfer", which means naming the exporter, the importer
  // and what is actually sent — a TIA that says "US, SCCs" and nothing else
  // assesses nothing. Step 6 is re-evaluation "at appropriate intervals", which
  // needs an interval rather than a date somebody sets once.
  //
  // `processing_transfer_id` already existed and nothing wrote it: every TIA was
  // filed against a *vendor*, so an organisation transferring three different
  // data sets to the same processor under different mechanisms had one assessment
  // covering all three. The link is what makes the assessment per transfer.
  // -------------------------------------------------------------------------
  processingActivityId: uuid('processing_activity_id').references(() => processingActivities.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }),

  // Step 1.
  dataExporter: varchar('data_exporter', { length: 255 }),
  dataImporter: varchar('data_importer', { length: 255 }),
  transferPurpose: text('transfer_purpose'),
  dataSubjectCategories: jsonb('data_subject_categories').$type<string[]>().default([]),
  transferFrequency: varchar('transfer_frequency', { length: 40 }),
  onwardTransfers: text('onward_transfers'),

  // Step 6. Months, not a date: an interval survives the review being done and
  // the next one being scheduled from it, which a single `next_review_at` does not.
  reevaluationIntervalMonths: integer('reevaluation_interval_months'),
  reevaluationTriggers: text('reevaluation_triggers'),

  // The suspension decision, which is the one conclusion that has to *do*
  // something. Recorded here as well as propagated onto the transfer rows,
  // because "who stopped this and when" is the question asked afterwards.
  suspendedAt: timestamp('suspended_at', { withTimezone: true }),
  suspendedBy: uuid('suspended_by').references(() => users.id),
  suspensionReason: text('suspension_reason'),

  assessedBy: uuid('assessed_by').references(() => users.id),
  
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// ============================================================================
// GAP ASSESSMENT
// ============================================================================

export const assessmentTemplates = pgTable('assessment_templates', {
  id: uuid('id').defaultRandom().primaryKey(),
  questionText: text('question_text').notNull(),
  category: varchar('category', { length: 100 }).notNull(),
  options: jsonb('options').notNull(),
  dependsOn: jsonb('depends_on'),
  translations: jsonb('translations').$type<Record<string, any>>().default({}),
  remediationGuidance: text('remediation_guidance'),
  maxRiskWeight: integer('max_risk_weight').default(10),
  gdprArticles: integer('gdpr_articles').array(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const assessments = pgTable('assessments', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id),
  anonymousSessionId: varchar('anonymous_session_id', { length: 255 }),
  email: varchar('email', { length: 255 }),
  status: varchar('status', { length: 50 }).default('in_progress'),
  overallScore: integer('overall_score'),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const assessmentAnswers = pgTable('assessment_answers', {
  id: uuid('id').defaultRandom().primaryKey(),
  assessmentId: uuid('assessment_id').notNull().references(() => assessments.id, { onDelete: 'cascade' }),
  questionId: uuid('question_id').notNull().references(() => assessmentTemplates.id),
  selectedOption: text('selected_option').notNull(),
  riskScore: integer('risk_score').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  unq: unique().on(table.assessmentId, table.questionId)
}));

export const actionItems = pgTable('action_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  assessmentId: uuid('assessment_id').notNull().references(() => assessments.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  category: varchar('category', { length: 100 }),
  description: text('description').notNull(),
  gdprArticleReference: varchar('gdpr_article_reference', { length: 255 }),
  gdprArticles: integer('gdpr_articles').array(),
  priority: varchar('priority', { length: 50 }).notNull(),
  status: varchar('status', { length: 50 }).default('open'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// ============================================================================
// LEAD ASSESSMENTS
// ============================================================================

export const leadAssessments = pgTable('lead_assessments', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }),
  marketingConsent: boolean('marketing_consent').default(false),
  totalScore: integer('total_score').notNull(),
  riskLevel: varchar('risk_level', { length: 50 }).notNull(),
  snapshot: jsonb('snapshot').notNull(),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  locale: varchar('locale', { length: 10 }).default('en').notNull(),
  utmSource: varchar('utm_source', { length: 255 }),
  utmMedium: varchar('utm_medium', { length: 255 }),
  utmCampaign: varchar('utm_campaign', { length: 255 }),
  convertedToOrgId: uuid('converted_to_org_id').references(() => organizations.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// ============================================================================
// AUTH.JS TABLES
// ============================================================================

export const pendingSignups = pgTable("pending_signups", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 255 }).notNull(),
  anonymousSessionId: varchar("anonymous_session_id", { length: 255 }),
  assessmentId: uuid("assessment_id").references(() => assessments.id),
  marketingConsent: boolean("marketing_consent").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

// ============================================================================
// AUDIT LOGS
// ============================================================================

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").references(() => organizations.id),
  userId: uuid("user_id").references(() => users.id),
  userEmail: varchar('user_email', { length: 255 }),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  
  action: varchar("action", { length: 255 }).notNull(),
  resourceType: varchar("resource_type", { length: 100 }),
  resourceId: varchar("resource_id", { length: 255 }),
  
  description: text('description').notNull(),
  changes: jsonb('changes'),
  metadata: jsonb('metadata'),

  // I86. A data category, recipient or transfer is edited by its *own* id, so
  // every child-row change filed itself under an id the activity's History tab
  // never queries — and most of what an Art. 30 record actually contains had no
  // visible trail at all. The parent is resolved by the audit middleware from the
  // mutation's own result, which is the only place it is reliably known.
  parentResourceId: varchar('parent_resource_id', { length: 255 }),
  // I85. The child table the change happened in ('processing_data_categories'),
  // so the timeline can say "Data category" rather than "processing activity"
  // against a row that is neither.
  childResourceType: varchar('child_resource_type', { length: 100 }),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('idx_audit_logs_org_id').on(table.organizationId),
  createdAtIdx: index('idx_audit_logs_created_at').on(table.createdAt),
  actionIdx: index('idx_audit_logs_action').on(table.action),
  resourceTypeIdx: index('idx_audit_logs_resource_type').on(table.resourceType),
  // I88. The activity timeline is "this organisation, this record, newest first",
  // and it is now filtered and paginated rather than fetched whole. Without a
  // composite the planner scans the org index and sorts, which on a register with
  // a year of history is the slowest query the editor makes.
  orgResourceIdx: index('idx_audit_logs_org_resource').on(table.organizationId, table.resourceId, table.createdAt),
  parentIdx: index('idx_audit_logs_parent').on(table.parentResourceId, table.createdAt),
}));

// ============================================================================
// DSAR AUTOMATION
// ============================================================================

export const dsarRequests = pgTable('dsar_requests', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  
  referenceNumber: varchar('reference_number', { length: 50 }).notNull().unique(),
  requestType: varchar('request_type', { length: 50 }).notNull(),
  
  subjectName: varchar('subject_name', { length: 255 }).notNull(),
  subjectEmail: varchar('subject_email', { length: 255 }).notNull(),
  subjectIdentifier: jsonb('subject_identifier'),
  
  subjectVerified: boolean('subject_verified').default(false),
  verificationMethod: varchar('verification_method', { length: 100 }),
  verificationDate: timestamp('verification_date', { withTimezone: true }),
  
  source: varchar('source', { length: 50 }),
  originalMessage: text('original_message'),
  
  receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
  deadlineAt: timestamp('deadline_at', { withTimezone: true }).notNull(),
  extended: boolean('extended').default(false),
  extensionReason: text('extension_reason'),
  extendedDeadlineAt: timestamp('extended_deadline_at', { withTimezone: true }),
  
  status: varchar('status', { length: 50 }).default('new'),
  
  refusalReason: varchar('refusal_reason', { length: 100 }),
  refusalDetail: text('refusal_detail'),
  
  completedAt: timestamp('completed_at', { withTimezone: true }),
  completedBy: uuid('completed_by').references(() => users.id),
  
  dataPackageUrl: varchar('data_package_url', { length: 500 }),
  dataPackageFormat: varchar('data_package_format', { length: 20 }),
  dataPackageExpiresAt: timestamp('data_package_expires_at', { withTimezone: true }),
  
  assignedTo: uuid('assigned_to').references(() => users.id),
  inboundEmailAddress: varchar('inbound_email_address', { length: 255 }).unique(),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => {
  return {
    orgStatusIdx: index('idx_dsar_requests_org_status').on(table.organizationId, table.status),
    deadlineIdx: index('idx_dsar_requests_deadline').on(table.deadlineAt),
  };
});

export const dsarTasks = pgTable('dsar_tasks', {
  id: uuid('id').defaultRandom().primaryKey(),
  dsarId: uuid('dsar_id').notNull().references(() => dsarRequests.id, { onDelete: 'cascade' }),
  
  systemName: varchar('system_name', { length: 255 }).notNull(),
  vendorId: uuid('vendor_id').references(() => vendors.id),
  searchInstructions: text('search_instructions'),
  priority: varchar('priority', { length: 20 }).default('normal'),
  relatedActivities: jsonb('related_activities').default([]),
  dataCategories: jsonb('data_categories').default([]),
  
  status: varchar('status', { length: 50 }).default('pending'),
  dataFound: boolean('data_found'),
  dataDescription: text('data_description'),
  actionTaken: varchar('action_taken', { length: 100 }),
  actionDetail: text('action_detail'),
  evidenceDocumentId: uuid('evidence_document_id').references(() => documents.id),
  
  completedBy: uuid('completed_by').references(() => users.id),
  completedAt: timestamp('completed_at', { withTimezone: true }),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => {
  return {
    dsarIdx: index('idx_dsar_tasks_dsar').on(table.dsarId),
  };
});

export const dsarCommunications = pgTable('dsar_communications', {
  id: uuid('id').defaultRandom().primaryKey(),
  dsarId: uuid('dsar_id').notNull().references(() => dsarRequests.id, { onDelete: 'cascade' }),
  
  direction: varchar('direction', { length: 10 }).notNull(),
  type: varchar('type', { length: 50 }).notNull(),
  channel: varchar('channel', { length: 50 }),
  
  subject: varchar('subject', { length: 255 }),
  body: text('body'),
  
  sentBy: uuid('sent_by').references(() => users.id),
  sentAt: timestamp('sent_at', { withTimezone: true }).defaultNow(),
  
  emailMessageId: varchar('email_message_id', { length: 255 }),
  deliveredAt: timestamp('delivered_at', { withTimezone: true }),
  openedAt: timestamp('opened_at', { withTimezone: true }),
  
  attachments: jsonb('attachments').default([]),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ============================================================================
// PRIVACY POLICIES & COOKIE CONSENT
// ============================================================================

export const privacyPolicies = pgTable('privacy_policies', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  
  type: varchar('type', { length: 50 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  language: varchar('language', { length: 10 }).default('en'),
  
  currentVersionId: uuid('current_version_id'),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  
  syncWithRopa: boolean('sync_with_ropa').default(false),
  embedUrl: varchar('embed_url', { length: 500 }),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const policyVersions = pgTable('policy_versions', {
  id: uuid('id').defaultRandom().primaryKey(),
  policyId: uuid('policy_id').notNull().references(() => privacyPolicies.id, { onDelete: 'cascade' }),
  
  versionNumber: integer('version_number').notNull(),
  contentHtml: text('content_html').notNull(),
  contentMarkdown: text('content_markdown').notNull(),
  contentJson: jsonb('content_json'),
  
  changeSummary: text('change_summary'),
  changeType: varchar('change_type', { length: 50 }),
  diffFromPrevious: jsonb('diff_from_previous'),
  
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const consentDomains = pgTable('consent_domains', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  clientId: uuid('client_id').references(() => clients.id),
  
  domain: varchar('domain', { length: 255 }).notNull(),
  
  bannerConfig: jsonb('banner_config').default({}),
  categories: jsonb('categories').default(['necessary', 'analytics', 'marketing', 'functional']),
  gcmV2Enabled: boolean('gcm_v2_enabled').default(false),
  tcfEnabled: boolean('tcf_enabled').default(false),
  
  lastScanAt: timestamp('last_scan_at', { withTimezone: true }),
  scanFrequency: varchar('scan_frequency', { length: 20 }).default('weekly'),
  
  scriptId: varchar('script_id', { length: 100 }).unique().notNull(),
  
  totalPageviews30d: integer('total_pageviews_30d').default(0),
  consentRate30d: numeric('consent_rate_30d', { precision: 5, scale: 2 }),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const consentCookies = pgTable('consent_cookies', {
  id: uuid('id').defaultRandom().primaryKey(),
  domainId: uuid('domain_id').notNull().references(() => consentDomains.id, { onDelete: 'cascade' }),
  
  cookieName: varchar('cookie_name', { length: 255 }).notNull(),
  cookieDomain: varchar('cookie_domain', { length: 255 }),
  cookiePath: varchar('cookie_path', { length: 255 }).default('/'),
  category: varchar('category', { length: 50 }).notNull(),
  provider: varchar('provider', { length: 255 }),
  purpose: text('purpose'),
  expiry: varchar('expiry', { length: 100 }),
  isThirdParty: boolean('is_third_party').default(false),
  
  autoClassified: boolean('auto_classified').default(false),
  classificationConfidence: numeric('classification_confidence', { precision: 3, scale: 2 }),
  manuallyVerified: boolean('manually_verified').default(false),
  
  discoveredAt: timestamp('discovered_at', { withTimezone: true }).defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).defaultNow(),
});

export const consentRecords = pgTable('consent_records', {
  id: uuid('id').defaultRandom().primaryKey(),
  domainId: uuid('domain_id').notNull().references(() => consentDomains.id),
  
  consentId: varchar('consent_id', { length: 255 }).notNull(),
  
  categoriesAccepted: jsonb('categories_accepted').notNull(),
  categoriesRejected: jsonb('categories_rejected').default([]),
  
  ipHash: varchar('ip_hash', { length: 64 }),
  countryCode: varchar('country_code', { length: 2 }),
  
  policyVersionId: uuid('policy_version_id').references(() => policyVersions.id),
  bannerVersion: varchar('banner_version', { length: 50 }),
  
  interactionType: varchar('interaction_type', { length: 50 }),
  
  tcfString: text('tcf_string'),
  gcmConsentState: jsonb('gcm_consent_state'),
  eventType: varchar('event_type', { length: 20 }).default('initial'),
  
  givenAt: timestamp('given_at', { withTimezone: true }).defaultNow(),
  withdrawnAt: timestamp('withdrawn_at', { withTimezone: true }),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => {
  return {
    domainIdx: index('idx_consent_records_domain').on(table.domainId),
    consentIdIdx: index('idx_consent_records_consent_id').on(table.consentId),
    givenAtIdx: index('idx_consent_records_given_at').on(table.givenAt),
    catAccIdx: index('idx_consent_records_cat_acc').using('gin', table.categoriesAccepted),
    catRejIdx: index('idx_consent_records_cat_rej').using('gin', table.categoriesRejected),
  };
});

// ============================================================================
// BREACH MANAGEMENT
// ============================================================================

export const breaches = pgTable('breaches', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  
  referenceNumber: varchar('reference_number', { length: 50 }).notNull().unique(),
  title: varchar('title', { length: 255 }).notNull(),
  
  discoveredAt: timestamp('discovered_at', { withTimezone: true }).notNull(),
  discoveredBy: uuid('discovered_by').references(() => users.id),
  discoveryMethod: varchar('discovery_method', { length: 100 }),
  
  notificationDeadline: timestamp('notification_deadline', { withTimezone: true }).notNull(),
  
  breachType: varchar('breach_type', { length: 100 }).notNull(),
  breachCause: varchar('breach_cause', { length: 100 }),
  
  description: text('description').notNull(),
  dataCategoriesAffected: jsonb('data_categories_affected').$type<string[]>().default([]),
  dataSubjectsAffected: jsonb('data_subjects_affected').default([]),
  estimatedRecordsAffected: integer('estimated_records_affected'),
  estimatedIndividualsAffected: integer('estimated_individuals_affected'),
  affectedSystems: jsonb('affected_systems').default([]),
  
  riskToIndividuals: varchar('risk_to_individuals', { length: 20 }),
  riskAssessmentDetail: text('risk_assessment_detail'),
  
  notifyAuthority: boolean('notify_authority'),
  authorityNotifiedAt: timestamp('authority_notified_at', { withTimezone: true }),
  authorityReference: varchar('authority_reference', { length: 255 }),
  
  notifyIndividuals: boolean('notify_individuals'),
  individualsNotifiedAt: timestamp('individuals_notified_at', { withTimezone: true }),
  individualNotificationMethod: varchar('individual_notification_method', { length: 100 }),
  
  status: varchar('status', { length: 50 }).default('detected'),
  
  rootCause: text('root_cause'),
  lessonsLearned: text('lessons_learned'),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  
  vendorOriginated: boolean('vendor_originated').default(false),
  vendorId: uuid('vendor_id').references(() => vendors.id),
  vendorNotificationDate: timestamp('vendor_notification_date', { withTimezone: true }),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const breachNotifications = pgTable('breach_notifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  breachId: uuid('breach_id').notNull().references(() => breaches.id, { onDelete: 'cascade' }),
  
  notificationType: varchar('notification_type', { length: 50 }).notNull(),
  recipient: varchar('recipient', { length: 255 }),
  
  documentId: uuid('document_id').references(() => documents.id),
  contentJson: jsonb('content_json'),
  
  status: varchar('status', { length: 50 }).default('draft'),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
  
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const breachRemediationTasks = pgTable('breach_remediation_tasks', {
  id: uuid('id').defaultRandom().primaryKey(),
  breachId: uuid('breach_id').notNull().references(() => breaches.id, { onDelete: 'cascade' }),
  
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  priority: varchar('priority', { length: 20 }).default('medium'),
  
  assignedTo: uuid('assigned_to').references(() => users.id),
  dueAt: timestamp('due_at', { withTimezone: true }),
  
  status: varchar('status', { length: 50 }).default('pending'),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  completionNotes: text('completion_notes'),
  evidenceDocumentId: uuid('evidence_document_id').references(() => documents.id),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ============================================================================
// COMPLIANCE REPORTING
// ============================================================================

export const complianceGapSources = ['gap_scanner', 'dpia', 'group_vendor_inconsistency'] as const;
export type ComplianceGapSource = typeof complianceGapSources[number];

export const complianceGaps = pgTable('compliance_gaps', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  
  entityType: varchar('entity_type', { length: 50 }).notNull(),
  entityId: uuid('entity_id').notNull(),
  
  gapType: varchar('gap_type', { length: 100 }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  
  severity: varchar('severity', { length: 20 }).notNull(),
  gdprArticles: jsonb('gdpr_articles').default([]),
  
  status: varchar('status', { length: 50 }).default('open'),
  resolutionUrl: varchar('resolution_url', { length: 500 }),
  
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  resolvedBy: uuid('resolved_by').references(() => users.id),
  
  dismissedAt: timestamp('dismissed_at', { withTimezone: true }),
  dismissedBy: uuid('dismissed_by').references(() => users.id),
  dismissalReason: text('dismissal_reason'),
  
  firstDetectedAt: timestamp('first_detected_at', { withTimezone: true }).defaultNow(),
  lastDetectedAt: timestamp('last_detected_at', { withTimezone: true }).defaultNow(),
  detectionCount: integer('detection_count').default(1),
  
  dpiaId: uuid('dpia_id').references(() => dpias.id, { onDelete: 'set null' }),
  dpiaRiskId: uuid('dpia_risk_id'),
  source: varchar('source', { length: 50 }).$type<ComplianceGapSource>().default('gap_scanner'),
  resolvedReason: varchar('resolved_reason', { length: 100 }),
  metadata: jsonb('metadata').default({}),
  mitigationDueDate: timestamp('mitigation_due_date', { withTimezone: true }),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => {
  return {
    dpiaIdx: index('idx_gaps_dpia').on(table.dpiaId),
    dpiaRiskIdx: index('idx_gaps_dpia_risk').on(table.dpiaId, table.dpiaRiskId),
  };
});

export const complianceReports = pgTable('compliance_reports', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  
  reportType: varchar('report_type', { length: 50 }).notNull(),
  
  scoreTotal: integer('score_total').notNull(),
  categoryScores: jsonb('category_scores').notNull(),
  scoreBreakdown: jsonb('score_breakdown').notNull(),
  topGaps: jsonb('top_gaps').default([]),
  
  documentId: uuid('document_id').references(() => documents.id),
  generatedBy: uuid('generated_by').references(() => users.id),
  
  snapshotDate: timestamp('snapshot_date', { withTimezone: true }).notNull().defaultNow(),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ============================================================================
// AI & VECTOR SEARCH
// ============================================================================

export const documentEmbeddings = pgTable('document_embeddings', {
  id: uuid('id').primaryKey().defaultRandom(),
  documentId: text('document_id').notNull(),
  source: text('source').notNull(),
  authority: text('authority').notNull(),
  title: text('title').notNull(),
  section: text('section'),
  category: text('category').notNull(),
  articles: integer('articles').array().notNull().default(sql`'{}'::integer[]`),
  content: text('content').notNull(),
  embedding: vector('embedding', { dimensions: 3072 }).notNull(),
  metadata: jsonb('metadata').default({}),
  chunkIndex: integer('chunk_index').notNull(),
  totalChunks: integer('total_chunks').notNull(),
  sourceUrl: text('source_url'),
  language: text('language').default('en'),
  isCurrent: boolean('is_current').default(true).notNull(),
  supersededBy: text('superseded_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  categoryIdx: index('idx_embeddings_category').on(t.category),
  sourceIdx: index('idx_embeddings_source').on(t.source),
  articlesIdx: index('idx_embeddings_articles').using('gin', t.articles),
  languageIdx: index('idx_embeddings_language').on(t.language),
  isCurrentIdx: index('idx_embeddings_is_current').on(t.isCurrent),
}));

// NOTE: embedding is unindexed (see 0012_embeddings_v3_3072.sql) — flat search is fine for
// documentEmbeddings' fixed global corpus, but this table scales with tenants x entities.
// Add a row-count guardrail (and a real vector index) before it silently degrades.
export const organizationEmbeddings = pgTable('organization_embeddings', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  entityType: text('entity_type').notNull(),
  entityId: uuid('entity_id').notNull(),
  
  content: text('content').notNull(),
  contentHash: varchar('content_hash', { length: 64 }),
  metadata: jsonb('metadata').default({}),
  embedding: vector('embedding', { dimensions: 3072 }).notNull(),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  orgIdx: index('idx_org_embeddings_org').on(t.organizationId),
  typeIdx: index('idx_org_embeddings_type').on(t.entityType),
  uniqueConstraint: unique('org_embeddings_entity_unique').on(t.organizationId, t.entityType, t.entityId),
}));

export const aiGuidanceLogs = pgTable('ai_guidance_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  module: varchar('module', { length: 50 }).notNull(),
  entityId: uuid('entity_id'),
  query: text('query'),
  response: text('response').notNull(),
  sources: jsonb('sources').$type<{ title: string; url: string }[]>().default([]),
  confidence: varchar('confidence', { length: 20 }).notNull(), // 'high' | 'medium' | 'advisory'
  feedback: varchar('feedback', { length: 15 }), // 'helpful' | 'not_helpful'
  feedbackAt: timestamp('feedback_at', { withTimezone: true }),
  topSimilarity: real('top_similarity'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ============================================================================
// TRAINING
// ============================================================================

export const trainingModules = pgTable('training_modules', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id),
  isGlobal: boolean('is_global').default(false),
  language: varchar('language', { length: 10 }).default('en'),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  targetRole: varchar('target_role', { length: 50 }).default('all'),
  isMandatory: boolean('is_mandatory').default(true),
  
  content: jsonb('content').default([]),
  quiz: jsonb('quiz').default({ questions: [] }),
  
  passingScore: integer('passing_score').default(70),
  status: varchar('status', { length: 50 }).default('draft'),
  recurrence: varchar('recurrence', { length: 50 }).default('annual'),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const trainingCompletions = pgTable('training_completions', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  userId: uuid('user_id').notNull().references(() => users.id),
  moduleId: uuid('module_id').notNull().references(() => trainingModules.id),
  
  status: varchar('status', { length: 50 }).default('not_started'),
  progressPercent: integer('progress_percent').default(0),
  slidesViewed: jsonb('slides_viewed').default([]),
  
  quizScore: integer('quiz_score'),
  quizPassed: boolean('quiz_passed'),
  quizAttempts: integer('quiz_attempts').default(0),
  lastAttemptAt: timestamp('last_attempt_at', { withTimezone: true }),
  quizAnswers: jsonb('quiz_answers'),
  
  certificateId: varchar('certificate_id', { length: 100 }).unique(),
  certificateDocumentId: uuid('certificate_document_id').references(() => documents.id),
  
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  
  assignedBy: uuid('assigned_by').references(() => users.id),
  assignedAt: timestamp('assigned_at', { withTimezone: true }),
  dueAt: timestamp('due_at', { withTimezone: true }),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  unq: unique().on(t.userId, t.moduleId),
}));

// ============================================================================
// NOTIFICATIONS
// ============================================================================

export const notificationQueue = pgTable('notification_queue', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  userId: uuid('user_id').references(() => users.id),
  
  type: varchar('type', { length: 100 }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  body: text('body').notNull(),
  actionUrl: varchar('action_url', { length: 500 }),
  
  channel: varchar('channel', { length: 50 }).notNull(),
  priority: varchar('priority', { length: 20 }).default('normal'),
  
  status: varchar('status', { length: 50 }).default('pending'),
  attempts: integer('attempts').default(0),
  maxAttempts: integer('max_attempts').default(3),
  lastAttemptAt: timestamp('last_attempt_at', { withTimezone: true }),
  nextRetryAt: timestamp('next_retry_at', { withTimezone: true }),
  
  sentAt: timestamp('sent_at', { withTimezone: true }),
  deliveredAt: timestamp('delivered_at', { withTimezone: true }),
  error: text('error'),
  
  emailTo: varchar('email_to', { length: 255 }),
  emailMessageId: varchar('email_message_id', { length: 255 }),
  
  slackResponse: jsonb('slack_response'),
  
  payload: jsonb('payload'),
  
  scheduledFor: timestamp('scheduled_for', { withTimezone: true }),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  idxPending: index('idx_nq_pending').on(t.status, t.priority, t.createdAt).where(sql`${t.status} = 'pending'`),
  idxOrg: index('idx_nq_org').on(t.organizationId),
  idxRetry: index('idx_nq_retry').on(t.nextRetryAt).where(sql`${t.status} = 'failed' AND ${t.attempts} < ${t.maxAttempts}`),
}));

// ============================================================================
// REGULATORY UPDATES
// ============================================================================

export const regulatoryUpdates = pgTable('regulatory_updates', {
  id: uuid('id').defaultRandom().primaryKey(),
  
  sourceId: varchar('source_id', { length: 50 }).notNull(),
  sourceName: varchar('source_name', { length: 255 }).notNull(),
  sourceUrl: varchar('source_url', { length: 500 }).notNull(),
  
  title: varchar('title', { length: 500 }).notNull(),
  summary: text('summary').notNull(),
  keyChanges: jsonb('key_changes').default([]),
  originalLanguage: char('original_language', { length: 2 }).default('en'),
  
  category: varchar('category', { length: 100 }),
  severity: varchar('severity', { length: 20 }).default('info'),
  affectsRegions: jsonb('affects_regions').default(['EU']),
  affectsArticles: jsonb('affects_articles').default([]),
  
  impactRules: jsonb('impact_rules').default([]),
  
  status: varchar('status', { length: 50 }).default('draft'),
  reviewedBy: varchar('reviewed_by', { length: 100 }),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  
  effectiveDate: date('effective_date'),
  contentHash: varchar('content_hash', { length: 64 }).unique(),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => {
  return {
    statusIdx: index('idx_ru_status').on(table.status),
    severityIdx: index('idx_ru_severity').on(table.severity),
    publishedIdx: index('idx_ru_published').on(table.publishedAt),
  };
});

export const regulatoryImpactAssessments = pgTable('regulatory_impact_assessments', {
  id: uuid('id').defaultRandom().primaryKey(),
  regulatoryUpdateId: uuid('regulatory_update_id').notNull().references(() => regulatoryUpdates.id, { onDelete: 'cascade' }),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  
  affectedActivities: jsonb('affected_activities').notNull(),
  affectedVendors: jsonb('affected_vendors').default([]),
  affectedTransfers: jsonb('affected_transfers').default([]),
  
  recommendedActions: jsonb('recommended_actions').default([]),
  
  status: varchar('status', { length: 50 }).default('unread'),
  acknowledgedBy: uuid('acknowledged_by').references(() => users.id),
  acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => {
  return {
    orgIdx: index('idx_ria_org').on(table.organizationId),
    statusIdx: index('idx_ria_status').on(table.status),
    unq: unique('idx_ria_unique').on(table.regulatoryUpdateId, table.organizationId),
  };
});

// ============================================================================
// CRM INTEGRATIONS (Phase 18)
// ============================================================================

export const organizationIntegrations = pgTable('organization_integrations', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),

  provider: varchar('provider', { length: 50 }).notNull(),
  providerAccountId: varchar('provider_account_id', { length: 255 }),
  providerAccountName: varchar('provider_account_name', { length: 255 }),

  // TODO(security): OAuth tokens stored in plaintext — need app-level encryption (KMS/envelope), not yet implemented.
  accessToken: text('access_token').notNull(),
  refreshToken: text('refresh_token'),
  tokenType: varchar('token_type', { length: 50 }).default('Bearer'),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  scopes: jsonb('scopes').default([]),

  status: varchar('status', { length: 50 }).default('active'),
  lastError: text('last_error'),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),

  connectedBy: uuid('connected_by').references(() => users.id),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => {
  return {
    orgIdx: index('idx_oi_org').on(table.organizationId),
    providerIdx: index('idx_oi_provider').on(table.provider),
    orgProviderUnique: unique('unique_org_provider').on(table.organizationId, table.provider),
  };
});

// ============================================================================
// PUBLIC API & WEBHOOKS (Phase 17)
// ============================================================================

export const apiKeys = pgTable('api_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),

  name: varchar('name', { length: 255 }).notNull(),
  keyHash: varchar('key_hash', { length: 64 }).notNull(),
  prefix: varchar('prefix', { length: 12 }).notNull(),

  scopes: jsonb('scopes').default(['read']),

  allowedIps: jsonb('allowed_ips'),

  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  requestCount: integer('request_count').default(0),

  expiresAt: timestamp('expires_at', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  revokedBy: uuid('revoked_by').references(() => users.id),

  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => {
  return {
    orgIdx: index('idx_ak_org').on(table.organizationId),
    hashIdx: index('idx_ak_hash').on(table.keyHash),
    prefixIdx: index('idx_ak_prefix').on(table.prefix),
  };
});

export const webhooks = pgTable('webhooks', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),

  url: varchar('url', { length: 1024 }).notNull(),
  events: jsonb('events').notNull(),
  secret: varchar('secret', { length: 255 }).notNull(),

  isActive: boolean('is_active').default(true),

  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => {
  return {
    orgIdx: index('idx_wh_org').on(table.organizationId),
  };
});

export const webhookDeliveries = pgTable('webhook_deliveries', {
  id: uuid('id').primaryKey().defaultRandom(),
  webhookId: uuid('webhook_id').notNull().references(() => webhooks.id),
  eventId: varchar('event_id', { length: 100 }).notNull(),

  eventType: varchar('event_type', { length: 100 }).notNull(),
  payload: jsonb('payload').notNull(),

  status: varchar('status', { length: 50 }).default('pending'),
  attempts: integer('attempts').default(0),
  maxAttempts: integer('max_attempts').default(5),

  responseStatus: integer('response_status'),
  responseBody: text('response_body'),
  responseTimeMs: integer('response_time_ms'),

  lastError: text('last_error'),
  nextRetryAt: timestamp('next_retry_at', { withTimezone: true }),

  deliveredAt: timestamp('delivered_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => {
  return {
    webhookIdx: index('idx_wd_webhook').on(table.webhookId),
    retryIdx: index('idx_wd_retry').on(table.nextRetryAt),
    statusIdx: index('idx_webhook_deliveries_status').on(table.status),
  };
});

// ============================================================================
// VENDOR QUESTIONNAIRES (Phase 5)
// ============================================================================

export const vendorQuestionnaires = pgTable('vendor_questionnaires', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  vendorId: uuid('vendor_id').notNull().references(() => vendors.id, { onDelete: 'cascade' }),
  orgVendorId: uuid('org_vendor_id').notNull().references(() => organizationVendors.id, { onDelete: 'cascade' }),
  
  token: uuid('token').defaultRandom().notNull().unique(),
  status: varchar('status', { length: 50 }).default('draft').notNull(), // 'draft' | 'sent' | 'submitted' | 'reviewed'
  promptVersion: varchar('prompt_version', { length: 100 }).default('v1').notNull(),
  
  questions: jsonb('questions').$type<VendorQuestionnaireQuestion[]>().notNull(),
  answers: jsonb('answers').$type<VendorQuestionnaireAnswer[]>().default([]),
  aiScore: integer('ai_score'), // score (0 to 100) calculated by Claude
  aiAnalysis: jsonb('ai_analysis').default({}), // { summary, answersReview: [{ questionId, score, status, analysis, confidence, gapIdentified }] }
  scoreModifier: integer('score_modifier').default(0).notNull(), // the -10 to +25 adjustment applied
  
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => {
  return {
    orgIdx: index('idx_vq_org').on(table.organizationId),
    vendorIdx: index('idx_vq_vendor').on(table.vendorId),
    tokenIdx: index('idx_vq_token').on(table.token),
  };
});

export const vendorQuestionnairesRelations = relations(vendorQuestionnaires, ({ one }) => ({
  organization: one(organizations, {
    fields: [vendorQuestionnaires.organizationId],
    references: [organizations.id],
  }),
  vendor: one(vendors, {
    fields: [vendorQuestionnaires.vendorId],
    references: [vendors.id],
  }),
  orgVendor: one(organizationVendors, {
    fields: [vendorQuestionnaires.orgVendorId],
    references: [organizationVendors.id],
  }),
}));

// ============================================================================
// RELATIONS
// ============================================================================

export const breachesRelations = relations(breaches, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [breaches.organizationId],
    references: [organizations.id],
  }),
  notifications: many(breachNotifications),
  tasks: many(breachRemediationTasks),
}));

export const breachNotificationsRelations = relations(breachNotifications, ({ one }) => ({
  breach: one(breaches, {
    fields: [breachNotifications.breachId],
    references: [breaches.id],
  }),
}));

export const breachRemediationTasksRelations = relations(breachRemediationTasks, ({ one }) => ({
  breach: one(breaches, {
    fields: [breachRemediationTasks.breachId],
    references: [breaches.id],
  }),
  assignedUser: one(users, {
    fields: [breachRemediationTasks.assignedTo],
    references: [users.id],
  }),
}));

export const processingActivitiesRelations = relations(processingActivities, ({ one, many }) => ({
  dataCategories: many(processingDataCategories),
  dataSubjects: many(processingDataSubjects),
  recipients: many(processingRecipients),
  transfers: many(processingTransfers),
  clients: many(clientProcessingActivities),
  reconsentFlags: many(reconsentFlags),
  attestations: many(processingActivityAttestations),
  approvals: many(processingActivityApprovals),
  versions: many(processingActivityVersions),
  tasks: many(processingActivityTasks),
  comments: many(processingActivityComments),
  // Sprint 3. The three assessments that hang off an activity. Each is a `many`
  // even where the product treats one as current — an LIA is superseded rather
  // than overwritten, and a screening from March is still evidence in June.
  liaAssessments: many(legitimateInterestAssessments),
  screenings: many(dpiaScreenings),
  transferAssessments: many(transferImpactAssessments),
  // Sprint 4. Retention, intake, discovery, drafting and material change all hang
  // off the activity; each target below declares the one(activity) back-reference
  // Drizzle infers the join from.
  retentionSchedule: one(retentionSchedules, {
    fields: [processingActivities.retentionScheduleId],
    references: [retentionSchedules.id],
  }),
  disposals: many(retentionDisposals),
  legalHolds: many(legalHoldActivities),
  intakeRequests: many(ropaIntakeRequests),
  drafts: many(ropaActivityDrafts),
  materialChanges: many(materialChangeEvents),
  businessOwner: one(users, {
    fields: [processingActivities.businessOwnerId],
    references: [users.id],
  }),
  privacyOwner: one(users, {
    fields: [processingActivities.privacyOwnerId],
    references: [users.id],
  }),
  reviewer: one(users, {
    fields: [processingActivities.currentReviewerId],
    references: [users.id],
  }),
}));

// Each of the five below carries the `one(activity)` back-reference its parent's
// `many()` needs. Drizzle infers the join from this side; without it the relational
// query throws while being *built*, so every caller fails rather than some unlucky
// row — the class check:relations exists to catch.

export const processingActivityAttestationsRelations = relations(processingActivityAttestations, ({ one }) => ({
  activity: one(processingActivities, {
    fields: [processingActivityAttestations.processingActivityId],
    references: [processingActivities.id],
  }),
  attestor: one(users, {
    fields: [processingActivityAttestations.attestedBy],
    references: [users.id],
  }),
}));

export const processingActivityApprovalsRelations = relations(processingActivityApprovals, ({ one }) => ({
  activity: one(processingActivities, {
    fields: [processingActivityApprovals.processingActivityId],
    references: [processingActivities.id],
  }),
  requester: one(users, {
    fields: [processingActivityApprovals.requestedBy],
    references: [users.id],
  }),
  reviewer: one(users, {
    fields: [processingActivityApprovals.reviewerId],
    references: [users.id],
  }),
}));

export const processingActivityVersionsRelations = relations(processingActivityVersions, ({ one }) => ({
  activity: one(processingActivities, {
    fields: [processingActivityVersions.processingActivityId],
    references: [processingActivities.id],
  }),
  author: one(users, {
    fields: [processingActivityVersions.createdBy],
    references: [users.id],
  }),
}));

export const processingActivityTasksRelations = relations(processingActivityTasks, ({ one }) => ({
  activity: one(processingActivities, {
    fields: [processingActivityTasks.processingActivityId],
    references: [processingActivities.id],
  }),
  assignee: one(users, {
    fields: [processingActivityTasks.assigneeId],
    references: [users.id],
  }),
}));

export const processingActivityCommentsRelations = relations(processingActivityComments, ({ one }) => ({
  activity: one(processingActivities, {
    fields: [processingActivityComments.processingActivityId],
    references: [processingActivities.id],
  }),
  author: one(users, {
    fields: [processingActivityComments.authorId],
    references: [users.id],
  }),
}));

export const legitimateInterestAssessmentsRelations = relations(legitimateInterestAssessments, ({ one }) => ({
  activity: one(processingActivities, {
    fields: [legitimateInterestAssessments.processingActivityId],
    references: [processingActivities.id],
  }),
  assessor: one(users, {
    fields: [legitimateInterestAssessments.assessedBy],
    references: [users.id],
  }),
}));

export const dpiaScreeningsRelations = relations(dpiaScreenings, ({ one }) => ({
  activity: one(processingActivities, {
    fields: [dpiaScreenings.processingActivityId],
    references: [processingActivities.id],
  }),
  screener: one(users, {
    fields: [dpiaScreenings.screenedBy],
    references: [users.id],
  }),
}));

export const dpiasRelations = relations(dpias, ({ one, many }) => ({
  risks: many(dpiaRisks),
  versions: many(dpiaVersions),
  owner: one(users, {
    fields: [dpias.ownerId],
    references: [users.id],
  }),
  signedOffByUser: one(users, {
    fields: [dpias.signedOffBy],
    references: [users.id],
  }),
}));

export const dpiaRisksRelations = relations(dpiaRisks, ({ one, many }) => ({
  dpia: one(dpias, {
    fields: [dpiaRisks.dpiaId],
    references: [dpias.id],
  }),
  measures: many(dpiaMeasures),
}));

export const dpiaMeasuresRelations = relations(dpiaMeasures, ({ one }) => ({
  risk: one(dpiaRisks, {
    fields: [dpiaMeasures.dpiaRiskId],
    references: [dpiaRisks.id],
  }),
  owner: one(users, {
    fields: [dpiaMeasures.ownerId],
    references: [users.id],
  }),
}));

export const dpiaVersionsRelations = relations(dpiaVersions, ({ one }) => ({
  dpia: one(dpias, {
    fields: [dpiaVersions.dpiaId],
    references: [dpias.id],
  }),
  author: one(users, {
    fields: [dpiaVersions.createdBy],
    references: [users.id],
  }),
}));

export const transferImpactAssessmentsRelations = relations(transferImpactAssessments, ({ one }) => ({
  activity: one(processingActivities, {
    fields: [transferImpactAssessments.processingActivityId],
    references: [processingActivities.id],
  }),
  transfer: one(processingTransfers, {
    fields: [transferImpactAssessments.processingTransferId],
    references: [processingTransfers.id],
  }),
  vendor: one(vendors, {
    fields: [transferImpactAssessments.vendorId],
    references: [vendors.id],
  }),
}));

export const ropaSavedViewsRelations = relations(ropaSavedViews, ({ one }) => ({
  organization: one(organizations, {
    fields: [ropaSavedViews.organizationId],
    references: [organizations.id],
  }),
  author: one(users, {
    fields: [ropaSavedViews.createdBy],
    references: [users.id],
  }),
}));

export const dataElementCatalogueRelations = relations(dataElementCatalogue, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [dataElementCatalogue.organizationId],
    references: [organizations.id],
  }),
  usages: many(processingDataCategories),
}));

export const dataSubjectCategoryCatalogueRelations = relations(dataSubjectCategoryCatalogue, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [dataSubjectCategoryCatalogue.organizationId],
    references: [organizations.id],
  }),
  usages: many(processingDataSubjects),
}));

export const processingDataSubjectsRelations = relations(processingDataSubjects, ({ one }) => ({
  activity: one(processingActivities, {
    fields: [processingDataSubjects.processingActivityId],
    references: [processingActivities.id],
  }),
  catalogueEntry: one(dataSubjectCategoryCatalogue, {
    fields: [processingDataSubjects.catalogueId],
    references: [dataSubjectCategoryCatalogue.id],
  }),
}));

// `many(processingTransfers)` on the activity needs this back-reference for the
// same reason the data-category one does — Drizzle infers the join from the
// child's `one()`, and throws while *building* the query when it is missing.
export const processingTransfersRelations = relations(processingTransfers, ({ one, many }) => ({
  activity: one(processingActivities, {
    fields: [processingTransfers.processingActivityId],
    references: [processingActivities.id],
  }),
  assessments: many(transferImpactAssessments),
  vendor: one(vendors, {
    fields: [processingTransfers.vendorId],
    references: [vendors.id],
  }),
}));

// The `many(processingDataCategories)` above can only be resolved if the child
// declares the matching `one()` — without it Drizzle has no fields/references to
// infer the join from and throws while building the query.
export const processingDataCategoriesRelations = relations(processingDataCategories, ({ one }) => ({
  activity: one(processingActivities, {
    fields: [processingDataCategories.processingActivityId],
    references: [processingActivities.id],
  }),
  catalogueEntry: one(dataElementCatalogue, {
    fields: [processingDataCategories.catalogueId],
    references: [dataElementCatalogue.id],
  }),
  retentionSchedule: one(retentionSchedules, {
    fields: [processingDataCategories.retentionScheduleId],
    references: [retentionSchedules.id],
  }),
}));

export const processingRecipientsRelations = relations(processingRecipients, ({ one }) => ({
  activity: one(processingActivities, {
    fields: [processingRecipients.processingActivityId],
    references: [processingActivities.id],
  }),
  vendor: one(vendors, {
    fields: [processingRecipients.vendorId],
    references: [vendors.id],
  }),
}));

export const reconsentFlagsRelations = relations(reconsentFlags, ({ one }) => ({
  organization: one(organizations, {
    fields: [reconsentFlags.organizationId],
    references: [organizations.id],
  }),
  activity: one(processingActivities, {
    fields: [reconsentFlags.processingActivityId],
    references: [processingActivities.id],
  }),
  dismissedByUser: one(users, {
    fields: [reconsentFlags.dismissedBy],
    references: [users.id],
  }),
}));

export const clientsRelations = relations(clients, ({ many }) => ({
  processingActivities: many(clientProcessingActivities),
}));

export const clientProcessingActivitiesRelations = relations(clientProcessingActivities, ({ one }) => ({
  client: one(clients, {
    fields: [clientProcessingActivities.clientId],
    references: [clients.id],
  }),
  processingActivity: one(processingActivities, {
    fields: [clientProcessingActivities.processingActivityId],
    references: [processingActivities.id],
  }),
}));

export const trainingModulesRelations = relations(trainingModules, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [trainingModules.organizationId],
    references: [organizations.id],
  }),
  completions: many(trainingCompletions),
}));

export const trainingCompletionsRelations = relations(trainingCompletions, ({ one }) => ({
  organization: one(organizations, {
    fields: [trainingCompletions.organizationId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [trainingCompletions.userId],
    references: [users.id],
  }),
  module: one(trainingModules, {
    fields: [trainingCompletions.moduleId],
    references: [trainingModules.id],
  }),
  certificateDocument: one(documents, {
    fields: [trainingCompletions.certificateDocumentId],
    references: [documents.id],
  }),
  assigner: one(users, {
    fields: [trainingCompletions.assignedBy],
    references: [users.id],
  }),
}));

export const notificationQueueRelations = relations(notificationQueue, ({ one }) => ({
  organization: one(organizations, {
    fields: [notificationQueue.organizationId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [notificationQueue.userId],
    references: [users.id],
  }),
}));

export const vendorSubProcessorChangesRelations = relations(vendorSubProcessorChanges, ({ one }) => ({
  organization: one(organizations, {
    fields: [vendorSubProcessorChanges.organizationId],
    references: [organizations.id],
  }),
  orgVendor: one(organizationVendors, {
    fields: [vendorSubProcessorChanges.orgVendorId],
    references: [organizationVendors.id],
  }),
  reviewer: one(users, {
    fields: [vendorSubProcessorChanges.reviewedBy],
    references: [users.id],
  }),
}));

export const vendorIncidentsRelations = relations(vendorIncidents, ({ many }) => ({
  alerts: many(organizationVendorIncidentAlerts),
}));

export const organizationVendorIncidentAlertsRelations = relations(organizationVendorIncidentAlerts, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationVendorIncidentAlerts.organizationId],
    references: [organizations.id],
  }),
  orgVendor: one(organizationVendors, {
    fields: [organizationVendorIncidentAlerts.orgVendorId],
    references: [organizationVendors.id],
  }),
  incident: one(vendorIncidents, {
    fields: [organizationVendorIncidentAlerts.incidentId],
    references: [vendorIncidents.id],
  }),
  reviewer: one(users, {
    fields: [organizationVendorIncidentAlerts.acknowledgedBy],
    references: [users.id],
  }),
}));

export const activeSessions = pgTable('active_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: varchar('token_hash', { length: 255 }).notNull(),
  device: varchar('device', { length: 255 }),
  browser: varchar('browser', { length: 255 }),
  ipAddress: varchar('ip_address', { length: 45 }),
  location: varchar('location', { length: 255 }),
  lastActiveAt: timestamp('last_active_at', { withTimezone: true }).defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => {
  return {
    userIdx: index('idx_as_user').on(table.userId),
    tokenHashIdx: uniqueIndex('idx_as_token_hash').on(table.tokenHash),
  };
});


export const organizationsRelations = relations(organizations, ({ one, many }) => ({
  parent: one(organizations, {
    fields: [organizations.parentOrganizationId],
    references: [organizations.id],
    relationName: 'parentOrganization'
  }),
  children: many(organizations, { relationName: 'parentOrganization' }),
  reconsentFlags: many(reconsentFlags),
}));

export const organizationVendorsRelations = relations(organizationVendors, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationVendors.organizationId],
    references: [organizations.id],
  }),
  vendor: one(vendors, {
    fields: [organizationVendors.vendorId],
    references: [vendors.id],
  }),
}));

export const webhookDeliveriesRelations = relations(webhookDeliveries, ({ one }) => ({
  webhook: one(webhooks, {
    fields: [webhookDeliveries.webhookId],
    references: [webhooks.id],
  }),
}));

// `assignee`, not `assignedTo`: a relation sharing a column's name overwrites that
// column in the result, which would turn the uuid into a user object.
export const dsarRequestsRelations = relations(dsarRequests, ({ one }) => ({
  organization: one(organizations, {
    fields: [dsarRequests.organizationId],
    references: [organizations.id],
  }),
  assignee: one(users, {
    fields: [dsarRequests.assignedTo],
    references: [users.id],
  }),
}));

export const account = pgTable('account', {
  userId: uuid('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 255 }).notNull(),
  provider: varchar('provider', { length: 255 }).notNull(),
  providerAccountId: varchar('providerAccountId', { length: 255 }).notNull(),
  refresh_token: text('refresh_token'),
  access_token: text('access_token'),
  expires_at: integer('expires_at'),
  token_type: varchar('token_type', { length: 255 }),
  scope: varchar('scope', { length: 255 }),
  id_token: text('id_token'),
  session_state: varchar('session_state', { length: 255 }),
}, (table) => {
  return {
    compoundKey: primaryKey({
      columns: [table.provider, table.providerAccountId],
    }),
  };
});

export const session = pgTable('session', {
  sessionToken: varchar('sessionToken', { length: 255 }).primaryKey(),
  userId: uuid('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires').notNull(),
});

export const verificationToken = pgTable('verificationToken', {
  identifier: varchar('identifier', { length: 255 }).notNull(),
  token: varchar('token', { length: 255 }).notNull(),
  expires: timestamp('expires').notNull(),
}, (table) => {
  return {
    compositePk: primaryKey({
      columns: [table.identifier, table.token],
    }),
  };
});

export const regulatoryUpdateMatches = pgTable('regulatory_update_matches', {
  id: uuid('id').defaultRandom().primaryKey(),
  regulatoryUpdateId: uuid('regulatory_update_id').notNull().references(() => regulatoryUpdates.id, { onDelete: 'cascade' }),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  matchedEntityType: text('matched_entity_type').notNull(),
  matchedEntityId: uuid('matched_entity_id').notNull(),
  matchedChunkId: uuid('matched_chunk_id').references(() => documentEmbeddings.id, { onDelete: 'set null' }),
  similarityScore: real('similarity_score').notNull(),
  detectedAt: timestamp('detected_at', { withTimezone: true }).defaultNow(),
  status: text('status').default('pending_assessment'),
  aiExplanation: text('ai_explanation'),
  recommendedAction: text('recommended_action'),
  confidence: varchar('confidence', { length: 50 }),
  matchStrength: varchar('match_strength', { length: 50 }),
  promptTokens: integer('prompt_tokens'),
  completionTokens: integer('completion_tokens'),
  notifiedAt: timestamp('notified_at', { withTimezone: true }),
  acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
  acknowledgedBy: uuid('acknowledged_by').references(() => users.id, { onDelete: 'set null' }),
  assessedAt: timestamp('assessed_at', { withTimezone: true }),
}, (table) => {
  return {
    orgIdx: index('idx_reg_matches_org').on(table.organizationId),
    updateIdx: index('idx_reg_matches_update').on(table.regulatoryUpdateId),
    similarityIdx: index('idx_reg_matches_similarity').on(table.similarityScore),
  };
});

// ============================================================================
// PHASE 2 - ROLLUP PERFORMANCE LAYER
// ============================================================================

export const consentDailySummary = pgTable('consent_daily_summary', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  domainId: uuid('domain_id').notNull().references(() => consentDomains.id, { onDelete: 'cascade' }),
  date: date('date').notNull(),
  
  category: varchar('category', { length: 50 }),
  acceptedSessions: integer('accepted_sessions').default(0),
  rejectedSessions: integer('rejected_sessions').default(0),
  totalSessions: integer('total_sessions').default(0),
  
  acceptAllCount: integer('accept_all_count').default(0),
  rejectAllCount: integer('reject_all_count').default(0),
  customizedWithAcceptanceCount: integer('customized_with_acceptance_count').default(0),
  customizedAllRejectedCount: integer('customized_all_rejected_count').default(0),
  
  categoryCombination: text('category_combination'),
  categoryCombinationCount: integer('category_combination_count').default(0),
}, (table) => {
  return {
    uniqueCategory: uniqueIndex('idx_consent_daily_summary_category').on(table.domainId, table.date, table.category),
    uniqueCombination: uniqueIndex('idx_consent_daily_summary_combination').on(table.domainId, table.date, table.categoryCombination),
    orgDateIdx: index('idx_consent_daily_summary_org_date').on(table.organizationId, table.date),
  };
});


export const rateLimits = pgTable('rate_limits', { key: varchar('key', { length: 255 }).primaryKey(), hits: integer('hits').default(1), expiresAt: timestamp('expires_at', { withTimezone: true }).notNull() });

// ============================================================================
// CONSENT / TRACKER RECONCILIATION
// ============================================================================

/**
 * Global catalogue of trackers, keyed by the hosts they call and the cookies they
 * write. Replaces the 11-entry KNOWN_COOKIES map that used to live in the cookie
 * scanner, and is shared by the cookie classifier and the network scanner so both
 * agree on what a given host is.
 */
export const trackerRegistry = pgTable('tracker_registry', {
  id: uuid('id').defaultRandom().primaryKey(),

  trackerKey: varchar('tracker_key', { length: 100 }).notNull().unique(),
  provider: varchar('provider', { length: 255 }).notNull(),
  /** Hosts, or host+path prefixes, that identify this tracker on the network. */
  matchDomains: jsonb('match_domains').notNull().default([]),
  /** Cookie name prefixes this tracker writes. */
  cookiePrefixes: jsonb('cookie_prefixes').notNull().default([]),
  requiredCategory: varchar('required_category', { length: 50 }).notNull(),

  consentModeSupported: boolean('consent_mode_supported').default(false),
  /** Query params that carry the tracker's own consent signal, e.g. gcs, dpo. */
  consentSignalParams: jsonb('consent_signal_params').default([]),
  /** Links a finding through to the vendor record and its DPA status. */
  vendorSlug: varchar('vendor_slug', { length: 100 }),

  purpose: text('purpose'),
  isActive: boolean('is_active').default(true),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => {
  return {
    categoryIdx: index('idx_tracker_registry_category').on(table.requiredCategory),
    vendorSlugIdx: index('idx_tracker_registry_vendor_slug').on(table.vendorSlug),
  };
});

/**
 * One reconciliation scan of one domain. Findings cite the run that produced them,
 * so every claim shown to a customer is traceable to a dated, successful scan.
 */
export const consentScanRuns = pgTable('consent_scan_runs', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  domainId: uuid('domain_id').notNull().references(() => consentDomains.id, { onDelete: 'cascade' }),

  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  status: varchar('status', { length: 20 }).notNull().default('running'), // running|ok|failed

  cmpDetected: varchar('cmp_detected', { length: 50 }),
  /** seeded_cookies|clicked|seeded_and_clicked|unknown — drives finding confidence. */
  postConsentMethod: varchar('post_consent_method', { length: 20 }),

  preRequestCount: integer('pre_request_count').default(0),
  postRequestCount: integer('post_request_count').default(0),
  cookiesFound: integer('cookies_found').default(0),
  findingsOpen: integer('findings_open').default(0),
  error: text('error'),
}, (table) => {
  return {
    domainStartedIdx: index('idx_consent_scan_runs_domain_started').on(table.domainId, table.startedAt),
    orgIdx: index('idx_consent_scan_runs_org').on(table.organizationId),
  };
});

/** What a single host did during a single pass of a scan. */
export const consentTrackerObservations = pgTable('consent_tracker_observations', {
  id: uuid('id').defaultRandom().primaryKey(),
  scanRunId: uuid('scan_run_id').notNull().references(() => consentScanRuns.id, { onDelete: 'cascade' }),
  domainId: uuid('domain_id').notNull().references(() => consentDomains.id, { onDelete: 'cascade' }),

  observedHost: varchar('observed_host', { length: 255 }).notNull(),
  trackerKey: varchar('tracker_key', { length: 100 }),
  provider: varchar('provider', { length: 255 }),
  requiredCategory: varchar('required_category', { length: 50 }),
  matchedVendorId: uuid('matched_vendor_id').references(() => vendors.id, { onDelete: 'set null' }),

  pass: varchar('pass', { length: 20 }).notNull(), // pre_consent|post_consent
  resourceType: varchar('resource_type', { length: 30 }),
  /** The request sent cookies or identifier-shaped params. The Consent Mode discriminator. */
  carriedIdentifiers: boolean('carried_identifiers').default(false),
  consentSignal: varchar('consent_signal', { length: 20 }), // granted|denied|absent
  requestCount: integer('request_count').default(1),
  /** Sanitised: origin + path with an allowlisted query only. Never a raw tracker URL. */
  sampleUrl: text('sample_url'),

  observedAt: timestamp('observed_at', { withTimezone: true }).defaultNow(),
}, (table) => {
  return {
    uniquePerPass: unique('uq_consent_observation_run_host_pass').on(table.scanRunId, table.observedHost, table.pass),
    runIdx: index('idx_consent_observations_run').on(table.scanRunId),
    domainHostIdx: index('idx_consent_observations_domain_host').on(table.domainId, table.observedHost),
  };
});

/**
 * Open findings for a domain. The unique key means a repeat scan upserts and bumps
 * last_seen_at, and anything a completed scan did not touch flips to resolved — so
 * remediation tracking, and dated evidence of it, falls out of the scan itself.
 */
export const consentFindings = pgTable('consent_findings', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  domainId: uuid('domain_id').notNull().references(() => consentDomains.id, { onDelete: 'cascade' }),

  findingType: varchar('finding_type', { length: 50 }).notNull(),
  severity: varchar('severity', { length: 20 }).notNull(), // critical|high|medium|low|info

  trackerKey: varchar('tracker_key', { length: 100 }),
  provider: varchar('provider', { length: 255 }),
  // Part of the upsert key, so it must not be null: Postgres treats NULLs in a
  // unique constraint as distinct, which would let domain-level findings duplicate
  // on every scan. Findings that are not about one host use the empty string.
  observedHost: varchar('observed_host', { length: 255 }).notNull().default(''),
  // Discriminator for findings that are not about a host — the cookie name, for
  // one. Without it every unclassified_cookie on a domain shared the upsert key
  // (domain, type, '') and all but one were silently overwritten.
  subject: varchar('subject', { length: 255 }).notNull().default(''),
  requiredCategory: varchar('required_category', { length: 50 }),
  matchedVendorId: uuid('matched_vendor_id').references(() => vendors.id, { onDelete: 'set null' }),

  /** Sanitised evidence only: hosts, cookie names, gcs values. No raw URLs, no identifiers. */
  evidence: jsonb('evidence').default({}),
  confidence: numeric('confidence', { precision: 3, scale: 2 }),

  state: varchar('state', { length: 20 }).notNull().default('open'), // open|resolved|dismissed|false_positive
  resolutionNote: text('resolution_note'),

  firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).defaultNow(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  resolvedBy: uuid('resolved_by').references(() => users.id, { onDelete: 'set null' }),

  firstScanRunId: uuid('first_scan_run_id').references(() => consentScanRuns.id, { onDelete: 'set null' }),
  lastScanRunId: uuid('last_scan_run_id').references(() => consentScanRuns.id, { onDelete: 'set null' }),
}, (table) => {
  return {
    uniqueFinding: unique('uq_consent_finding_domain_type_host').on(table.domainId, table.findingType, table.observedHost, table.subject),
    domainStateIdx: index('idx_consent_findings_domain_state').on(table.domainId, table.state),
    orgStateSeverityIdx: index('idx_consent_findings_org_state_severity').on(table.organizationId, table.state, table.severity),
  };
});

/**
 * Audit evidence library.
 *
 * "Audit Readiness" was a score, a gap list and an export. What an auditor
 * actually walks through is control-to-evidence linkage: for each obligation,
 * show me the document that discharges it and when it was last reviewed. That
 * mapping had nowhere to live.
 *
 * `articles` is the GDPR article each item speaks to — a jsonb array rather
 * than a join table because an item routinely covers several ("32" and "5(1)(f)"
 * for the same security policy) and the set is small and read whole.
 */
export const auditEvidence = pgTable('audit_evidence', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),

  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),

  /** GDPR article references, e.g. ["30","32"]. */
  articles: jsonb('articles').notNull().default([]),

  /** How the evidence is held: a link, an internal Custodia record, or a written attestation. */
  evidenceType: varchar('evidence_type', { length: 30 }).notNull().default('document_link'),
  url: text('url'),

  /**
   * When the evidence was gathered, and when it stops being current. An auditor
   * asks "how do you know this is still true", so a review date is the point.
   */
  collectedAt: timestamp('collected_at', { withTimezone: true }).notNull().defaultNow(),
  validUntil: timestamp('valid_until', { withTimezone: true }),

  uploadedBy: uuid('uploaded_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => {
  return {
    orgIdx: index('idx_audit_evidence_org').on(table.organizationId),
    orgValidIdx: index('idx_audit_evidence_org_valid').on(table.organizationId, table.validUntil),
  };
});

// ============================================================================
// SPRINT 4 — retention management, delegated intake, discovery, AI drafting,
// completeness trend and generalised material-change evaluation.
// ============================================================================

/**
 * E47. A retention rule as a reusable object an organisation owns, rather than a
 * string typed again into every activity.
 *
 * The register already had `retention_period` on the activity and on each data
 * category, and both are free varchars — which is why a register can hold "7
 * years", "7 yrs", "seven years" and "6_months" for the same statutory clock, and
 * why nothing could answer "which activities does the accounting retention rule
 * cover, and who owns it". A schedule is the object that answer hangs off: it has
 * a period, the *event the period runs from*, the law that sets it, the
 * jurisdiction that law belongs to, an owner and a review date.
 *
 * The free-text columns on the activity and the category are deliberately kept.
 * Attaching a schedule is an upgrade, not a migration — a register that refuses to
 * open until every period has been re-entered as a schedule is a register that
 * gets abandoned at the first tab.
 */
export const retentionSchedules = pgTable('retention_schedules', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),

  name: varchar('name', { length: 160 }).notNull(),
  description: text('description'),

  /**
   * E48/E49. A number and a unit rather than a string, so a disposal date can be
   * computed rather than read. `indefinite` and `until_event` carry no number:
   * the first is a claim that needs a justification (and fails a gap rule without
   * one), the second defers to a trigger that has no clock of its own.
   */
  periodValue: integer('period_value'),
  periodUnit: varchar('period_unit', { length: 20 }).notNull().default('years'),

  /**
   * E48. The event the period runs from. "Six years" is not a retention rule;
   * "six years from the end of the contract" is, and the two produce disposal
   * dates that can be a decade apart for the same record.
   */
  trigger: varchar('trigger', { length: 40 }).notNull().default('collection'),
  triggerDetail: text('trigger_detail'),

  /** The provision that sets the period, and the law it belongs to. */
  statutoryCitation: varchar('statutory_citation', { length: 255 }),
  jurisdiction: char('jurisdiction', { length: 2 }),

  /** Art. 5(1)(e) asks the controller to justify the period, not merely state it. */
  justification: text('justification'),

  /** What happens at the end — deletion is not the only lawful answer. */
  disposalMethod: varchar('disposal_method', { length: 30 }).notNull().default('deletion'),

  ownerId: uuid('owner_id').references(() => users.id),
  reviewIntervalMonths: integer('review_interval_months'),
  lastReviewedAt: timestamp('last_reviewed_at', { withTimezone: true }),
  nextReviewAt: timestamp('next_review_at', { withTimezone: true }),

  status: varchar('status', { length: 20 }).notNull().default('active'),

  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
}, (table) => {
  return {
    orgIdx: index('idx_retention_schedules_org').on(table.organizationId),
    // E50 review queue is "every schedule whose review date has passed", across
    // the whole organisation, which is this index exactly.
    orgReviewIdx: index('idx_retention_schedules_org_review').on(table.organizationId, table.nextReviewAt),
    // A schedule name is how people refer to the rule in conversation; two rules
    // called "Payroll" in one organisation is a data-entry slip, not a fact.
    orgNameUnq: unique('retention_schedules_org_name_unq').on(table.organizationId, table.name),
  };
});

/**
 * E52. A legal hold suspends a retention rule for named activities.
 *
 * Litigation hold is the one thing that legitimately overrides storage limitation,
 * and a register with no way to express it produces exactly one of two failures: a
 * disposal that destroys evidence, or a blanket "we never delete anything" that
 * abandons Art. 5(1)(e) entirely. The hold carries a reason, an owner and an
 * expiry, because a hold nobody ever releases is the second failure wearing a hat.
 */
export const legalHolds = pgTable('legal_holds', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),

  reference: varchar('reference', { length: 120 }).notNull(),
  reason: text('reason').notNull(),
  /** litigation | regulatory_investigation | audit | internal_investigation | other */
  holdType: varchar('hold_type', { length: 40 }).notNull().default('litigation'),

  ownerId: uuid('owner_id').references(() => users.id),
  issuedAt: timestamp('issued_at', { withTimezone: true }).notNull().defaultNow(),
  /**
   * Nullable, and the nullability is the point: an open-ended hold is a real thing
   * and pretending otherwise would make people invent a date. The review date
   * below is what stops it being forgotten.
   */
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  nextReviewAt: timestamp('next_review_at', { withTimezone: true }),

  status: varchar('status', { length: 20 }).notNull().default('active'),
  releasedAt: timestamp('released_at', { withTimezone: true }),
  releasedBy: uuid('released_by').references(() => users.id),
  releaseNote: text('release_note'),

  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => {
  return {
    orgIdx: index('idx_legal_holds_org').on(table.organizationId),
    orgStatusIdx: index('idx_legal_holds_org_status').on(table.organizationId, table.status),
  };
});

/**
 * Which activities a hold covers. A join table rather than a jsonb array on the
 * hold, because the question asked far more often is the reverse one — "is this
 * activity under hold right now" — and the disposal report asks it once per
 * activity.
 */
export const legalHoldActivities = pgTable('legal_hold_activities', {
  id: uuid('id').defaultRandom().primaryKey(),
  legalHoldId: uuid('legal_hold_id').notNull().references(() => legalHolds.id, { onDelete: 'cascade' }),
  processingActivityId: uuid('processing_activity_id').notNull().references(() => processingActivities.id, { onDelete: 'cascade' }),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => {
  return {
    holdIdx: index('idx_legal_hold_activities_hold').on(table.legalHoldId),
    activityIdx: index('idx_legal_hold_activities_activity').on(table.processingActivityId),
    unq: unique('legal_hold_activities_hold_activity_unq').on(table.legalHoldId, table.processingActivityId),
  };
});

/**
 * E51. The disposal log — what was due, what was done, and the evidence for it.
 *
 * Two kinds of row live here and they are the same shape on purpose. The worker
 * writes a `due` row when a schedule clock runs out on an activity; a person
 * completes it with a method, a count and evidence. A register that can only say
 * "we delete after seven years" is asserting a policy; one that can show the run
 * that executed it, on which date, over how many records, is showing compliance.
 *
 * `due_key` is what makes the worker idempotent. It is the schedule clock for one
 * activity expressed as a date, so re-running the scan on the same day finds the
 * row it wrote yesterday instead of writing a second one — the same pattern
 * `consent_findings` uses, and the reason the column is NOT NULL.
 */
export const retentionDisposals = pgTable('retention_disposals', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  processingActivityId: uuid('processing_activity_id').notNull().references(() => processingActivities.id, { onDelete: 'cascade' }),
  retentionScheduleId: uuid('retention_schedule_id').references(() => retentionSchedules.id, { onDelete: 'set null' }),
  dataCategoryId: uuid('data_category_id').references(() => processingDataCategories.id, { onDelete: 'set null' }),

  dueKey: varchar('due_key', { length: 64 }).notNull().default(''),
  dueAt: timestamp('due_at', { withTimezone: true }).notNull(),

  /** due | completed | deferred | on_hold | not_required */
  status: varchar('status', { length: 20 }).notNull().default('due'),

  performedAt: timestamp('performed_at', { withTimezone: true }),
  performedBy: uuid('performed_by').references(() => users.id),
  /** deletion | anonymisation | return_to_controller | archive */
  method: varchar('method', { length: 30 }),
  recordCount: integer('record_count'),
  /** Which systems the disposal was executed in — the part an auditor asks about. */
  systems: jsonb('systems').default([]),
  evidence: jsonb('evidence').default([]),
  note: text('note'),

  /** E52. Set when the due date passed while a hold covered the activity. */
  legalHoldId: uuid('legal_hold_id').references(() => legalHolds.id, { onDelete: 'set null' }),
  deferredUntil: timestamp('deferred_until', { withTimezone: true }),
  deferralReason: text('deferral_reason'),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => {
  return {
    orgIdx: index('idx_retention_disposals_org').on(table.organizationId),
    orgStatusDueIdx: index('idx_retention_disposals_org_status_due').on(table.organizationId, table.status, table.dueAt),
    activityIdx: index('idx_retention_disposals_activity').on(table.processingActivityId),
    unq: unique('retention_disposals_activity_due_key_unq').on(table.processingActivityId, table.dueKey),
  };
});

/**
 * C32/C33. A questionnaire sent to whoever actually knows what the processing does.
 *
 * The population problem is not that the fields are hard; it is that the person
 * who can answer them does not have a Custodia account and is never going to get
 * one. So the request is addressed by email and answered through an unguessable
 * token — the same access-control shape `vendor_questionnaires` uses, for the same
 * reason.
 *
 * What comes back is *not* written into the register. It lands in `answers` and
 * waits for a privacy reviewer to accept it field by field, which is the whole
 * difference between delegated intake and letting a department head edit the
 * Article 30 record directly.
 */
export const ropaIntakeRequests = pgTable('ropa_intake_requests', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),

  /**
   * Null for an interview-mode request that will create a new activity; set when
   * the request asks a business owner to confirm or update one that exists.
   */
  processingActivityId: uuid('processing_activity_id').references(() => processingActivities.id, { onDelete: 'cascade' }),

  token: uuid('token').defaultRandom().notNull().unique(),

  /** interview | review | update — decides which question set is served. */
  kind: varchar('kind', { length: 20 }).notNull().default('interview'),

  recipientEmail: varchar('recipient_email', { length: 255 }).notNull(),
  recipientName: varchar('recipient_name', { length: 160 }),
  department: varchar('department', { length: 120 }),

  subject: varchar('subject', { length: 255 }),
  message: text('message'),
  locale: varchar('locale', { length: 5 }).notNull().default('en'),

  /**
   * The questions as served, frozen on the request. A question set that changes
   * under a half-finished response is a response that answers questions nobody
   * asked, and the merge screen has to be able to show what was actually put to
   * the respondent.
   */
  questions: jsonb('questions').notNull().default([]),
  answers: jsonb('answers').notNull().default({}),

  /** draft | sent | opened | submitted | merged | declined | cancelled | expired */
  status: varchar('status', { length: 20 }).notNull().default('draft'),

  dueAt: timestamp('due_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  openedAt: timestamp('opened_at', { withTimezone: true }),
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  submittedByName: varchar('submitted_by_name', { length: 160 }),
  declinedReason: text('declined_reason'),

  remindersSent: integer('reminders_sent').notNull().default(0),
  lastReminderAt: timestamp('last_reminder_at', { withTimezone: true }),

  /**
   * Which answers a reviewer took, keyed by question id. Kept after the merge so
   * "where did this field come from" has an answer that is not a guess — the audit
   * trail records the write, this records the provenance.
   */
  mergedFields: jsonb('merged_fields').default({}),
  mergedAt: timestamp('merged_at', { withTimezone: true }),
  mergedBy: uuid('merged_by').references(() => users.id),
  createdActivityId: uuid('created_activity_id').references(() => processingActivities.id, { onDelete: 'set null' }),

  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => {
  return {
    orgIdx: index('idx_ropa_intake_org').on(table.organizationId),
    orgStatusIdx: index('idx_ropa_intake_org_status').on(table.organizationId, table.status),
    activityIdx: index('idx_ropa_intake_activity').on(table.processingActivityId),
    // The reminder ladder scans "sent, not submitted, due soon" across every org.
    dueIdx: index('idx_ropa_intake_due').on(table.status, table.dueAt),
  };
});

/**
 * C34–C36. Something outside the register suggests processing the register does
 * not account for.
 *
 * Three sources, one table, because the *shape* of the finding is identical and so
 * is the reviewer decision: a vendor nothing references, a tracker no activity
 * explains, a connected SaaS app with no record behind it. Splitting them into
 * three tables would mean three queues, three dismissal flows and three chances
 * for one of them to be forgotten.
 *
 * The unique key over (org, source, source_key) is the same bargain
 * `consent_findings` makes: an upsert bumps `last_seen_at`, a completed scan
 * resolves anything it did not touch, and re-running the scan is free. Dismissal
 * survives it — a signal a human has already judged does not come back next week
 * with a fresh id and the same text.
 */
export const ropaDiscoverySignals = pgTable('ropa_discovery_signals', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),

  /** vendor_register | tracker_scan | saas_connector */
  source: varchar('source', { length: 30 }).notNull(),
  /**
   * The natural key within the source — a vendor id, a tracker name on a domain, a
   * connector app identifier. NOT NULL and defaulted to '' because Postgres treats
   * NULLs in a unique constraint as distinct, which would let every scan insert a
   * fresh duplicate.
   */
  sourceKey: varchar('source_key', { length: 255 }).notNull().default(''),

  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  /** high | medium | low — how confident the rule is that this is real processing. */
  confidence: varchar('confidence', { length: 20 }).notNull().default('medium'),

  /** The draft a reviewer would accept, as fields rather than prose. */
  suggestedName: varchar('suggested_name', { length: 255 }),
  suggestedPurpose: text('suggested_purpose'),
  suggestedLawfulBasis: varchar('suggested_lawful_basis', { length: 50 }),
  suggestedDataCategories: jsonb('suggested_data_categories').default([]),
  suggestedDataSubjects: jsonb('suggested_data_subjects').default([]),
  suggestedRecipients: jsonb('suggested_recipients').default([]),
  suggestedTransfers: jsonb('suggested_transfers').default([]),

  /** What the rule saw. Rendered on the card, because a suggestion with no evidence is a guess. */
  evidence: jsonb('evidence').default({}),

  vendorId: uuid('vendor_id'),
  consentDomainId: uuid('consent_domain_id').references(() => consentDomains.id, { onDelete: 'set null' }),
  integrationId: uuid('integration_id').references(() => organizationIntegrations.id, { onDelete: 'set null' }),

  /** open | accepted | dismissed | resolved */
  status: varchar('status', { length: 20 }).notNull().default('open'),

  acceptedActivityId: uuid('accepted_activity_id').references(() => processingActivities.id, { onDelete: 'set null' }),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  acceptedBy: uuid('accepted_by').references(() => users.id),

  dismissedReason: text('dismissed_reason'),
  dismissedAt: timestamp('dismissed_at', { withTimezone: true }),
  dismissedBy: uuid('dismissed_by').references(() => users.id),

  firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).defaultNow(),
  detectionCount: integer('detection_count').notNull().default(1),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => {
  return {
    orgIdx: index('idx_ropa_discovery_org').on(table.organizationId),
    orgStatusIdx: index('idx_ropa_discovery_org_status').on(table.organizationId, table.status),
    unq: unique('ropa_discovery_signals_org_source_key_unq').on(table.organizationId, table.source, table.sourceKey),
  };
});

/**
 * C37. A proposed activity, field by field, with what the reviewer did to each.
 *
 * The existing panel returns a blob of prose and can apply two fields of it. What
 * makes AI drafting worth having is the opposite property: every proposed value is
 * separately visible, separately sourced, and separately accepted or rejected —
 * because a draft a DPO cannot audit is a draft a DPO has to retype.
 *
 * The decisions are stored rather than applied-and-forgotten, so that "who put this
 * in the register" is answerable about a field a model proposed and a human
 * accepted, which is not the same statement as either alone.
 */
export const ropaActivityDrafts = pgTable('ropa_activity_drafts', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),

  /** Set when drafting *into* an existing activity rather than proposing a new one. */
  processingActivityId: uuid('processing_activity_id').references(() => processingActivities.id, { onDelete: 'cascade' }),
  discoverySignalId: uuid('discovery_signal_id').references(() => ropaDiscoverySignals.id, { onDelete: 'set null' }),
  intakeRequestId: uuid('intake_request_id').references(() => ropaIntakeRequests.id, { onDelete: 'set null' }),

  /** The one-line description the draft was generated from. */
  prompt: text('prompt').notNull(),
  model: varchar('model', { length: 80 }),

  /** field id -> { value, rationale, confidence, article } */
  proposal: jsonb('proposal').notNull().default({}),
  /** field id -> { decision: accepted|rejected|pending, value, decidedAt, decidedBy } */
  decisions: jsonb('decisions').notNull().default({}),

  /** proposed | partially_applied | applied | discarded */
  status: varchar('status', { length: 20 }).notNull().default('proposed'),

  appliedActivityId: uuid('applied_activity_id').references(() => processingActivities.id, { onDelete: 'set null' }),
  appliedAt: timestamp('applied_at', { withTimezone: true }),
  appliedBy: uuid('applied_by').references(() => users.id),

  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => {
  return {
    orgIdx: index('idx_ropa_drafts_org').on(table.organizationId),
    orgStatusIdx: index('idx_ropa_drafts_org_status').on(table.organizationId, table.status),
    activityIdx: index('idx_ropa_drafts_activity').on(table.processingActivityId),
  };
});

/**
 * P123. One row per organisation per day: what the register scored and what was
 * missing from it.
 *
 * A completeness score with no history answers "is the register complete"; a trend
 * answers "is it getting better", which is the question a DPO is actually asked at
 * a board meeting and the one a spreadsheet cannot answer at all. Kept as a daily
 * roll-up rather than derived from the version table because versions are written
 * on edit — a register nobody touched for a month would have no points on the
 * graph, and a flat line is a real answer.
 *
 * `by_requirement` is the interesting column: the same requirement keys
 * `scoreActivity` produces, counted, so "retention is missing on 40 of 112
 * activities" is a number rather than an impression.
 */
export const ropaCompletenessSnapshots = pgTable('ropa_completeness_snapshots', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),

  capturedOn: date('captured_on').notNull(),

  activityCount: integer('activity_count').notNull().default(0),
  activeCount: integer('active_count').notNull().default(0),
  averageScore: integer('average_score').notNull().default(0),
  /** Activities carrying at least one publication blocker. */
  blockedCount: integer('blocked_count').notNull().default(0),
  /** { low, medium, high } — the same bands the register filters on. */
  bands: jsonb('bands').notNull().default({}),
  /** requirement id -> number of activities where it is missing or partial. */
  byRequirement: jsonb('by_requirement').notNull().default({}),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => {
  return {
    orgIdx: index('idx_ropa_completeness_snapshots_org').on(table.organizationId, table.capturedOn),
    unq: unique('ropa_completeness_snapshots_org_day_unq').on(table.organizationId, table.capturedOn),
  };
});

/**
 * P125. A change to an activity, classified against what the change obliges.
 *
 * The re-consent worker was the best idea in the module and it watched one field.
 * The generalisation is not "watch more fields" — it is that a material change has
 * *three different consequences* and they do not travel together. Adding a data
 * category to a consent-based activity needs fresh consent; adding a recipient to
 * a contract-based one needs the privacy notice updated under Art. 13(3) and no
 * consent at all; widening the subject population to children needs the DPIA
 * looked at again under Art. 35(11) and possibly neither of the other two.
 *
 * So the row holds the diff, a verdict per consequence, and one status — because
 * the register user works a queue, not three.
 */
export const materialChangeEvents = pgTable('material_change_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  processingActivityId: uuid('processing_activity_id').notNull().references(() => processingActivities.id, { onDelete: 'cascade' }),

  /** The two snapshots the diff was taken between, where both exist. */
  fromVersionId: uuid('from_version_id').references(() => processingActivityVersions.id, { onDelete: 'set null' }),
  toVersionId: uuid('to_version_id').references(() => processingActivityVersions.id, { onDelete: 'set null' }),

  /** The changed fields, in the shape `diffSnapshots` returns. */
  changes: jsonb('changes').notNull().default([]),

  /** none | advisory | material — the overall verdict, for the badge on the queue. */
  materiality: varchar('materiality', { length: 20 }).notNull().default('advisory'),
  /** Subset of ['reconsent','notice_update','dpia_reassessment']. */
  consequences: jsonb('consequences').notNull().default([]),
  /** consequence -> { required, confidence, reasoning, articles } */
  verdicts: jsonb('verdicts').notNull().default({}),

  /** rules | ai — whether a model was asked, or the deterministic rules settled it. */
  evaluatedBy: varchar('evaluated_by', { length: 20 }).notNull().default('rules'),

  /** open | acknowledged | actioned | dismissed */
  status: varchar('status', { length: 20 }).notNull().default('open'),
  reviewedBy: uuid('reviewed_by').references(() => users.id),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  reviewNote: text('review_note'),

  detectedAt: timestamp('detected_at', { withTimezone: true }).defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => {
  return {
    orgIdx: index('idx_material_change_org').on(table.organizationId),
    orgStatusIdx: index('idx_material_change_org_status').on(table.organizationId, table.status),
    activityIdx: index('idx_material_change_activity').on(table.processingActivityId),
  };
});

// ---------------------------------------------------------------------------
// Sprint 4 relations.
//
// `with:` in a relational query is not typechecked — Drizzle widens the key type
// for a table with no relations() block and the dialect throws while *building*
// the query, so the caller fails on every invocation. check:relations resolves
// every key against this file; each `many()` below carries its `one()` back.
// ---------------------------------------------------------------------------

export const retentionSchedulesRelations = relations(retentionSchedules, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [retentionSchedules.organizationId],
    references: [organizations.id],
  }),
  owner: one(users, {
    fields: [retentionSchedules.ownerId],
    references: [users.id],
  }),
  activities: many(processingActivities),
  disposals: many(retentionDisposals),
}));

export const legalHoldsRelations = relations(legalHolds, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [legalHolds.organizationId],
    references: [organizations.id],
  }),
  owner: one(users, {
    fields: [legalHolds.ownerId],
    references: [users.id],
  }),
  activities: many(legalHoldActivities),
  disposals: many(retentionDisposals),
}));

export const legalHoldActivitiesRelations = relations(legalHoldActivities, ({ one }) => ({
  hold: one(legalHolds, {
    fields: [legalHoldActivities.legalHoldId],
    references: [legalHolds.id],
  }),
  activity: one(processingActivities, {
    fields: [legalHoldActivities.processingActivityId],
    references: [processingActivities.id],
  }),
}));

export const retentionDisposalsRelations = relations(retentionDisposals, ({ one }) => ({
  organization: one(organizations, {
    fields: [retentionDisposals.organizationId],
    references: [organizations.id],
  }),
  activity: one(processingActivities, {
    fields: [retentionDisposals.processingActivityId],
    references: [processingActivities.id],
  }),
  schedule: one(retentionSchedules, {
    fields: [retentionDisposals.retentionScheduleId],
    references: [retentionSchedules.id],
  }),
  dataCategory: one(processingDataCategories, {
    fields: [retentionDisposals.dataCategoryId],
    references: [processingDataCategories.id],
  }),
  hold: one(legalHolds, {
    fields: [retentionDisposals.legalHoldId],
    references: [legalHolds.id],
  }),
  performer: one(users, {
    fields: [retentionDisposals.performedBy],
    references: [users.id],
  }),
}));

export const ropaIntakeRequestsRelations = relations(ropaIntakeRequests, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [ropaIntakeRequests.organizationId],
    references: [organizations.id],
  }),
  activity: one(processingActivities, {
    fields: [ropaIntakeRequests.processingActivityId],
    references: [processingActivities.id],
  }),
  creator: one(users, {
    fields: [ropaIntakeRequests.createdBy],
    references: [users.id],
  }),
  drafts: many(ropaActivityDrafts),
}));

export const ropaDiscoverySignalsRelations = relations(ropaDiscoverySignals, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [ropaDiscoverySignals.organizationId],
    references: [organizations.id],
  }),
  acceptedActivity: one(processingActivities, {
    fields: [ropaDiscoverySignals.acceptedActivityId],
    references: [processingActivities.id],
  }),
  domain: one(consentDomains, {
    fields: [ropaDiscoverySignals.consentDomainId],
    references: [consentDomains.id],
  }),
  integration: one(organizationIntegrations, {
    fields: [ropaDiscoverySignals.integrationId],
    references: [organizationIntegrations.id],
  }),
  drafts: many(ropaActivityDrafts),
}));

export const ropaActivityDraftsRelations = relations(ropaActivityDrafts, ({ one }) => ({
  organization: one(organizations, {
    fields: [ropaActivityDrafts.organizationId],
    references: [organizations.id],
  }),
  activity: one(processingActivities, {
    fields: [ropaActivityDrafts.processingActivityId],
    references: [processingActivities.id],
  }),
  signal: one(ropaDiscoverySignals, {
    fields: [ropaActivityDrafts.discoverySignalId],
    references: [ropaDiscoverySignals.id],
  }),
  intakeRequest: one(ropaIntakeRequests, {
    fields: [ropaActivityDrafts.intakeRequestId],
    references: [ropaIntakeRequests.id],
  }),
  author: one(users, {
    fields: [ropaActivityDrafts.createdBy],
    references: [users.id],
  }),
}));

export const ropaCompletenessSnapshotsRelations = relations(ropaCompletenessSnapshots, ({ one }) => ({
  organization: one(organizations, {
    fields: [ropaCompletenessSnapshots.organizationId],
    references: [organizations.id],
  }),
}));

export const materialChangeEventsRelations = relations(materialChangeEvents, ({ one }) => ({
  organization: one(organizations, {
    fields: [materialChangeEvents.organizationId],
    references: [organizations.id],
  }),
  activity: one(processingActivities, {
    fields: [materialChangeEvents.processingActivityId],
    references: [processingActivities.id],
  }),
  fromVersion: one(processingActivityVersions, {
    fields: [materialChangeEvents.fromVersionId],
    references: [processingActivityVersions.id],
  }),
  toVersion: one(processingActivityVersions, {
    fields: [materialChangeEvents.toVersionId],
    references: [processingActivityVersions.id],
  }),
  reviewer: one(users, {
    fields: [materialChangeEvents.reviewedBy],
    references: [users.id],
  }),
}));
