import * as dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });
import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
import crypto from 'crypto';
import { assessmentTemplates, assessments, assessmentAnswers, actionItems, pendingSignups } from './schema.js';

const { Pool } = pkg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool);

function getDeterministicId(slug: string) {
  if (!slug) throw new Error('Slug is required for deterministic UUIDs');
  const hash = crypto.createHash('sha1').update(slug).digest('hex');
  // Injects version (4) and variant (a) nibbles to generate a valid v4 UUID from the sha1 hash
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

const healthQId = getDeterministicId('client-compliance-q1');
const paymentQId = getDeterministicId('client-compliance-q4');
const cookieQId = getDeterministicId('cookie-consent-q1');

const questions = [
  // ═══════════════════════════════════════════
  // Data Mapping
  // ═══════════════════════════════════════════
  {
    slug: 'data-mapping-q1',
    category: 'Data Mapping',
    questionText: 'Do you know exactly what personal data your organization collects and stores?',
    options: [
      { text: 'Yes, fully documented', riskWeight: 0 },
      { text: 'Partially', riskWeight: 5 },
      { text: 'No', riskWeight: 10 },
    ],
    dependsOn: null,
    remediationGuidance: 'Conduct a comprehensive data inventory across all departments and systems. Document every category of personal data collected, its source, and where it is stored. Use this to populate your Record of Processing Activities (ROPA).',
    gdprArticles: [30],
  },
  {
    slug: 'data-mapping-q2',
    category: 'Data Mapping',
    questionText: 'Have you documented all the places where personal data lives (CRM, email tools, spreadsheets, cloud storage)?',
    options: [
      { text: 'Yes, fully documented', riskWeight: 0 },
      { text: 'Partially', riskWeight: 5 },
      { text: 'No', riskWeight: 10 },
    ],
    dependsOn: null,
    remediationGuidance: 'Create a data storage inventory mapping every system, application, and physical location where personal data resides. Include cloud services, local drives, email inboxes, spreadsheets, and third-party tools. Update this inventory whenever new tools are adopted.',
    gdprArticles: [30],
  },
  {
    slug: 'data-mapping-q3',
    category: 'Data Mapping',
    questionText: 'Do you know which of your data falls under GDPR "special categories" (health, religion, biometrics)?',
    options: [
      { text: 'Yes, fully documented', riskWeight: 0 },
      { text: 'Not sure', riskWeight: 10 },
      { text: 'We don\'t process special categories', riskWeight: 0 },
    ],
    dependsOn: null,
    remediationGuidance: 'Audit all data fields across your systems to identify any special category data as defined under Article 9 (racial or ethnic origin, political opinions, religious beliefs, trade union membership, genetic data, biometric data, health data, sex life, or sexual orientation). For each instance found, ensure a valid Article 9(2) legal basis is documented.',
    gdprArticles: [9],
  },
  {
    slug: 'data-mapping-q4',
    category: 'Data Mapping',
    questionText: 'Can you identify every third party you share personal data with?',
    options: [
      { text: 'Yes', riskWeight: 0 },
      { text: 'Most of them', riskWeight: 5 },
      { text: 'No', riskWeight: 10 },
    ],
    dependsOn: null,
    remediationGuidance: 'Compile a complete vendor register listing every third party that receives, processes, or has access to personal data. Include SaaS tools, analytics providers, payment processors, email services, and any subcontractors. Cross-reference this list with your data map to ensure no sharing relationships are undocumented.',
    gdprArticles: [28, 30],
  },
  {
    slug: 'data-mapping-q5',
    category: 'Data Mapping',
    questionText: 'Do you have a documented data retention policy?',
    options: [
      { text: 'Yes, and it is enforced', riskWeight: 0 },
      { text: 'Yes, but not enforced', riskWeight: 5 },
      { text: 'No', riskWeight: 10 },
    ],
    dependsOn: null,
    remediationGuidance: 'Define retention periods for each category of personal data based on legal requirements, contractual obligations, and business necessity. Implement automated deletion or anonymization workflows to enforce these periods. Document the retention schedule in your ROPA and review it annually.',
    gdprArticles: [5],
  },

  // ═══════════════════════════════════════════
  // Lawful Basis
  // ═══════════════════════════════════════════
  {
    slug: 'lawful-basis-q1',
    category: 'Lawful Basis',
    questionText: 'Have you identified a lawful basis (consent, contract, legitimate interest, etc.) for each type of data you process?',
    options: [
      { text: 'Yes', riskWeight: 0 },
      { text: 'Partially', riskWeight: 5 },
      { text: 'No', riskWeight: 10 },
    ],
    dependsOn: null,
    remediationGuidance: 'Map each processing activity in your ROPA to one of the six lawful bases under Article 6(1): consent, contract performance, legal obligation, vital interests, public task, or legitimate interest. Document the chosen basis and your reasoning for each. This mapping should be reviewed whenever processing activities change.',
    gdprArticles: [6],
  },
  {
    slug: 'lawful-basis-q2',
    category: 'Lawful Basis',
    questionText: 'If you rely on consent, can people withdraw it as easily as they gave it?',
    options: [
      { text: 'Yes', riskWeight: 0 },
      { text: 'No, it requires email or support', riskWeight: 8 },
      { text: 'We don\'t rely on consent', riskWeight: 0 },
    ],
    dependsOn: null,
    remediationGuidance: 'Implement a self-service consent withdrawal mechanism that is as simple and accessible as the method used to collect consent. If consent was given via a single checkbox or click, withdrawal must be equally effortless (e.g., one-click unsubscribe link, preference center toggle, or account settings option). Do not require users to email support or navigate complex processes to revoke consent.',
    gdprArticles: [7],
  },
  {
    slug: 'lawful-basis-q3',
    category: 'Lawful Basis',
    questionText: 'If you rely on legitimate interest, have you documented a balancing test (LIA)?',
    options: [
      { text: 'Yes', riskWeight: 0 },
      { text: 'No', riskWeight: 10 },
      { text: 'We don\'t rely on legitimate interest', riskWeight: 0 },
    ],
    dependsOn: null,
    remediationGuidance: 'Conduct and document a Legitimate Interest Assessment (LIA) for every processing activity relying on legitimate interest. The assessment must identify the legitimate interest pursued, demonstrate that processing is necessary to achieve it, and balance it against the rights and freedoms of data subjects. Keep LIA records alongside your ROPA for audit readiness.',
    gdprArticles: [6],
  },
  {
    slug: 'lawful-basis-q4',
    category: 'Lawful Basis',
    questionText: 'Do your consent mechanisms meet GDPR standards (explicit, specific, freely given)?',
    options: [
      { text: 'Yes, opt-in only', riskWeight: 0 },
      { text: 'No, we use pre-ticked boxes/implied consent', riskWeight: 10 },
      { text: 'Not sure', riskWeight: 8 },
    ],
    dependsOn: null,
    remediationGuidance: 'Replace any pre-ticked checkboxes, implied consent mechanisms, or bundled consent with explicit opt-in controls. Consent must be freely given, specific, informed, and unambiguous. Each processing purpose requires a separate consent request. Ensure consent forms use clear, plain language and do not condition service access on unnecessary consent (no "consent walls").',
    gdprArticles: [7],
  },
  {
    slug: 'lawful-basis-q5',
    category: 'Lawful Basis',
    questionText: 'Does your privacy notice clearly specify the lawful basis you rely on for each processing purpose (e.g., consent, contract, legitimate interest)?',
    options: [
      { text: 'Yes', riskWeight: 0 },
      { text: 'Partially', riskWeight: 5 },
      { text: 'No', riskWeight: 10 },
    ],
    dependsOn: null,
    remediationGuidance: 'Update your privacy notice to explicitly state the lawful basis relied upon for each distinct processing purpose. Articles 13 and 14 require that data subjects are informed of the lawful basis at the point of data collection. Present this information in a clear, structured format (e.g., a table mapping purposes to legal bases).',
    gdprArticles: [13, 14],
  },

  // ═══════════════════════════════════════════
  // Vendor Management & Transfers
  // ═══════════════════════════════════════════
  {
    slug: 'vendor-management-q1',
    category: 'Vendor Management',
    questionText: 'Do you have a signed Data Processing Agreement with every SaaS tool that handles personal data?',
    options: [
      { text: 'Yes', riskWeight: 0 },
      { text: 'Some of them', riskWeight: 5 },
      { text: 'No', riskWeight: 10 },
    ],
    dependsOn: null,
    remediationGuidance: 'Execute a GDPR-compliant Data Processing Agreement (DPA) with every vendor that processes personal data on your behalf. The DPA must include all eight mandatory clauses under Article 28(3): documented instructions, confidentiality, security measures, sub-processor restrictions, data subject rights assistance, breach and DPIA assistance, deletion or return of data, and audit rights.',
    gdprArticles: [28],
  },
  {
    slug: 'vendor-management-q2',
    category: 'Vendor Management',
    questionText: 'Do you know which of your tools transfer data outside the EU?',
    options: [
      { text: 'Yes, and we have SCCs in place', riskWeight: 0 },
      { text: 'Yes, but no safeguards', riskWeight: 10 },
      { text: 'No', riskWeight: 10 },
    ],
    dependsOn: null,
    remediationGuidance: 'Identify all vendors and systems that transfer personal data to countries outside the EU/EEA. For each transfer, implement an appropriate safeguard under Chapter V: Standard Contractual Clauses (SCCs), Binding Corporate Rules (BCRs), or reliance on an adequacy decision. Conduct a Transfer Impact Assessment (TIA) for transfers to countries without an adequacy decision.',
    gdprArticles: [44, 45, 46],
  },
  {
    slug: 'vendor-management-q3',
    category: 'Vendor Management',
    questionText: 'Have you assessed the privacy risks of your vendors and tools based outside the EU/EEA?',
    options: [
      { text: 'Yes, via TIA (Transfer Impact Assessment)', riskWeight: 0 },
      { text: 'No', riskWeight: 8 },
      { text: 'We don\'t use vendors outside the EU/EEA', riskWeight: 0 },
    ],
    dependsOn: null,
    remediationGuidance: 'Conduct a Transfer Impact Assessment (TIA) for every international data transfer as required by the Schrems II ruling. Evaluate the legal framework of the recipient country, assess whether supplementary measures are needed (encryption, pseudonymization, contractual provisions), and document your analysis. Reassess whenever the legal landscape changes.',
    gdprArticles: [44, 45, 46],
  },
  {
    slug: 'vendor-management-q4',
    category: 'Vendor Management',
    questionText: 'Do you transfer personal data internationally through your own operations (e.g., remote workers, international branches accessing EU data)?',
    options: [
      { text: 'Yes, with appropriate safeguards like SCCs', riskWeight: 0 },
      { text: 'Yes, without safeguards', riskWeight: 10 },
      { text: 'No', riskWeight: 0 },
    ],
    dependsOn: null,
    remediationGuidance: 'Implement appropriate transfer mechanisms for all internal international data flows. This includes intra-group transfers to offices, remote employees, or branches outside the EU/EEA. Use Binding Corporate Rules (BCRs) for group-wide transfers or Standard Contractual Clauses (SCCs) for specific transfers. Ensure access controls restrict data visibility to authorized personnel in each jurisdiction.',
    gdprArticles: [44, 45, 46],
  },
  {
    slug: 'vendor-management-q5',
    category: 'Vendor Management',
    questionText: 'Do you monitor when your vendors change their sub-processors?',
    options: [
      { text: 'Yes', riskWeight: 0 },
      { text: 'No', riskWeight: 5 },
    ],
    dependsOn: null,
    remediationGuidance: 'Establish a sub-processor monitoring process. Subscribe to change notifications from each vendor\'s sub-processor list page. Review your DPAs to ensure they include prior written notification requirements for sub-processor changes and your right to object. Track and acknowledge all sub-processor changes as part of your vendor management workflow.',
    gdprArticles: [28],
  },
  {
    slug: 'vendor-management-q6',
    category: 'Vendor Management',
    questionText: 'Have you reviewed your vendors\' security certifications (e.g. SOC 2, ISO 27001)?',
    options: [
      { text: 'Yes', riskWeight: 0 },
      { text: 'No', riskWeight: 5 },
    ],
    dependsOn: null,
    remediationGuidance: 'Request and review security certifications (SOC 2 Type II, ISO 27001, or equivalent) from all vendors processing personal data. Incorporate certification status into your vendor risk scoring. For vendors lacking certifications, conduct a vendor security questionnaire to assess their technical and organizational measures under Article 32.',
    gdprArticles: [28, 32],
  },

  // ═══════════════════════════════════════════
  // Data Subject Rights
  // ═══════════════════════════════════════════
  {
    slug: 'data-subject-rights-q1',
    category: 'Data Subject Rights',
    questionText: 'If someone emails asking "what data do you have on me?", do you have a process to respond within one month?',
    options: [
      { text: 'Yes, documented process', riskWeight: 0 },
      { text: 'Ad-hoc process', riskWeight: 5 },
      { text: 'No', riskWeight: 10 },
    ],
    dependsOn: null,
    remediationGuidance: 'Establish a documented Data Subject Access Request (DSAR) procedure with clear ownership, identity verification steps, and response templates. Ensure the process can locate and compile personal data across all systems within the one-month statutory deadline. Assign responsibility for DSAR handling and train relevant staff on the workflow.',
    gdprArticles: [15],
  },
  {
    slug: 'data-subject-rights-q2',
    category: 'Data Subject Rights',
    questionText: 'Can you locate and delete all of a person\'s data across all your systems if they request erasure?',
    options: [
      { text: 'Yes, across all systems', riskWeight: 0 },
      { text: 'Only in our main database, not in third-party tools', riskWeight: 8 },
      { text: 'No', riskWeight: 10 },
    ],
    dependsOn: null,
    remediationGuidance: 'Map all systems and third-party tools where personal data is stored and build a documented erasure procedure that covers every location. Include backup systems, analytics platforms, email marketing tools, and CRM databases. For third-party tools, verify their APIs or admin panels support data deletion and document the process for each vendor.',
    gdprArticles: [17],
  },
  {
    slug: 'data-subject-rights-q3',
    category: 'Data Subject Rights',
    questionText: 'Do you have a process for data portability requests?',
    options: [
      { text: 'Yes, we can export CSV/JSON', riskWeight: 0 },
      { text: 'No', riskWeight: 8 },
    ],
    dependsOn: null,
    remediationGuidance: 'Implement the ability to export a data subject\'s personal data in a structured, commonly used, and machine-readable format (e.g., CSV or JSON). The export should cover all data provided by the data subject and processed on the basis of consent or contract. Ensure the process can be completed within the one-month response deadline.',
    gdprArticles: [20],
  },
  {
    slug: 'data-subject-rights-q4',
    category: 'Data Subject Rights',
    questionText: 'Is there a clear, accessible way for people to submit rights requests?',
    options: [
      { text: 'Yes, dedicated web form or email', riskWeight: 0 },
      { text: 'No', riskWeight: 5 },
    ],
    dependsOn: null,
    remediationGuidance: 'Provide a clearly visible and easily accessible mechanism for data subjects to submit rights requests. This could be a dedicated web form, a published email address, or a link in your privacy notice. Ensure the submission method is prominently referenced in your privacy policy and footer of your website.',
    gdprArticles: [12],
  },
  {
    slug: 'data-subject-rights-q5',
    category: 'Data Subject Rights',
    questionText: 'Do you inform data subjects of their right to object to processing, particularly for direct marketing?',
    options: [
      { text: 'Yes', riskWeight: 0 },
      { text: 'No, but we do direct marketing', riskWeight: 10 },
      { text: 'We don\'t do direct marketing', riskWeight: 0 },
    ],
    dependsOn: null,
    remediationGuidance: 'Explicitly inform data subjects of their right to object to processing for direct marketing purposes at the point of first communication and in your privacy notice. When a data subject objects to direct marketing, cease processing their data for that purpose immediately and without exception. This right is absolute under Article 21(2) and cannot be overridden.',
    gdprArticles: [21],
  },
  {
    slug: 'data-subject-rights-q6',
    category: 'Data Subject Rights',
    questionText: 'Do you use automated decision-making or profiling (e.g., AI lead scoring, algorithmic hiring)?',
    options: [
      { text: 'Yes, with human oversight and opt-outs', riskWeight: 0 },
      { text: 'Yes, fully automated without opt-outs', riskWeight: 10 },
      { text: 'No', riskWeight: 0 },
    ],
    dependsOn: null,
    remediationGuidance: 'Implement meaningful human oversight for all automated decision-making processes that produce legal or similarly significant effects. Provide data subjects with the right to obtain human intervention, express their point of view, and contest the decision. Document the logic, significance, and envisaged consequences of the automated processing in your privacy notice.',
    gdprArticles: [22],
  },

  // ═══════════════════════════════════════════
  // Security
  // ═══════════════════════════════════════════
  {
    slug: 'security-q1',
    category: 'Security',
    questionText: 'Is personal data encrypted at rest and in transit across your systems?',
    options: [
      { text: 'Yes', riskWeight: 0 },
      { text: 'In transit only', riskWeight: 5 },
      { text: 'No', riskWeight: 10 },
    ],
    dependsOn: null,
    remediationGuidance: 'Implement encryption for personal data both at rest (AES-256 or equivalent for databases, file storage, and backups) and in transit (TLS 1.2+ for all network communications). Ensure encryption keys are managed securely and rotated periodically. Document your encryption standards as part of your Article 32 technical measures.',
    gdprArticles: [32],
  },
  {
    slug: 'security-q2',
    category: 'Security',
    questionText: 'Do you have access controls limiting who on your team can see personal data?',
    options: [
      { text: 'Yes, role-based access', riskWeight: 0 },
      { text: 'Partial — some systems have controls, others don\'t', riskWeight: 5 },
      { text: 'Everyone has access', riskWeight: 10 },
    ],
    dependsOn: null,
    remediationGuidance: 'Implement role-based access controls (RBAC) across all systems that store or process personal data. Apply the principle of least privilege so that each team member can only access the data necessary for their role. Conduct quarterly access reviews to remove stale permissions and ensure access remains appropriate as roles change.',
    gdprArticles: [32],
  },
  {
    slug: 'security-q3',
    category: 'Security',
    questionText: 'Do you regularly test, assess, and evaluate the effectiveness of your security measures (e.g., penetration testing, vulnerability scans)?',
    options: [
      { text: 'Yes, regularly', riskWeight: 0 },
      { text: 'Rarely or ad-hoc', riskWeight: 5 },
      { text: 'No', riskWeight: 10 },
    ],
    dependsOn: null,
    remediationGuidance: 'Establish a regular security testing cadence including vulnerability scanning (at least quarterly) and penetration testing (at least annually). Document findings, remediation timelines, and re-test results. Article 32(1)(d) specifically requires a process for regularly testing, assessing, and evaluating the effectiveness of technical and organizational security measures.',
    gdprArticles: [32],
  },
  {
    slug: 'security-q4',
    category: 'Security',
    questionText: 'Do you have a documented process for notifying the supervisory authority within 72 hours for breaches that are likely to result in a risk to people\'s rights and freedoms?',
    options: [
      { text: 'Yes, tested incident response plan', riskWeight: 0 },
      { text: 'Yes, but untested', riskWeight: 3 },
      { text: 'No', riskWeight: 10 },
    ],
    dependsOn: null,
    remediationGuidance: 'Document a data breach incident response plan that includes detection procedures, severity assessment criteria, internal escalation paths, and supervisory authority notification templates. Test the plan through tabletop exercises at least annually. Ensure the plan includes the 72-hour notification deadline under Article 33 and criteria for determining when affected individuals must also be notified under Article 34.',
    gdprArticles: [33, 34],
  },
  {
    slug: 'security-q5',
    category: 'Security',
    questionText: 'Has your team received GDPR awareness training in the last 12 months?',
    options: [
      { text: 'Yes', riskWeight: 0 },
      { text: 'No', riskWeight: 5 },
    ],
    dependsOn: null,
    remediationGuidance: 'Deliver GDPR awareness training to all staff who handle personal data, with role-specific modules for high-risk functions (HR, marketing, customer support). Training should cover data subject rights, breach identification and reporting, and lawful basis principles. Schedule refresher training at least annually and track completion rates for audit evidence.',
    gdprArticles: [24, 32, 39],
  },

  // ═══════════════════════════════════════════
  // Privacy Notices
  // ═══════════════════════════════════════════
  {
    slug: 'privacy-notices-q1',
    category: 'Privacy Notices',
    questionText: 'Does your website have a privacy policy that was updated in the last 12 months?',
    options: [
      { text: 'Yes', riskWeight: 0 },
      { text: 'No, it\'s older', riskWeight: 5 },
      { text: 'No privacy policy at all', riskWeight: 10 },
    ],
    dependsOn: null,
    remediationGuidance: 'Review and update your privacy policy to reflect current data processing activities, vendors, data categories, and lawful bases. Privacy notices should be reviewed at least annually or whenever there is a material change to how personal data is processed. Include a "last updated" date for transparency.',
    gdprArticles: [13, 14],
  },
  {
    slug: 'privacy-notices-q2',
    category: 'Privacy Notices',
    questionText: 'Does your privacy policy explain all the data you collect, why, and who you share it with?',
    options: [
      { text: 'Yes, highly detailed', riskWeight: 0 },
      { text: 'Generic template, might be missing specifics', riskWeight: 8 },
      { text: 'No', riskWeight: 10 },
    ],
    dependsOn: null,
    remediationGuidance: 'Replace any generic privacy policy template with a detailed notice specific to your organization. It must list every category of personal data collected, the specific purposes for each, all recipients or categories of recipients, retention periods, international transfers, and data subject rights. Articles 13 and 14 mandate this information be provided in a concise, transparent, and easily accessible form.',
    gdprArticles: [13, 14],
  },
  {
    slug: 'privacy-notices-q3',
    category: 'Privacy Notices',
    questionText: 'Do you have separate privacy notices for employees, clients, and website visitors?',
    options: [
      { text: 'Yes', riskWeight: 0 },
      { text: 'No, one policy for everything', riskWeight: 5 },
    ],
    dependsOn: null,
    remediationGuidance: 'Create tailored privacy notices for each distinct audience: employees (covering HR data, monitoring, payroll), clients (covering service-related processing), and website visitors (covering cookies, analytics, forms). Each audience has different data categories, purposes, and lawful bases that a single catch-all notice cannot adequately address.',
    gdprArticles: [13, 14],
  },

  // ═══════════════════════════════════════════
  // Cookie Consent
  // ═══════════════════════════════════════════
  {
    slug: 'cookie-consent-q1',
    category: 'Cookie Consent',
    id: cookieQId,
    questionText: 'Does your website have a cookie consent banner?',
    options: [
      { text: 'Yes', riskWeight: 0 },
      { text: 'No', riskWeight: 10 },
    ],
    dependsOn: null,
    remediationGuidance: 'Implement a cookie consent banner that appears before any non-essential cookies are set. The banner must clearly explain what cookies are used and for what purposes, and provide granular controls for users to accept or reject each category (necessary, analytics, marketing, etc.).',
    gdprArticles: [7],
  },
  {
    slug: 'cookie-consent-q2',
    category: 'Cookie Consent',
    questionText: 'Can visitors reject all non-essential cookies as easily as accepting them?',
    options: [
      { text: 'Yes', riskWeight: 0 },
      { text: 'No, reject is hidden or requires multiple clicks', riskWeight: 8 },
    ],
    dependsOn: {
      conditions: [
        { questionId: cookieQId, answerEquals: 'Yes' }
      ],
      logic: 'AND'
    },
    remediationGuidance: 'Ensure your cookie banner provides a "Reject All" button that is equally prominent and accessible as the "Accept All" button. Per the Planet49 ruling and EDPB Guidelines 05/2020 on consent, burying the reject option behind settings menus or requiring additional clicks constitutes a dark pattern and does not meet the standard for freely given consent.',
    gdprArticles: [7],
  },
  {
    slug: 'cookie-consent-q3',
    category: 'Cookie Consent',
    questionText: 'Do you block non-essential cookies and tracking scripts from firing until the user gives explicit consent?',
    options: [
      { text: 'Yes, they are blocked until consent', riskWeight: 0 },
      { text: 'Not sure', riskWeight: 5 },
      { text: 'No, they fire immediately', riskWeight: 10 },
    ],
    dependsOn: null,
    remediationGuidance: 'Configure your cookie consent implementation to block all non-essential cookies and tracking scripts (analytics, advertising pixels, social media widgets) from executing until the user has given explicit consent. This requires a tag management system or consent-aware script loader that gates script execution on the user\'s consent state. Pre-consent data collection violates the ePrivacy Directive and GDPR consent requirements.',
    gdprArticles: [7],
  },
  {
    slug: 'cookie-consent-q4',
    category: 'Cookie Consent',
    questionText: 'Do you have a record of cookie consents given by visitors?',
    options: [
      { text: 'Yes, stored securely', riskWeight: 0 },
      { text: 'No', riskWeight: 8 },
    ],
    dependsOn: null,
    remediationGuidance: 'Implement a consent logging mechanism that records each visitor\'s consent decision, including a timestamp, the consent version shown, the categories accepted or rejected, and a unique consent ID. These records are essential for demonstrating compliance under Article 7(1), which requires controllers to be able to demonstrate that consent was given.',
    gdprArticles: [7],
  },

  // ═══════════════════════════════════════════
  // Governance
  // ═══════════════════════════════════════════
  {
    slug: 'governance-q1',
    category: 'Governance',
    questionText: 'Have you appointed a Data Protection Officer (DPO) as required by Article 37?',
    options: [
      { text: 'Yes', riskWeight: 0 },
      { text: 'No, but we process large-scale sensitive data/monitor users', riskWeight: 10 },
      { text: 'No, we are not required to', riskWeight: 0 },
    ],
    dependsOn: null,
    remediationGuidance: 'Evaluate whether your organization is required to appoint a DPO under Article 37 (mandatory for public authorities, organizations whose core activities involve large-scale systematic monitoring, or large-scale processing of special category data). If required, formally designate a DPO, ensure their independence, provide adequate resources, and publish their contact details to the supervisory authority.',
    gdprArticles: [37],
  },
  {
    slug: 'governance-q2',
    category: 'Governance',
    questionText: 'Have you conducted Data Protection Impact Assessments (DPIAs) for your high-risk processing activities?',
    options: [
      { text: 'Yes', riskWeight: 0 },
      { text: 'No, but we do high-risk processing', riskWeight: 10 },
      { text: 'We don\'t have high-risk activities', riskWeight: 0 },
    ],
    dependsOn: null,
    remediationGuidance: 'Identify all processing activities that are likely to result in a high risk to individuals (e.g., systematic profiling, large-scale processing of special category data, public monitoring) and conduct a DPIA for each. The DPIA must describe the processing, assess its necessity and proportionality, evaluate risks to data subjects, and detail mitigating measures. Consult your DPO during the process.',
    gdprArticles: [35],
  },
  {
    slug: 'governance-q3',
    category: 'Governance',
    questionText: 'Do you maintain a formal Record of Processing Activities (ROPA) mapping out what data you process, why, and where it goes?',
    options: [
      { text: 'Yes, fully up-to-date', riskWeight: 0 },
      { text: 'Partially or outdated', riskWeight: 5 },
      { text: 'No', riskWeight: 10 },
    ],
    dependsOn: null,
    remediationGuidance: 'Create and maintain a Record of Processing Activities (ROPA) as required under Article 30. For each processing activity, document: the purpose, categories of data subjects and personal data, recipients, international transfers, retention periods, and a description of technical and organizational security measures. Review and update the ROPA at least quarterly or whenever processing activities change.',
    gdprArticles: [30],
  },

  // ═══════════════════════════════════════════
  // Client Compliance
  // ═══════════════════════════════════════════
  {
    id: healthQId,
    slug: 'client-compliance-q1',
    category: 'Client Compliance',
    questionText: 'Do you process patient health records?',
    options: [
      { text: 'Yes', riskWeight: 0 },
      { text: 'No', riskWeight: 0 },
    ],
    dependsOn: null,
    remediationGuidance: 'If processing health data, ensure you have identified a valid lawful basis under Article 6 and a specific Article 9(2) exemption. Implement enhanced security measures proportionate to the sensitivity of health data, including access controls, encryption, and audit logging.',
    gdprArticles: [9],
  },
  {
    slug: 'client-compliance-q2',
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
    remediationGuidance: 'Identify and document a specific Article 9(2) exemption for each instance of special category data processing. Common exemptions include explicit consent (9(2)(a)), employment obligations (9(2)(b)), vital interests (9(2)(c)), or preventive/occupational medicine (9(2)(h)). Processing special category data without a valid exemption is prohibited regardless of whether a general Article 6 lawful basis exists.',
    gdprArticles: [9],
  },
  {
    slug: 'client-compliance-q3',
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
    remediationGuidance: 'Conduct a Data Protection Impact Assessment specifically for your health data processing activities. Processing health data at scale is explicitly listed as high-risk processing requiring a DPIA under Article 35. The assessment should address the necessity and proportionality of processing, risks to patients and data subjects, and specific safeguards (pseudonymization, access restrictions, audit trails).',
    gdprArticles: [35],
  },
  {
    id: paymentQId,
    slug: 'client-compliance-q4',
    category: 'Client Compliance',
    questionText: 'Do you process payment card data?',
    options: [
      { text: 'Yes', riskWeight: 0 },
      { text: 'No', riskWeight: 0 },
    ],
    dependsOn: null,
    remediationGuidance: 'If processing payment card data, implement enhanced security measures including PCI-DSS compliance, tokenization of card numbers, and strict access controls. Ensure payment data is encrypted at rest and in transit, and minimize the scope of systems that handle raw card data.',
    gdprArticles: [32],
  },
  {
    slug: 'client-compliance-q5',
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
    remediationGuidance: 'Achieve and maintain PCI-DSS compliance for all systems that store, process, or transmit payment card data. Implement tokenization to replace raw card numbers with non-reversible tokens, restrict access to payment systems to authorized personnel only, and conduct regular security assessments. Consider delegating payment processing to a PCI-DSS compliant third-party processor to reduce your compliance scope.',
    gdprArticles: [32],
  },
  {
    slug: 'client-compliance-q6',
    category: 'Client Compliance',
    questionText: 'When you act as a data processor on behalf of clients, do you have DPAs in place with each client?',
    options: [
      { text: 'Yes, all clients', riskWeight: 0 },
      { text: 'Some clients', riskWeight: 5 },
      { text: 'No', riskWeight: 10 },
    ],
    dependsOn: null,
    remediationGuidance: 'Execute Data Processing Agreements with every client for whom you act as a data processor. Under Article 28, processing must be governed by a binding contract that sets out the subject matter, duration, nature, and purpose of processing. As a processor, you must not engage another processor without prior written authorization from the controller.',
    gdprArticles: [28],
  },
  {
    slug: 'client-compliance-q7',
    category: 'Client Compliance',
    questionText: 'Can you demonstrate your GDPR compliance to clients or partners who ask?',
    options: [
      { text: 'Yes, with a dashboard or compiled report', riskWeight: 0 },
      { text: 'Yes, but it takes hours to compile manually', riskWeight: 5 },
      { text: 'No', riskWeight: 10 },
    ],
    dependsOn: null,
    remediationGuidance: 'Establish an accountability framework that allows you to demonstrate GDPR compliance on demand. This includes maintaining up-to-date ROPA records, DPA documentation, security certifications, training records, DPIA reports, and breach response logs. Consider a compliance dashboard or audit file that consolidates all evidence into a single exportable package for client due diligence requests.',
    gdprArticles: [5],
  },
];

async function seed() {
  console.log('Clearing existing assessment data to prevent FK violations...');
  await db.delete(pendingSignups);
  await db.delete(actionItems);
  await db.delete(assessmentAnswers);
  await db.delete(assessments);
  await db.delete(assessmentTemplates);

  console.log(`Seeding ${questions.length} GDPR Gap Assessment Questions...`);
  for (const q of questions) {
    const maxRiskWeight = Math.max(...q.options.map((o: any) => o.riskWeight));
    const values: any = {
      questionText: q.questionText,
      category: q.category,
      options: q.options,
      dependsOn: q.dependsOn,
      maxRiskWeight: maxRiskWeight,
      gdprArticles: q.gdprArticles,
      remediationGuidance: q.remediationGuidance,
    };
    if ((q as any).id) {
      values.id = (q as any).id;
    } else {
      values.id = getDeterministicId(q.slug);
    }
    await db.insert(assessmentTemplates).values(values);
  }
  console.log('Seeding complete.');
  await pool.end();
  process.exit(0);
}

seed().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});