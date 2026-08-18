/**
 * What a new organisation's data-element and subject-category catalogues start as.
 *
 * The catalogues are org-scoped and seeded lazily — the first time a register asks
 * for one, `ensureCatalogues()` upserts these rows. Lazily rather than at signup
 * because every organisation already in the database predates the tables, and a
 * migration that back-filled 32 templates' worth of taxonomy for tenants who may
 * never open the module is work nobody asked for.
 *
 * The unique key is `(organization_id, name)`, so re-seeding is idempotent and a
 * customer who renames "Email address" does not get a second copy on the next run.
 * `is_seeded` marks these apart from what the customer added, which is what lets a
 * future reset know what it may touch.
 *
 * Elements are deliberately narrow — "Date of birth", not "Personal details". A
 * catalogue whose entries are as vague as free text buys nothing.
 */

export type SeedElement = {
  name: string;
  elementGroup: string;
  sensitivity: 'standard' | 'confidential' | 'special';
  isSpecialCategory?: boolean;
  specialCategoryType?: string;
  isCriminalData?: boolean;
  identifiability?: 'direct' | 'indirect' | 'pseudonymised' | 'anonymous';
  format?: string;
  example?: string;
};

export const SEED_DATA_ELEMENTS: SeedElement[] = [
  // ---- Identity -----------------------------------------------------------
  { name: 'Full name', elementGroup: 'Identity', sensitivity: 'standard', identifiability: 'direct', format: 'text', example: 'Alex Moreau' },
  { name: 'Date of birth', elementGroup: 'Identity', sensitivity: 'confidential', identifiability: 'direct', format: 'date' },
  { name: 'National identification number', elementGroup: 'Identity', sensitivity: 'confidential', identifiability: 'direct', format: 'text', example: 'NI number, INSEE, Steuer-ID' },
  { name: 'Passport or ID document number', elementGroup: 'Identity', sensitivity: 'confidential', identifiability: 'direct', format: 'text' },
  { name: 'Nationality', elementGroup: 'Identity', sensitivity: 'confidential', identifiability: 'indirect' },
  { name: 'Photograph', elementGroup: 'Identity', sensitivity: 'confidential', identifiability: 'direct', format: 'image' },
  { name: 'Signature', elementGroup: 'Identity', sensitivity: 'confidential', identifiability: 'direct', format: 'image' },

  // ---- Contact ------------------------------------------------------------
  { name: 'Email address', elementGroup: 'Contact', sensitivity: 'standard', identifiability: 'direct', format: 'email' },
  { name: 'Telephone number', elementGroup: 'Contact', sensitivity: 'standard', identifiability: 'direct', format: 'phone' },
  { name: 'Postal address', elementGroup: 'Contact', sensitivity: 'standard', identifiability: 'direct', format: 'text' },
  { name: 'Emergency contact details', elementGroup: 'Contact', sensitivity: 'confidential', identifiability: 'direct' },

  // ---- Financial ----------------------------------------------------------
  { name: 'Bank account details', elementGroup: 'Financial', sensitivity: 'confidential', identifiability: 'direct', format: 'text', example: 'IBAN, sort code and account number' },
  { name: 'Payment card details', elementGroup: 'Financial', sensitivity: 'confidential', identifiability: 'direct', format: 'text', example: 'Tokenised PAN, expiry, last four digits' },
  { name: 'Salary and compensation', elementGroup: 'Financial', sensitivity: 'confidential', identifiability: 'direct', format: 'number' },
  { name: 'Tax reference', elementGroup: 'Financial', sensitivity: 'confidential', identifiability: 'direct' },
  { name: 'Billing and invoice history', elementGroup: 'Financial', sensitivity: 'standard', identifiability: 'direct' },
  { name: 'Credit or affordability assessment', elementGroup: 'Financial', sensitivity: 'confidential', identifiability: 'direct' },

  // ---- Employment ---------------------------------------------------------
  { name: 'Job title and department', elementGroup: 'Employment', sensitivity: 'standard', identifiability: 'indirect' },
  { name: 'Employment contract terms', elementGroup: 'Employment', sensitivity: 'confidential', identifiability: 'direct' },
  { name: 'CV and employment history', elementGroup: 'Employment', sensitivity: 'confidential', identifiability: 'direct' },
  { name: 'Qualifications and training records', elementGroup: 'Employment', sensitivity: 'standard', identifiability: 'direct' },
  { name: 'Performance review records', elementGroup: 'Employment', sensitivity: 'confidential', identifiability: 'direct' },
  { name: 'Disciplinary and grievance records', elementGroup: 'Employment', sensitivity: 'confidential', identifiability: 'direct' },
  { name: 'Absence and leave records', elementGroup: 'Employment', sensitivity: 'confidential', identifiability: 'direct' },
  { name: 'Right-to-work documentation', elementGroup: 'Employment', sensitivity: 'confidential', identifiability: 'direct' },

  // ---- Online and device --------------------------------------------------
  { name: 'IP address', elementGroup: 'Online identifiers', sensitivity: 'standard', identifiability: 'indirect', format: 'text' },
  { name: 'Cookie and tracker identifiers', elementGroup: 'Online identifiers', sensitivity: 'standard', identifiability: 'pseudonymised' },
  { name: 'Device identifiers', elementGroup: 'Online identifiers', sensitivity: 'standard', identifiability: 'pseudonymised' },
  { name: 'Account credentials', elementGroup: 'Online identifiers', sensitivity: 'confidential', identifiability: 'direct', example: 'Username and hashed password' },
  { name: 'Usage and interaction logs', elementGroup: 'Online identifiers', sensitivity: 'standard', identifiability: 'pseudonymised' },
  { name: 'Location data', elementGroup: 'Online identifiers', sensitivity: 'confidential', identifiability: 'indirect' },
  { name: 'Marketing preferences and consent records', elementGroup: 'Preferences', sensitivity: 'standard', identifiability: 'direct' },
  { name: 'Support and correspondence history', elementGroup: 'Preferences', sensitivity: 'standard', identifiability: 'direct' },
  { name: 'Profiling scores and segments', elementGroup: 'Derived', sensitivity: 'confidential', identifiability: 'indirect' },

  // ---- Article 9 ----------------------------------------------------------
  { name: 'Health and medical information', elementGroup: 'Special category', sensitivity: 'special', isSpecialCategory: true, specialCategoryType: 'health_data', identifiability: 'direct' },
  { name: 'Disability and accessibility needs', elementGroup: 'Special category', sensitivity: 'special', isSpecialCategory: true, specialCategoryType: 'health_data', identifiability: 'direct' },
  { name: 'Racial or ethnic origin', elementGroup: 'Special category', sensitivity: 'special', isSpecialCategory: true, specialCategoryType: 'racial_or_ethnic_origin', identifiability: 'direct' },
  { name: 'Religious or philosophical beliefs', elementGroup: 'Special category', sensitivity: 'special', isSpecialCategory: true, specialCategoryType: 'religious_or_philosophical_beliefs', identifiability: 'direct' },
  { name: 'Political opinions', elementGroup: 'Special category', sensitivity: 'special', isSpecialCategory: true, specialCategoryType: 'political_opinions', identifiability: 'direct' },
  { name: 'Trade union membership', elementGroup: 'Special category', sensitivity: 'special', isSpecialCategory: true, specialCategoryType: 'trade_union_membership', identifiability: 'direct' },
  { name: 'Genetic data', elementGroup: 'Special category', sensitivity: 'special', isSpecialCategory: true, specialCategoryType: 'genetic_data', identifiability: 'direct' },
  { name: 'Biometric data used for identification', elementGroup: 'Special category', sensitivity: 'special', isSpecialCategory: true, specialCategoryType: 'biometric_data_for_id', identifiability: 'direct' },
  { name: 'Sex life or sexual orientation', elementGroup: 'Special category', sensitivity: 'special', isSpecialCategory: true, specialCategoryType: 'sexual_orientation', identifiability: 'direct' },

  // ---- Article 10 ---------------------------------------------------------
  // Not an Art. 9 category, and the most common mistake in a hand-built register.
  { name: 'Criminal convictions and offences', elementGroup: 'Criminal data', sensitivity: 'special', isCriminalData: true, identifiability: 'direct' },
  { name: 'Criminal record check result', elementGroup: 'Criminal data', sensitivity: 'special', isCriminalData: true, identifiability: 'direct', example: 'DBS, Bundeszentralregister, bulletin n°3' },
];

export type SeedSubjectCategory = {
  name: string;
  isChild?: boolean;
  isVulnerable?: boolean;
  description?: string;
};

export const SEED_SUBJECT_CATEGORIES: SeedSubjectCategory[] = [
  { name: 'Employees' },
  { name: 'Former employees' },
  { name: 'Job applicants' },
  { name: 'Contractors and temporary staff' },
  { name: 'Customers' },
  { name: 'Prospective customers' },
  { name: 'Website visitors' },
  { name: 'Suppliers and vendor contacts' },
  { name: 'Shareholders and investors' },
  { name: 'Next of kin and emergency contacts', isVulnerable: true, description: 'Recorded about someone who has no relationship with the controller and no expectation of it.' },
  { name: 'Children', isChild: true, isVulnerable: true, description: 'Art. 8 and Recital 38. The age of consent for information-society services varies by Member State (13–16).' },
  { name: 'Patients', isVulnerable: true },
  { name: 'Students and learners' },
  { name: 'Members and subscribers' },
  { name: 'Claimants' },
  { name: 'Witnesses', isVulnerable: true },
  { name: 'Complainants' },
  { name: 'Beneficiaries and dependants', isVulnerable: true },
  { name: 'Visitors to premises' },
];

/**
 * The 32 onboarding templates seed `data_subject_categories` as slugs — `employees`,
 * `website_visitors`, `prospective_clients`. When those activities are opened and
 * their subject categories become editable rows, the slug has to resolve to a
 * catalogue entry or the customer sees "website_visitors" in their register forever.
 *
 * Anything not mapped here is title-cased and underscores become spaces, which is
 * the right answer for every slug the templates actually use and a reasonable one
 * for a slug from a CSV import.
 */
const SLUG_ALIASES: Record<string, string> = {
  users: 'Customers',
  clients: 'Customers',
  prospects: 'Prospective customers',
  prospective_clients: 'Prospective customers',
  candidates: 'Job applicants',
  applicants: 'Job applicants',
  third_parties: 'Suppliers and vendor contacts',
  suppliers: 'Suppliers and vendor contacts',
  visitors: 'Website visitors',
  staff: 'Employees',
  ex_employees: 'Former employees',
  minors: 'Children',
};

export function humaniseSubjectCategory(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  const slug = trimmed.toLowerCase().replace(/[\s-]+/g, '_');
  const alias = SLUG_ALIASES[slug];
  if (alias) return alias;
  // Already prose (it contains a space or an initial capital) — leave it alone
  // rather than mangling "Next of kin and emergency contacts" into "Next Of Kin".
  if (/[A-Z]/.test(trimmed) || trimmed.includes(' ')) return trimmed;
  const words = slug.split('_').filter(Boolean);
  if (words.length === 0) return trimmed;
  return words.join(' ').replace(/^./, (c) => c.toUpperCase());
}
