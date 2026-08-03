import { createWorker, createQueue } from '../lib/queue.js';
import { Resend } from 'resend';
import { db } from '../db.js';
import { organizations, users, processingActivities, organizationVendors } from 'db';
import { eq, and, isNotNull, inArray, count } from 'drizzle-orm';

const resend = new Resend(process.env.RESEND_API_KEY || 're_mock_key');

export const trialExpiryQueue = createQueue('trial-expiry');

export const trialExpiryWorker = createWorker('trial-expiry', async () => {
  console.log(`[Trial Expiry Worker] Scanning for expiring trials...`);
  
  // Find all organizations that are trialing and have a trialEndsAt
  const trialingOrgs = await db.select().from(organizations)
    .where(and(
      eq(organizations.subscriptionStatus, 'trialing'),
      isNotNull(organizations.trialEndsAt)
    ));

  const now = Date.now();

  for (const org of trialingOrgs) {
    if (!org.trialEndsAt) continue;

    const daysLeft = Math.ceil((org.trialEndsAt.getTime() - now) / (1000 * 60 * 60 * 24));
    
    let emailSubject = '';
    let emailText = '';

    if (daysLeft === 4) {
      emailSubject = 'Your Custodia trial expires in 4 days';
      emailText = 'You have 4 days left on your trial. Subscribe to keep access to your compliance data.';
    } else if (daysLeft === 1) {
      emailSubject = 'Your Custodia trial expires tomorrow!';
      emailText = 'Your trial expires tomorrow. Please upgrade to continue accessing your workspace.';
    } else {
      continue; // Not a targeted day
    }

    // Get usage stats
    const ropaRes = await db.select({ c: count() }).from(processingActivities).where(eq(processingActivities.organizationId, org.id));
    const vendorRes = await db.select({ c: count() }).from(organizationVendors).where(eq(organizationVendors.organizationId, org.id));
    const ropaCount = ropaRes[0]?.c ?? 0;
    const vendorCount = vendorRes[0]?.c ?? 0;
    const statsText = `\n\nYou have built:\n- ${ropaCount} ROPA Entries\n- ${vendorCount} Vendors Tracked`;

    // Get owners/admins to email
    const orgUsers = await db.select().from(users).where(
      and(
        eq(users.organizationId, org.id),
        inArray(users.role, ['owner', 'admin'])
      )
    );

    for (const u of orgUsers) {
      console.log(`[Trial Expiry Worker] Sending email to ${u.email} (${daysLeft} days left)`);
      try {
        await resend.emails.send({
          from: 'noreply@trycustodia.online',
          to: u.email,
          subject: emailSubject,
          text: emailText + statsText,
        });
      } catch (err) {
        console.error(`[Trial Expiry Worker] Failed to send email to ${u.email}:`, err);
      }
    }
  }
});
