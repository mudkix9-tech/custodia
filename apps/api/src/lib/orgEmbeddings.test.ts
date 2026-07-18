import dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });
import { serializeEntityForEmbedding } from './orgEmbeddings.js';
import { db } from '../db.js';
import { 
  organizations, 
  processingActivities, 
  vendors, 
  organizationVendors, 
  complianceGaps,
  users
} from 'db';
import { eq } from 'drizzle-orm';

async function runTests() {
  console.log('Starting orgEmbeddings serialization tests...');
  
  // 1. Get or create a test organization
  let [org] = await db.select().from(organizations).limit(1);
  if (!org) {
    [org] = await db.insert(organizations).values({
      name: 'Test Org',
      slug: 'test-org-' + Math.floor(Math.random() * 100000),
      countryCode: 'US',
    } as any).returning();
  }
  if (!org) {
    throw new Error('Failed to find or create organization');
  }
  console.log(`Using organization: ${org.name} (id: ${org.id})`);

  // Get a real user ID to satisfy foreign key constraints
  const [user] = await db.select().from(users).limit(1);
  if (!user) {
    throw new Error('No user found in database. Run migrations/seeds first.');
  }
  console.log(`Using user: ${user.email} (id: ${user.id})`);

  // 2. Test ROPA serialization
  const [activity] = await db.insert(processingActivities).values({
    organizationId: org.id,
    name: 'Customer Email Marketing',
    purpose: 'Sending weekly newsletter and promotional offers',
    lawfulBasis: 'consent',
    createdBy: user.id,
  } as any).returning();

  if (!activity) {
    throw new Error('Failed to create test activity');
  }

  try {
    const serializedRopa = await serializeEntityForEmbedding('processing_activity', activity.id);
    console.log('ROPA Serialization Success:', serializedRopa);
    if (!serializedRopa.includes('Customer Email Marketing') || !serializedRopa.includes('consent')) {
      throw new Error('ROPA serialization mismatch');
    }
  } finally {
    await db.delete(processingActivities).where(eq(processingActivities.id, activity.id));
  }

  // 3. Test Vendor serialization
  let [globalVendor] = await db.select().from(vendors).limit(1);
  if (!globalVendor) {
    [globalVendor] = await db.insert(vendors).values({
      name: 'Mailchimp',
      website: 'mailchimp.com',
      isGlobal: true,
    } as any).returning();
  }
  if (!globalVendor) {
    throw new Error('Failed to find or create global vendor');
  }

  const [orgVendor] = await db.insert(organizationVendors).values({
    organizationId: org.id,
    vendorId: globalVendor.id,
    purpose: 'Email campaigns',
    dpaStatus: 'signed',
    addedBy: user.id,
  } as any).returning();

  if (!orgVendor) {
    throw new Error('Failed to create org vendor link');
  }

  try {
    const serializedVendor = await serializeEntityForEmbedding('vendor', orgVendor.id);
    console.log('Vendor Serialization Success:', serializedVendor);
    if (!serializedVendor.includes(globalVendor.name) || !serializedVendor.includes('signed')) {
      throw new Error('Vendor serialization mismatch');
    }
  } finally {
    await db.delete(organizationVendors).where(eq(organizationVendors.id, orgVendor.id));
  }

  // 4. Test Compliance Gap serialization
  const [gap] = await db.insert(complianceGaps).values({
    organizationId: org.id,
    entityType: 'ropa',
    entityId: '00000000-0000-0000-0000-000000000000',
    gapType: 'missing_dpo',
    title: 'Missing DPO details',
    severity: 'high',
    status: 'open',
    gdprArticles: [37, 38],
  } as any).returning();

  if (!gap) {
    throw new Error('Failed to create test gap');
  }

  try {
    const serializedGap = await serializeEntityForEmbedding('gap', gap.id);
    console.log('Gap Serialization Success:', serializedGap);
    if (!serializedGap.includes('Missing DPO details') || !serializedGap.includes('high')) {
      throw new Error('Gap serialization mismatch');
    }
  } finally {
    await db.delete(complianceGaps).where(eq(complianceGaps.id, gap.id));
  }

  console.log('All serialization tests passed successfully!');
}

runTests().catch(err => {
  console.error('Tests failed:', err);
  process.exit(1);
});
