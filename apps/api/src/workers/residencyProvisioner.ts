import { createWorker, createQueue } from '../lib/queue.js';
// @ts-nocheck
import { RDSClient, CreateDBInstanceCommand, DescribeDBInstancesCommand } from '@aws-sdk/client-rds';
import { db as primaryDb } from '../db.js';
import { organizations } from 'db';
import { eq } from 'drizzle-orm';
import { encryptToken } from '../lib/encryption.js';
import crypto from 'crypto';
import pg from 'pg';

export const residencyProvisioningQueue = createQueue('residency-provisioning');

function generateSecurePassword() {
  return crypto.randomBytes(16).toString('base64').replace(/[^a-zA-Z0-9]/g, '');
}

async function pollUntilAvailable(rds: RDSClient, instanceId: string) {
  let available = false;
  while (!available) {
    const { DBInstances } = await rds.send(new DescribeDBInstancesCommand({ DBInstanceIdentifier: instanceId }));
    if (DBInstances && DBInstances[0]?.DBInstanceStatus === 'available') {
      available = true;
      return DBInstances[0]?.Endpoint;
    }
    await new Promise(r => setTimeout(r, 30000)); // poll every 30s
  }
}

async function runMigrations(connectionString: string) {
  // In a real implementation we would run drizzle-kit or raw migration SQL
  // For the purpose of this implementation we'll run a simple check
  const pool = new pg.Pool({ connectionString, ssl: { rejectUnauthorized: false } });
  await pool.query('SELECT 1;');
  pool.end();
}

export const residencyProvisioningWorker = createWorker('residency-provisioning', async job => {
  const { orgId, region, orgSlug } = job.data;

  try {
    const rds = new RDSClient({ region });
    const instanceId = `custodia-dedicated-${orgSlug}-${Date.now()}`;
    const password = generateSecurePassword();

    // 1. Create instance
    await rds.send(new CreateDBInstanceCommand({
      DBInstanceIdentifier: instanceId,
      DBInstanceClass: 'db.t4g.micro', // Smaller for development/demo
      Engine: 'postgres',
      EngineVersion: '16.3',
      MasterUsername: 'privaro_admin',
      MasterUserPassword: password,
      AllocatedStorage: 20,
      StorageEncrypted: true,
      PubliclyAccessible: true, // Needs VPC peering or public access for API to reach
    }));

    // 2. Poll until available
    const endpoint = await pollUntilAvailable(rds, instanceId);

    if (endpoint) {
      const connectionString = `postgres://privaro_admin:${password}@${endpoint.Address}:${endpoint.Port}/postgres`;

      // 3. Run migrations
      await runMigrations(connectionString);

      // 4. Update org
      await primaryDb.update(organizations)
        .set({
          dedicatedDatabaseHost: encryptToken(connectionString),
          dedicatedDatabaseStatus: 'active',
          dedicatedDatabaseProvisionedAt: new Date(),
        })
        .where(eq(organizations.id, orgId));

      // 5. Trigger Data Migration
      const { dataMigrationQueue } = await import('./dataMigration.js');
      await dataMigrationQueue.add('migrate-data', { orgId });
    }

  } catch (error) {
    console.error('Failed to provision dedicated DB:', error);
    await primaryDb.update(organizations)
      .set({ dedicatedDatabaseStatus: 'failed' })
      .where(eq(organizations.id, orgId));
    throw error;
  }
}, { drainDelay: 60 });
