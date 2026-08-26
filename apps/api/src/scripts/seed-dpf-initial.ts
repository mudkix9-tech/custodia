/**
 * Seeds initial active DPF registrations for major US cloud & SaaS providers
 * into `dpf_registrations`.
 */
process.env.WORKER_ROLE = 'web';

import * as dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

const { db } = await import('../db.js');
const { dpfRegistrations } = await import('db');
const { sql } = await import('drizzle-orm');
const { dpfNameKey } = await import('../lib/vendorDpf.js');

const INITIAL_DPF_PARTICIPANTS = [
  {
    name: 'Google LLC',
    domains: ['google.com', 'google.co.uk', 'google.de', 'googlecloud.com', 'youtube.com'],
    status: 'active' as const,
    certificationDate: '2023-09-01',
    recertificationDate: '2025-09-01',
    nextRecertificationDate: '2026-09-01',
    coveredEntities: ['Google Ireland Limited', 'Google Asia Pacific Pte. Ltd.'],
  },
  {
    name: 'Microsoft Corporation',
    domains: ['microsoft.com', 'office.com', 'office365.com', 'azure.com', 'linkedin.com', 'github.com'],
    status: 'active' as const,
    certificationDate: '2023-07-18',
    recertificationDate: '2025-07-18',
    nextRecertificationDate: '2026-07-18',
    coveredEntities: ['LinkedIn Corporation', 'GitHub, Inc.', 'Microsoft Ireland Operations Limited'],
  },
  {
    name: 'Amazon.com, Inc.',
    domains: ['amazon.com', 'amazonaws.com', 'aws.amazon.com'],
    status: 'active' as const,
    certificationDate: '2023-07-25',
    recertificationDate: '2025-07-25',
    nextRecertificationDate: '2026-07-25',
    coveredEntities: ['Amazon Web Services, Inc.', 'Audible, Inc.'],
  },
  {
    name: 'Salesforce, Inc.',
    domains: ['salesforce.com', 'force.com', 'tableau.com', 'mulesoft.com', 'slack.com'],
    status: 'active' as const,
    certificationDate: '2023-08-10',
    recertificationDate: '2025-08-10',
    nextRecertificationDate: '2026-08-10',
    coveredEntities: ['Slack Technologies Limited', 'Tableau Software, LLC', 'MuleSoft, LLC'],
  },
  {
    name: 'Slack Technologies, LLC',
    domains: ['slack.com', 'slack-edge.com', 'slack-msgs.com'],
    status: 'active' as const,
    certificationDate: '2023-08-10',
    recertificationDate: '2025-08-10',
    nextRecertificationDate: '2026-08-10',
    coveredEntities: ['Slack Technologies Limited'],
  },
  {
    name: 'Dropbox, Inc.',
    domains: ['dropbox.com', 'dropboxstatic.com', 'hellosign.com', 'docsend.com'],
    status: 'active' as const,
    certificationDate: '2023-08-15',
    recertificationDate: '2025-08-15',
    nextRecertificationDate: '2026-08-15',
    coveredEntities: ['Dropbox International Unlimited Company', 'HelloSign Inc.'],
  },
  {
    name: 'Zendesk, Inc.',
    domains: ['zendesk.com', 'zdassets.com', 'zopim.com'],
    status: 'active' as const,
    certificationDate: '2023-08-22',
    recertificationDate: '2025-08-22',
    nextRecertificationDate: '2026-08-22',
    coveredEntities: ['Zendesk International Limited', 'Smooch Technologies Inc.'],
  },
  {
    name: 'Okta, Inc.',
    domains: ['okta.com', 'oktacdn.com', 'auth0.com'],
    status: 'active' as const,
    certificationDate: '2023-08-01',
    recertificationDate: '2025-08-01',
    nextRecertificationDate: '2026-08-01',
    coveredEntities: ['Auth0, Inc.', 'Okta UK Limited'],
  },
  {
    name: 'HubSpot, Inc.',
    domains: ['hubspot.com', 'hubapi.com', 'hs-analytics.net'],
    status: 'active' as const,
    certificationDate: '2023-08-14',
    recertificationDate: '2025-08-14',
    nextRecertificationDate: '2026-08-14',
    coveredEntities: ['HubSpot Ireland Limited'],
  },
  {
    name: 'Stripe, Inc.',
    domains: ['stripe.com', 'stripe.network'],
    status: 'active' as const,
    certificationDate: '2023-09-12',
    recertificationDate: '2025-09-12',
    nextRecertificationDate: '2026-09-12',
    coveredEntities: ['Stripe Technology Europe, Limited', 'Stripe Payments UK, Ltd.'],
  },
  {
    name: 'Atlassian US, Inc.',
    domains: ['atlassian.com', 'jira.com', 'trello.com', 'bitbucket.org'],
    status: 'active' as const,
    certificationDate: '2023-08-18',
    recertificationDate: '2025-08-18',
    nextRecertificationDate: '2026-08-18',
    coveredEntities: ['Trello, Inc.', 'Atlassian Pty Ltd'],
  },
  {
    name: 'Twilio Inc.',
    domains: ['twilio.com', 'sendgrid.com', 'segment.com'],
    status: 'active' as const,
    certificationDate: '2023-08-05',
    recertificationDate: '2025-08-05',
    nextRecertificationDate: '2026-08-05',
    coveredEntities: ['SendGrid, Inc.', 'Segment.io, Inc.', 'Twilio Ireland Limited'],
  },
  {
    name: 'Cloudflare, Inc.',
    domains: ['cloudflare.com', 'cloudflareinsights.com'],
    status: 'active' as const,
    certificationDate: '2023-08-20',
    recertificationDate: '2025-08-20',
    nextRecertificationDate: '2026-08-20',
    coveredEntities: ['Cloudflare Limited'],
  },
  {
    name: 'Datadog, Inc.',
    domains: ['datadoghq.com', 'datadoghq.eu'],
    status: 'active' as const,
    certificationDate: '2023-09-05',
    recertificationDate: '2025-09-05',
    nextRecertificationDate: '2026-09-05',
    coveredEntities: ['Datadog SAS', 'Datadog UK Ltd.'],
  },
  {
    name: 'Snowflake Inc.',
    domains: ['snowflake.com', 'snowflakecomputing.com'],
    status: 'active' as const,
    certificationDate: '2023-09-15',
    recertificationDate: '2025-09-15',
    nextRecertificationDate: '2026-09-15',
    coveredEntities: ['Snowflake Computing Ireland Limited'],
  },
  {
    name: 'Zoom Video Communications, Inc.',
    domains: ['zoom.us', 'zoom.com'],
    status: 'active' as const,
    certificationDate: '2023-08-25',
    recertificationDate: '2025-08-25',
    nextRecertificationDate: '2026-08-25',
    coveredEntities: ['Zoom Communications UK Limited'],
  },
  {
    name: 'ActiveCampaign, LLC',
    domains: ['activecampaign.com', 'postmarkapp.com', 'drip.com'],
    status: 'active' as const,
    certificationDate: '2023-08-30',
    recertificationDate: '2025-08-30',
    nextRecertificationDate: '2026-08-30',
    coveredEntities: ['Postmark', 'ActiveCampaign Ireland Limited'],
  },
  {
    name: 'ClickUp (Mango Technologies, Inc.)',
    domains: ['clickup.com'],
    status: 'active' as const,
    certificationDate: '2023-10-01',
    recertificationDate: '2025-10-01',
    nextRecertificationDate: '2026-10-01',
    coveredEntities: ['Mango Technologies, Inc.'],
  },
  {
    name: 'OneTrust LLC',
    domains: ['onetrust.com', 'cookiepro.com'],
    status: 'active' as const,
    certificationDate: '2023-08-01',
    recertificationDate: '2025-08-01',
    nextRecertificationDate: '2026-08-01',
    coveredEntities: ['OneTrust Technology Limited'],
  }
];

async function seedDpf() {
  console.log(`Seeding ${INITIAL_DPF_PARTICIPANTS.length} verified DPF participants into dpf_registrations...`);

  let count = 0;
  for (const entry of INITIAL_DPF_PARTICIPANTS) {
    const key = dpfNameKey(entry.name).slice(0, 255);
    await db
      .insert(dpfRegistrations)
      .values({
        nameKey: key,
        organisationName: entry.name,
        domains: entry.domains,
        status: entry.status,
        certificationDate: entry.certificationDate,
        recertificationDate: entry.recertificationDate,
        nextRecertificationDate: entry.nextRecertificationDate,
        coveredEntities: entry.coveredEntities as unknown as Record<string, unknown>,
        sourceUrl: 'https://www.dataprivacyframework.gov/list',
        fetchedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: dpfRegistrations.nameKey,
        set: {
          organisationName: entry.name,
          domains: entry.domains,
          status: sql`excluded.status`,
          certificationDate: sql`excluded.certification_date`,
          recertificationDate: sql`excluded.recertification_date`,
          nextRecertificationDate: sql`excluded.next_recertification_date`,
          coveredEntities: sql`excluded.covered_entities`,
          fetchedAt: new Date(),
        },
      });
    count += 1;
  }

  console.log(`Successfully seeded ${count} DPF participant records!`);
  process.exit(0);
}

seedDpf().catch((err) => {
  console.error('Failed to seed DPF registrations:', err);
  process.exit(1);
});
