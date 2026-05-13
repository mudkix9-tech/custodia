import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
import { assessmentTemplates } from './schema.js';

const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://privaro:privaro_password@localhost:5432/privaro_db',
});

const db = drizzle(pool);

const questions = [
  // Data Mapping
  {
    category: 'Data Mapping',
    questionText: 'Do you know exactly what personal data your agency collects and stores?',
    options: [
      { text: 'Yes, fully documented', riskWeight: 0 },
      { text: 'Partially', riskWeight: 5 },
      { text: 'No', riskWeight: 10 },
    ],
    dependsOn: null,
  },
  {
    category: 'Data Mapping',
    questionText: 'Have you documented all the places where personal data lives (CRM, email tools, spreadsheets, cloud storage)?',
    options: [
      { text: 'Yes, fully documented', riskWeight: 0 },
      { text: 'Partially', riskWeight: 5 },
      { text: 'No', riskWeight: 10 },
    ],
    dependsOn: null,
  },
  {
    category: 'Data Mapping',
    questionText: 'Do you know which of your data falls under GDPR "special categories" (health, religion, biometrics)?',
    options: [
      { text: 'Yes, fully documented', riskWeight: 0 },
      { text: 'Not sure', riskWeight: 10 },
      { text: 'We don\'t process special categories', riskWeight: 0 },
    ],
    dependsOn: null,
  },
  {
    category: 'Data Mapping',
    questionText: 'Can you identify every third party you share personal data with?',
    options: [
      { text: 'Yes', riskWeight: 0 },
      { text: 'Most of them', riskWeight: 5 },
      { text: 'No', riskWeight: 10 },
    ],
    dependsOn: null,
  },
  {
    category: 'Data Mapping',
    questionText: 'Do you have a documented data retention policy?',
    options: [
      { text: 'Yes, and it is enforced', riskWeight: 0 },
      { text: 'Yes, but not enforced', riskWeight: 5 },
      { text: 'No', riskWeight: 10 },
    ],
    dependsOn: null,
  },
  
  // Lawful Basis
  {
    category: 'Lawful Basis',
    questionText: 'Have you identified a lawful basis (consent, contract, legitimate interest, etc.) for each type of data you process?',
    options: [
      { text: 'Yes', riskWeight: 0 },
      { text: 'Partially', riskWeight: 5 },
      { text: 'No', riskWeight: 10 },
    ],
    dependsOn: null,
  },
  {
    category: 'Lawful Basis',
    questionText: 'If you rely on consent, can people withdraw it as easily as they gave it?',
    options: [
      { text: 'Yes', riskWeight: 0 },
      { text: 'No, it requires email or support', riskWeight: 8 },
      { text: 'We don\'t rely on consent', riskWeight: 0 },
    ],
    dependsOn: null,
  },
  {
    category: 'Lawful Basis',
    questionText: 'If you rely on legitimate interest, have you documented a balancing test (LIA)?',
    options: [
      { text: 'Yes', riskWeight: 0 },
      { text: 'No', riskWeight: 10 },
      { text: 'We don\'t rely on legitimate interest', riskWeight: 0 },
    ],
    dependsOn: null,
  },
  {
    category: 'Lawful Basis',
    questionText: 'Do your consent mechanisms meet GDPR standards (explicit, specific, freely given)?',
    options: [
      { text: 'Yes, opt-in only', riskWeight: 0 },
      { text: 'No, we use pre-ticked boxes/implied consent', riskWeight: 10 },
      { text: 'Not sure', riskWeight: 10 },
    ],
    dependsOn: null,
  },

  // Vendor Management
  {
    category: 'Vendor Management',
    questionText: 'Do you have a signed Data Processing Agreement with every SaaS tool that handles personal data?',
    options: [
      { text: 'Yes', riskWeight: 0 },
      { text: 'Some of them', riskWeight: 5 },
      { text: 'No', riskWeight: 10 },
    ],
    dependsOn: null,
  },
  {
    category: 'Vendor Management',
    questionText: 'Do you know which of your tools transfer data outside the EU?',
    options: [
      { text: 'Yes, and we have SCCs in place', riskWeight: 0 },
      { text: 'Yes, but no safeguards', riskWeight: 10 },
      { text: 'No', riskWeight: 10 },
    ],
    dependsOn: null,
  },
  {
    category: 'Vendor Management',
    questionText: 'Have you assessed the privacy risks of your US-based tools (Google, Meta, HubSpot, etc.)?',
    options: [
      { text: 'Yes, via TIA (Transfer Impact Assessment)', riskWeight: 0 },
      { text: 'No', riskWeight: 8 },
      { text: 'We don\'t use US-based tools', riskWeight: 0 },
    ],
    dependsOn: null,
  },
  {
    category: 'Vendor Management',
    questionText: 'Do you monitor when your vendors change their sub-processors?',
    options: [
      { text: 'Yes', riskWeight: 0 },
      { text: 'No', riskWeight: 5 },
    ],
    dependsOn: null,
  },
  {
    category: 'Vendor Management',
    questionText: 'Have you reviewed your vendors\' security certifications (e.g. SOC 2, ISO 27001)?',
    options: [
      { text: 'Yes', riskWeight: 0 },
      { text: 'No', riskWeight: 5 },
    ],
    dependsOn: null,
  },

  // Data Subject Rights
  {
    category: 'Data Subject Rights',
    questionText: 'If someone emails asking "what data do you have on me?", do you have a process to respond within 30 days?',
    options: [
      { text: 'Yes, documented process', riskWeight: 0 },
      { text: 'Ad-hoc process', riskWeight: 5 },
      { text: 'No', riskWeight: 10 },
    ],
    dependsOn: null,
  },
  {
    category: 'Data Subject Rights',
    questionText: 'Can you locate and delete all of a person\'s data across all your systems if they request erasure?',
    options: [
      { text: 'Yes, across all systems', riskWeight: 0 },
      { text: 'Only in our main database, not in third-party tools', riskWeight: 8 },
      { text: 'No', riskWeight: 10 },
    ],
    dependsOn: null,
  },
  {
    category: 'Data Subject Rights',
    questionText: 'Do you have a process for data portability requests?',
    options: [
      { text: 'Yes, we can export CSV/JSON', riskWeight: 0 },
      { text: 'No', riskWeight: 5 },
    ],
    dependsOn: null,
  },
  {
    category: 'Data Subject Rights',
    questionText: 'Is there a clear, accessible way for people to submit rights requests?',
    options: [
      { text: 'Yes, dedicated web form or email', riskWeight: 0 },
      { text: 'No', riskWeight: 5 },
    ],
    dependsOn: null,
  },

  // Security
  {
    category: 'Security',
    questionText: 'Is personal data encrypted at rest and in transit across your systems?',
    options: [
      { text: 'Yes', riskWeight: 0 },
      { text: 'In transit only', riskWeight: 5 },
      { text: 'No', riskWeight: 10 },
    ],
    dependsOn: null,
  },
  {
    category: 'Security',
    questionText: 'Do you have access controls limiting who on your team can see personal data?',
    options: [
      { text: 'Yes, role-based access', riskWeight: 0 },
      { text: 'Everyone has access', riskWeight: 10 },
    ],
    dependsOn: null,
  },
  {
    category: 'Security',
    questionText: 'Do you have a documented process for handling a data breach within 72 hours?',
    options: [
      { text: 'Yes, tested incident response plan', riskWeight: 0 },
      { text: 'Yes, but untested', riskWeight: 3 },
      { text: 'No', riskWeight: 10 },
    ],
    dependsOn: null,
  },
  {
    category: 'Security',
    questionText: 'Has your team received GDPR awareness training in the last 12 months?',
    options: [
      { text: 'Yes', riskWeight: 0 },
      { text: 'No', riskWeight: 5 },
    ],
    dependsOn: null,
  },

  // Privacy Notices
  {
    category: 'Privacy Notices',
    questionText: 'Does your website have a privacy policy that was updated in the last 12 months?',
    options: [
      { text: 'Yes', riskWeight: 0 },
      { text: 'No, it\'s older', riskWeight: 5 },
      { text: 'No privacy policy at all', riskWeight: 10 },
    ],
    dependsOn: null,
  },
  {
    category: 'Privacy Notices',
    questionText: 'Does your privacy policy explain all the data you collect, why, and who you share it with?',
    options: [
      { text: 'Yes, highly detailed', riskWeight: 0 },
      { text: 'Generic template, might be missing specifics', riskWeight: 8 },
      { text: 'No', riskWeight: 10 },
    ],
    dependsOn: null,
  },
  {
    category: 'Privacy Notices',
    questionText: 'Do you have separate privacy notices for employees, clients, and website visitors?',
    options: [
      { text: 'Yes', riskWeight: 0 },
      { text: 'No, one policy for everything', riskWeight: 5 },
    ],
    dependsOn: null,
  },

  // Cookie Consent
  {
    category: 'Cookie Consent',
    questionText: 'Does your website have a cookie consent banner?',
    options: [
      { text: 'Yes', riskWeight: 0 },
      { text: 'No', riskWeight: 10 },
    ],
    dependsOn: null,
  },
  {
    category: 'Cookie Consent',
    questionText: 'Can visitors reject all non-essential cookies as easily as accepting them?',
    options: [
      { text: 'Yes', riskWeight: 0 },
      { text: 'No, reject is hidden or requires multiple clicks', riskWeight: 8 },
    ],
    dependsOn: null,
  },
  {
    category: 'Cookie Consent',
    questionText: 'Do you have a record of cookie consents given by visitors?',
    options: [
      { text: 'Yes, stored securely', riskWeight: 0 },
      { text: 'No', riskWeight: 8 },
    ],
    dependsOn: null,
  },

  // Client Compliance (Agency-Specific)
  {
    category: 'Client Compliance',
    questionText: 'When you act as a data processor for your clients, do you have DPAs in place with each client?',
    options: [
      { text: 'Yes, all clients', riskWeight: 0 },
      { text: 'Some clients', riskWeight: 5 },
      { text: 'No', riskWeight: 10 },
    ],
    dependsOn: null,
  },
  {
    category: 'Client Compliance',
    questionText: 'Can you demonstrate your GDPR compliance to clients who ask?',
    options: [
      { text: 'Yes, with a dashboard or compiled report', riskWeight: 0 },
      { text: 'Yes, but it takes hours to compile manually', riskWeight: 5 },
      { text: 'No', riskWeight: 10 },
    ],
    dependsOn: null,
  },
];

async function seed() {
  console.log('Clearing existing assessment templates...');
  await db.delete(assessmentTemplates);

  console.log('Seeding 30 GDPR Gap Assessment Questions...');
  for (const q of questions) {
    await db.insert(assessmentTemplates).values({
      questionText: q.questionText,
      category: q.category,
      options: q.options,
      dependsOn: q.dependsOn,
    });
  }

  console.log('Seeding complete!');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
