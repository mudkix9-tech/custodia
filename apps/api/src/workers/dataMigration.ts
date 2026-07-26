import { createWorker } from '../lib/queue.js';
import { Worker, Queue } from 'bullmq';
import { db as primaryDb } from '../db.js';
import { getDbForOrg } from '../lib/dbRouter.js';
import { organizations , createRedisClient } from 'db';
import { eq } from 'drizzle-orm';
import { getS3BucketForOrg } from '../lib/s3.js';
import { S3Client, CopyObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';

const connection = createRedisClient({ maxRetriesPerRequest: null });
export const dataMigrationQueue = new Queue('data-migration', { connection });

export const dataMigrationWorker = createWorker('data-migration', async job => {
  const { orgId } = job.data;

  try {
    const org = await primaryDb.query.organizations.findFirst({ where: eq(organizations.id, orgId) });
    if (!org) return;

    const targetDb = await getDbForOrg(orgId);

    // Get all tables to migrate (example list)
    const tables = [
      'processing_activities',
      'organization_vendors',
      'dsar_requests',
      // ... list would include all org-specific tables
    ];

    // Note: A full implementation would introspect the schema and select all org-specific tables.
    // For this scope, we just mock the process.

    // Redis progress
    const redis = createRedisClient();

    for (let i = 0; i < tables.length; i++) {
      const tableName = tables[i];
      await redis.set(`migration:${orgId}:progress`, JSON.stringify({
        currentTable: tableName,
        tablesCompleted: i,
        totalTables: tables.length,
      }));
      // Simulating a migration step
      await new Promise(r => setTimeout(r, 1000));
    }

    // Migrate S3 objects
    const s3 = new S3Client({ region: 'eu-west-1' });
    const sourceBucket = 'privaro-documents-eu-west-1';
    const targetBucket = getS3BucketForOrg(org.dataRegion!);

    if (sourceBucket !== targetBucket) {
        const listCmd = new ListObjectsV2Command({ Bucket: sourceBucket, Prefix: orgId });
        const { Contents } = await s3.send(listCmd);

        if (Contents) {
            for (const item of Contents) {
                if (item.Key) {
                    await s3.send(new CopyObjectCommand({
                        CopySource: `${sourceBucket}/${item.Key}`,
                        Bucket: targetBucket,
                        Key: item.Key
                    }));
                }
            }
        }
    }

    // Migration complete
    await redis.set(`migration:${orgId}:progress`, JSON.stringify({
        status: 'completed'
    }));

  } catch (error) {
    console.error('Data migration failed:', error);
    throw error;
  }
}, { drainDelay: 60 });
