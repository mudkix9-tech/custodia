import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';

// Replicate the text cleaning function to test it
function cleanPageText(rawText: string): string {
  return rawText
    .split('\n')
    .map(line => {
      const trimmed = line.trim();
      const isCookieBanner = /cookie/i.test(trimmed) && /(use|experience|accept|agree|decline|consent|settings|manage|policy)/i.test(trimmed);
      const isCopyright = /copyright|all rights reserved|©/i.test(trimmed);
      const isBoilerplateLink = /^(privacy policy|terms of service|terms & conditions|contact us|about us|help center|support)$/i.test(trimmed) || 
                                (trimmed.includes('|') && /(privacy|terms|contact|about|support)/i.test(trimmed));
      
      if (isCookieBanner || isCopyright || isBoilerplateLink) {
        return '';
      }
      return trimmed;
    })
    .filter(Boolean)
    .join('\n')
    .replace(/\s+/g, ' ')
    .replace(/\b(?:202\d|19\d\d)\b/g, '')
    .trim();
}

async function runTests() {
  const { db } = await import('../db.js');
  const { vendors, organizationVendors, vendorSubProcessorChanges, users, organizations } = await import('db');

  console.log('Starting Sub-Processor Change Monitoring tests...');

  // Test 1: Text cleaning and normalization
  console.log('Testing text cleaning logic...');
  const sampleRawText = `
    Welcome to our page.
    Copyright © 2026 GDPR Privaaro Inc. All rights reserved.
    We use cookies to ensure you get the best experience. Accept Cookies Privacy Policy
    Cookie Settings
    Sub-processors List:
    - Amazon Web Services (Hosting in Ireland)
    - Twilio (SMS delivery)
    Contact Us | Support | Terms of Service
  `;
  const cleaned = cleanPageText(sampleRawText);
  console.log('Cleaned Text:', cleaned);
  
  if (cleaned.includes('Copyright') || cleaned.includes('2026') || cleaned.includes('cookies') || cleaned.includes('Privacy Policy') || cleaned.includes('Terms of Service')) {
    throw new Error('Text cleaning failed to strip boilerplate noise.');
  }
  if (!cleaned.includes('Amazon Web Services') || !cleaned.includes('Twilio')) {
    throw new Error('Text cleaning stripped actual sub-processors content.');
  }
  console.log('Text cleaning test passed!');

  // Test 2: Database Operations and Relations
  console.log('Testing DB change insertion and retrieval...');
  let [org] = await db.select().from(organizations).limit(1);
  if (!org) {
    const [insertedOrg] = await db.insert(organizations).values({
      name: 'Scraper Test Org',
      slug: 'scraper-test-org-' + Math.floor(Math.random() * 100000),
      countryCode: 'US',
    } as any).returning();
    org = insertedOrg;
  }
  if (!org) throw new Error('No org found or created');
  
  const [user] = await db.select().from(users).limit(1);
  if (!user) throw new Error('Need at least one user to run tests.');

  // Create a temporary vendor and link it
  const [tempVendor] = await db.insert(vendors).values({
    name: 'Scrape Test Vendor',
    website: 'scrapetest.com',
    isGlobal: false,
    subProcessorListUrl: 'https://scrapetest.com/sub-processors'
  } as any).returning();
  if (!tempVendor) throw new Error('Failed to create temp vendor');

  const [orgVendor] = await db.insert(organizationVendors).values({
    organizationId: org.id,
    vendorId: tempVendor.id,
    purpose: 'Testing subprocessor scrapers',
    dpaStatus: 'signed',
    addedBy: user.id
  } as any).returning();
  if (!orgVendor) throw new Error('Failed to create org vendor link');

  try {
    // Simulate detecting a change
    const prevHash = crypto.createHash('sha256').update('Baseline Subprocessors').digest('hex');
    const newHash = crypto.createHash('sha256').update('Baseline Subprocessors\n- New Subprocessor LLC').digest('hex');

    const [changeRecord] = await db.insert(vendorSubProcessorChanges).values({
      organizationId: org.id,
      orgVendorId: orgVendor.id,
      previousHash: prevHash,
      newHash: newHash,
      previousSnapshot: 'Baseline Subprocessors',
      newSnapshot: 'Baseline Subprocessors\n- New Subprocessor LLC',
      status: 'pending_review'
    }).returning();
    if (!changeRecord) throw new Error('Failed to create change record');

    console.log('Inserted change record:', changeRecord.id);

    // Verify retrieval
    const retrieved = await db.select().from(vendorSubProcessorChanges).where(eq(vendorSubProcessorChanges.id, changeRecord.id));
    if (retrieved.length === 0 || !retrieved[0]) throw new Error('Could not retrieve change record.');
    if (retrieved[0].status !== 'pending_review') throw new Error('Status mismatch.');

    // Simulate review
    await db.update(vendorSubProcessorChanges)
      .set({
        status: 'acknowledged',
        notes: 'Approved new subprocessor LLC',
        reviewedBy: user.id,
        reviewedAt: new Date()
      })
      .where(eq(vendorSubProcessorChanges.id, changeRecord.id));

    const reviewed = await db.select().from(vendorSubProcessorChanges).where(eq(vendorSubProcessorChanges.id, changeRecord.id));
    if (reviewed.length === 0 || !reviewed[0] || reviewed[0].status !== 'acknowledged' || reviewed[0].notes !== 'Approved new subprocessor LLC') {
      throw new Error('Review update failed.');
    }

    console.log('Sub-processor changes DB flow verified successfully!');
  } finally {
    // Cleanup
    await db.delete(vendorSubProcessorChanges).where(eq(vendorSubProcessorChanges.orgVendorId, orgVendor.id));
    await db.delete(organizationVendors).where(eq(organizationVendors.id, orgVendor.id));
    await db.delete(vendors).where(eq(vendors.id, tempVendor.id));
  }

  console.log('All tests passed successfully!');
}

runTests().catch(err => {
  console.error('Tests failed:', err);
  process.exit(1);
});
