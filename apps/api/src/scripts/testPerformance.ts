import { sql } from 'drizzle-orm';
import { db } from '../db.js';
import { consentRecords, consentDomains, organizations } from 'db';

async function main() {
  console.log('Testing query performance for Consent Analytics...');
  
  // 1. Get or create a domain
  let [org] = await db.select().from(organizations).limit(1);
  if (!org) {
    [org] = await db.insert(organizations).values({ name: 'Test Org', slug: 'test-org' }).returning();
  }

  let [domain] = await db.select().from(consentDomains).where(sql`${consentDomains.organizationId} = ${org.id}`).limit(1);
  if (!domain) {
    [domain] = await db.insert(consentDomains).values({
      organizationId: org.id,
      domain: 'example.com',
      scriptId: 'testscript'
    }).returning();
  }
  
  const domainId = domain.id;
  
  console.log('Checking current record count...');
  const countResult = await db.execute(sql`SELECT COUNT(*) FROM ${consentRecords} WHERE domain_id = ${domainId}`);
  const count = Number(countResult.rows[0].count);
  console.log(`Current records: ${count}`);
  
  if (count < 10000) {
    console.log('Seeding records for testing... this might take a moment');
    const records = [];
    const interactions = ['accept_all', 'reject_all', 'customized', 'customized'];
    
    // We'll insert in batches to avoid memory issues
    for (let batch = 0; batch < 10; batch++) {
      const batchRecords = [];
      for (let i = 0; i < 5000; i++) {
        const interaction = interactions[Math.floor(Math.random() * interactions.length)];
        let accepted = '["necessary"]';
        let rejected = '[]';
        if (interaction === 'accept_all') {
            accepted = '["necessary", "analytics", "marketing", "functional"]';
        } else if (interaction === 'reject_all') {
            rejected = '["analytics", "marketing", "functional"]';
        } else if (interaction === 'customized') {
            if (Math.random() > 0.5) {
                accepted = '["necessary", "analytics"]';
                rejected = '["marketing", "functional"]';
            } else {
                accepted = '["necessary"]';
                rejected = '["analytics", "marketing", "functional"]';
            }
        }
        
        batchRecords.push({
          domainId: domainId,
          consentId: 'test-' + Math.random(),
          interactionType: interaction,
          categoriesAccepted: JSON.parse(accepted),
          categoriesRejected: JSON.parse(rejected),
          givenAt: new Date(),
        });
      }
      await db.insert(consentRecords).values(batchRecords);
      process.stdout.write('.');
    }
    console.log('\nSeeding complete.');
  }

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 1);

  console.log('\nRunning EXPLAIN ANALYZE on queries...');
  
  // 1. Opt-in Rate Query
  const q1 = sql`
    EXPLAIN ANALYZE SELECT 
      date_trunc('day', ${consentRecords.givenAt}) as date,
      COUNT(*) as total_sessions,
      SUM(CASE WHEN ${consentRecords.categoriesAccepted} ? 'analytics' THEN 1 ELSE 0 END) as analytics_accepted
    FROM ${consentRecords}
    WHERE ${consentRecords.domainId} = ${domainId}
      AND ${consentRecords.givenAt} >= ${startDate.toISOString()}
      AND ${consentRecords.givenAt} <= ${endDate.toISOString()}
    GROUP BY 1
  `;
  const r1 = await db.execute(q1);
  console.log('Opt-In Rate Query:');
  console.log(r1.rows.map(r => r['QUERY PLAN']).join('\n'));
  
  process.exit(0);
}

main().catch(console.error);
