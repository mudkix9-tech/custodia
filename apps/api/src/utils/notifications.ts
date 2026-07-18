import { db } from '../db.js';
import { notificationQueue, organizations } from 'db';
import { eq } from 'drizzle-orm';

export const NOTIFICATION_TYPES = {
  // DSAR
  'dsar.received': { defaultChannels: ['email', 'slack', 'in_app'], urgency: 'high' },
  'dsar.deadline_warning_7d': { defaultChannels: ['email', 'in_app'], urgency: 'high' },
  'dsar.deadline_warning_3d': { defaultChannels: ['email', 'slack', 'in_app'], urgency: 'critical' },
  'dsar.deadline_warning_1d': { defaultChannels: ['email', 'slack', 'in_app'], urgency: 'critical' },
  'dsar.overdue': { defaultChannels: ['email', 'slack', 'in_app'], urgency: 'critical' },
  'dsar.reply_received': { defaultChannels: ['email', 'slack', 'in_app'], urgency: 'medium' },
  
  // Breaches
  'breach.reported': { defaultChannels: ['email', 'slack', 'in_app'], urgency: 'critical' },
  'breach.deadline_48h': { defaultChannels: ['email', 'slack', 'in_app'], urgency: 'critical' },
  'breach.deadline_24h': { defaultChannels: ['email', 'slack', 'in_app'], urgency: 'critical' },
  'breach.deadline_12h': { defaultChannels: ['email', 'slack', 'in_app'], urgency: 'critical' },
  'breach.overdue': { defaultChannels: ['email', 'slack', 'in_app'], urgency: 'critical' },
  
  // Vendors
  'vendor.dpa_expiring_30d': { defaultChannels: ['email', 'in_app'], urgency: 'medium' },
  'vendor.dpa_expiring_7d': { defaultChannels: ['email', 'slack', 'in_app'], urgency: 'high' },
  'vendor.dpa_expired': { defaultChannels: ['email', 'slack', 'in_app'], urgency: 'critical' },
  'vendor.breach_detected': { defaultChannels: ['email', 'slack', 'in_app'], urgency: 'critical' },
  'vendor.sub_processor_changed': { defaultChannels: ['email', 'slack', 'in_app'], urgency: 'high' },
  'vendor.incident_detected': { defaultChannels: ['email', 'slack', 'in_app'], urgency: 'high' },
  
  // Compliance
  'compliance.gap_detected': { defaultChannels: ['email', 'in_app'], urgency: 'medium' },
  'compliance.gap_critical': { defaultChannels: ['email', 'slack', 'in_app'], urgency: 'high' },
  'compliance.score_dropped': { defaultChannels: ['email', 'slack', 'in_app'], urgency: 'high' },
  'policy.out_of_sync': { defaultChannels: ['email', 'in_app'], urgency: 'medium' },
  'regulatory.update': { defaultChannels: ['email', 'in_app'], urgency: 'medium' },
  
  // Training
  'training.assigned': { defaultChannels: ['email', 'in_app'], urgency: 'medium' },
  'training.due_7d': { defaultChannels: ['email', 'in_app'], urgency: 'medium' },
  'training.overdue': { defaultChannels: ['email', 'slack', 'in_app'], urgency: 'high' },
} as const;

export type NotificationType = keyof typeof NOTIFICATION_TYPES;

interface QueueNotificationParams {
  organizationId: string;
  userId?: string | null;
  type: NotificationType;
  title: string;
  body: string;
  actionUrl?: string;
  metadata?: Record<string, any>;
}

export async function queueNotification(params: QueueNotificationParams) {
  const [org] = await db.select().from(organizations).where(eq(organizations.id, params.organizationId));
  if (!org) throw new Error('Organization not found for notification');

  const orgPrefs = (org.notificationPreferences as Record<string, any>) || {};
  const notificationType = NOTIFICATION_TYPES[params.type];
  
  // Merge defaults with org preferences
  const channelsToUse = orgPrefs[params.type]?.channels || notificationType.defaultChannels;

  // For each configured channel, insert a job into the queue
  for (const channel of channelsToUse) {
    await db.insert(notificationQueue).values({
      organizationId: params.organizationId,
      userId: params.userId || undefined,
      channel,
      type: params.type,
      title: params.title,
      body: params.body,
      actionUrl: params.actionUrl,
      payload: params.metadata || null,
      priority: notificationType.urgency,
      status: 'pending',
    });
  }
}
