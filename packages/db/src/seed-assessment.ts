import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
import { assessmentTemplates, assessments, assessmentAnswers } from './schema.js';

const { Pool } = pkg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool);

const healthQId = '11111111-1111-4111-a111-111111111111';
const paymentQId = '22222222-2222-4222-a222-222222222222';

const questions = [
  // Data Mapping
  {
    category: 'Data Mapping',
    questionText: 'Do you know exactly what personal data your organization collects and stores?',
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
  {
    category: 'Lawful Basis',
    questionText: 'Does your privacy notice clearly specify the lawful basis you rely on for each processing purpose (e.g., consent, contract, legitimate interest)?',
    options: [
      { text: 'Yes', riskWeight: 0 },
      { text: 'Partially', riskWeight: 5 },
      { text: 'No', riskWeight: 10 },
    ],
    dependsOn: null,
  },

  // Vendor Management & Transfers
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
    questionText: 'Have you assessed the privacy risks of your vendors and tools based outside the EU/EEA?',
    options: [
      { text: 'Yes, via TIA (Transfer Impact Assessment)', riskWeight: 0 },
      { text: 'No', riskWeight: 8 },
      { text: 'We don\'t use vendors outside the EU/EEA', riskWeight: 0 },
    ],
    dependsOn: null,
  },
  {
    category: 'Vendor Management',
    questionText: 'Do you transfer personal data internationally through your own operations (e.g., remote workers, international branches accessing EU data)?',
    options: [
      { text: 'Yes, with appropriate safeguards like SCCs', riskWeight: 0 },
      { text: 'Yes, without safeguards', riskWeight: 10 },
      { text: 'No', riskWeight: 0 },
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
  {
    category: 'Data Subject Rights',
    questionText: 'Do you inform data subjects of their right to object to processing, particularly for direct marketing?',
    options: [
      { text: 'Yes', riskWeight: 0 },
      { text: 'No, but we do direct marketing', riskWeight: 10 },
      { text: 'We don\'t do direct marketing', riskWeight: 0 },
    ],
    dependsOn: null,
  },
  {
    category: 'Data Subject Rights',
    questionText: 'Do you use automated decision-making or profiling (e.g., AI lead scoring, algorithmic hiring)?',
    options: [
      { text: 'Yes, with human oversight and opt-outs', riskWeight: 0 },
      { text: 'Yes, fully automated without opt-outs', riskWeight: 10 },
      { text: 'No', riskWeight: 0 },
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
    questionText: 'Do you regularly test, assess, and evaluate the effectiveness of your security measures (e.g., penetration testing, vulnerability scans)?',
    options: [
      { text: 'Yes, regularly', riskWeight: 0 },
      { text: 'Rarely or ad-hoc', riskWeight: 5 },
      { text: 'No', riskWeight: 10 },
    ],
    dependsOn: null,
  },
  {
    category: 'Security',
    questionText: 'Do you have a documented process for notifying the supervisory authority within 72 hours for breaches that are likely to result in a risk to people\'s rights and freedoms?',
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
    questionText: 'Do you block non-essential cookies and tracking scripts from firing until the user gives explicit consent?',
    options: [
      { text: 'Yes, they are blocked until consent', riskWeight: 0 },
      { text: 'Not sure', riskWeight: 5 },
      { text: 'No, they fire immediately', riskWeight: 10 },
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

  // Governance (New Structural Gaps)
  {
    category: 'Governance',
    questionText: 'Have you appointed a Data Protection Officer (DPO) as required by Article 37?',
    options: [
      { text: 'Yes', riskWeight: 0 },
      { text: 'No, but we process large-scale sensitive data/monitor users', riskWeight: 10 },
      { text: 'No, we are not required to', riskWeight: 0 },
    ],
    dependsOn: null,
  },
  {
    category: 'Governance',
    questionText: 'Have you conducted Data Protection Impact Assessments (DPIAs) for your high-risk processing activities?',
    options: [
      { text: 'Yes', riskWeight: 0 },
      { text: 'No, but we do high-risk processing', riskWeight: 10 },
      { text: 'We don\'t have high-risk activities', riskWeight: 0 },
    ],
    dependsOn: null,
  },
  {
    category: 'Governance',
    questionText: 'Do you maintain a formal Record of Processing Activities (ROPA) mapping out what data you process, why, and where it goes?',
    options: [
      { text: 'Yes, fully up-to-date', riskWeight: 0 },
      { text: 'Partially or outdated', riskWeight: 5 },
      { text: 'No', riskWeight: 10 },
    ],
    dependsOn: null,
  },

  // Client Compliance
  {
    id: healthQId,
    category: 'Client Compliance',
    questionText: 'Do you process patient health records?',
    options: [
      { text: 'Yes', riskWeight: 0 },
      { text: 'No', riskWeight: 0 },
    ],
    dependsOn: null,
  },
  {
    category: 'Client Compliance',
    questionText: 'Have you identified a valid Article 9(2) basis (e.g., explicit consent, medical diagnosis) for processing this special category data?',
    options: [
      { text: 'Yes', riskWeight: 0 },
      { text: 'No', riskWeight: 10 },
    ],
    dependsOn: {
      conditions: [
        { questionId: healthQId, answerEquals: 'Yes' }
      ],
      logic: 'AND'
    },
  },
  {
    category: 'Client Compliance',
    questionText: 'Have you conducted a Data Protection Impact Assessment (DPIA) for this health data processing?',
    options: [
      { text: 'Yes', riskWeight: 0 },
      { text: 'No', riskWeight: 10 },
    ],
    dependsOn: {
      conditions: [
        { questionId: healthQId, answerEquals: 'Yes' }
      ],
      logic: 'AND'
    },
  },
  {
    id: paymentQId,
    category: 'Client Compliance',
    questionText: 'Do you process payment card data?',
    options: [
      { text: 'Yes', riskWeight: 0 },
      { text: 'No', riskWeight: 0 },
    ],
    dependsOn: null,
  },
  {
    category: 'Client Compliance',
    questionText: 'Have you implemented enhanced security measures (e.g., PCI-DSS compliance) to protect this financial data?',
    options: [
      { text: 'Yes', riskWeight: 0 },
      { text: 'No', riskWeight: 10 },
    ],
    dependsOn: {
      conditions: [
        { questionId: paymentQId, answerEquals: 'Yes' }
      ],
      logic: 'AND'
    },
  },
  {
    category: 'Client Compliance',
    questionText: 'When you act as a data processor on behalf of clients, do you have DPAs in place with each client?',
    options: [
      { text: 'Yes, all clients', riskWeight: 0 },
      { text: 'Some clients', riskWeight: 5 },
      { text: 'No', riskWeight: 10 },
    ],
    dependsOn: null,
  },
  {
    category: 'Client Compliance',
    questionText: 'Can you demonstrate your GDPR compliance to clients or partners who ask?',
    options: [
      { text: 'Yes, with a dashboard or compiled report', riskWeight: 0 },
      { text: 'Yes, but it takes hours to compile manually', riskWeight: 5 },
      { text: 'No', riskWeight: 10 },
    ],
    dependsOn: null,
  },
];

async function seed() {
  console.log('Clearing existing assessment data to prevent FK violations...');
  await db.delete(assessmentAnswers);
  await db.delete(assessments);
  await db.delete(assessmentTemplates);

  console.log(`Seeding ${questions.length} GDPR Gap Assessment Questions...`);
  for (const q of questions) {
    const values: any = {
      questionText: q.questionText,
      category: q.category,
      options: q.options,
      dependsOn: q.dependsOn,
    };
    if ((q as any).id) {
      values.id = (q as any).id;
    }
    
    await db.insert(assessmentTemplates).values(values);
  }

  console.log('Seeding complete!');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
