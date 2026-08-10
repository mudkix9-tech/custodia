import { createWorker, createQueue, getBoss } from '../lib/queue.js';
import { db } from '../db.js';
import { consentCookies, consentDomains, consentRecords } from 'db';
import { eq, sql, inArray } from 'drizzle-orm';
import { scanDomain } from '../lib/browserPool.js';
import { loadTrackerRegistry, classifyCookieName } from '../lib/trackerRegistry.js';
import { isSameSite } from '../lib/domains.js';

export const cmpJobsQueue = createQueue('cmp-automation');

const cmpWorker = createWorker('cmp-automation', async job => {
  
  if (job.name === 'cookie-scanner') {
    const { domainId } = job.data;
    const [domainData] = await db.select().from(consentDomains).where(eq(consentDomains.id, domainId));
    if (!domainData) return;

    console.log(`[Cookie Scanner] Scanning ${domainData.domain}...`);
    
    try {
      const mergedCookies = await scanDomain(`https://${domainData.domain}`);
      const registry = await loadTrackerRegistry();

      // Merge cookies mapping. isSameSite compares registrable domains, so a cookie
      // on `.example.co.uk` is not called third-party on `shop.example.co.uk`, and
      // `notexample.com` is no longer treated as first-party for `example.com` the
      // way a substring check did.
      const allCookiesMap = new Map();
      for (const bc of mergedCookies) {
        allCookiesMap.set(bc.name, {
          ...bc,
          isThirdParty: bc.domain ? !isSameSite(bc.domain, domainData.domain) : false,
        });
      }

      // Bulk upsert into db
      const existingCookies = await db.select()
        .from(consentCookies)
        .where(eq(consentCookies.domainId, domainId));

      const existingCookieMap = new Map(existingCookies.map(c => [c.cookieName, c]));

      const cookiesToInsert: any[] = [];
      const cookiesToUpdate: any[] = [];

      for (const [name, cookie] of allCookiesMap.entries()) {
        const classification = classifyCookieName(name, registry);
        const match = existingCookieMap.get(name);

        if (match) {
          cookiesToUpdate.push(match.id);
        } else {
          cookiesToInsert.push({
            domainId,
            cookieName: name,
            cookieDomain: cookie.domain,
            cookiePath: cookie.path || '/',
            category: classification.category,
            provider: classification.provider,
            isThirdParty: cookie.isThirdParty,
            autoClassified: true,
            classificationConfidence: classification.confidence.toFixed(2),
          });
        }
      }

      if (cookiesToUpdate.length > 0) {
        await db.update(consentCookies)
          .set({ lastSeenAt: new Date() })
          .where(inArray(consentCookies.id, cookiesToUpdate));
      }

      if (cookiesToInsert.length > 0) {
        await db.insert(consentCookies).values(cookiesToInsert);
      }

      await db.update(consentDomains).set({ lastScanAt: new Date() }).where(eq(consentDomains.id, domainId));
      console.log(`[Cookie Scanner] Found ${allCookiesMap.size} cookies on ${domainData.domain}`);

    } catch (err: any) {
      console.error(`[Cookie Scanner] Error scanning ${domainData.domain}: ${err.message}`);
    }
  }

  else if (job.name === 'consent-batch-insert') {
    const boss = await getBoss();
    const batchSize = 1000;
    
    // Fetch buffered consent records
    const records = await boss.fetch('consent-batch-buffer', batchSize);
    if (!records || records.length === 0) return;

    // Filter and query prior state for resubmissions
    const parsedRecords = records.map((r: any) => r.data);
    const resubmissionIds = parsedRecords.filter((r: any) => r.isResubmission).map((r: any) => r.consentId);
    
    let previousStates: Record<string, string[]> = {};
    if (resubmissionIds.length > 0) {
      // Find the most recent record for each consentId
      const priors = await db.select({
        consentId: consentRecords.consentId,
        categoriesAccepted: consentRecords.categoriesAccepted
      }).from(consentRecords)
        .where(sql`${consentRecords.consentId} IN (${sql.join(resubmissionIds, sql`, `)})`)
        .orderBy(sql`${consentRecords.givenAt} DESC`); 
      
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

    // Complete the buffered jobs
    await boss.complete(records.map((r: any) => r.id));
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

}, { teamSize: 1 });

cmpWorker.on('error', (err: Error) => console.warn('[CMP Worker] Error:', err.message));


