import { createWorker } from '../lib/queue.js';
import { Queue, Worker } from 'bullmq';
import { db } from '../db.js';
import { consentCookies, consentDomains, consentRecords , createRedisClient } from 'db';
import { eq, sql } from 'drizzle-orm';
import { scanDomain } from '../lib/browserPool.js';

const connection = createRedisClient({
  maxRetriesPerRequest: null,
});

export const cmpJobsQueue = new Queue('cmp-automation', { connection });

// Known cookie database for rule-based classification
const KNOWN_COOKIES: Record<string, { category: string, provider: string }> = {
  '_ga': { category: 'analytics', provider: 'Google Analytics' },
  '_gid': { category: 'analytics', provider: 'Google Analytics' },
  '_gat': { category: 'analytics', provider: 'Google Analytics' },
  '_fbp': { category: 'marketing', provider: 'Meta/Facebook' },
  '_gcl_au': { category: 'marketing', provider: 'Google Ads' },
  'hubspotutk': { category: 'marketing', provider: 'HubSpot' },
  '__stripe_mid': { category: 'functional', provider: 'Stripe' },
  '__stripe_sid': { category: 'functional', provider: 'Stripe' },
  'intercom-id': { category: 'functional', provider: 'Intercom' },
  'intercom-session': { category: 'functional', provider: 'Intercom' },
  'pvr_consent_id': { category: 'necessary', provider: 'Privaro' },
};

function classifyCookie(name: string) {
  for (const [key, val] of Object.entries(KNOWN_COOKIES)) {
    if (name.startsWith(key)) return val;
  }
  return { category: 'uncategorized', provider: 'Unknown' };
}

const cmpWorker = createWorker('cmp-automation', async job => {
  
  if (job.name === 'cookie-scanner') {
    const { domainId } = job.data;
    const [domainData] = await db.select().from(consentDomains).where(eq(consentDomains.id, domainId));
    if (!domainData) return;

    console.log(`[Cookie Scanner] Scanning ${domainData.domain}...`);
    
    try {
      const mergedCookies = await scanDomain(`https://${domainData.domain}`);

      // Merge cookies mapping
      const allCookiesMap = new Map();
      for (const bc of mergedCookies) {
        allCookiesMap.set(bc.name, { ...bc, isThirdParty: bc.domain ? !bc.domain.includes(domainData.domain) : false });
      }

      // Bulk upsert into db
      for (const [name, cookie] of allCookiesMap.entries()) {
        const classification = classifyCookie(name);
        
        // Simple upsert by name + domainId
        const existing = await db.select().from(consentCookies).where(eq(consentCookies.cookieName, name));
        const match = existing.find(e => e.domainId === domainId);
        
        if (match) {
          await db.update(consentCookies).set({ lastSeenAt: new Date() }).where(eq(consentCookies.id, match.id));
        } else {
          await db.insert(consentCookies).values({
            domainId,
            cookieName: name,
            cookieDomain: cookie.domain,
            cookiePath: cookie.path || '/',
            category: classification.category,
            provider: classification.provider,
            isThirdParty: cookie.isThirdParty,
            autoClassified: true,
            classificationConfidence: classification.category === 'uncategorized' ? '0.00' : '0.90',
          });
        }
      }

      await db.update(consentDomains).set({ lastScanAt: new Date() }).where(eq(consentDomains.id, domainId));
      console.log(`[Cookie Scanner] Found ${allCookiesMap.size} cookies on ${domainData.domain}`);

    } catch (err: any) {
      console.error(`[Cookie Scanner] Error scanning ${domainData.domain}: ${err.message}`);
    }
  }

  else if (job.name === 'consent-batch-insert') {
    // Read from Redis List
    const batchSize = 1000;
    const records = await connection.lpop('cmp:consent_logs', batchSize);
    
    if (!records || records.length === 0) return;

    // Filter and query prior state for resubmissions
    const parsedRecords = records.map((recordStr: string) => JSON.parse(recordStr));
    const resubmissionIds = parsedRecords.filter((r: any) => r.isResubmission).map((r: any) => r.consentId);
    
    let previousStates: Record<string, string[]> = {};
    if (resubmissionIds.length > 0) {
      // Find the most recent record for each consentId
      const priors = await db.select({
        consentId: consentRecords.consentId,
        categoriesAccepted: consentRecords.categoriesAccepted
      }).from(consentRecords)
        .where(sql`${consentRecords.consentId} IN (${sql.join(resubmissionIds, sql`, `)})`)
        .orderBy(sql`${consentRecords.givenAt} DESC`); // Need custom logic to get latest, or we just group by in JS
      
      // Keep only the first (most recent) for each consentId
      for (const p of priors) {
        if (!previousStates[p.consentId]) {
          previousStates[p.consentId] = p.categoriesAccepted as string[];
        }
      }
    }

    const valuesToInsert = parsedRecords.map((record: any) => {
      let eventType = 'initial';
      if (record.isResubmission) {
        const priorAccepted = previousStates[record.consentId] || [];
        const priorOptionalCount = priorAccepted.filter(c => c !== 'necessary').length;
        const newOptionalCount = record.categoriesAccepted.filter((c: string) => c !== 'necessary').length;
        
        if (priorOptionalCount > 0 && newOptionalCount === 0) {
          eventType = 'withdrawal';
        } else {
          eventType = 'update';
        }
      }

      return {
        domainId: record.domainId, // Extracted earlier from scriptId
        consentId: record.consentId,
        categoriesAccepted: record.categoriesAccepted,
        categoriesRejected: record.categoriesRejected,
        ipHash: record.ipHash,
        countryCode: record.countryCode,
        policyVersionId: record.policyVersionId,
        bannerVersion: record.bannerVersion,
        interactionType: record.interactionType,
        gcmConsentState: record.gcmState,
        eventType,
      };
    });

    if (valuesToInsert.length > 0) {
      await db.insert(consentRecords).values(valuesToInsert);
      console.log(`[CMP Worker] Batch inserted ${valuesToInsert.length} consent records.`);
    }
  }

  else if (job.name === 'partition-manager') {
    console.log('[CMP Worker] Running partition manager...');
    // Create next month's partition
    const date = new Date();
    date.setMonth(date.getMonth() + 1);
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const partitionName = `consent_records_${year}_${month}`;
    
    const startDate = `${year}-${month}-01`;
    // End date is 1st of next month
    date.setMonth(date.getMonth() + 1);
    const endYear = date.getFullYear();
    const endMonth = String(date.getMonth() + 1).padStart(2, '0');
    const endDate = `${endYear}-${endMonth}-01`;

    try {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS ${sql.identifier(partitionName)} PARTITION OF consent_records
        FOR VALUES FROM (${startDate}) TO (${endDate});
      `);
      console.log(`[CMP Worker] Created partition ${partitionName}`);
    } catch (err: any) {
      console.error(`[CMP Worker] Partition creation failed: ${err.message}`);
    }
  }

}, { drainDelay: 60 });

cmpWorker.on('error', (err) => console.warn('[CMP Worker] Error:', err.message));

export async function scheduleCmpJobs() {
  try {
    const repeatableJobs = await cmpJobsQueue.getRepeatableJobs();
    for (const job of repeatableJobs) {
      await cmpJobsQueue.removeRepeatableByKey(job.key);
    }

    // Batch insert runs every 5 seconds
    await cmpJobsQueue.add('consent-batch-insert', {}, { repeat: { every: 5000 } });
    
    // Partition manager runs on the 25th of every month
    await cmpJobsQueue.add('partition-manager', {}, { repeat: { pattern: '0 0 25 * *' } });
    
    console.log('✅ CMP background jobs scheduled');
  } catch (err: any) {
    console.warn('⚠️ Could not schedule CMP jobs:', err.message);
  }
}
