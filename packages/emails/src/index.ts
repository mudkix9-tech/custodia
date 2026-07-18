// Export templates
export * from './templates/auth/MagicLink';
export * from './templates/auth/TeamInvitation';
export * from './templates/auth/WelcomeNewUser';
export * from './templates/auth/PasswordChanged';
export * from './templates/auth/MfaEnabled';

export * from './templates/assessment/AssessmentResults';
export * from './templates/assessment/AssessmentFollowupDay3';
export * from './templates/assessment/AssessmentFollowupDay7';
export * from './templates/assessment/AssessmentFollowupDay14';

export * from './templates/dsar/DsarAcknowledgment';
export * from './templates/dsar/DsarVerification';
export * from './templates/dsar/DsarDeadlineWarning';
export * from './templates/dsar/DsarCompleted';
export * from './templates/dsar/DsarExtensionNotice';

export * from './templates/breach/BreachReported';
export * from './templates/breach/BreachDeadline48h';
export * from './templates/breach/BreachDeadline24h';
export * from './templates/breach/BreachDeadline12h';
export * from './templates/breach/BreachOverdue';

export * from './templates/vendor/DpaExpiring30d';
export * from './templates/vendor/DpaExpiring7d';
export * from './templates/vendor/DpaExpired';
export * from './templates/vendor/VendorBreachAlert';
export * from './templates/vendor/SubProcessorChanged';
export * from './templates/vendor/AssessmentInvitation';
export * from './templates/vendor/AssessmentReminder';

export * from './templates/compliance/GapDetected';
export * from './templates/compliance/MonthlyReport';
export * from './templates/compliance/QuarterlyReport';
export * from './templates/compliance/ScoreDropped';

export * from './templates/training/TrainingAssigned';
export * from './templates/training/TrainingDue7d';
export * from './templates/training/TrainingOverdue';
export * from './templates/training/TrainingCompleted';

export * from './templates/billing/PaymentFailed';
export * from './templates/billing/PaymentSucceeded';
export * from './templates/billing/SubscriptionExpiring';
export * from './templates/billing/TrialEndingSoon';

export * from './templates/general/DataExportReady';
export * from './templates/general/AccountDeletionScheduled';
export * from './templates/general/AccountDeletionCanceled';

// Export utils
export * from './utils/send';
