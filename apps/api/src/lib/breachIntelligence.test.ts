process.env.NODE_ENV = 'test';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

import { eq, and, ilike, inArray } from 'drizzle-orm';
import crypto from 'crypto';

async function runTests() {
  const { db } = await import('../db.js');
  const { vendors, organizationVendors, vendorIncidents, organizationVendorIncidentAlerts, users, organizations } = await import('db');
  const { processNewIncident, getDomain } = await import('../workers/incidents.js');

  console.log('Cleaning up leftovers from previous runs...');
  const leftovers = await db.select().from(vendors).where(ilike(vendors.slug, 'stripe-%'));
  for (const left of leftovers) {
    const leftoverIncidents = await db.select().from(vendorIncidents).where(eq(vendorIncidents.vendorSlug, left.slug!));
    if (leftoverIncidents.length > 0) {
      await db.delete(organizationVendorIncidentAlerts).where(
        inArray(organizationVendorIncidentAlerts.incidentId, leftoverIncidents.map(i => i.id))
      );
    }
    await db.delete(vendorIncidents).where(eq(vendorIncidents.vendorSlug, left.slug!));
    await db.delete(organizationVendors).where(eq(organizationVendors.vendorId, left.id));
    await db.delete(vendors).where(eq(vendors.id, left.id));
  }

  console.log('Starting Breach Intelligence Feed tests...');

  // Test 1: getDomain helper
  console.log('Testing domain extractor...');
  if (getDomain('https://mailchimp.com/pricing/') !== 'mailchimp.com') {
    throw new Error('Domain extraction failed for standard https URL.');
  }
  if (getDomain('http://www.google.co.uk/search') !== 'google.co.uk') {
    throw new Error('Domain extraction failed for www subdomain.');
  }
  console.log('Domain extractor tests passed!');

  // Setup test environment data
  let [org] = await db.select().from(organizations).limit(1);
  if (!org) {
    const [insertedOrg] = await db.insert(organizations).values({
      name: 'Breach Test Org',
      slug: 'breach-test-org-' + Math.floor(Math.random() * 100000),
      countryCode: 'US',
    } as any).returning();
    org = insertedOrg;
  }
  if (!org) throw new Error('No org found or created');
  
  const [user] = await db.select().from(users).limit(1);
  if (!user) throw new Error('Need at least one user to run tests.');

  // Create temporary vendor with domain and aliases
  const testSlug = 'stripe-' + Math.floor(Math.random() * 100000);
  const [tempVendor] = await db.insert(vendors).values({
    name: 'Stripe Payments',
    slug: testSlug,
    website: 'https://stripe.com/global',
    isGlobal: true,
    aliases: ['Stripe Inc', 'Stripe EU', 'Stripe/Ireland'],
    knownIncidents: []
  } as any).returning();
  if (!tempVendor) throw new Error('Failed to create temp vendor');

  const [orgVendor] = await db.insert(organizationVendors).values({
    organizationId: org.id,
    vendorId: tempVendor.id,
    purpose: 'Testing breach matching',
    dpaStatus: 'signed',
    addedBy: user.id,
    riskScore: 0,
    riskLevel: 'low'
  } as any).returning();
  if (!orgVendor) throw new Error('Failed to create org vendor link');

  try {
    // Test 2: Primary Domain Match (High Confidence -> Published)
    console.log('Testing High Confidence primary domain match...');
    await processNewIncident({
      incidentType: 'breach',
      title: 'Security incident at stripe.com portal',
      summary: 'Data breach exposing customer details hosted at stripe.com servers.',
      sourceUrl: 'https://securitynews.com/stripe-breach',
      sourceName: 'Security News',
      incidentDate: new Date(),
      severity: 'high'
    });

    // Verify it auto-published and created alert
    const incidentsList = await db.select().from(vendorIncidents).where(eq(vendorIncidents.vendorSlug, testSlug));
    if (incidentsList.length === 0 || !incidentsList[0]) {
      throw new Error('High confidence incident was not matched or inserted.');
    }
    const incident = incidentsList[0];
    if (incident.status !== 'published') {
      throw new Error('High confidence incident should have status = published.');
    }

    const alerts = await db.select().from(organizationVendorIncidentAlerts).where(eq(organizationVendorIncidentAlerts.incidentId, incident.id));
    if (alerts.length === 0) {
      throw new Error('Org alerts were not fanned out for published incident.');
    }
    console.log('High Confidence domain match test passed!');

    // Test 3: Fuzzy / Alias Match (Low Confidence -> Draft)
    console.log('Testing Low Confidence alias match...');
    await processNewIncident({
      incidentType: 'investigation',
      title: 'Regulator opens inquiry into Stripe Inc pricing transparency',
      summary: 'Regulatory inquiry launched regarding compliance concerns.',
      sourceUrl: 'https://news.com/stripe-inquiry',
      sourceName: 'Inquiry Feed',
      incidentDate: new Date(),
      severity: 'medium'
    });

    const draftIncidents = await db.select()
      .from(vendorIncidents)
      .where(and(
        eq(vendorIncidents.vendorSlug, testSlug),
        eq(vendorIncidents.incidentType, 'investigation')
      ));
    
    if (draftIncidents.length === 0 || !draftIncidents[0]) {
      throw new Error('Fuzzy alias matched incident was not inserted.');
    }
    const draftInc = draftIncidents[0];
    if (draftInc.status !== 'draft') {
      throw new Error('Fuzzy matched incident should be inserted in draft status.');
    }

    const draftAlerts = await db.select().from(organizationVendorIncidentAlerts).where(eq(organizationVendorIncidentAlerts.incidentId, draftInc.id));
    if (draftAlerts.length > 0) {
      throw new Error('Draft incident should not trigger alert fan-out before publishing.');
    }
    console.log('Low Confidence alias match test passed!');

    // Test 4: Ingestion Deduplication (±7 days window)
    console.log('Testing ±7 day window deduplication and source merging...');
    const originalSummary = incident.summary || '';
    
    // Process another breach incident of same type for the same vendor 2 days later
    const duplicateDate = new Date();
    duplicateDate.setDate(duplicateDate.getDate() + 2);

    await processNewIncident({
      incidentType: 'breach',
      title: 'Second notice on stripe.com security issue',
      summary: 'Additional security reports confirming compromised databases.',
      sourceUrl: 'https://othernews.com/stripe-followup',
      sourceName: 'Other News',
      incidentDate: duplicateDate,
      severity: 'critical'
    });

    const finalIncidentsList = await db.select().from(vendorIncidents).where(eq(vendorIncidents.vendorSlug, testSlug));
    const breaches = finalIncidentsList.filter(i => i.incidentType === 'breach');
    if (breaches.length !== 1) {
      throw new Error(`Deduplication failed: expected 1 breach incident, got ${breaches.length}`);
    }

    const mergedIncident = breaches[0]!;
    if (!mergedIncident.summary?.includes('Additional Source') || !mergedIncident.summary?.includes('Other News')) {
      throw new Error('Source merge failed: description did not contain merged info.');
    }
    if (mergedIncident.severity !== 'critical') {
      throw new Error('Deduplication did not upgrade severity to critical.');
    }
    console.log('Deduplication test passed!');

    // Test 5: Risk Score Auto-Escalation
    console.log('Testing risk score auto-escalation triggers...');
    const [refreshedOrgVendor] = await db.select().from(organizationVendors).where(eq(organizationVendors.id, orgVendor.id));
    if (!refreshedOrgVendor || refreshedOrgVendor.riskScore === 0) {
      throw new Error('Risk score was not escalated when breach occurred.');
    }
    console.log(`Risk score successfully escalated to ${refreshedOrgVendor.riskScore} (Level: ${refreshedOrgVendor.riskLevel})!`);

    console.log('All Breach Intelligence tests passed successfully!');
  } finally {
    // Cleanup
    const finalIncidents = await db.select().from(vendorIncidents).where(eq(vendorIncidents.vendorSlug, testSlug));
    for (const inc of finalIncidents) {
      await db.delete(organizationVendorIncidentAlerts).where(eq(organizationVendorIncidentAlerts.incidentId, inc.id));
    }
    await db.delete(vendorIncidents).where(eq(vendorIncidents.vendorSlug, testSlug));
    await db.delete(organizationVendors).where(eq(organizationVendors.id, orgVendor.id));
    await db.delete(vendors).where(eq(vendors.id, tempVendor.id));
  }
}

runTests().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('Breach Intelligence tests failed:', err);
  process.exit(1);
});
