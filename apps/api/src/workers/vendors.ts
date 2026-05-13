import { Worker, Queue, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { db } from '../db.js';
import { vendors, organizationVendors } from 'db';
import { eq, and, isNotNull, lte, gt } from 'drizzle-orm';
import { calculateVendorRisk } from '../routers/vendors.js';

const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  retryStrategy: (times: number) => {
    if (times > 3) return null;
    return Math.min(times * 50, 2000);
  }
});

connection.on('error', (err: any) => {
  // Suppress unhandled redis connection errors so the server doesn't crash
  console.warn('[Redis] Connection error in vendor jobs:', err.message);
});

export const vendorJobsQueue = new Queue('vendor-intelligence', { connection });

// Helper to calculate days until expiry
const daysUntil = (date: Date) => {
  return Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
};

export const vendorWorker = new Worker('vendor-intelligence', async (job: Job) => {
  console.log(`[Vendor Worker] Processing job ${job.name} (ID: ${job.id})`);

  switch (job.name) {
    case 'sub-processor-change-detector':
      // In a real app, this would fetch vendor.subProcessorListUrl and hash it
      console.log('Simulating sub-processor change detection...');
      // Simulated: randomly pick a vendor and pretend its sub-processors changed
      break;

    case 'breach-alert-monitor':
      // In a real app, this would query HaveIBeenPwned or similar feeds
      console.log('Simulating breach alert monitor...');
      break;

    case 'dpa-expiry-checker':
      console.log('Running DPA Expiry Checker...');
      
      const expiringVendors = await db.select({
        orgVendor: organizationVendors,
        vendor: vendors
      })
      .from(organizationVendors)
      .innerJoin(vendors, eq(organizationVendors.vendorId, vendors.id))
      .where(and(
        isNotNull(organizationVendors.dpaExpiresAt),
        eq(organizationVendors.dpaStatus, 'signed')
      ));

      for (const record of expiringVendors) {
        if (!record.orgVendor.dpaExpiresAt) continue;
        
        const days = daysUntil(record.orgVendor.dpaExpiresAt);
        
        if (days <= 0) {
          // Expired
          await db.update(organizationVendors)
            .set({ dpaStatus: 'expired' })
            .where(eq(organizationVendors.id, record.orgVendor.id));
            
          // Recalculate risk immediately
          const { score, level } = calculateVendorRisk(record.vendor, { ...record.orgVendor, dpaStatus: 'expired' });
          await db.update(organizationVendors)
            .set({ riskScore: score, riskLevel: level })
            .where(eq(organizationVendors.id, record.orgVendor.id));
            
          await createNotification(record.orgVendor.organizationId, 'CRITICAL', `DPA with ${record.vendor.name} has expired.`);
        } 
        else if (days === 1 || days === 7 || days === 14 || days === 30) {
          // Alert intervals
          await createNotification(
            record.orgVendor.organizationId, 
            days === 1 ? 'HIGH' : 'MEDIUM', 
            `DPA with ${record.vendor.name} will expire in ${days} day(s).`
          );
        }
      }
      break;

    case 'dpa-page-change-detector':
      console.log('Simulating DPA page change detector...');
      break;

    case 'vendor-risk-recalculation':
      console.log('Running daily vendor risk recalculation...');
      // Find vendors changed in last 24h
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentlyChanged = await db.select({
        orgVendor: organizationVendors,
        vendor: vendors
      })
      .from(organizationVendors)
      .innerJoin(vendors, eq(organizationVendors.vendorId, vendors.id))
      .where(gt(organizationVendors.updatedAt, yesterday));

      for (const record of recentlyChanged) {
        const { score, level } = calculateVendorRisk(record.vendor, record.orgVendor);
        if (score !== record.orgVendor.riskScore) {
          await db.update(organizationVendors)
            .set({ riskScore: score, riskLevel: level })
            .where(eq(organizationVendors.id, record.orgVendor.id));
        }
      }
      break;

    default:
      console.warn(`Unknown job: ${job.name}`);
  }
}, { connection });

vendorWorker.on('completed', job => {
  console.log(`[Vendor Worker] Job ${job.id} has completed!`);
});

vendorWorker.on('failed', (job, err) => {
  console.error(`[Vendor Worker] Job ${job?.id} has failed with ${err.message}`);
});

vendorWorker.on('error', (err) => {
  // Suppress unhandled worker errors (like connection drops)
  console.warn('[Vendor Worker] Error:', err.message);
});

// Helper
async function createNotification(orgId: string, urgency: string, message: string) {
  // Assuming a generic notifications table exists, or we log it somewhere.
  // In a real app, this might send an email or an in-app notification.
  console.log(`[Notification -> Org ${orgId}] [${urgency}] ${message}`);
}

// Function to schedule recurring jobs
export async function scheduleVendorJobs() {
  try {
    // Clear existing repeatable jobs to avoid duplicates on restart
    const repeatableJobs = await vendorJobsQueue.getRepeatableJobs();
    for (const job of repeatableJobs) {
      await vendorJobsQueue.removeRepeatableByKey(job.key);
    }

    // Schedule daily jobs (midnight UTC)
    await vendorJobsQueue.add('sub-processor-change-detector', {}, { repeat: { pattern: '0 0 * * *' } });
    await vendorJobsQueue.add('dpa-expiry-checker', {}, { repeat: { pattern: '0 0 * * *' } });
    await vendorJobsQueue.add('vendor-risk-recalculation', {}, { repeat: { pattern: '0 1 * * *' } }); // 1 AM

    // Schedule weekly jobs (Sunday midnight)
    await vendorJobsQueue.add('dpa-page-change-detector', {}, { repeat: { pattern: '0 0 * * 0' } });
    
    console.log('✅ Vendor intelligence recurring jobs scheduled');
  } catch (err: any) {
    console.warn('⚠️ Could not schedule vendor jobs. Is Redis running? Error:', err.message);
  }
}
