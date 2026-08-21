import { createWorker, createQueue } from '../lib/queue.js';
import { db } from '../db.js';
import { notificationQueue, organizations, users } from 'db';
import { eq, and, sql } from 'drizzle-orm';
import crypto from 'crypto';
import React from 'react';
import { sendEmail } from 'emails';
import {
  MagicLink,
  TeamInvitation,
  WelcomeNewUser,
  PasswordChanged,
  MfaEnabled,
  AssessmentResults,
  AssessmentFollowupDay3,
  AssessmentFollowupDay7,
  AssessmentFollowupDay14,
  DsarAcknowledgment,
  DsarVerification,
  DsarDeadlineWarning,
  DsarCompleted,
  DsarExtensionNotice,
  BreachReported,
  BreachDeadline48h,
  BreachDeadline24h,
  BreachDeadline12h,
  BreachOverdue,
  DpaExpiring30d,
  DpaExpiring7d,
  DpaExpired,
  VendorBreachAlert,
  SubProcessorChanged,
  GapDetected,
  MonthlyReport,
  QuarterlyReport,
  ScoreDropped,
  TrainingAssigned,
  TrainingDue7d,
  TrainingOverdue,
  TrainingCompleted,
  PaymentFailed,
  PaymentSucceeded,
  SubscriptionExpiring,
  TrialEndingSoon,
  DataExportReady,

  } from 'emails';
import { formatSiemPayload } from '../lib/siemFormatters.js';

export const notificationsJobQueue = createQueue('notifications');

const EMAIL_TEMPLATES: Record<string, (data: any) => React.ReactElement> = {
  'auth.magic_link': (data) => React.createElement(MagicLink, data),
  'auth.team_invitation': (data) => React.createElement(TeamInvitation, data),
  'auth.welcome_new_user': (data) => React.createElement(WelcomeNewUser, data),
  'auth.password_changed': (data) => React.createElement(PasswordChanged, data),
  'auth.mfa_enabled': (data) => React.createElement(MfaEnabled, data),
  'assessment.results': (data) => React.createElement(AssessmentResults, data),
  'assessment.followup_day3': (data) => React.createElement(AssessmentFollowupDay3, data),
  'assessment.followup_day7': (data) => React.createElement(AssessmentFollowupDay7, data),
  'assessment.followup_day14': (data) => React.createElement(AssessmentFollowupDay14, data),
  'dsar.acknowledgment': (data) => React.createElement(DsarAcknowledgment, data),
  'dsar.verification': (data) => React.createElement(DsarVerification, data),
  'dsar.deadline_warning': (data) => React.createElement(DsarDeadlineWarning, data),
  'dsar.completed': (data) => React.createElement(DsarCompleted, data),
  'dsar.extension_notice': (data) => React.createElement(DsarExtensionNotice, data),
  'breach.reported': (data) => React.createElement(BreachReported, data),
  'breach.deadline_48h': (data) => React.createElement(BreachDeadline48h, data),
  'breach.deadline_24h': (data) => React.createElement(BreachDeadline24h, data),
  'breach.deadline_12h': (data) => React.createElement(BreachDeadline12h, data),
  'breach.overdue': (data) => React.createElement(BreachOverdue, data),
  'vendor.dpa_expiring_30d': (data) => React.createElement(DpaExpiring30d, data),
  'vendor.dpa_expiring_7d': (data) => React.createElement(DpaExpiring7d, data),
  'vendor.dpa_expired': (data) => React.createElement(DpaExpired, data),
  'vendor.breach_alert': (data) => React.createElement(VendorBreachAlert, data),
  'vendor.sub_processor_changed': (data) => React.createElement(SubProcessorChanged, data),
  'compliance.gap_detected': (data) => React.createElement(GapDetected, data),
  'compliance.monthly_report': (data) => React.createElement(MonthlyReport, data),
  'compliance.quarterly_report': (data) => React.createElement(QuarterlyReport, data),
  'compliance.score_dropped': (data) => React.createElement(ScoreDropped, data),
  'training.assigned': (data) => React.createElement(TrainingAssigned, data),
  'training.due_7d': (data) => React.createElement(TrainingDue7d, data),
  'training.overdue': (data) => React.createElement(TrainingOverdue, data),
  'training.completed': (data) => React.createElement(TrainingCompleted, data),
  'billing.payment_failed': (data) => React.createElement(PaymentFailed, data),
  'billing.payment_succeeded': (data) => React.createElement(PaymentSucceeded, data),
  'billing.subscription_expiring': (data) => React.createElement(SubscriptionExpiring, data),
  'billing.trial_ending_soon': (data) => React.createElement(TrialEndingSoon, data),
  'general.data_export_ready': (data) => React.createElement(DataExportReady, data),
  'general.account_deletion_scheduled': (data) => React.createElement( data),
  'general.account_deletion_canceled': (data) => React.createElement( data),
};

const channelHandlers: Record<string, (notification: any) => Promise<void>> = {
  email: async (notification) => {
    let recipients: string[] = [];
    
    if (notification.emailTo) {
      // C33. An address set by the enqueuer, for a recipient who has no account and
      // is never going to get one — the delegated-intake questionnaire goes to a
      // department head by email and nothing else. Without this branch the row
      // would fall through to "all org admins", which is the wrong people and, for
      // a message carrying an access token, actively wrong.
      recipients = String(notification.emailTo).split(',').map((s) => s.trim()).filter(Boolean);
    } else if (notification.userId) {
      const [u] = await db.select().from(users).where(eq(users.id, notification.userId));
      if (u) recipients.push(u.email);
    } else {
      // Get all org admins
      const orgUsers = await db.select().from(users).where(and(eq(users.organizationId, notification.organizationId), eq(users.role, 'admin')));
      recipients = orgUsers.map(u => u.email);
    }

    if (recipients.length === 0) {
      await db.update(notificationQueue)
        .set({ status: 'skipped', error: 'No valid email recipients found' })
        .where(eq(notificationQueue.id, notification.id));
      return;
    }

    try {
      const templateFn = EMAIL_TEMPLATES[notification.type];

      let payload: any = {};
      try {
        payload = typeof notification.payload === 'string' ? JSON.parse(notification.payload) : notification.payload || {};
      } catch (e) {
        // ignore parse error
      }

      const resolveUrl = (notif: any, payl: any) => {
        if (payl?.url) return payl.url;
        if (!notif.actionUrl) return undefined;
        if (notif.actionUrl.startsWith('http')) return notif.actionUrl;
        return `${process.env.FRONTEND_URL || 'http://localhost:3000'}${notif.actionUrl.startsWith('/') ? '' : '/'}${notif.actionUrl}`;
      };

      const finalUrl = resolveUrl(notification, payload);

      if (templateFn) {
        // Add URL fallback
        const data = {
          ...payload,
          url: finalUrl
        };

        const template = templateFn(data);

        const result = await sendEmail({
          to: recipients,
          subject: notification.title,
          template,
        });

        await db.update(notificationQueue)
          .set({
            status: 'sent',
            sentAt: new Date(),
            emailMessageId: result.data?.id,
            emailTo: recipients.join(', '),
          })
          .where(eq(notificationQueue.id, notification.id));
      } else {
        // Fallback for unknown types
        const result = await sendEmail({
          to: recipients,
          subject: notification.title,
          template: React.createElement('div', {
            style: { fontFamily: 'Arial, sans-serif', padding: '20px', color: '#333' }
          },
            React.createElement('h2', null, notification.title),
            React.createElement('p', null, notification.body),
            finalUrl ? React.createElement('a', {
              href: finalUrl,
              style: { display: 'inline-block', padding: '10px 20px', backgroundColor: '#294036', color: 'white', textDecoration: 'none', borderRadius: '5px', marginTop: '20px' }
            }, 'View Details') : null,
            React.createElement('hr', { style: { marginTop: '40px', border: 'none', borderTop: '1px solid #eee' } }),
            React.createElement('p', { style: { fontSize: '12px', color: '#999' } }, 'This is an automated notification from Custodia. You can manage your preferences in your account settings.')
          )
        });

        await db.update(notificationQueue)
          .set({
            status: 'sent',
            sentAt: new Date(),
            emailMessageId: result.data?.id,
            emailTo: recipients.join(', '),
          })
          .where(eq(notificationQueue.id, notification.id));
      }
    } catch (e: any) {
      throw new Error(`Resend Error: ${e.message}`);
    }
  },
  
  slack: async (notification) => {
    const [org] = await db.select().from(organizations).where(eq(organizations.id, notification.organizationId));
    if (!org?.slackWebhookUrl) {
      await db.update(notificationQueue)
        .set({ status: 'skipped', error: 'No Slack webhook configured' })
        .where(eq(notificationQueue.id, notification.id));
      return;
    }
    
    let payload: any = {};
    try {
      payload = typeof notification.payload === 'string' ? JSON.parse(notification.payload) : notification.payload || {};
    } catch (e) {}

    const resolveUrl = (notif: any, payl: any) => {
      if (payl?.url) return payl.url;
      if (!notif.actionUrl) return undefined;
      if (notif.actionUrl.startsWith('http')) return notif.actionUrl;
      return `${process.env.FRONTEND_URL || 'http://localhost:3000'}${notif.actionUrl.startsWith('/') ? '' : '/'}${notif.actionUrl}`;
    };
    
    const finalUrl = resolveUrl(notification, payload);
    
    const slackPayload = {
      blocks: [
        {
          type: "header",
          text: { type: "plain_text", text: notification.title }
        },
        {
          type: "section",
          text: { type: "mrkdwn", text: notification.body }
        },
        ...(finalUrl ? [{
          type: "actions",
          elements: [
            {
              type: "button",
              text: { type: "plain_text", text: "View Details" },
              url: finalUrl
            }
          ]
        }] : [])
      ]
    };

    const response = await fetch(org.slackWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(slackPayload),
    });
    
    if (!response.ok) throw new Error(`Slack returned ${response.status}`);
    
    await db.update(notificationQueue)
      .set({ status: 'sent', sentAt: new Date() })
      .where(eq(notificationQueue.id, notification.id));
  },
  
  in_app: async (notification) => {
    // In-app notifications are natively available via the table. 
    // Just mark delivered so the UI knows they are ready.
    await db.update(notificationQueue)
      .set({ status: 'delivered', deliveredAt: new Date() })
      .where(eq(notificationQueue.id, notification.id));
  },
  
  webhook: async (notification) => {
    const [org] = await db.select().from(organizations).where(eq(organizations.id, notification.organizationId));
    if (!org) {
      await db.update(notificationQueue)
        .set({ status: 'skipped', error: 'Organization not found' })
        .where(eq(notificationQueue.id, notification.id));
      return;
    }
    
    const webhookUrl = (org.settings as any)?.webhookUrl;
    const webhookSecret = (org.settings as any)?.webhookSecret;

    // Signing with a literal fallback is worse than not signing: the receiver sees
    // a valid X-Custodia-Signature header and trusts the payload, while anyone who
    // has read this file can forge one. Skip instead, and say why.
    if (webhookUrl && !webhookSecret) {
      await db.update(notificationQueue)
        .set({ status: 'skipped', error: 'No webhook signing secret configured' })
        .where(eq(notificationQueue.id, notification.id));
      return;
    }

    if (!webhookUrl) {
      await db.update(notificationQueue)
        .set({ status: 'skipped', error: 'No webhook URL configured' })
        .where(eq(notificationQueue.id, notification.id));
      return;
    }
    
    const payloadStr = JSON.stringify({
      type: notification.type,
      title: notification.title,
      body: notification.body,
      actionUrl: notification.actionUrl,
      timestamp: notification.createdAt,
    });

    const signature = crypto.createHmac('sha256', webhookSecret).update(payloadStr).digest('hex');
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Custodia-Signature': signature,
      },
      body: payloadStr,
    });

    if (!response.ok) throw new Error(`Webhook returned ${response.status}`);
    
    await db.update(notificationQueue)
      .set({ status: 'sent', sentAt: new Date() })
      .where(eq(notificationQueue.id, notification.id));
  },

  siem: async (notification) => {
    const [org] = await db.select().from(organizations).where(eq(organizations.id, notification.organizationId));
    if (!org) {
      await db.update(notificationQueue)
        .set({ status: 'skipped', error: 'Organization not found' })
        .where(eq(notificationQueue.id, notification.id));
      return;
    }

    if (!org.siemEnabled || !org.siemEndpointUrl) {
      await db.update(notificationQueue)
        .set({ status: 'skipped', error: 'SIEM not enabled or configured' })
        .where(eq(notificationQueue.id, notification.id));
      return;
    }

    const payloadObj = typeof notification.payload === 'string' ? JSON.parse(notification.payload) : notification.payload || {};
    const formattedPayload = formatSiemPayload(org.siemFormat || 'json', payloadObj);

    const headers: Record<string, string> = {
      'Content-Type': org.siemFormat === 'json' ? 'application/json' : 'text/plain',
    };

    if (org.siemAuthHeader) {
      headers['Authorization'] = org.siemAuthHeader;
    }

    const response = await fetch(org.siemEndpointUrl, {
      method: 'POST',
      headers,
      body: formattedPayload,
    });

    if (!response.ok) throw new Error(`SIEM returned ${response.status}`);

    await db.update(notificationQueue)
      .set({ status: 'sent', sentAt: new Date() })
      .where(eq(notificationQueue.id, notification.id));
  },
};

export const notificationWorker = createWorker('notifications', async (job) => {
  console.log(`[NotificationWorker] Running queue processor...`);

  // 1. Fetch pending notifications or those that are scheduled for retry
  const pendingNotifications = await db.select().from(notificationQueue).where(
    sql`${notificationQueue.status} = 'pending' OR (${notificationQueue.status} = 'failed' AND ${notificationQueue.attempts} < ${notificationQueue.maxAttempts} AND ${notificationQueue.nextRetryAt} <= NOW())`
  ).limit(50);

  for (const notification of pendingNotifications) {
    try {
      // Mark as processing
      await db.update(notificationQueue)
        .set({ status: 'processing', lastAttemptAt: new Date(), attempts: (notification.attempts || 0) + 1 })
        .where(eq(notificationQueue.id, notification.id));

      const handler = channelHandlers[notification.channel];
      if (handler) {
        await handler(notification);
      } else {
        await db.update(notificationQueue)
          .set({ status: 'skipped', error: `Unknown channel ${notification.channel}` })
          .where(eq(notificationQueue.id, notification.id));
      }
    } catch (error: any) {
      console.error(`[NotificationWorker] Failed to process notification ${notification.id}`, error);
      
      const newAttempts = (notification.attempts || 0) + 1;
      const maxAttempts = notification.maxAttempts || 3;
      
      if (newAttempts >= maxAttempts) {
        // Permanently fail
        await db.update(notificationQueue)
          .set({ status: 'failed', error: error.message })
          .where(eq(notificationQueue.id, notification.id));
      } else {
        // Exponential backoff retry (e.g., 1m, 5m, 15m)
        const backoffMinutes = [1, 5, 15][newAttempts - 1] || 30;
        const nextRetry = new Date(Date.now() + backoffMinutes * 60000);
        
        await db.update(notificationQueue)
          .set({ status: 'failed', error: error.message, nextRetryAt: nextRetry })
          .where(eq(notificationQueue.id, notification.id));
      }
    }
  }

  return { processed: pendingNotifications.length };
}, { drainDelay: 15 });


