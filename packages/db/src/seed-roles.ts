import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool); // Assuming you have an export in index.js for db or can run it through index
import { customRoles, organizations } from './schema.js';
import { eq } from 'drizzle-orm';

const enterpriseRoles = [
  {
    name: 'DPO',
    description: 'Data Protection Officer - View everything, edit ROPA/vendors/policies.',
    isDefault: true,
    permissions: {
      ropa: { view: true, edit: true, delete: false, export: true },
      vendors: { view: true, edit: true, delete: false },
      dsar: { view: true, manage: false, respond: false },
      breaches: { view: true, report: false, manage: false, notify: false },
      policies: { view: true, edit: true, publish: true },
      consent: { view: true, configure: false },
      training: { view: true, manage: false },
      audit: { view: true, export: true },
      clients: { view: true, manage: false },
      settings: { view: true, manage: false },
      billing: { view: false, manage: false },
      developers: { view: true, manage: false },
      team: { view: true, invite: false, manage: false },
      '*': { view: true } // view everything fallback if specific not set
    }
  },
  {
    name: 'Department Head',
    description: 'View and edit ROPA/vendors scoped to their department (no access to billing/settings).',
    isDefault: true,
    permissions: {
      ropa: { view: true, edit: true, delete: false, export: false },
      vendors: { view: true, edit: true, delete: false },
      dsar: { view: false, manage: false, respond: false },
      breaches: { view: false, report: false, manage: false, notify: false },
      policies: { view: false, edit: false, publish: false },
      consent: { view: false, configure: false },
      training: { view: false, manage: false },
      audit: { view: false, export: false },
      clients: { view: false, manage: false },
      settings: { view: false, manage: false },
      billing: { view: false, manage: false },
      developers: { view: false, manage: false },
      team: { view: true, invite: false, manage: false },
    }
  },
  {
    name: 'External Auditor',
    description: 'View-only across all modules, can export audit files.',
    isDefault: true,
    permissions: {
      ropa: { view: true, edit: false, delete: false, export: true },
      vendors: { view: true, edit: false, delete: false },
      dsar: { view: true, manage: false, respond: false },
      breaches: { view: true, report: false, manage: false, notify: false },
      policies: { view: true, edit: false, publish: false },
      consent: { view: true, configure: false },
      training: { view: true, manage: false },
      audit: { view: true, export: true },
      clients: { view: true, manage: false },
      settings: { view: true, manage: false },
      billing: { view: false, manage: false },
      developers: { view: true, manage: false },
      team: { view: true, invite: false, manage: false },
    }
  },
  {
    name: 'Compliance Officer',
    description: 'Full access except billing and team management.',
    isDefault: true,
    permissions: {
      ropa: { view: true, edit: true, delete: true, export: true },
      vendors: { view: true, edit: true, delete: true },
      dsar: { view: true, manage: true, respond: true },
      breaches: { view: true, report: true, manage: true, notify: true },
      policies: { view: true, edit: true, publish: true },
      consent: { view: true, configure: true },
      training: { view: true, manage: true },
      audit: { view: true, export: true },
      clients: { view: true, manage: true },
      settings: { view: true, manage: false },
      billing: { view: false, manage: false },
      developers: { view: true, manage: true },
      team: { view: true, invite: false, manage: false },
    }
  }
];

async function seedEnterpriseRoles() {
  console.log('Seeding enterprise custom roles...');

  // Since custom roles belong to an organization, we could seed them into a "template" organization
  // or a system org, or loop through all organizations and add them.
  // We'll fetch all organizations and insert these roles for any org that doesn't have them yet.

  const allOrgs = await db.select().from(organizations);
  console.log(`Found ${allOrgs.length} organizations to check/seed roles for.`);

  let insertedCount = 0;

  for (const org of allOrgs) {
    const existingRoles = await db.select().from(customRoles).where(eq(customRoles.organizationId, org.id));
    const existingRoleNames = existingRoles.map(r => r.name);

    for (const roleTemplate of enterpriseRoles) {
      if (!existingRoleNames.includes(roleTemplate.name)) {
        await db.insert(customRoles).values({
          organizationId: org.id,
          name: roleTemplate.name,
          description: roleTemplate.description,
          permissions: roleTemplate.permissions,
          isDefault: true
        } as any);
        insertedCount++;
      }
    }
  }

  console.log(`Successfully inserted ${insertedCount} new enterprise custom roles.`);
  process.exit(0);
}

seedEnterpriseRoles().catch(console.error);
