import { createWorker, createQueue, Job } from '../lib/queue.js';
import { db } from '../db.js';
import { vendors, organizationVendors, vendorSubProcessors, vendorSubProcessorChanges, vendorSubProcessorEntities, organizations, vendorDiscoveries, vendorAssessments, vendorAssessmentTemplates } from 'db';
import { eq, and, isNotNull, lte, gt, inArray, or, isNull, sql } from 'drizzle-orm';
import { updateVendorRiskScore } from '../routers/vendors.js';
import { VENDOR_STATUSES_LIVE } from '../constants/vendorLifecycle.js';
import { runClusterTask, scanDomainForThirdParties } from '../lib/browserPool.js';
import { getRootDomain } from '../lib/domains.js';
import { normaliseSubProcessorSnapshot } from '../lib/vendorSubProcessors.js';
import { parseSubProcessorLine, diffSubProcessorEntities } from '../lib/vendorSubProcessorEntities.js';
import { queueNotification } from '../utils/notifications.js';
import { dispatchWebhook } from '../utils/webhookDispatcher.js';
import crypto from 'crypto';
import dns from 'dns/promises';
import React from 'react';
import { sendEmail, AssessmentReminder } from 'emails';
import { generateAccessToken } from '../lib/assessmentTokens.js';

/**
 * "Relationships this organisation is still in."
 *
 * A local copy of the router's `liveVendorPredicate`, because importing it
 * would pull the whole vendors router — and therefore every queue handle it
 * touches — into the worker barrel. A NULL status is a row written before the
 * column meant anything: live, not silently offboarded.
 */
function liveVendors() {
  return or(
    inArray(organizationVendors.status, [...VENDOR_STATUSES_LIVE]),
    isNull(organizationVendors.status),
  )!;
}


export const vendorJobsQueue = createQueue('vendor-intelligence');

// Helper to calculate days until expiry
const daysUntil = (date: Date) => {
  return Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
};

export const vendorWorker = createWorker('vendor-intelligence', async (job: Job) => {
  console.log(`[Vendor Worker] Processing job ${job.name} (ID: ${job.id})`);

  switch (job.name) {
    case 'sub-processor-change-detector':
      console.log('Running sub-processor change detector...');
      /*
       * D45. This was a bare `.limit(50)` over the whole catalogue, ordered by
       * nothing — so once more than fifty vendors published a sub-processor list,
       * the same arbitrary fifty were scraped every night and the rest were never
       * checked again. Article 28(2) says the controller must be informed of
       * intended changes; a detector that silently covers a fixed subset does not
       * deliver that, and nothing on screen said which vendors it had given up on.
       *
       * Ordered oldest-checked-first and stamped as we go, so the cap becomes a
       * per-run batch size rather than a permanent horizon: every vendor comes round
       * eventually, and the ones nobody has looked at longest come round first.
       */
      const SCAN_BATCH = Number(process.env.SUBPROCESSOR_SCAN_BATCH || 50);
      const targetVendors = await db.select()
        .from(vendors)
        .where(isNotNull(vendors.subProcessorListUrl))
        .orderBy(sql`${vendors.subProcessorListCheckedAt} ASC NULLS FIRST`)
        .limit(SCAN_BATCH);

      const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

      for (const v of targetVendors) {
        if (!v.subProcessorListUrl) continue;

        let textContent = '';
        let fetchSuccess = false;
        let retries = 3;

        for (let attempt = 1; attempt <= retries; attempt++) {
          try {
            // Acquired per attempt rather than once for the loop: if Chromium dies
            // partway through 50 vendors, the pool is replaced underneath us and a
            // hoisted handle would spend the remaining vendors on the dead browser.
            textContent = await runClusterTask('sub-processor-scrape', async ({ page }: any) => {
              await page.goto(v.subProcessorListUrl!, { waitUntil: 'networkidle2', timeout: 30000 });
              
              // Clean DOM elements to remove boilerplate headers, footers, cookie banners, navigation
              await page.evaluate(() => {
                const selectors = [
                  'footer', 'header', 'nav', 'iframe', 'script', 'style', 'noscript',
                  '[class*="cookie" i]', '[id*="cookie" i]',
                  '[class*="footer" i]', '[id*="footer" i]',
                  '[class*="header" i]', '[id*="header" i]',
                  '[class*="nav" i]', '[id*="nav" i]',
                  '#cookie-banner', '#cookie-consent', '.cookie-notice'
                ];
                selectors.forEach(sel => {
                  try {
                    document.querySelectorAll(sel).forEach(e => e.remove());
                  } catch (e) {}
                });
              });
              const bodyText = await page.evaluate(() => document.body.innerText);
              return bodyText || '';
            });

            fetchSuccess = true;
            break;
          } catch (err: any) {
            console.warn(`[Sub-processor Scraper] Attempt ${attempt} failed for ${v.name}: ${err.message}`);
            if (attempt < retries) {
              await delay(5000 * attempt);
            }
          }
        }

        if (!fetchSuccess) {
          console.error(`[Sub-processor Scraper] Failed to fetch sub-processor list for ${v.name} after 3 attempts.`);
          continue;
        }

        // Clean & normalize text content to prevent boilerplate noise.
        // The chain itself lives in lib/vendorSubProcessors.ts so it can be
        // covered by fixtures -- its failure mode is a snapshot that looks fine.
        const cleanedText = normaliseSubProcessorSnapshot(textContent);

        const currentHash = crypto.createHash('sha256').update(cleanedText).digest('hex');

        // Stamped on every examined vendor, whatever the outcome, so the batch
        // ordering advances and the next run picks up where this one stopped.
        await db.update(vendors)
          .set({ subProcessorListCheckedAt: new Date() })
          .where(eq(vendors.id, v.id));

        if (!v.subProcessorListHash) {
          console.log(`[Sub-processor Scraper] Setting baseline hash for ${v.name}`);
          await db.update(vendors)
            .set({
              subProcessorListHash: currentHash,
              subProcessorListSnapshot: cleanedText
            })
            .where(eq(vendors.id, v.id));
          continue;
        }

        if (v.subProcessorListHash !== currentHash) {
          console.log(`[Sub-processor Scraper] Change detected for ${v.name}!`);

          // Only organisations still using the vendor. An Art. 28(2) objection
          // window has no meaning for a relationship that ended last year, and
          // the alert lands in the queue of someone with nothing to object to.
          const linkedOrgs = await db.select()
            .from(organizationVendors)
            .where(and(eq(organizationVendors.vendorId, v.id), liveVendors()));

          for (const orgVendor of linkedOrgs) {
            const [changeRecord] = await db.insert(vendorSubProcessorChanges).values({
              organizationId: orgVendor.organizationId,
              orgVendorId: orgVendor.id,
              previousHash: v.subProcessorListHash,
              newHash: currentHash,
              previousSnapshot: v.subProcessorListSnapshot,
              newSnapshot: cleanedText,
              status: 'pending_review'
            }).returning();

            if (!changeRecord) throw new Error('Failed to insert sub-processor change record');

            // P-10. The snapshot diff shows lines; entities show facts. Parse both
            // snapshots into rows and store the parsed diff on the change record's
            // organisation scope, upserting the shared catalogue entity table. The
            // per-org review still reads the line-level snapshots; these rows are
            // what "who changed" becomes queryable against.
            const previousEntities = String(v.subProcessorListSnapshot || '')
              .split('\n')
              .map((line) => parseSubProcessorLine(line))
              .filter((e): e is NonNullable<typeof e> => e !== null);
            const nextEntities = cleanedText
              .split('\n')
              .map((line) => parseSubProcessorLine(line))
              .filter((e): e is NonNullable<typeof e> => e !== null);
            const entityDiff = diffSubProcessorEntities(previousEntities, nextEntities);
            for (const added of entityDiff.added) {
              await db.insert(vendorSubProcessorEntities).values({
                parentVendorId: v.id,
                name: added.name.slice(0, 255),
                nameKey: added.nameKey,
                service: added.service ?? null,
                country: added.country && added.country.length === 2 ? added.country.toUpperCase() : null,
                purpose: added.purpose ?? null,
                website: added.website ?? null,
              }).onConflictDoUpdate({
                target: [vendorSubProcessorEntities.parentVendorId, vendorSubProcessorEntities.nameKey],
                set: {
                  lastSeenAt: new Date(),
                  removedAt: null,
                  service: added.service ?? null,
                },
              });
            }
            if (entityDiff.removed.length > 0) {
              await db.update(vendorSubProcessorEntities)
                .set({ removedAt: new Date() })
                .where(and(
                  eq(vendorSubProcessorEntities.parentVendorId, v.id),
                  inArray(vendorSubProcessorEntities.nameKey, entityDiff.removed.map((r) => r.nameKey)),
                ));
            }

            await queueNotification({
              organizationId: orgVendor.organizationId,
              type: 'vendor.sub_processor_changed',
              title: 'Sub-Processor List Changed',
              body: `${v.name} updated their sub-processor list. Please review the changes and submit your response.`,
              actionUrl: `/vendors/${v.id}?tab=sub-processors`,
              metadata: {
                vendorId: v.id,
                orgVendorId: orgVendor.id,
                changeId: changeRecord.id
              }
            });

            await dispatchWebhook(orgVendor.organizationId, 'vendor.sub_processor_changed', {
              vendorId: v.id,
              vendorName: v.name,
              orgVendorId: orgVendor.id,
              changeId: changeRecord.id,
              detectedAt: new Date().toISOString(),
              previousHash: v.subProcessorListHash,
              newHash: currentHash
            });
          }

          // ONLY update the global vendor's hash/snapshot after fanning out all org-level entries
          await db.update(vendors)
            .set({
              subProcessorListHash: currentHash,
              subProcessorListSnapshot: cleanedText
            })
            .where(eq(vendors.id, v.id));
        } else {
          console.log(`[Sub-processor Scraper] No change for ${v.name}`);
        }
      }
      break;

    /*
     * D18. `breach-alert-monitor` and `dpa-page-change-detector` were
     * `console.log('Simulating…')` bodies behind job names the module advertises as
     * monitoring capabilities. A stub that logs and returns success is worse than an
     * absent feature: the queue records a completed run, so the only evidence a
     * customer or an operator has says the check happened.
     *
     * They now fail loudly instead of pretending. Breach monitoring against a real
     * feed is the `vendor-incidents-ingest` work, and DPA page change detection is
     * the same scrape-and-hash the sub-processor detector already does — both are
     * real jobs and neither is these. Throwing keeps the job name reserved and
     * makes enabling it a decision someone has to finish.
     */
    case 'breach-alert-monitor':
      throw new Error(
        'breach-alert-monitor is not implemented. It was a console.log stub reporting success; ' +
        'vendor breach intelligence belongs in the vendor-incidents-ingest job against a real feed.'
      );

    case 'dpa-expiry-checker':
      console.log('Running DPA Expiry & Contract Renewal Checker...');
      
      const expiringVendors = await db.select({
        orgVendor: organizationVendors,
        vendor: vendors
      })
      .from(organizationVendors)
      .innerJoin(vendors, eq(organizationVendors.vendorId, vendors.id))
      .where(and(
        isNotNull(organizationVendors.dpaExpiresAt),
        eq(organizationVendors.dpaStatus, 'signed'),
        // D30. Chasing the renewal of a DPA for a processor the customer stopped
        // using is the clearest way to teach them to ignore these emails.
        liveVendors(),
      ));

      const getNotificationTier = (days: number): string | null => {
        if (days <= 0) return 'expired';
        if (days <= 7) return '7';
        if (days <= 30) return '30';
        if (days <= 60) return '60';
        if (days <= 90) return '90';
        return null;
      };

      for (const record of expiringVendors) {
        if (!record.orgVendor.dpaExpiresAt) continue;

        const subs = await db.select()
          .from(vendorSubProcessors)
          .where(eq(vendorSubProcessors.parentVendorId, record.vendor.id));
        const subProcessorsCount = subs.length;

        const days = daysUntil(record.orgVendor.dpaExpiresAt);
        const currentTier = getNotificationTier(days);
        const lastTier = record.orgVendor.lastExpiryNotificationTier;

        if (currentTier && currentTier !== lastTier) {
          if (currentTier === 'expired') {
            // Expired
            await db.update(organizationVendors)
              .set({ 
                dpaStatus: 'expired',
                lastExpiryNotificationTier: 'expired'
              })
              .where(eq(organizationVendors.id, record.orgVendor.id));
              
            // Recalculate risk immediately. This is an existing relationship, so it
            // goes through the full derivation rather than a three-argument call
            // that would drop the questionnaire modifier, the DPIA gaps and the
            // discrepancy penalty; the dpaStatus write above is already committed,
            // so the recalculation reads 'expired' from the row.
            await updateVendorRiskScore(db, record.orgVendor.organizationId, record.vendor.id);
              
            await createNotification(record.orgVendor.organizationId, 'CRITICAL', `DPA with ${record.vendor.name} has expired.`, {
              type: 'vendor.dpa_expired',
              actionUrl: `/vendors/${record.vendor.id}`,
              vendorName: record.vendor.name,
            });
          } else {
            // Alert intervals: 90, 60, 30, 7 days
            await db.update(organizationVendors)
              .set({ lastExpiryNotificationTier: currentTier })
              .where(eq(organizationVendors.id, record.orgVendor.id));

            await createNotification(
              record.orgVendor.organizationId,
              currentTier === '7' ? 'HIGH' : 'MEDIUM',
              `DPA with ${record.vendor.name} will expire in ${days} days.`,
              {
                type: days <= 7 ? 'vendor.dpa_expiring_7d' : 'vendor.dpa_expiring_30d',
                actionUrl: `/vendors/${record.vendor.id}`,
                vendorName: record.vendor.name,
              },
            );
          }
        } else if (currentTier === null && lastTier !== null) {
          // Reset tier if expiry date was pushed out
          await db.update(organizationVendors)
            .set({ lastExpiryNotificationTier: null })
            .where(eq(organizationVendors.id, record.orgVendor.id));
        }
      }

      // 2. Contract renewal date checker
      const renewalVendors = await db.select({
        orgVendor: organizationVendors,
        vendor: vendors
      })
      .from(organizationVendors)
      .innerJoin(vendors, eq(organizationVendors.vendorId, vendors.id))
      .where(and(
        eq(organizationVendors.status, 'active'),
        isNotNull(organizationVendors.contractRenewalDate)
      ));

      for (const record of renewalVendors) {
        if (!record.orgVendor.contractRenewalDate) continue;

        const dateVal = new Date(record.orgVendor.contractRenewalDate);
        const days = daysUntil(dateVal);
        const currentTier = getNotificationTier(days);
        const lastTier = record.orgVendor.lastRenewalNotificationTier;

        if (currentTier && currentTier !== lastTier) {
          if (currentTier === 'expired') {
            await db.update(organizationVendors)
              .set({ lastRenewalNotificationTier: 'expired' })
              .where(eq(organizationVendors.id, record.orgVendor.id));
              
            await createNotification(
              record.orgVendor.organizationId,
              'HIGH',
              `Contract for vendor ${record.vendor.name} has reached its renewal date (${record.orgVendor.contractRenewalDate}).`,
              {
                type: 'vendor.dpa_expired',
                actionUrl: `/vendors/${record.vendor.id}`,
                vendorName: record.vendor.name,
              },
            );
          } else {
            await db.update(organizationVendors)
              .set({ lastRenewalNotificationTier: currentTier })
              .where(eq(organizationVendors.id, record.orgVendor.id));

            await createNotification(
              record.orgVendor.organizationId,
              'MEDIUM',
              `Contract renewal for vendor ${record.vendor.name} is in ${days} days (Date: ${record.orgVendor.contractRenewalDate}).`,
              {
                type: days <= 7 ? 'vendor.dpa_expiring_7d' : 'vendor.dpa_expiring_30d',
                actionUrl: `/vendors/${record.vendor.id}`,
                vendorName: record.vendor.name,
              },
            );
          }
        } else if (currentTier === null && lastTier !== null) {
          // Reset tier if contract renewal was extended
          await db.update(organizationVendors)
            .set({ lastRenewalNotificationTier: null })
            .where(eq(organizationVendors.id, record.orgVendor.id));
        }
      }
      break;

    case 'dpa-page-change-detector':
      throw new Error(
        'dpa-page-change-detector is not implemented. It was a console.log stub reporting success; ' +
        'implement it as the same scrape-and-hash the sub-processor change detector uses, over vendors.dpaUrl.'
      );

    case 'vendor-risk-recalculation': {
      console.log('Running daily vendor risk recalculation...');
      // Find vendors changed in last 24h
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentlyChanged = await db.select({
        orgVendor: organizationVendors,
        vendor: vendors
      })
      .from(organizationVendors)
      .innerJoin(vendors, eq(organizationVendors.vendorId, vendors.id))
      .where(and(gt(organizationVendors.updatedAt, yesterday), liveVendors()));

      if (recentlyChanged.length === 0) break;

      /*
       * This used to assemble its own score and write it with a hand-rolled CASE
       * expression, and both halves were wrong. The call passed three arguments to
       * a six-input function, so it silently dropped the reviewed-questionnaire
       * modifier (D6), the DPIA gaps and the cross-check discrepancy penalty —
       * meaning one nightly pass would have reverted every one of them across the
       * estate. And every branch of the CASE was a bound parameter with nothing for
       * Postgres to infer a type from, so it resolved as `text` and the write threw
       * `column "risk_score" is of type integer but expression is of type text` —
       * the same defect `recalculateVendorRiskForAllOrgs` carries a cast to avoid.
       *
       * Delegating to `updateVendorRiskScore` is one query set per changed row
       * rather than one for the batch, which is the right trade for a nightly job
       * over a 24-hour window: it is the single derivation of the number, so this
       * path cannot drift from the others again.
       */
      for (const record of recentlyChanged) {
        await updateVendorRiskScore(db, record.orgVendor.organizationId, record.vendor.id);
      }
      break;
    }

    case 'assessment-reminder-checker': {
      console.log('Running vendor assessment reminder checker...');
      const activeAssessments = await db.select({
        assessment: vendorAssessments,
        orgVendor: organizationVendors,
        vendor: vendors,
        org: organizations
      })
      .from(vendorAssessments)
      .innerJoin(organizationVendors, eq(vendorAssessments.vendorId, organizationVendors.id))
      .innerJoin(vendors, eq(organizationVendors.vendorId, vendors.id))
      .innerJoin(organizations, eq(vendorAssessments.organizationId, organizations.id));

      const now = new Date();

      for (const record of activeAssessments) {
        const { assessment, orgVendor, vendor, org } = record;
        
        if (assessment.status === 'completed' || assessment.status === 'expired') {
          continue;
        }

        // Check if expired
        if (assessment.expiresAt && now > assessment.expiresAt) {
          console.log(`Assessment ${assessment.id} for ${vendor.name} has expired. Updating status.`);
          await db.update(vendorAssessments)
            .set({ 
              status: 'expired',
              submissionLocked: true
            })
            .where(eq(vendorAssessments.id, assessment.id));
          continue;
        }

        const sentAtTime = assessment.sentAt ? new Date(assessment.sentAt).getTime() : now.getTime();
        const diffMs = now.getTime() - sentAtTime;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        let shouldSend = false;
        let nextReminderCount = assessment.reminderCount;

        if (diffDays >= 7 && diffDays < 14 && assessment.reminderCount === 0) {
          shouldSend = true;
          nextReminderCount = 1;
        } else if (diffDays >= 14 && diffDays < 21 && assessment.reminderCount === 1) {
          shouldSend = true;
          nextReminderCount = 2;
        } else if (diffDays >= 21 && assessment.reminderCount === 2) {
          shouldSend = true;
          nextReminderCount = 3;
        }

        if (shouldSend && assessment.lastReminderSentAt) {
          const lastReminderTime = new Date(assessment.lastReminderSentAt).getTime();
          const msSinceLastReminder = now.getTime() - lastReminderTime;
          if (msSinceLastReminder < 24 * 60 * 60 * 1000) {
            shouldSend = false;
          }
        }

        if (shouldSend) {
          const daysRemaining = assessment.expiresAt 
            ? Math.max(0, Math.ceil((new Date(assessment.expiresAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
            : 0;

          /*
           * The stored value is a SHA-256 hash (D38), so the plaintext that went in
           * the original invitation cannot be recovered to rebuild this link. The
           * reminder therefore issues a fresh token and stores its hash — standard
           * magic-link rotation, and a smaller exposure window than reusing one
           * token for the life of the assessment. The consequence to know about is
           * that the original link stops working once a reminder goes out, which is
           * why the reminder email carries the new link rather than a bare nudge.
           */
          const { token: freshToken, tokenHash: freshHash } = generateAccessToken();
          await db.update(vendorAssessments)
            .set({ accessToken: freshHash })
            .where(eq(vendorAssessments.id, assessment.id));

          const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
          const linkUrl = `${frontendUrl}/public/assessments/${freshToken}`;

          console.log(`Sending reminder ${nextReminderCount} to ${assessment.recipientEmail} for vendor ${vendor.name} (${daysRemaining} days remaining).`);

          try {
            await sendEmail({
              to: [assessment.recipientEmail],
              subject: `Reminder: Pending Security & Privacy Assessment for ${org.name}`,
              template: React.createElement(AssessmentReminder, {
                orgName: org.name,
                vendorName: vendor.name,
                recipientName: assessment.recipientName || 'Security Lead',
                url: linkUrl,
                daysRemaining
              })
            });

            await db.update(vendorAssessments)
              .set({
                reminderCount: nextReminderCount,
                lastReminderSentAt: now
              })
              .where(eq(vendorAssessments.id, assessment.id));
              
          } catch (err: any) {
            console.error(`Failed to send reminder for assessment ${assessment.id}:`, err.message);
          }
        }
      }
      break;
    }
 
    case 'vendor-discovery': {
      const { organizationId, domain, websiteUrl } = job.data;
      console.log(`[Vendor Discovery] Running discovery for Org ${organizationId} on domain: ${domain}, websiteUrl: ${websiteUrl}`);

      const detectedItems: Array<{ domain: string; serviceName: string; method: string }> = [];

      // 1. Website Scan
      if (websiteUrl) {
        try {
          const scanResults = await scanDomainForThirdParties(websiteUrl);
          
          for (const d of scanResults.domains) {
            let serviceName = d.split('.').slice(-2, -1)[0];
            if (serviceName) {
              serviceName = serviceName.charAt(0).toUpperCase() + serviceName.slice(1);
            } else {
              serviceName = d;
            }

            detectedItems.push({
              domain: d,
              serviceName,
              method: 'website_scan'
            });
          }
        } catch (e: any) {
          console.error(`[Vendor Discovery] Website scan failed: ${e.message}`);
        }
      }

      // 2. DNS/MX/SPF Analysis
      if (domain) {
        try {
          const dnsResults = await performDnsAnalysis(domain);
          for (const dnsItem of dnsResults) {
            detectedItems.push({
              domain: dnsItem.domain,
              serviceName: dnsItem.serviceName,
              method: 'dns_analysis'
            });
          }
        } catch (e: any) {
          console.error(`[Vendor Discovery] DNS analysis failed: ${e.message}`);
        }
      }

      console.log(`[Vendor Discovery] Detected ${detectedItems.length} total items for Org ${organizationId}`);

      // 3. Process and Save to Database
      for (const item of detectedItems) {
        const { vendor: matchedVendor } = await findMatchedVendor(db, item.domain, item.serviceName);
        const matchedVendorId = matchedVendor ? matchedVendor.id : null;
        
        let initialStatus = 'undocumented';
        if (matchedVendorId) {
          const [existingLink] = await db.select()
            .from(organizationVendors)
            .where(and(
              eq(organizationVendors.organizationId, organizationId),
              eq(organizationVendors.vendorId, matchedVendorId)
            ));
          if (existingLink) {
            initialStatus = 'added_to_register';
          }
        }

        const [existingDiscovery] = await db.select()
          .from(vendorDiscoveries)
          .where(and(
            eq(vendorDiscoveries.organizationId, organizationId),
            eq(vendorDiscoveries.detectedDomain, item.domain),
            eq(vendorDiscoveries.discoveryMethod, item.method)
          ));

        if (existingDiscovery) {
          const nextStatus = (existingDiscovery.status === 'undocumented') ? initialStatus : existingDiscovery.status;
          
          await db.update(vendorDiscoveries)
            .set({
              lastDetectedAt: new Date(),
              matchedVendorId,
              status: nextStatus,
              detectedServiceName: matchedVendor ? matchedVendor.name : item.serviceName
            })
            .where(eq(vendorDiscoveries.id, existingDiscovery.id));
        } else {
          await db.insert(vendorDiscoveries).values({
            organizationId,
            discoveryMethod: item.method,
            detectedDomain: item.domain,
            matchedVendorId,
            detectedServiceName: matchedVendor ? matchedVendor.name : item.serviceName,
            status: initialStatus,
            firstDetectedAt: new Date(),
            lastDetectedAt: new Date()
          });
        }
      }

      console.log(`[Vendor Discovery] Completed discovery for Org ${organizationId}`);
      break;
    }

    case 'weekly-organization-discovery-trigger': {
      console.log('[Vendor Discovery] Triggering weekly scans for all organizations...');
      const orgs = await db.select().from(organizations);
      for (const org of orgs) {
        const websiteUrl = (org.settings as any)?.websiteUrl;
        if (websiteUrl) {
          let domain = '';
          try {
            const urlObj = new URL(websiteUrl);
            domain = urlObj.hostname.replace(/^www\./, '');
          } catch (e) {
            continue;
          }

          // Stagger weekly scans across 6 hours (deterministic delay based on organizationId UUID string)
          const orgIdStr = org.id.replace(/-/g, '');
          const hashVal = parseInt(orgIdStr.substring(0, 8), 16) || 0;
          const delayMs = (hashVal % 360) * 60 * 1000; // 0 to 359 minutes delay

          await vendorJobsQueue.add('vendor-discovery', {
            organizationId: org.id,
            domain,
            websiteUrl
          }, {
            delay: delayMs
          });
        }
      }
      break;
    }

    case 'vendor-review-reminder': {
      console.log('[Vendor Governance] Running vendor review reminders...');
      const now = new Date();
      const in14Days = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

      const dueVendors = await db
        .select({
          orgVendor: organizationVendors,
          vendor: vendors,
        })
        .from(organizationVendors)
        .innerJoin(vendors, eq(organizationVendors.vendorId, vendors.id))
        .where(
          and(
            liveVendors(),
            isNotNull(organizationVendors.nextReviewAt),
            lte(organizationVendors.nextReviewAt, in14Days)
          )
        );

      for (const { orgVendor, vendor } of dueVendors) {
        const reviewDate = orgVendor.nextReviewAt!;
        const isOverdue = reviewDate.getTime() < now.getTime();
        const days = Math.ceil((reviewDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        const title = isOverdue
          ? `Overdue vendor review: ${vendor.name}`
          : `Upcoming vendor review in ${days} days: ${vendor.name}`;

        const body = isOverdue
          ? `The scheduled compliance review for ${vendor.name} (${orgVendor.criticality || 'medium'} criticality) was due on ${reviewDate.toISOString().split('T')[0]}. Please attest the relationship.`
          : `The compliance review for ${vendor.name} is due on ${reviewDate.toISOString().split('T')[0]}.`;

        await queueNotification({
          organizationId: orgVendor.organizationId,
          type: isOverdue ? 'vendor.review_overdue' : 'vendor.review_due',
          title,
          body,
          actionUrl: `/vendors/${vendor.id}?tab=relationship`,
          metadata: {
            vendorId: vendor.id,
            vendorName: vendor.name,
            reviewDate: reviewDate.toISOString(),
            isOverdue,
          },
        });
      }
      break;
    }

    default:
      console.warn(`Unknown job: ${job.name}`);
  }
}, { drainDelay: 15 });

if (vendorWorker) {
  vendorWorker.on('completed', (job: any) => {
    console.log(`[Vendor Worker] Job ${job.id} completed successfully`);
  });

  vendorWorker.on('failed', (job: Job | undefined, err: Error) => {
    console.error(`[Vendor Worker] Job ${job?.id} failed:`, err.message);
  });

  vendorWorker.on('error', (err: Error) => {
    // Suppress unhandled worker errors (like connection drops)
    console.warn('[Vendor Worker] Error:', err.message);
  });
}

// D17. This was a `console.log` under the comment "Assuming a generic
// notifications table exists" — while `queueNotification` sat two hundred lines
// away in the same file's import list, used by the sub-processor fan-out above.
// Every DPA-expiry and renewal alert was invisible. The urgency argument is
// kept for log continuity; the real routing is the notification type, which
// carries its channels (email/slack/in_app) from NOTIFICATION_TYPES.
async function createNotification(
  orgId: string,
  urgency: string,
  message: string,
  opts?: { type?: 'vendor.dpa_expired' | 'vendor.dpa_expiring_7d' | 'vendor.dpa_expiring_30d'; actionUrl?: string; vendorName?: string },
) {
  const type = opts?.type ?? 'vendor.dpa_expiring_30d';
  await queueNotification({
    organizationId: orgId,
    type,
    title: message.slice(0, 120),
    body: message,
    actionUrl: opts?.actionUrl ?? '/vendors',
    metadata: { vendorName: opts?.vendorName ?? null },
  });
}

// Function to schedule recurring jobs


function getLevenshteinDistance(a: string, b: string): number {
  const distance = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = i;
    for (let j = 1; j <= b.length; j++) {
      const val = Math.min(
        distance[j]! + 1,
        prev + 1,
        distance[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
      distance[j - 1] = prev;
      prev = val;
    }
    distance[b.length] = prev;
  }
  return distance[b.length]!;
}

function getSimilarity(a: string, b: string): number {
  const distance = getLevenshteinDistance(a, b);
  const maxLength = Math.max(a.length, b.length);
  if (maxLength === 0) return 1.0;
  return 1.0 - distance / maxLength;
}

async function performDnsAnalysis(domain: string) {
  const discoveries: Array<{ domain: string; type: string; url: string; serviceName: string }> = [];

  // 1. MX Records lookup
  try {
    const mxRecords = await dns.resolveMx(domain);
    for (const mx of mxRecords) {
      const exchange = mx.exchange.toLowerCase();
      if (exchange.includes('google.com') || exchange.includes('googlemail.com')) {
        discoveries.push({
          domain: 'google.com',
          type: 'dns_analysis',
          url: exchange,
          serviceName: 'Google Workspace'
        });
        break;
      }
      if (exchange.includes('outlook.com') || exchange.includes('mail.protection.outlook.com')) {
        discoveries.push({
          domain: 'outlook.office365.com',
          type: 'dns_analysis',
          url: exchange,
          serviceName: 'Microsoft Office 365'
        });
        break;
      }
      if (exchange.includes('zoho.com')) {
        discoveries.push({
          domain: 'zoho.com',
          type: 'dns_analysis',
          url: exchange,
          serviceName: 'Zoho Mail'
        });
        break;
      }
    }
  } catch (err) {
    console.warn(`[DNS Analysis] MX lookup failed for ${domain}:`, err);
  }

  // 2. SPF TXT Records lookup
  try {
    const txtRecords = await dns.resolveTxt(domain);
    const spfRecord = txtRecords.flatMap(r => r).find(r => r.startsWith('v=spf1'));
    if (spfRecord) {
      const spfParts = spfRecord.split(/\s+/);
      const spfMapping: Record<string, { serviceName: string; domain: string }> = {
        'mailgun.org': { serviceName: 'Mailgun', domain: 'mailgun.com' },
        'sendgrid.net': { serviceName: 'SendGrid', domain: 'sendgrid.com' },
        'mcsv.net': { serviceName: 'Mailchimp', domain: 'mailchimp.com' },
        'amazonses.com': { serviceName: 'Amazon SES', domain: 'aws.amazon.com' },
        'mailjet.com': { serviceName: 'Mailjet', domain: 'mailjet.com' },
        'mandrillapp.com': { serviceName: 'Mandrill', domain: 'mandrill.com' },
        'sparkpostmail.com': { serviceName: 'SparkPost', domain: 'sparkpost.com' },
        'constantcontact.com': { serviceName: 'Constant Contact', domain: 'constantcontact.com' },
        'zoho.com': { serviceName: 'Zoho Campaigns', domain: 'zoho.com' },
      };

      for (const part of spfParts) {
        if (part.startsWith('include:')) {
          const includeDomain = part.replace('include:', '').toLowerCase();
          for (const [key, details] of Object.entries(spfMapping)) {
            if (includeDomain.includes(key)) {
              discoveries.push({
                domain: details.domain,
                type: 'dns_analysis',
                url: part,
                serviceName: details.serviceName
              });
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn(`[DNS Analysis] SPF/TXT lookup failed for ${domain}:`, err);
  }

  // 3. CCNAME Subdomain checking
  const commonServices = [
    { name: 'Zendesk', domainPattern: '{prefix}.zendesk.com', matchedDomain: 'zendesk.com' },
    { name: 'Intercom', domainPattern: '{prefix}.intercom.help', matchedDomain: 'intercom.com' },
    { name: 'Atlassian Jira/Confluence', domainPattern: '{prefix}.atlassian.net', matchedDomain: 'atlassian.com' },
    { name: 'Slack', domainPattern: '{prefix}.slack.com', matchedDomain: 'slack.com' },
    { name: 'HubSpot', domainPattern: '{prefix}.hubspot.com', matchedDomain: 'hubspot.com' }
  ];

  const prefix = domain.split('.')[0];
  if (prefix) {
    for (const service of commonServices) {
      const subdomain = service.domainPattern.replace('{prefix}', prefix);
      try {
        await dns.resolve(subdomain);
        discoveries.push({
          domain: service.matchedDomain,
          type: 'dns_analysis',
          url: subdomain,
          serviceName: service.name
        });
      } catch (err) {
        // Expected if subdomain doesn't exist
      }
    }
  }

  return discoveries;
}

async function findMatchedVendor(dbInstance: any, detectedDomain: string, serviceName: string) {
  const allVendors = await dbInstance.select().from(vendors);

  // getRootDomain now lives in lib/domains.ts so that tracker matching and vendor
  // matching cannot drift apart on the same host.
  const cleanDomain = getRootDomain(detectedDomain);

  let bestMatch: any = null;
  let bestConfidence = 0.0;

  for (const v of allVendors) {
    const website = v.website ? getRootDomain(v.website.replace(/^(https?:\/\/)?(www\.)?/, '')) : '';
    const aliases = (v.aliases || []) as string[];

    // 1. Check exact or subdomain match with website
    if (website && (cleanDomain === website || cleanDomain.endsWith('.' + website) || website.endsWith('.' + cleanDomain))) {
      return { vendor: v, confidence: 1.0 };
    }

    // 2. Check aliases
    const matchedAlias = aliases.find(alias => {
      const cleanAlias = getRootDomain(alias.replace(/^(https?:\/\/)?(www\.)?/, ''));
      return cleanDomain === cleanAlias || cleanDomain.endsWith('.' + cleanAlias);
    });
    if (matchedAlias) {
      return { vendor: v, confidence: 1.0 };
    }

    // 3. Fuzzy match serviceName or domain name vs vendor name using Levenshtein
    const cleanVendorName = v.name.toLowerCase().replace(/\s+/g, '');
    const cleanServiceName = serviceName.toLowerCase().replace(/\s+/g, '');
    const cleanDomainName = cleanDomain.split('.')[0] || '';

    const simName = getSimilarity(cleanVendorName, cleanServiceName);
    const simDomain = getSimilarity(cleanVendorName, cleanDomainName);
    const maxSim = Math.max(simName, simDomain);

    if (maxSim > bestConfidence) {
      bestConfidence = maxSim;
      bestMatch = v;
    }
  }

  // Threshold checking
  if (bestConfidence >= 0.50) {
    return { vendor: bestMatch, confidence: bestConfidence };
  }

  return { vendor: null, confidence: 0.0 };
}
