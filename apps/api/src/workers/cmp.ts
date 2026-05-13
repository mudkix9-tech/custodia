import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { db } from '../db.js';
import { consentCookies, consentDomains, consentRecords } from 'db';
import { eq, sql } from 'drizzle-orm';
import puppeteer from 'puppeteer';

const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
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

const cmpWorker = new Worker('cmp-automation', async job => {
  
  if (job.name === 'cookie-scanner') {
    const { domainId } = job.data;
    const [domainData] = await db.select().from(consentDomains).where(eq(consentDomains.id, domainId));
    if (!domainData) return;

    console.log(`[Cookie Scanner] Scanning ${domainData.domain}...`);
    
    let browser;
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });

      const page = await browser.newPage();
      const client = await page.target().createCDPSession();
      await client.send('Network.enable');

      const discoveredCookies: any[] = [];

      client.on('Network.responseReceivedExtraInfo', (params: any) => {
        const setCookieHeaders = params.headers?.['set-cookie'] || params.headers?.['Set-Cookie'];
        if (setCookieHeaders) {
          // Simplistic parse: just grab name and domain
          const parts = setCookieHeaders.split(';').map((p: string) => p.trim());
          const [nameValuePair] = parts;
          if (nameValuePair) {
            const [name] = nameValuePair.split('=');
            let domain = domainData.domain;
            for (const part of parts) {
              if (part.toLowerCase().startsWith('domain=')) {
                domain = part.split('=')[1];
              }
            }
            discoveredCookies.push({ name, domain, isNetwork: true });
          }
        }
      });

      // Visit site without accepting consent
      await page.goto(`https://${domainData.domain}`, { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
      await new Promise(r => setTimeout(r, 3000)); // wait for lazy-loaded scripts

      const browserCookies = await page.cookies();
      await browser.close();

      // Merge cookies
      const allCookiesMap = new Map();
      for (const bc of browserCookies) {
        allCookiesMap.set(bc.name, { ...bc, isThirdParty: !bc.domain.includes(domainData.domain) });
      }
      for (const dc of discoveredCookies) {
        if (!allCookiesMap.has(dc.name)) {
          allCookiesMap.set(dc.name, { name: dc.name, domain: dc.domain, isThirdParty: !dc.domain.includes(domainData.domain) });
        }
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
      if (browser) await browser.close();
    }
  }

  else if (job.name === 'consent-batch-insert') {
    // Read from Redis List
    const batchSize = 1000;
    const records = await connection.lpop('cmp:consent_logs', batchSize);
    
    if (!records || records.length === 0) return;

    const valuesToInsert = records.map((recordStr: string) => {
      const record = JSON.parse(recordStr);
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
        CREATE TABLE IF NOT EXISTS ${sql.raw(partitionName)} PARTITION OF consent_records
        FOR VALUES FROM (${startDate}) TO (${endDate});
      `);
      console.log(`[CMP Worker] Created partition ${partitionName}`);
    } catch (err: any) {
      console.error(`[CMP Worker] Partition creation failed: ${err.message}`);
    }
  }

}, { connection });

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
