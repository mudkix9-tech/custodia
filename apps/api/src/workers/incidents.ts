import { createWorker, createQueue, getBoss } from '../lib/queue.js';
import { db } from '../db.js';
import { vendors, organizationVendors, vendorIncidents, organizationVendorIncidentAlerts } from 'db';
import { eq, and, sql, or } from 'drizzle-orm';
import { queueNotification } from '../utils/notifications.js';
import { dispatchWebhook } from '../utils/webhookDispatcher.js';
import { recalculateVendorRiskForAllOrgs } from '../routers/vendors.js';

export const incidentJobsQueue = process.env.NODE_ENV === 'test'
  ? null as any
  : createQueue('vendor-incidents-ingest');

// Helper to extract root domain from a URL
export function getDomain(urlStr: string): string {
  try {
    if (!urlStr) return '';
    let formatted = urlStr.trim().toLowerCase();
    if (!/^https?:\/\//i.test(formatted)) {
      formatted = 'https://' + formatted;
    }
    const parsed = new URL(formatted);
    let hostname = parsed.hostname;
    if (hostname.startsWith('www.')) {
      hostname = hostname.slice(4);
    }
    return hostname;
  } catch (e) {
    return '';
  }
}

// Ingestion sources -- the real feeds a future RSS parser will consume.
const EDPB_FEED_URL = 'https://edpb.europa.eu/feed/news_en';
const GDPRHUB_FEED_URL = 'https://gdprhub.eu/index.php?title=Special:RecentChanges&feed=rss';

export async function processNewIncident(incidentData: {
  vendorSlug?: string;
  incidentType: 'breach' | 'fine' | 'enforcement' | 'investigation';
  title: string;
  summary: string;
  sourceUrl: string;
  sourceName: string;
  incidentDate: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
  affectedDataCategories?: string[];
  fineAmount?: number;
  fineCurrency?: string;
}) {
  // 1. Matching Engine: find target vendor using domain and name/alias criteria
  const globalVendors = await db.select().from(vendors);
  let matchedVendor: any = null;
  let isHighConfidence = false;

  const titleAndContent = `${incidentData.title} ${incidentData.summary} ${incidentData.sourceUrl}`.toLowerCase();

  for (const v of globalVendors) {
    // A. Domain Match: Primary signal (High Confidence)
    const vendorDomain = getDomain(v.website || '');
    if (vendorDomain && vendorDomain.length > 3) {
      if (titleAndContent.includes(vendorDomain)) {
        matchedVendor = v;
        isHighConfidence = true;
        break; // Stop on high confidence domain match
      }
    }

    // B. Name/Alias word boundaries: Secondary signal (Fuzzy Match)
    const aliases = [v.name, ...(v.aliases || [])].map(a => a.toLowerCase().trim()).filter(Boolean);
    for (const alias of aliases) {
      // Regex checking for word boundaries to avoid meta-analysis matching Meta
      const escapedAlias = alias.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(`\\b${escapedAlias}\\b`, 'i');
      if (regex.test(incidentData.title) || regex.test(incidentData.summary)) {
        matchedVendor = v;
        // Keep searching in case we find a high confidence domain match on a subsequent vendor
      }
    }
  }

  if (!matchedVendor) {
    console.log(`[Incident Engine] No matching vendor found for incident: "${incidentData.title}"`);
    return;
  }

  const vendorSlug = matchedVendor.slug || matchedVendor.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const incidentStatus = isHighConfidence ? 'published' : 'draft';

  // 2. Deduplication: hash on vendor_slug + incident_type and check ±7 days window
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  const incidentTime = incidentData.incidentDate.getTime();
  const minDate = new Date(incidentTime - sevenDays);
  const maxDate = new Date(incidentTime + sevenDays);

  const existingIncidents = await db.select()
    .from(vendorIncidents)
    .where(and(
      eq(vendorIncidents.vendorSlug, vendorSlug),
      eq(vendorIncidents.incidentType, incidentData.incidentType)
    ));

  const duplicate = existingIncidents.find(inc => {
    if (!inc.incidentDate) return false;
    const incTime = new Date(inc.incidentDate).getTime();
    return incTime >= minDate.getTime() && incTime <= maxDate.getTime();
  });

  let targetIncidentId: string;

  if (duplicate) {
    console.log(`[Incident Engine] Duplicate incident detected in window. Merging sources for incident: ${duplicate.id}`);
    
    // Merge source information into summary
    const updatedSummary = `${duplicate.summary || ''}\n\n[Additional Source: ${incidentData.sourceName}] ${incidentData.summary}`;
    await db.update(vendorIncidents)
      .set({ 
        summary: updatedSummary,
        // Upgrade severity if incoming is higher
        severity: getHigherSeverity(duplicate.severity as any, incidentData.severity)
      })
      .where(eq(vendorIncidents.id, duplicate.id));
      
    targetIncidentId = duplicate.id;
  } else {
    // Insert new incident
    const [newIncident] = await db.insert(vendorIncidents).values({
      vendorSlug,
      incidentType: incidentData.incidentType,
      title: incidentData.title,
      summary: incidentData.summary,
      sourceUrl: incidentData.sourceUrl,
      sourceName: incidentData.sourceName,
      incidentDate: incidentData.incidentDate.toISOString().slice(0, 10),
      severity: incidentData.severity,
      affectedDataCategories: incidentData.affectedDataCategories || [],
      fineAmount: incidentData.fineAmount ? incidentData.fineAmount.toString() : null,
      fineCurrency: incidentData.fineCurrency || null,
      status: incidentStatus
    }).returning();

    if (!newIncident) throw new Error('Failed to create vendor incident record');
    targetIncidentId = newIncident.id;

    console.log(`[Incident Engine] Inserted new incident (${incidentStatus}): ${incidentData.title}`);

    // If published, trigger fan-out alerts
    if (incidentStatus === 'published') {
      await publishIncidentAndAlertOrgs(targetIncidentId, matchedVendor, newIncident);
    }
  }
}

function getHigherSeverity(s1: 'low' | 'medium' | 'high' | 'critical', s2: 'low' | 'medium' | 'high' | 'critical'): 'low' | 'medium' | 'high' | 'critical' {
  const ranking = { low: 1, medium: 2, high: 3, critical: 4 };
  return ranking[s1] >= ranking[s2] ? s1 : s2;
}

export async function publishIncidentAndAlertOrgs(incidentId: string, matchedVendor: any, incident: any) {
  // Find organizations using this vendor
  const linkedOrgs = await db.select()
    .from(organizationVendors)
    .where(eq(organizationVendors.vendorId, matchedVendor.id));

  console.log(`[Incident Engine] Fanning out alerts to ${linkedOrgs.length} orgs for vendor ${matchedVendor.name}`);

  if (linkedOrgs.length > 0) {
    const alertsToInsert = linkedOrgs.map(orgVendor => ({
      organizationId: orgVendor.organizationId,
      orgVendorId: orgVendor.id,
      incidentId: incidentId,
      status: 'unread'
    }));

    const insertedAlerts = await db.insert(organizationVendorIncidentAlerts).values(alertsToInsert as any).returning();

    await Promise.all(insertedAlerts.map(async (alert) => {
      const orgVendor = linkedOrgs.find(o => o.id === alert.orgVendorId);
      if (!orgVendor) return;

      // 2. Queue in-app + email notification
      await queueNotification({
        organizationId: orgVendor.organizationId,
        type: 'vendor.incident_detected',
        title: `${matchedVendor.name} - ${incident.incidentType.toUpperCase()} Detected`,
        body: `${matchedVendor.name} is affected by a new incident: "${incident.title}". Please assess impact and review Article 33 obligations.`,
        actionUrl: `/vendors/${matchedVendor.id}?tab=incidents`,
        metadata: {
          vendorId: matchedVendor.id,
          orgVendorId: orgVendor.id,
          incidentId,
          alertId: alert.id
        }
      });

      // 3. Dispatch webhook event
      await dispatchWebhook(orgVendor.organizationId, 'vendor.incident_detected', {
        vendorId: matchedVendor.id,
        vendorName: matchedVendor.name,
        orgVendorId: orgVendor.id,
        incidentId,
        alertId: alert.id,
        incidentType: incident.incidentType,
        title: incident.title,
        severity: incident.severity,
        detectedAt: incident.detectedAt
      });
    }));
  }

  // 4. Auto-escalate vendor risk score
  // Append new incident into global vendor's knownIncidents JSONB array
  const currentIncidents = (matchedVendor.knownIncidents as any[]) || [];
  const updatedIncidents = [
    ...currentIncidents,
    { date: incident.incidentDate || new Date(), description: incident.title }
  ];

  await db.update(vendors)
    .set({ knownIncidents: updatedIncidents })
    .where(eq(vendors.id, matchedVendor.id));

  // Recalculate risk score for all organizations linked to this vendor
  await recalculateVendorRiskForAllOrgs(db, matchedVendor.id);
}

// Ingestion Worker Tasks
// D16: this used to discard the fetched RSS bodies and process three hardcoded
// samples instead -- fabricated breaches about Mailchimp, Meta and Google
// Analytics, each stamped incidentDate: new Date(), fanned out to every tenant
// tracking those vendors and pinned their breach factor at maximum forever.
// Ingestion is unimplemented until real RSS parsing exists; the job also remains
// in DORMANT_JOBS, so nothing below executes today.
export async function scrapeBreachFeeds() {
  console.warn('[Incident Scraper] Feed ingestion is not implemented; no incidents ingested.');
}

// BullMQ Worker Initialization
export const incidentWorker = process.env.NODE_ENV === 'test'
  ? null as any
  : createWorker('vendor-incidents-ingest', async (job) => {
      console.log(`[Incident Worker] Processing job ${job.name} (ID: ${job.id})`);
      if (job.name === 'ingest-daily') {
        await scrapeBreachFeeds();
      }
    }, { drainDelay: 60 });

if (incidentWorker) {
  incidentWorker.on('completed', (job: any) => {
    console.log(`[Incident Worker] Job ${job.id} has completed!`);
  });

  incidentWorker.on('failed', (job: any, err: any) => {
    console.error(`[Incident Worker] Job ${job?.id} has failed with ${err.message}`);
  });

  incidentWorker.on('error', (err: any) => {
    console.warn('[Incident Worker] General error:', err.message);
  });
}


