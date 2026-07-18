import * as dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
const { Pool } = pg;
import { drizzle } from 'drizzle-orm/node-postgres';
import { vendorAssessmentTemplates } from './schema.js';
import { eq } from 'drizzle-orm';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load dotenv from root
dotenv.config();
dotenv.config({ path: join(__dirname, '../../../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

const db = drizzle(pool);

const standardQuestions = [
  {
    id: "q_dpa_willingness",
    text: "Are you willing to execute a Data Processing Agreement (DPA) containing standard contractual clauses (SCCs) if required?",
    category: "Contract & DPA",
    type: "choice",
    options: [
      { text: "Yes, we sign standard DPAs", score: 10 },
      { text: "Yes, but only our own template", score: 7 },
      { text: "No / Under negotiation", score: 0 }
    ]
  },
  {
    id: "q_dpo_appointment",
    text: "Has your organization formally appointed a Data Protection Officer (DPO) or designated lead for data privacy?",
    category: "Governance",
    type: "choice",
    options: [
      { text: "Yes, we have an appointed DPO", score: 5 },
      { text: "Yes, we have a designated privacy contact", score: 4 },
      { text: "No", score: 0 }
    ]
  },
  {
    id: "q_processing_locations",
    text: "Where is customer personal data primarily hosted and processed?",
    category: "Data Residency & Transfers",
    type: "choice",
    options: [
      { text: "Exclusively within the EU/EEA", score: 10 },
      { text: "US / Other countries with Adequacy Decision", score: 8 },
      { text: "Globally / Non-adequate countries (using SCCs)", score: 5 },
      { text: "Non-adequate countries without transfer safeguards", score: 0 }
    ]
  },
  {
    id: "q_encryption_transit",
    text: "Is personal data encrypted during transit using TLS 1.2 or higher?",
    category: "Technical Security",
    type: "choice",
    options: [
      { text: "Yes, enforced for all connections", score: 5 },
      { text: "Partially / Optional", score: 2 },
      { text: "No", score: 0 }
    ]
  },
  {
    id: "q_encryption_rest",
    text: "Is personal data encrypted at rest using AES-256 or similar standard algorithms?",
    category: "Technical Security",
    type: "choice",
    options: [
      { text: "Yes, all data at rest is encrypted", score: 5 },
      { text: "Only specific database tables are encrypted", score: 3 },
      { text: "No", score: 0 }
    ]
  },
  {
    id: "q_access_control",
    text: "Do you enforce role-based access control (RBAC) and Multi-Factor Authentication (MFA) for employees accessing customer data?",
    category: "Technical Security",
    type: "choice",
    options: [
      { text: "Yes, RBAC and MFA are strictly enforced", score: 5 },
      { text: "RBAC is enforced, but MFA is optional", score: 3 },
      { text: "No", score: 0 }
    ]
  },
  {
    id: "q_certifications",
    text: "What independent security certifications or audits does your organization maintain?",
    category: "Certifications",
    type: "choice",
    options: [
      { text: "SOC 2 Type II and ISO 27001", score: 10 },
      { text: "SOC 2 Type I or ISO 27001 only", score: 7 },
      { text: "Other local certifications / Audits pending", score: 4 },
      { text: "None", score: 0 }
    ]
  },
  {
    id: "q_subprocessor_mgmt",
    text: "Do you maintain a public, up-to-date list of sub-processors and notify customers of changes prior to engagement?",
    category: "Sub-processors",
    type: "choice",
    options: [
      { text: "Yes, list is public and notification is contractual", score: 10 },
      { text: "List is available on request, but no proactive notifications", score: 5 },
      { text: "No list / No notification process", score: 0 }
    ]
  },
  {
    id: "q_retention_deletion",
    text: "Do you have automated procedures to securely delete or return customer data upon contract termination or customer request?",
    category: "Data Lifecycle",
    type: "choice",
    options: [
      { text: "Yes, automated deletion within 30 days", score: 5 },
      { text: "Yes, manual deletion within 90 days", score: 3 },
      { text: "No formal data deletion guarantees", score: 0 }
    ]
  },
  {
    id: "q_employee_training",
    text: "Do all employees with access to customer personal data undergo annual security and privacy training (including GDPR)?",
    category: "Governance",
    type: "choice",
    options: [
      { text: "Yes, mandatory annual training", score: 5 },
      { text: "Yes, but ad-hoc or on onboarding only", score: 3 },
      { text: "No", score: 0 }
    ]
  },
  {
    id: "q_incident_response",
    text: "Do you have a documented incident response plan and contractually commit to notifying customer controllers of a data breach within 48-72 hours?",
    category: "Incidents",
    type: "choice",
    options: [
      { text: "Yes, notification within 48 hours", score: 10 },
      { text: "Yes, notification within 72 hours", score: 8 },
      { text: "Yes, but longer timeline (e.g. 7-14 days)", score: 4 },
      { text: "No formal breach notification timelines", score: 0 }
    ]
  },
  {
    id: "q_dpia_conducted",
    text: "Have you conducted Data Protection Impact Assessments (DPIAs) for high-risk processing operations under your scope?",
    category: "Governance",
    type: "choice",
    options: [
      { text: "Yes, DPIAs are conducted and documented", score: 5 },
      { text: "Only when specifically requested by client controllers", score: 3 },
      { text: "No", score: 0 }
    ]
  },
  {
    id: "q_audit_rights",
    text: "Do you allow customer audits and inspections to verify compliance with Article 28 commitments?",
    category: "Contract & DPA",
    type: "choice",
    options: [
      { text: "Yes, full audit rights allowed annually", score: 5 },
      { text: "Yes, but limited to documentation/audit reports only", score: 3 },
      { text: "No audit rights allowed", score: 0 }
    ]
  },
  {
    id: "q_vulnerability_mgmt",
    text: "Do you conduct regular penetration testing and vulnerability scans by certified third parties?",
    category: "Technical Security",
    type: "choice",
    options: [
      { text: "Yes, annual third-party pen tests", score: 5 },
      { text: "Internal scans only", score: 3 },
      { text: "No testing", score: 0 }
    ]
  },
  {
    id: "q_backup_dr",
    text: "Do you maintain encrypted backups and test your disaster recovery (DR) procedures at least annually?",
    category: "Technical Security",
    type: "choice",
    options: [
      { text: "Yes, daily backups with annual DR testing", score: 5 },
      { text: "Backups exist, but DR is not regularly tested", score: 3 },
      { text: "No formal backup/DR procedures", score: 0 }
    ]
  }
];

async function seed() {
  console.log("Seeding Vendor Assessment Template...");
  const [existing] = await db.select()
    .from(vendorAssessmentTemplates)
    .where(eq(vendorAssessmentTemplates.name, "Standard GDPR Security & Privacy Assessment"));

  if (existing) {
    console.log("Template already exists, skipping seeding.");
  } else {
    await db.insert(vendorAssessmentTemplates).values({
      name: "Standard GDPR Security & Privacy Assessment",
      description: "Standard compliance template covering Article 28 parameters, sub-processors, encryption, data transfers, and retention.",
      questions: standardQuestions,
      isDefault: true,
      organizationId: null // Global system template
    });
    console.log("Seeded template successfully!");
  }
  await pool.end();
}

seed().catch(err => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
