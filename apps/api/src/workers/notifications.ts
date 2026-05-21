import { Worker, Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { db } from '../db.js';
import { notificationQueue, organizations, users } from 'db';
import { eq, and, sql } from 'drizzle-orm';
import { Resend } from 'resend';
import crypto from 'crypto';

const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', { maxRetriesPerRequest: null });
export const notificationsJobQueue = new Queue('notifications', { connection });

const resend = new Resend(process.env.RESEND_API_KEY || 're_mock_key');

// Helper to get email templates based on type
function getEmailTemplate(notification: any) {
  return {
    subject: `Privaro Notification: ${notification.title}`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
        <h2>${notification.title}</h2>
        <p>${notification.body}</p>
        ${notification.actionUrl ? `<a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}${notification.actionUrl}" style="display: inline-block; padding: 10px 20px; background-color: #294036; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px;">View Details</a>` : ''}
        <hr style="margin-top: 40px; border: none; border-top: 1px solid #eee;" />
        <p style="font-size: 12px; color: #999;">This is an automated notification from Privaro. You can manage your preferences in your account settings.</p>
      </div>
    `
  };
}

const channelHandlers: Record<string, (notification: any) => Promise<void>> = {
  email: async (notification) => {
    const template = getEmailTemplate(notification);
    let recipients: string[] = [];
    
    if (notification.userId) {
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
      const result = await resend.emails.send({
        from: 'Privaro <notifications@privaro.io>',
        to: recipients,
        subject: template.subject,
        html: template.html,
      });

      await db.update(notificationQueue)
        .set({ 
          status: 'sent', 
          sentAt: new Date(), 
          emailMessageId: result.data?.id,
          emailTo: recipients.join(', '),
        })
        .where(eq(notificationQueue.id, notification.id));
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
        ...(notification.actionUrl ? [{
          type: "actions",
          elements: [
            {
              type: "button",
              text: { type: "plain_text", text: "View Details" },
              url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}${notification.actionUrl}`
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
    const webhookSecret = (org.settings as any)?.webhookSecret || 'secret';

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
        'X-Privaro-Signature': signature,
      },
      body: payloadStr,
    });

    if (!response.ok) throw new Error(`Webhook returned ${response.status}`);
    
    await db.update(notificationQueue)
      .set({ status: 'sent', sentAt: new Date() })
      .where(eq(notificationQueue.id, notification.id));
  },
};

export const notificationWorker = new Worker('notifications', async (job) => {
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
}, { connection });

export async function scheduleNotificationJobs() {
  await notificationsJobQueue.add('process-queue', {}, {
    repeat: { pattern: '* * * * *' } // Run every minute to drain the queue
  });
}
