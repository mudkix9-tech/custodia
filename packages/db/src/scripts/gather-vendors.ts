import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from the root .env
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

const configPath = path.resolve(__dirname, '../seed-data/gather-config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const vendorsPath = path.resolve(__dirname, '../seed-data/vendors.json');
const pendingPath = path.resolve(__dirname, '../seed-data/pending-review.json');

let existingVendors: any[] = [];
if (fs.existsSync(vendorsPath)) {
  try {
    existingVendors = JSON.parse(fs.readFileSync(vendorsPath, 'utf8'));
  } catch (e) {
    console.error('Failed to parse existing vendors.json, starting fresh', e);
  }
}

let pendingVendors: any[] = [];
if (fs.existsSync(pendingPath)) {
  try {
    pendingVendors = JSON.parse(fs.readFileSync(pendingPath, 'utf8'));
  } catch (e) {
    console.error('Failed to parse existing pending-review.json, starting fresh', e);
  }
}

// -------------------------------------------------------------------------
// Normalization Helpers
// -------------------------------------------------------------------------
function normalizeDomain(urlStr: string): string {
  if (!urlStr) return '';
  let clean = urlStr.toLowerCase();
  clean = clean.replace(/^(https?:\/\/)?(www\.)?/, '');
  clean = clean.split('/')[0] || '';
  return clean.trim();
}

function normalizeName(nameStr: string): string {
  if (!nameStr) return '';
  return nameStr.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
}

function isDuplicate(name: string, website: string): boolean {
  const normName = normalizeName(name);
  const normDomain = normalizeDomain(website);

  for (const v of existingVendors) {
    if (normalizeName(v.name) === normName) return true;
    if (v.website && normalizeDomain(v.website) === normDomain) return true;
    if (v.aliases && Array.isArray(v.aliases)) {
      for (const alias of v.aliases) {
        if (normalizeName(alias) === normName) return true;
      }
    }
  }
  for (const v of pendingVendors) {
    if (normalizeName(v.name) === normName) return true;
    if (v.website && normalizeDomain(v.website) === normDomain) return true;
  }
  return false;
}

// -------------------------------------------------------------------------
// Smart Domain Matching Check
// -------------------------------------------------------------------------
function verifyDomainAuth(url: string | null, vendorWebsite: string): boolean {
  if (!url) return true;
  const urlDomain = normalizeDomain(url);
  const vendorDomain = normalizeDomain(vendorWebsite);

  if (urlDomain === vendorDomain) return true;
  if (urlDomain.endsWith('.' + vendorDomain)) return true;

  // Check trust platforms allowlist
  for (const platform of config.trustPlatforms) {
    if (urlDomain === platform || urlDomain.endsWith('.' + platform)) {
      return true;
    }
  }

  // Check parent companies mapping
  const parentDomain = config.parentCompanies[vendorDomain];
  if (parentDomain) {
    if (urlDomain === parentDomain || urlDomain.endsWith('.' + parentDomain)) {
      return true;
    }
  }

  return false;
}

// -------------------------------------------------------------------------
// Multi-Signal HTTP Prober
// -------------------------------------------------------------------------
interface VerificationResult {
  status: 'verified_probed_success' | 'partially_probed' | 'failed_gated' | 'failed_probed';
  resolvedUrl: string | null;
}

export function evaluateContentSignals(text: string, type: 'dpa' | 'privacy' | 'subprocessors'): VerificationResult['status'] {
  const normalizedBody = text.replace(/\s+/g, ' ').toLowerCase();

  // Check if content reveals a login screen
  if (normalizedBody.includes('enter your username') || (normalizedBody.includes('password') && normalizedBody.includes('log in'))) {
    return 'failed_gated';
  }

  if (type === 'dpa') {
    const groupA = /data[\s\-_]processing[\s\-_]agreement|data[\s\-_]processing[\s\-_]addendum|data[\s\-_]protection[\s\-_]agreement|dpa/i.test(normalizedBody);
    const groupB = /controller|processor|standard[\s\-_]contractual[\s\-_]clauses|scc/i.test(normalizedBody);
    const groupC = /sign|execute|parties|signature|execution|duly[\s\-_]authorised/i.test(normalizedBody);

    if (groupA && groupB && groupC) {
      return 'verified_probed_success';
    } else {
      return 'partially_probed';
    }
  } else if (type === 'subprocessors') {
    const groupA = /subprocessor|sub[\s\-_]processor|third[\s\-_]party[\s\-_]list/i.test(normalizedBody);
    const groupB = /location|purpose|entity|hosting/i.test(normalizedBody);

    if (groupA && groupB) {
      return 'verified_probed_success';
    } else {
      return 'partially_probed';
    }
  } else {
    const hasPrivacy = /privacy[\s\-_]policy|privacy[\s\-_]statement|privacy[\s\-_]notice/i.test(normalizedBody);
    if (hasPrivacy) {
      return 'verified_probed_success';
    } else {
      return 'partially_probed';
    }
  }
}

export async function verifyComplianceUrl(
  url: string | null,
  type: 'dpa' | 'privacy' | 'subprocessors',
  vendorWebsite: string
): Promise<VerificationResult> {
  if (!url) {
    return { status: 'failed_probed', resolvedUrl: null };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 seconds to allow for streaming

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml,application/pdf;q=0.9,*/*;q=0.8'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return { status: 'failed_probed', resolvedUrl: url };
    }

    const resolvedUrl = response.url || url;
    const lowerUrl = resolvedUrl.toLowerCase();

    // Check for gated login walls/sales redirects on the URL itself
    const isGated = /login|signin|sign-in|register|oauth|portal|gate|contact-sales|contact\/sales|request-demo/i.test(lowerUrl);
    if (isGated) {
      return { status: 'failed_gated', resolvedUrl };
    }

    // Stream download with 10MB cap
    const chunks: Buffer[] = [];
    let totalLength = 0;
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB

    if (response.body) {
      for await (const chunk of response.body as any) {
        const buf = Buffer.from(chunk);
        chunks.push(buf);
        totalLength += buf.length;
        if (totalLength > MAX_SIZE) {
          console.warn(`[Prober] Aborted: File exceeds 10MB (${resolvedUrl})`);
          return { status: 'partially_probed', resolvedUrl }; // Oversized
        }
      }
    }

    const buffer = Buffer.concat(chunks);
    const contentType = response.headers.get('content-type') || '';
    let bodyText = '';

    // Process PDF content
    if (contentType.includes('application/pdf') || lowerUrl.endsWith('.pdf')) {
      try {
        const pdfData = await pdfParse(buffer);
        bodyText = pdfData.text || '';

        // Handle scanned/image-only PDFs
        if (bodyText.replace(/\s+/g, '').length < 100) {
          console.warn(`[Prober] Scanned/Empty PDF detected (Length: ${bodyText.length}) for ${resolvedUrl}`);
          return { status: 'partially_probed', resolvedUrl };
        }
      } catch (e: any) {
        console.warn(`[Prober] Failed to parse PDF ${resolvedUrl}: ${e.message}`);
        return { status: 'partially_probed', resolvedUrl };
      }
    } else {
      // Process standard HTML content
      bodyText = buffer.toString('utf8');
    }

    const finalStatus = evaluateContentSignals(bodyText, type);
    return { status: finalStatus, resolvedUrl };

  } catch (err: any) {
    console.warn(`Prober warning for ${url}: ${err.message}`);
    return { status: 'failed_probed', resolvedUrl: url };
  }
}

// -------------------------------------------------------------------------
// Target List by 16 Verticals
// -------------------------------------------------------------------------
const TARGETS = [
  // 1. Healthcare
  { name: "Epic Systems", website: "https://www.epic.com", category: "healthcare" },
  { name: "Athenahealth", website: "https://www.athenahealth.com", category: "healthcare" },
  { name: "Cerner", website: "https://www.oracle.com/health", category: "healthcare" },
  { name: "eClinicalWorks", website: "https://www.eclinicalworks.com", category: "healthcare" },
  { name: "SimplePractice", website: "https://www.simplepractice.com", category: "healthcare" },

  // 2. Legal
  { name: "Smokeball", website: "https://www.smokeball.com", category: "legal" },
  { name: "Filevine", website: "https://www.filevine.com", category: "legal" },
  { name: "DocuSign", website: "https://www.docusign.com", category: "legal" },
  { name: "Adobe Sign", website: "https://www.adobe.com/sign", category: "legal" },

  // 3. Real Estate
  { name: "LionDesk", website: "https://www.liondesk.com", category: "real_estate" },
  { name: "BoomTown", website: "https://www.boomtownroi.com", category: "real_estate" },
  { name: "kvCORE", website: "https://www.insiderealestate.com", category: "real_estate" },
  { name: "Redfin", website: "https://www.redfin.com", category: "real_estate" },

  // 4. Recruitment & HR
  { name: "Gusto", website: "https://www.gusto.com", category: "recruitment" },
  { name: "BambooHR", website: "https://www.bamboohr.com", category: "recruitment" },
  { name: "Rippling", website: "https://www.rippling.com", category: "recruitment" },
  { name: "Deel", website: "https://www.deel.com", category: "recruitment" },
  { name: "ADP", website: "https://www.adp.com", category: "recruitment" },

  // 5. Construction
  { name: "Buildertrend", website: "https://www.buildertrend.com", category: "construction" },
  { name: "Fieldwire", website: "https://www.fieldwire.com", category: "construction" },

  // 6. Finance & Accounting
  { name: "NetSuite", website: "https://www.netsuite.com", category: "finance" },
  { name: "Expensify", website: "https://www.expensify.com", category: "finance" },

  // 7. Marketing & CRM
  { name: "ActiveCampaign", website: "https://www.activecampaign.com", category: "marketing" },
  { name: "Klaviyo", website: "https://www.klaviyo.com", category: "marketing" },
  { name: "SendGrid", website: "https://www.sendgrid.com", category: "marketing" },
  { name: "Salesforce", website: "https://www.salesforce.com", category: "marketing" },

  // 8. Customer Support
  { name: "Zendesk", website: "https://www.zendesk.com", category: "software" },
  { name: "Freshdesk", website: "https://www.freshworks.com/freshdesk", category: "software" },
  { name: "Intercom", website: "https://www.intercom.com", category: "software" },
  { name: "Help Scout", website: "https://www.helpscout.com", category: "software" },
  { name: "Front", website: "https://www.front.com", category: "software" },

  // 9. Collaboration & Productivity
  { name: "Monday.com", website: "https://www.monday.com", category: "productivity" },
  { name: "ClickUp", website: "https://www.clickup.com", category: "productivity" },
  { name: "Zoom", website: "https://www.zoom.us", category: "productivity" },

  // 10. E-commerce
  { name: "Magento", website: "https://business.adobe.com/products/magento/magento-commerce.html", category: "ecommerce" },

  // 11. IT & Infrastructure
  { name: "Microsoft Azure", website: "https://azure.microsoft.com", category: "software" },
  { name: "Cloudflare", website: "https://www.cloudflare.com", category: "software" },
  { name: "DigitalOcean", website: "https://www.digitalocean.com", category: "software" },

  // 12. Security & Identity
  { name: "Vanta", website: "https://www.vanta.com", category: "software" },
  { name: "Drata", website: "https://www.drata.com", category: "software" },
  { name: "OneTrust", website: "https://www.onetrust.com", category: "software" },
  { name: "Okta", website: "https://www.okta.com", category: "software" },

  // 13. EdTech
  { name: "Canvas LMS", website: "https://www.instructure.com/canvas", category: "generic" },
  { name: "Blackboard", website: "https://www.blackboard.com", category: "generic" },
  { name: "Moodle", website: "https://www.moodle.org", category: "generic" },

  // 14. Non-Profit
  { name: "Donorbox", website: "https://www.donorbox.org", category: "generic" },
  { name: "Classy", website: "https://www.classy.org", category: "generic" },
  { name: "Blackbaud", website: "https://www.blackbaud.com", category: "generic" },

  // 15. Analytics & BI
  { name: "Mixpanel", website: "https://www.mixpanel.com", category: "generic" },
  { name: "Amplitude", website: "https://www.amplitude.com", category: "generic" },
  { name: "Tableau", website: "https://www.tableau.com", category: "generic" },

  // 16. Media & Design
  { name: "Canva", website: "https://www.canva.com", category: "generic" },
  { name: "Figma", website: "https://www.figma.com", category: "generic" },
  { name: "Adobe", website: "https://www.adobe.com", category: "generic" },
  { name: "Loom", website: "https://www.loom.com", category: "generic" }
];

// -------------------------------------------------------------------------
// Main Execution
// -------------------------------------------------------------------------
async function run() {
  console.log('🤖 Starting Grounded & Verified Vendor Data Gathering...');

  // Initialize AI Client
  const ai = new GoogleGenAI({
    vertexai: true,
    project: (process.env.GCP_PROJECT_ID || 'custodia') as string,
    location: (process.env.GCP_LOCATION || 'us-central1') as string,
  });

  const isTestMode = process.argv.includes('--test');
  const targetBatch = isTestMode ? TARGETS.slice(0, 3) : TARGETS;

  console.log(`Processing ${targetBatch.length} vendors...`);

  // Create a backup of vendors.json
  if (fs.existsSync(vendorsPath)) {
    fs.copyFileSync(vendorsPath, vendorsPath + '.bak');
    console.log('📦 Created backup of vendors.json to vendors.json.bak');
  }

  for (let i = 0; i < targetBatch.length; i++) {
    const target = targetBatch[i];
    if (!target) continue;
    console.log(`\n--------------------------------------------------`);
    console.log(`[${i + 1}/${targetBatch.length}] Investigating ${target.name}...`);

    if (isDuplicate(target.name, target.website)) {
      console.log(`⏭️ ${target.name} already exists. Skipping.`);
      continue;
    }

    const prompt = `You are a GDPR compliance researcher. We need verified data for "${target.name}" (${target.website}).
Use Google Search to locate the official URLs for their:
- Privacy Policy
- Data Processing Agreement (DPA)
- Subprocessor list
Find their headquarters country, data hosting regions, security certifications, and transfer mechanisms.

CRITICAL DIRECTIVES:
1. Only return URLs that are explicitly mentioned in the search results.
2. If you cannot find a valid URL in the search results for a specific legal/DPA/subprocessor document, set the corresponding field to null.
3. NEVER guess, speculate, or try to construct URLs based on common patterns (like domain/privacy or domain/dpa).

Format the output strictly as a single JSON object (enclosed in { and }). Fill with null if not found.
{
  "isGlobal": true,
  "name": "${target.name}",
  "slug": "${normalizeName(target.name)}",
  "website": "${target.website}",
  "logoUrl": null,
  "description": "Short description.",
  "category": "${target.category}",
  "headquartersCountry": "2-letter ISO code",
  "dataProcessingLocations": ["country codes"],
  "dpaUrl": "URL or null",
  "dpaAvailable": true,
  "privacyPolicyUrl": "URL or null",
  "transferMechanisms": ["scc", "dpf"],
  "euHostingAvailable": true,
  "securityCertifications": ["soc2", "iso27001"],
  "subProcessorListUrl": "URL or null",
  "aliases": [],
  "typicalDataCategories": ["name", "email"],
  "suggestedForIndustries": ["${target.category}"]
}`;

    try {
      console.log(`🔍 Querying Gemini with Search Grounding...`);
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }]
        }
      });

      const textResponse = response.text?.trim() || '';
      const startIdx = textResponse.indexOf('{');
      const endIdx = textResponse.lastIndexOf('}');
      if (startIdx === -1 || endIdx === -1) {
        throw new Error('No JSON object found in Gemini response: ' + textResponse);
      }
      const cleanJsonStr = textResponse.substring(startIdx, endIdx + 1);
      const extractedData = JSON.parse(cleanJsonStr);

      // Clean LLM whitespace formatting glitches from extracted URLs
      if (typeof extractedData.dpaUrl === 'string') {
        extractedData.dpaUrl = extractedData.dpaUrl.replace(/\s+/g, '');
      }
      if (typeof extractedData.privacyPolicyUrl === 'string') {
        extractedData.privacyPolicyUrl = extractedData.privacyPolicyUrl.replace(/\s+/g, '');
      }
      if (typeof extractedData.subProcessorListUrl === 'string') {
        extractedData.subProcessorListUrl = extractedData.subProcessorListUrl.replace(/\s+/g, '');
      }

      console.log('✅ Extraction complete. Running HTTP Prober verification...');

      // Run physical link verification checks
      const dpaCheck = await verifyComplianceUrl(extractedData.dpaUrl, 'dpa', target.website);
      const privacyCheck = await verifyComplianceUrl(extractedData.privacyPolicyUrl, 'privacy', target.website);
      const subprocessorCheck = await verifyComplianceUrl(extractedData.subProcessorListUrl, 'subprocessors', target.website);

      // Verify domain authority (smart matching check)
      const dpaDomainOk = verifyDomainAuth(extractedData.dpaUrl, target.website);
      const privacyDomainOk = verifyDomainAuth(extractedData.privacyPolicyUrl, target.website);
      const subDomainOk = verifyDomainAuth(extractedData.subProcessorListUrl, target.website);

      const dpaOk = dpaCheck.status === 'verified_probed_success' && dpaDomainOk;
      const privacyOk = privacyCheck.status === 'verified_probed_success' && privacyDomainOk;

      // Compile verification and domain authenticity flags
      const isHighConfidence = dpaOk && privacyOk;

      const provenance = {
        source: 'automated_rag_search',
        generatedAt: new Date().toISOString(),
        verificationStatus: isHighConfidence ? 'verified_probed_success' : 'partially_probed',
        verifiedUrls: {
          dpaUrl: dpaCheck.status,
          privacyPolicyUrl: privacyCheck.status,
          subProcessorListUrl: subprocessorCheck.status
        },
        domainVerification: {
          dpaUrl: dpaDomainOk,
          privacyPolicyUrl: privacyDomainOk,
          subProcessorListUrl: subDomainOk
        }
      };

      const finalRecord = {
        ...extractedData,
        dpaUrl: dpaCheck.resolvedUrl || extractedData.dpaUrl,
        privacyPolicyUrl: privacyCheck.resolvedUrl || extractedData.privacyPolicyUrl,
        subProcessorListUrl: subprocessorCheck.resolvedUrl || extractedData.subProcessorListUrl,
        provenance
      };

      if (isHighConfidence) {
        console.log(`🎉 High Confidence match for ${target.name}. Appending to vendors.json.`);
        existingVendors.push(finalRecord);
        fs.writeFileSync(vendorsPath, JSON.stringify(existingVendors, null, 2), 'utf8');
      } else {
        console.warn(`⚠️ Lower Confidence / Suspect Domains for ${target.name}. Appending to pending-review.json.`);
        if (!isHighConfidence) {
          if (!dpaDomainOk || !privacyDomainOk || !subDomainOk) {
            console.warn(`   Reason: Unrecognized domain encountered in resolved URLs.`);
          }
          if (dpaCheck.status !== 'verified_probed_success') {
            console.warn(`   DPA Prober status: ${dpaCheck.status}`);
          }
          if (privacyCheck.status !== 'verified_probed_success') {
            console.warn(`   Privacy Prober status: ${privacyCheck.status}`);
          }
        }
        pendingVendors.push(finalRecord);
        fs.writeFileSync(pendingPath, JSON.stringify(pendingVendors, null, 2), 'utf8');
      }

    } catch (err: any) {
      console.error(`❌ Error gathering data for ${target.name}: ${err.message}`);
    }

    // Rate-limiting pause
    if (i < targetBatch.length - 1) {
      console.log('Sleeping for 3 seconds...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  console.log('\n🏁 Seeding Gather Process Complete!');
}

run().catch(console.error);
