import { 
  pgTable, 
  uuid, 
  varchar, 
  boolean, 
  integer, 
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
  subscriptionTier: subscriptionTierEnum('subscription_tier').default('starter'),
  subscriptionStatus: varchar('subscription_status', { length: 50 }).default('trialing'),
  
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
});

export const documents = pgTable('documents', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  uploaderId: uuid('uploader_id').references(() => users.id),
  
  filename: varchar('filename', { length: 255 }).notNull(),
  originalName: varchar('original_name', { length: 255 }).notNull(),
  mimeType: varchar('mime_type', { length: 100 }),
  sizeBytes: integer('size_bytes'),
  
  s3Key: varchar('s3_key', { length: 500 }).notNull(),
  encryptionKeyId: varchar('encryption_key_id', { length: 255 }),
  
  status: varchar('status', { length: 50 }).default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
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
  portalToken: varchar('portal_token', { length: 255 }).unique(),
  
  complianceSummary: jsonb('compliance_summary').default({}),
  notes: text('notes'),
  
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
  
  retentionPeriod: varchar('retention_period', { length: 100 }),
  retentionJustification: text('retention_justification'),
  retentionReviewDate: timestamp('retention_review_date', { withTimezone: true }),
  deletionProcedure: text('deletion_procedure'),
  
  securityMeasures: jsonb('security_measures').default([]),
  securityMeasuresDetail: text('security_measures_detail'),
  
  status: varchar('status', { length: 50 }).default('draft'),
  riskLevel: varchar('risk_level', { length: 20 }).default('low'),
  requiresDpia: boolean('requires_dpia').default(false),
  dpiaId: uuid('dpia_id'),
  
  lastReviewedAt: timestamp('last_reviewed_at', { withTimezone: true }),
  nextReviewAt: timestamp('next_review_at', { withTimezone: true }),
  reviewedBy: uuid('reviewed_by').references(() => users.id),
  
  version: integer('version').default(1),
  previousVersionId: uuid('previous_version_id'),
  
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  source: varchar('source', { length: 50 }).default('template'),
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

export const legitimateInterestAssessments = pgTable('legitimate_interest_assessments', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  processingActivityId: uuid('processing_activity_id').notNull().references(() => processingActivities.id, { onDelete: 'cascade' }),
  
  purposeTestLegitimateInterest: text('purpose_test_legitimate_interest').notNull(),
  purposeTestIsLawful: boolean('purpose_test_is_lawful').default(true),
  purposeTestEvidence: text('purpose_test_evidence'),
  
  necessityTestIsNecessary: text('necessity_test_is_necessary').notNull(),
  necessityTestAlternatives: text('necessity_test_alternatives'),
  necessityTestConclusion: text('necessity_test_conclusion'),
  
  balancingTestImpact: text('balancing_test_impact').notNull(),
  balancingTestExpectation: text('balancing_test_expectation'),
  balancingTestSafeguards: text('balancing_test_safeguards'),
  balancingTestOverrides: text('balancing_test_overrides').notNull(),
  
  outcome: varchar('outcome', { length: 50 }).notNull(),
  assessedBy: uuid('assessed_by').references(() => users.id),
  assessedAt: timestamp('assessed_at', { withTimezone: true }).defaultNow(),
  nextReviewAt: timestamp('next_review_at', { withTimezone: true }),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const processingDataCategories = pgTable('processing_data_categories', {
  id: uuid('id').defaultRandom().primaryKey(),
  processingActivityId: uuid('processing_activity_id').notNull().references(() => processingActivities.id, { onDelete: 'cascade' }),
  
  category: varchar('category', { length: 100 }).notNull(),
  categoryGroup: varchar('category_group', { length: 100 }).notNull(),
  description: text('description'),
  
  source: varchar('source', { length: 100 }),
  sourceDetail: text('source_detail'),
  
  isSpecialCategory: boolean('is_special_category').default(false),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const processingRecipients = pgTable('processing_recipients', {
  id: uuid('id').defaultRandom().primaryKey(),
  processingActivityId: uuid('processing_activity_id').notNull().references(() => processingActivities.id, { onDelete: 'cascade' }),
  
  recipientType: varchar('recipient_type', { length: 50 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
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
  residualRisks: jsonb('residual_risks').default([]),
  lastMitigationReminderSentAt: timestamp('last_mitigation_reminder_sent_at', { withTimezone: true }),
});

export const dpiaRisks = pgTable('dpia_risks', {
  id: uuid('id').defaultRandom().primaryKey(),
  dpiaId: uuid('dpia_id').notNull().references(() => dpias.id, { onDelete: 'cascade' }),
  
  description: text('description').notNull(),
  likelihood: integer('likelihood'),
  severity: integer('severity'),
  initialRiskScore: integer('initial_risk_score'),
  residualRiskScore: integer('residual_risk_score'),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const dpiaMeasures = pgTable('dpia_measures', {
  id: uuid('id').defaultRandom().primaryKey(),
  dpiaRiskId: uuid('dpia_risk_id').notNull().references(() => dpiaRisks.id, { onDelete: 'cascade' }),
  
  description: text('description').notNull(),
  status: varchar('status', { length: 50 }).default('planned'),
  implementedAt: timestamp('implemented_at', { withTimezone: true }),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

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
  
  transferMechanisms: jsonb('transfer_mechanisms').default([]),
  euHostingAvailable: boolean('eu_hosting_available').default(false),
  euHostingDetail: text('eu_hosting_detail'),
  
  securityCertifications: jsonb('security_certifications').default([]),
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
  
  knownIncidents: jsonb('known_incidents').default([]),
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
  
  dataCategoriesShared: jsonb('data_categories_shared').default([]),
  processingActivities: jsonb('processing_activities').default([]),
  purpose: text('purpose'),
  usingEuHosting: boolean('using_eu_hosting').default(false),
  
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
  
  lastReviewedAt: timestamp('last_reviewed_at', { withTimezone: true }),
  nextReviewAt: timestamp('next_review_at', { withTimezone: true }),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
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
  questions: jsonb('questions').notNull(), // array of question objects: { id, text, category, type: 'choice' | 'text', options: [{ text, score }] }
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
  description: text('description').notNull(),
  gdprArticleReference: varchar('gdpr_article_reference', { length: 255 }),
  gdprArticles: integer('gdpr_articles').array(),
  priority: varchar('priority', { length: 50 }).notNull(),
  status: varchar('status', { length: 50 }).default('open'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// ============================================================================
// AUTH.JS TABLES
// ============================================================================

export const accounts = pgTable(
  "account",
  {
    userId: uuid("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 255 }).notNull(),
    provider: varchar("provider", { length: 255 }).notNull(),
    providerAccountId: varchar("providerAccountId", { length: 255 }).notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: varchar("token_type", { length: 255 }),
    scope: varchar("scope", { length: 255 }),
    id_token: text("id_token"),
    session_state: varchar("session_state", { length: 255 }),
  },
  (account) => ({
    compoundKey: primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  })
);

export const sessions = pgTable("session", {
  sessionToken: varchar("sessionToken", { length: 255 }).notNull().primaryKey(),
  userId: uuid("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: varchar("identifier", { length: 255 }).notNull(),
    token: varchar("token", { length: 255 }).notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => ({
    compoundKey: primaryKey({ columns: [vt.identifier, vt.token] }),
  })
);

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
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('idx_audit_logs_org_id').on(table.organizationId),
  createdAtIdx: index('idx_audit_logs_created_at').on(table.createdAt),
  actionIdx: index('idx_audit_logs_action').on(table.action),
  resourceTypeIdx: index('idx_audit_logs_resource_type').on(table.resourceType),
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
  
  bannerConfig: jsonb('banner_config').default('{}'),
  categories: jsonb('categories').default('["necessary", "analytics", "marketing", "functional"]'),
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
  categoriesRejected: jsonb('categories_rejected').default('[]'),
  
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
  dataCategoriesAffected: jsonb('data_categories_affected').default('[]'),
  dataSubjectsAffected: jsonb('data_subjects_affected').default('[]'),
  estimatedRecordsAffected: integer('estimated_records_affected'),
  estimatedIndividualsAffected: integer('estimated_individuals_affected'),
  affectedSystems: jsonb('affected_systems').default('[]'),
  
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
  sources: jsonb('sources').default([]),
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

  accessToken: text('access_token').notNull(),
  refreshToken: text('refresh_token'),
  tokenType: varchar('token_type', { length: 50 }).default('Bearer'),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  scopes: jsonb('scopes').default('[]'),

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

  scopes: jsonb('scopes').default('["read"]'),

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
  
  questions: jsonb('questions').notNull(), // array of { id, text, category, rationale }
  answers: jsonb('answers').default([]), // array of { questionId, textAnswer }
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

export const processingActivitiesRelations = relations(processingActivities, ({ many }) => ({
  dataCategories: many(processingDataCategories),
  recipients: many(processingRecipients),
  clients: many(clientProcessingActivities),
  reconsentFlags: many(reconsentFlags),
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
