const fs = require('fs');
let schema = fs.readFileSync('packages/db/src/schema.ts', 'utf8');

// Insert residency fields into organizations table
const residencyFields = `
  dataRegion: varchar('data_region', { length: 50 }).default('eu-west-1'),
  dedicatedDatabaseHost: varchar('dedicated_database_host', { length: 500 }),
  dedicatedDatabaseStatus: varchar('dedicated_database_status', { length: 50 }),
  dedicatedDatabaseProvisionedAt: timestamp('dedicated_database_provisioned_at', { withTimezone: true }),
`;

const targetStr = "parentOrganizationId: uuid('parent_organization_id').references((): any => organizations.id), // self-referencing, added in constraints or relations";

schema = schema.replace(targetStr, targetStr + "\n" + residencyFields);

fs.writeFileSync('packages/db/src/schema.ts', schema);
console.log('Schema updated with residency fields.');
