import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import postgres from 'postgres';
import * as schema from './schema';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../../apps/api/.env') });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is not set');

const sql = postgres(connectionString);
const db = drizzle(sql, { schema });

const VENDORS = [
  {
    name: 'HubSpot',
    website: 'https://hubspot.com',
    category: 'CRM & Marketing',
    headquartersCountry: 'US',
    dataProcessingLocations: ['US', 'EU'],
    dpaAvailable: true,
    dpaUrl: 'https://legal.hubspot.com/dpa',
    privacyPolicyUrl: 'https://legal.hubspot.com/privacy-policy',
    euHostingAvailable: true,
    euHostingDetail: 'Available on EU Data Center (Frankfurt)',
    securityCertifications: ['soc2_type2', 'iso27001'],
    subProcessorListUrl: 'https://legal.hubspot.com/hubspot-sub-processors',
    transferMechanisms: ['standard_contractual_clauses']
  },
  {
    name: 'Stripe',
    website: 'https://stripe.com',
    category: 'Payments',
    headquartersCountry: 'US',
    dataProcessingLocations: ['US', 'IE'],
    dpaAvailable: true,
    dpaUrl: 'https://stripe.com/legal/dpa',
    privacyPolicyUrl: 'https://stripe.com/privacy',
    euHostingAvailable: false,
    securityCertifications: ['soc1', 'soc2_type2', 'pci_dss'],
    subProcessorListUrl: 'https://stripe.com/legal/sub-processors',
    transferMechanisms: ['standard_contractual_clauses']
  },
  {
    name: 'Amazon Web Services (AWS)',
    website: 'https://aws.amazon.com',
    category: 'Cloud Infrastructure',
    headquartersCountry: 'US',
    dataProcessingLocations: ['Global'],
    dpaAvailable: true,
    dpaUrl: 'https://d1.awsstatic.com/legal/aws-gdpr/AWS_GDPR_DPA.pdf',
    privacyPolicyUrl: 'https://aws.amazon.com/privacy/',
    euHostingAvailable: true,
    euHostingDetail: 'Multiple EU regions available (e.g., eu-west-1)',
    securityCertifications: ['soc1', 'soc2_type2', 'soc3', 'iso27001', 'iso27017', 'iso27018'],
    subProcessorListUrl: 'https://aws.amazon.com/compliance/sub-processors/',
    transferMechanisms: ['standard_contractual_clauses']
  },
  {
    name: 'Google Workspace',
    website: 'https://workspace.google.com',
    category: 'Productivity',
    headquartersCountry: 'US',
    dataProcessingLocations: ['Global'],
    dpaAvailable: true,
    dpaUrl: 'https://workspace.google.com/terms/dpa_terms.html',
    privacyPolicyUrl: 'https://policies.google.com/privacy',
    euHostingAvailable: true,
    euHostingDetail: 'Data regions can be set to Europe',
    securityCertifications: ['soc2_type2', 'soc3', 'iso27001'],
    subProcessorListUrl: 'https://workspace.google.com/terms/subprocessors.html',
    transferMechanisms: ['standard_contractual_clauses']
  },
  {
    name: 'Mailchimp',
    website: 'https://mailchimp.com',
    category: 'Email Marketing',
    headquartersCountry: 'US',
    dataProcessingLocations: ['US'],
    dpaAvailable: true,
    dpaUrl: 'https://mailchimp.com/legal/data-processing-addendum/',
    privacyPolicyUrl: 'https://mailchimp.com/legal/privacy/',
    euHostingAvailable: false,
    euHostingDetail: 'Data hosted in US servers',
    securityCertifications: ['soc2_type2'],
    subProcessorListUrl: 'https://mailchimp.com/legal/subprocessors/',
    transferMechanisms: ['standard_contractual_clauses']
  },
  {
    name: 'Slack',
    website: 'https://slack.com',
    category: 'Communication',
    headquartersCountry: 'US',
    dataProcessingLocations: ['US', 'DE', 'FR'],
    dpaAvailable: true,
    dpaUrl: 'https://slack.com/terms-of-service/data-processing',
    privacyPolicyUrl: 'https://slack.com/trust/privacy/privacy-policy',
    euHostingAvailable: true,
    euHostingDetail: 'Slack Enterprise Grid offers EU data residency',
    securityCertifications: ['soc2_type2', 'soc3', 'iso27001'],
    subProcessorListUrl: 'https://slack.com/trust/compliance/subprocessors',
    transferMechanisms: ['standard_contractual_clauses']
  },
  // Add more vendors to reach ~50
  {
    name: 'Notion',
    website: 'https://notion.so',
    category: 'Productivity',
    headquartersCountry: 'US',
    dataProcessingLocations: ['US'],
    dpaAvailable: true,
    dpaUrl: 'https://www.notion.so/Data-Processing-Addendum-df50901e18824df4bb0cd767a909f18a',
    privacyPolicyUrl: 'https://www.notion.so/Privacy-Policy-3468d120cf614d4c9014c09d6adc9091',
    euHostingAvailable: false,
    securityCertifications: ['soc2_type2'],
    subProcessorListUrl: 'https://www.notion.so/Subprocessors-24edaf4ce7234ecda4fecddb3815b3c5',
    transferMechanisms: ['standard_contractual_clauses']
  },
  {
    name: 'Meta (Facebook)',
    website: 'https://facebook.com/business',
    category: 'Advertising',
    headquartersCountry: 'US',
    dataProcessingLocations: ['US', 'IE'],
    dpaAvailable: true,
    dpaUrl: 'https://www.facebook.com/legal/terms/dataprocessing',
    privacyPolicyUrl: 'https://www.facebook.com/policy.php',
    euHostingAvailable: false,
    securityCertifications: ['iso27001'],
    subProcessorListUrl: 'https://www.facebook.com/legal/terms/subprocessorlist',
    transferMechanisms: ['standard_contractual_clauses']
  },
  {
    name: 'Postmark',
    website: 'https://postmarkapp.com',
    category: 'Transactional Email',
    headquartersCountry: 'US',
    dataProcessingLocations: ['US'],
    dpaAvailable: true,
    dpaUrl: 'https://postmarkapp.com/eu-privacy/dpa',
    privacyPolicyUrl: 'https://postmarkapp.com/privacy',
    euHostingAvailable: false,
    securityCertifications: ['soc2_type2'],
    subProcessorListUrl: 'https://postmarkapp.com/subprocessors',
    transferMechanisms: ['standard_contractual_clauses']
  },
  {
    name: 'GitHub',
    website: 'https://github.com',
    category: 'Development',
    headquartersCountry: 'US',
    dataProcessingLocations: ['US'],
    dpaAvailable: true,
    dpaUrl: 'https://docs.github.com/en/site-policy/privacy-policies/github-data-protection-agreement',
    privacyPolicyUrl: 'https://docs.github.com/en/site-policy/privacy-policies/github-privacy-statement',
    euHostingAvailable: false,
    securityCertifications: ['soc1', 'soc2_type2', 'iso27001'],
    subProcessorListUrl: 'https://docs.github.com/en/site-policy/privacy-policies/github-subprocessors',
    transferMechanisms: ['standard_contractual_clauses']
  }
];

async function seedVendors() {
  console.log('🌱 Seeding Global Vendors...');
  
  for (const v of VENDORS) {
    // Check if exists
    const [existing] = await db.select().from(schema.vendors).where(eq(schema.vendors.name, v.name));
    
    if (!existing) {
      await db.insert(schema.vendors).values({
        ...v,
        isGlobal: true,
      });
      console.log(`✅ Inserted ${v.name}`);
    } else {
      console.log(`⏭️ Skipped ${v.name} (already exists)`);
    }
  }

  console.log('✅ Global Vendors Seeded successfully!');
  process.exit(0);
}

seedVendors().catch((err) => {
  console.error('Error seeding vendors:', err);
  process.exit(1);
});
