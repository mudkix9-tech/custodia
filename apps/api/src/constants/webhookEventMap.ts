export const TRPC_PATH_TO_EVENT: Record<string, string> = {
  // Processing Activities
  'ropa.create': 'ropa.created',
  'ropa.update': 'ropa.updated',
  'ropa.delete': 'ropa.deleted',

  // Vendors
  'vendors.org.link': 'vendor.added',
  'vendors.org.unlink': 'vendor.removed',
  'vendors.org.update': 'vendor.dpa_status_changed',
  'vendors.updateRiskLevel': 'vendor.risk_level_changed', // assuming this is a path
  'vendors.updateSubprocessors': 'vendor.subprocessor_changed', // assuming
  'breaches.reportVendorBreach': 'vendor.breach_reported', // assuming

  // DSARs
  'dsar.submitPublic': 'dsar.created',
  'dsar.updateStatus': 'dsar.status_changed',
  'dsar.extendDeadline': 'dsar.deadline_approaching', // pseudo map
  'dsar.markOverdue': 'dsar.overdue', // pseudo
  'dsar.close': 'dsar.completed',

  // Breaches
  'breaches.report': 'breach.reported',
  'breaches.updateStatus': 'breach.status_changed',
  'breaches.remindDeadline': 'breach.deadline_approaching', // pseudo
  'breaches.notifications.markSent': 'breach.notification_sent',

  // Compliance
  'compliance.updateScore': 'compliance.score_changed', // pseudo
  'complianceGaps.create': 'compliance.gap_detected',
  'complianceGaps.resolve': 'compliance.gap_resolved',

  // Consent
  'consent.domain.detectCookies': 'consent.new_cookies_detected', // pseudo

  // Regulatory
  'regulatory.publishUpdate': 'regulatory.update_published', // pseudo

  // Training
  'training.completions.submitQuiz': 'training.completed',
  'training.markOverdue': 'training.overdue', // pseudo
};
