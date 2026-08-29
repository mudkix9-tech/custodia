/**
 * The curated core — Channel 4, Tier 4 (analyst), with VD-15 applied.
 *
 * **The unit of this table is the product a customer recognises; the unit of a
 * contract is the company.** Those are different, and conflating them is VD-15:
 * Google Cloud, Google Workspace and Google Analytics are three entries someone
 * would search for and one DPF registrant, one DPA and one set of SCCs. Asking
 * the Department of Commerce's participant list about "Google Analytics"
 * returns `not_found`, which the product renders as "never certified" for a
 * company that plainly is.
 *
 * So every row names a product, and `entity` names the legal person behind it
 * where that is a *different* row in this table. A row with no `entity` is its
 * own entity. That is the whole of the relationship; the registered company
 * name is **not** written here, because it is a fact about the world and this
 * file is a list of things to go and find out. `seed-catalogue.ts` resolves it
 * from the DPF register — a source with a URL and a fetch date — and leaves it
 * absent where the register has nothing to say.
 *
 * **What this file may and may not contain.** Names, domains and corporate
 * ownership are the analyst tier: a human decided this list, and the acquisitions
 * it encodes (Slack by Salesforce, GitHub by Microsoft, Mailchimp by Intuit,
 * Loom by Atlassian, NetSuite and Cerner by Oracle) are matters of public record
 * rather than derived facts. Everything a *score* reads — headquarters country,
 * transfer mechanisms, certifications, DPA availability — is deliberately absent
 * from this file. Those are sourced by probe or registry or not at all, which is
 * the entire argument of the sourcing programme: a value with no evidence behind
 * it is worse than no value, because the product renders it against a named
 * company's name.
 *
 * The domains are the *seed* for the probe, not an assertion. A domain that does
 * not resolve produces a vendor row with no probed fields and no provenance, and
 * that is a correct outcome rather than a failed one.
 */

export interface CatalogueSeedEntry {
  /** What a customer would type. */
  name: string;
  /** Stable key. Also the `vendors.slug`, so it must not change once seeded. */
  slug: string;
  /** Registrable domain to enumerate and probe from. Never itself evidence. */
  domain: string;
  category: string;
  /**
   * The slug of the legal entity behind this product, where that is another row
   * here. Absent means the product is its own entity.
   */
  entity?: string;
}

/**
 * Roughly 75 products across roughly 62 entities, and the two numbers are kept
 * apart on purpose — the superseded plan reported them as one, which is how a
 * target set silently double-counts Twilio three times.
 */
export const CATALOGUE_SEED: readonly CatalogueSeedEntry[] = [
  // --- entities that own other rows below ------------------------------------
  { name: 'Adobe', slug: 'adobe', domain: 'adobe.com', category: 'Content / Creative' },
  { name: 'Atlassian', slug: 'atlassian', domain: 'atlassian.com', category: 'Engineering' },
  { name: 'Google', slug: 'google', domain: 'google.com', category: 'Cloud / Infrastructure' },
  { name: 'Instructure', slug: 'instructure', domain: 'instructure.com', category: 'Education' },
  { name: 'Intuit', slug: 'intuit', domain: 'intuit.com', category: 'Finance' },
  { name: 'Microsoft', slug: 'microsoft', domain: 'microsoft.com', category: 'Cloud / Infrastructure' },
  { name: 'Oracle', slug: 'oracle', domain: 'oracle.com', category: 'Cloud / Infrastructure' },
  { name: 'Salesforce', slug: 'salesforce', domain: 'salesforce.com', category: 'CRM' },
  { name: 'Freshworks', slug: 'freshworks', domain: 'freshworks.com', category: 'Customer Support' },
  { name: 'Inside Real Estate', slug: 'inside-real-estate', domain: 'insiderealestate.com', category: 'Real Estate' },

  // --- products whose contract is signed with one of the above ---------------
  { name: 'Adobe Sign', slug: 'adobe-sign', domain: 'adobe.com', category: 'E-signature', entity: 'adobe' },
  { name: 'Magento', slug: 'magento', domain: 'business.adobe.com', category: 'E-commerce', entity: 'adobe' },
  { name: 'Loom', slug: 'loom', domain: 'loom.com', category: 'Collaboration', entity: 'atlassian' },
  { name: 'Google Analytics', slug: 'google-analytics', domain: 'analytics.google.com', category: 'Analytics', entity: 'google' },
  { name: 'Google Workspace', slug: 'google-workspace', domain: 'workspace.google.com', category: 'Productivity', entity: 'google' },
  { name: 'Canvas LMS', slug: 'canvas-lms', domain: 'instructure.com', category: 'Education', entity: 'instructure' },
  { name: 'Mailchimp', slug: 'mailchimp', domain: 'mailchimp.com', category: 'Marketing', entity: 'intuit' },
  { name: 'GitHub', slug: 'github', domain: 'github.com', category: 'Engineering', entity: 'microsoft' },
  { name: 'Microsoft Azure', slug: 'microsoft-azure', domain: 'azure.microsoft.com', category: 'Cloud / Infrastructure', entity: 'microsoft' },
  { name: 'NetSuite', slug: 'netsuite', domain: 'netsuite.com', category: 'ERP', entity: 'oracle' },
  { name: 'Cerner', slug: 'cerner', domain: 'oracle.com', category: 'Healthcare', entity: 'oracle' },
  { name: 'Slack', slug: 'slack', domain: 'slack.com', category: 'Collaboration', entity: 'salesforce' },
  { name: 'Tableau', slug: 'tableau', domain: 'tableau.com', category: 'Analytics', entity: 'salesforce' },
  { name: 'Freshdesk', slug: 'freshdesk', domain: 'freshworks.com', category: 'Customer Support', entity: 'freshworks' },
  { name: 'kvCORE', slug: 'kvcore', domain: 'insiderealestate.com', category: 'Real Estate', entity: 'inside-real-estate' },

  // --- entities with a single product, listed once ---------------------------
  { name: 'ActiveCampaign', slug: 'activecampaign', domain: 'activecampaign.com', category: 'Marketing' },
  { name: 'ADP', slug: 'adp', domain: 'adp.com', category: 'HR / Payroll' },
  { name: 'Amazon Web Services', slug: 'aws', domain: 'aws.amazon.com', category: 'Cloud / Infrastructure' },
  { name: 'Amplitude', slug: 'amplitude', domain: 'amplitude.com', category: 'Analytics' },
  { name: 'Asana', slug: 'asana', domain: 'asana.com', category: 'Project Management' },
  { name: 'athenahealth', slug: 'athenahealth', domain: 'athenahealth.com', category: 'Healthcare' },
  { name: 'BambooHR', slug: 'bamboohr', domain: 'bamboohr.com', category: 'HR / Payroll' },
  { name: 'Blackbaud', slug: 'blackbaud', domain: 'blackbaud.com', category: 'Non-profit' },
  { name: 'Blackboard', slug: 'blackboard', domain: 'blackboard.com', category: 'Education' },
  { name: 'BoomTown', slug: 'boomtown', domain: 'boomtownroi.com', category: 'Real Estate' },
  { name: 'Buildertrend', slug: 'buildertrend', domain: 'buildertrend.com', category: 'Construction' },
  { name: 'Canva', slug: 'canva', domain: 'canva.com', category: 'Content / Creative' },
  { name: 'Classy', slug: 'classy', domain: 'classy.org', category: 'Non-profit' },
  { name: 'ClickUp', slug: 'clickup', domain: 'clickup.com', category: 'Project Management' },
  { name: 'Cloudflare', slug: 'cloudflare', domain: 'cloudflare.com', category: 'Cloud / Infrastructure' },
  { name: 'Databricks', slug: 'databricks', domain: 'databricks.com', category: 'Data' },
  { name: 'Datadog', slug: 'datadog', domain: 'datadoghq.com', category: 'Observability' },
  { name: 'Deel', slug: 'deel', domain: 'deel.com', category: 'HR / Payroll' },
  { name: 'DigitalOcean', slug: 'digitalocean', domain: 'digitalocean.com', category: 'Cloud / Infrastructure' },
  { name: 'DocuSign', slug: 'docusign', domain: 'docusign.com', category: 'E-signature' },
  { name: 'Donorbox', slug: 'donorbox', domain: 'donorbox.org', category: 'Non-profit' },
  { name: 'Drata', slug: 'drata', domain: 'drata.com', category: 'Compliance' },
  { name: 'Dropbox', slug: 'dropbox', domain: 'dropbox.com', category: 'Storage' },
  { name: 'eClinicalWorks', slug: 'eclinicalworks', domain: 'eclinicalworks.com', category: 'Healthcare' },
  { name: 'Epic Systems', slug: 'epic-systems', domain: 'epic.com', category: 'Healthcare' },
  { name: 'Expensify', slug: 'expensify', domain: 'expensify.com', category: 'Finance' },
  { name: 'Fieldwire', slug: 'fieldwire', domain: 'fieldwire.com', category: 'Construction' },
  { name: 'Figma', slug: 'figma', domain: 'figma.com', category: 'Content / Creative' },
  { name: 'Filevine', slug: 'filevine', domain: 'filevine.com', category: 'Legal' },
  { name: 'Front', slug: 'front', domain: 'front.com', category: 'Customer Support' },
  { name: 'Gusto', slug: 'gusto', domain: 'gusto.com', category: 'HR / Payroll' },
  { name: 'Help Scout', slug: 'help-scout', domain: 'helpscout.com', category: 'Customer Support' },
  { name: 'HubSpot', slug: 'hubspot', domain: 'hubspot.com', category: 'CRM' },
  { name: 'Intercom', slug: 'intercom', domain: 'intercom.com', category: 'Customer Support' },
  { name: 'Klaviyo', slug: 'klaviyo', domain: 'klaviyo.com', category: 'Marketing' },
  { name: 'Linear', slug: 'linear', domain: 'linear.app', category: 'Project Management' },
  { name: 'LionDesk', slug: 'liondesk', domain: 'liondesk.com', category: 'Real Estate' },
  { name: 'Mixpanel', slug: 'mixpanel', domain: 'mixpanel.com', category: 'Analytics' },
  { name: 'Monday.com', slug: 'monday', domain: 'monday.com', category: 'Project Management' },
  { name: 'Moodle', slug: 'moodle', domain: 'moodle.org', category: 'Education' },
  { name: 'Notion', slug: 'notion', domain: 'notion.so', category: 'Productivity' },
  { name: 'Okta', slug: 'okta', domain: 'okta.com', category: 'Identity' },
  { name: 'OneTrust', slug: 'onetrust', domain: 'onetrust.com', category: 'Compliance' },
  { name: 'Plausible Analytics', slug: 'plausible', domain: 'plausible.io', category: 'Analytics' },
  { name: 'PostHog', slug: 'posthog', domain: 'posthog.com', category: 'Analytics' },
  { name: 'Redfin', slug: 'redfin', domain: 'redfin.com', category: 'Real Estate' },
  { name: 'Rippling', slug: 'rippling', domain: 'rippling.com', category: 'HR / Payroll' },
  { name: 'Sentry', slug: 'sentry', domain: 'sentry.io', category: 'Observability' },
  { name: 'SimplePractice', slug: 'simplepractice', domain: 'simplepractice.com', category: 'Healthcare' },
  { name: 'Smokeball', slug: 'smokeball', domain: 'smokeball.com', category: 'Legal' },
  { name: 'Stripe', slug: 'stripe', domain: 'stripe.com', category: 'Payments' },
  { name: 'Twilio', slug: 'twilio', domain: 'twilio.com', category: 'Communications' },
  { name: 'Vanta', slug: 'vanta', domain: 'vanta.com', category: 'Compliance' },
  { name: 'Vercel', slug: 'vercel', domain: 'vercel.com', category: 'Cloud / Infrastructure' },
  { name: 'Zendesk', slug: 'zendesk', domain: 'zendesk.com', category: 'Customer Support' },
  { name: 'Zoom', slug: 'zoom', domain: 'zoom.us', category: 'Communications' },
];

/** Distinct legal entities in the set — the number that is *not* 75. */
export function catalogueEntityCount(entries: readonly CatalogueSeedEntry[] = CATALOGUE_SEED): number {
  return new Set(entries.map((e) => e.entity ?? e.slug)).size;
}

/**
 * Every referential problem this table can have, as one list.
 *
 * Checked by `test:vendors` rather than by review, because the failure modes are
 * quiet: a typo'd `entity` seeds an orphan whose DPF lookup silently falls back
 * to the product name, and a duplicated slug makes the seed's upsert overwrite
 * one product with another.
 */
export function validateCatalogueSeed(
  entries: readonly CatalogueSeedEntry[] = CATALOGUE_SEED,
): string[] {
  const problems: string[] = [];
  const bySlug = new Map<string, CatalogueSeedEntry>();

  for (const entry of entries) {
    if (bySlug.has(entry.slug)) problems.push(`duplicate slug: ${entry.slug}`);
    bySlug.set(entry.slug, entry);
    if (!/^[a-z0-9][a-z0-9-]*$/.test(entry.slug)) problems.push(`slug is not url-safe: ${entry.slug}`);
    if (entry.domain !== entry.domain.trim().toLowerCase()) problems.push(`domain is not normalised: ${entry.domain}`);
    if (/^https?:\/\//.test(entry.domain)) problems.push(`domain carries a scheme: ${entry.domain}`);
    if (!entry.domain.includes('.')) problems.push(`domain has no dot: ${entry.domain}`);
  }

  for (const entry of entries) {
    if (!entry.entity) continue;
    if (entry.entity === entry.slug) problems.push(`${entry.slug} is its own parent`);
    const parent = bySlug.get(entry.entity);
    if (!parent) {
      problems.push(`${entry.slug} names a parent that is not in the table: ${entry.entity}`);
      continue;
    }
    // One level only. A chain would make "which entity signs this?" a walk, and
    // every caller would have to remember to do it.
    if (parent.entity) problems.push(`${entry.slug} -> ${entry.entity} -> ${parent.entity}: parent chains are not supported`);
  }

  return problems;
}
