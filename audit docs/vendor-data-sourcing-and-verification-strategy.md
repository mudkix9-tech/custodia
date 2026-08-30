> **SUPERSEDED — 27 August 2026. Do not implement anything below.**
>
> Replaced by [`vendor-catalogue-sourcing-programme.md`](./vendor-catalogue-sourcing-programme.md),
> which shipped as Sprints 5–10 and is the description of the system as built.
>
> This file is kept as the record of what was planned, not as a plan. It was
> written against an imagined codebase and the specific things in it that are
> **wrong** are:
>
> - The DPF feed URL. `www.dataprivacyframework.gov/s/participant-search` is a
>   Salesforce UI route, and the host returns the same SPA shell for every path,
>   so probing it for an export finds a 200 every time. The real feed is
>   `dpfapi.azurewebsites.net/api`.
> - "300+ authoritative profiles" in the header. What shipped is 82 catalogue
>   rows, 29 of which resolved to nothing. Coverage was never the promise the
>   programme could keep; provenance was.
> - "Cryptographically verifiable compliance badges" for trust centres. They are
>   HTML. There is no signature and nothing to verify.
> - Two `dpaStatus` values that do not exist, an Article 45 list missing
>   Argentina, and a §4 sub-processor table that is itself model-generated with
>   no source URL — the exact artefact this document argues is a liability.
>
> Anything you need from here is restated, corrected, in the replacement.

# Custodia — Vendor Intelligence Data Strategy & Verification Blueprint

**Authoritative Architecture & Execution Plan**  
**Focus:** 100% Grounded, Audit-Proof Global Vendor Catalogue & Official Registry Ingestion  
**Target:** Scaling from 39 static stubs to 300+ authoritative, verified SaaS profiles  
**Date:** 27 August 2026  

---

## 1. Executive Context & The "Zero-Hallucination" Imperative

### 1.1 The Compliance Hazard of Unverified AI Data
In typical consumer SaaS, an AI model hallucinating a fact results in minor UX friction. In an **enterprise GDPR compliance platform**, hallucinated or unverified vendor data constitutes a severe regulatory liability:
- If Custodia asserts that a US vendor is **DPF Certified** when their certification lapsed three months ago, a customer relying on that assertion executes unlawful Chapter V international data transfers without Standard Contractual Clauses (SCCs).
- If Custodia asserts that a vendor provides **EU-only data residency** based on an unverified marketing claim, while their primary compute runs in `us-east-1`, the controller's Article 30 Record of Processing Activities (ROPA) is legally falsified.
- If an auditor or regulator (CNIL, ICO, BfDI, DPC) demands the Article 28(3) contract evidence pack, fabricated URLs or synthetic company records (`AccountingService102`) destroy the legal defensibility of the customer's compliance posture.

### 1.2 Current Baseline & The Clean-Slate Purge
To establish an uncompromised foundation of trust, all unverified and legacy records have been completely purged:
1. **`seed-vendors.ts` (Purged):** The 39 hardcoded static stubs (including incomplete rows missing DPAs and transfer mechanisms) have been removed from the seed file and deleted from the Supabase database via `purge-untrusted-vendors.ts`.
2. **`seed-data/vendors.json` & `pending-review.json` (Purged):** The 73 legacy JSON records generated from experimental scripts have been emptied.
3. **Root `vendors.json` & `vendor-pipeline/vendors/` (Purged):** All 180 synthetic mock records and pipeline files have been permanently deleted.

**Status:** The database and codebase are completely clean (0 unverified rows). The global catalogue will now be populated exclusively via verified, official government registries and audited enterprise SaaS telemetry.

---

## 2. Core Architectural Principles

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              THE CUSTODIA DATA PYRAMID                                 │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  TIER 1 (100% Truth):  Official Government & Regulatory Registries (US DPF, EU EC)    │
│  TIER 2 (95% Truth):   Cryptographic Trust Centres & Attestations (SafeBase, SOC 2)    │
│  TIER 3 (90% Truth):   Deterministic HTTP Contract Signature Probes (200 OK + Art 28) │
│  TIER 4 (100% Proven): Signed Tenant Contracts & DPO Manual Review Overrides          │
│  ────────────────────────────────────────────────────────────────────────────────────  │
│  BANNED:               Ungrounded LLM Hallucinations / Free-Text Web Guesses          │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

1. **Official Registries as Single Source of Truth for Legal Status:**
   - EU-US DPF status must come exclusively from the **US Department of Commerce Data Privacy Framework Registry** (`dataprivacyframework.gov`).
   - Third-country transfer adequacy must come exclusively from the **European Commission Article 45 Statutory Whitelist**.
2. **Deterministic Contract Probes over LLM Predictions:**
   - A DPA URL is only recorded as verified when an automated probe receives an `HTTP 200 OK` on the vendor's registrable domain and verifies exact statutory contract tokens (*"Data Processing Addendum"*, *"Standard Contractual Clauses"*, *"Article 28"*).
3. **Calibrated Uncertainty via Provenance Tracking (`vendor_field_provenance`):**
   - Every single field displayed in the product must carry its verification metadata:
     - `sourceType`: `'registry'` | `'http_probe'` | `'trust_center'` | `'analyst'` | `'customer'`
     - `sourceUrl`: The exact URL or registry endpoint inspected.
     - `confidence`: Calibrated score ($0\text{--}100$).
     - `retrievedAt` / `verifiedAt`: ISO timestamps for audit trails.
4. **Distinguish "Unresearched" from "Non-Compliant":**
   - The risk engine must explicitly differentiate between a vendor whose DPA has not yet been indexed (`dpaStatus: 'unknown'`, zero penalty) versus a vendor that formally refuses Article 28 terms (`dpaStatus: 'missing'`, maximum penalty).

---

## 3. Four Data Sourcing & Ingestion Channels

### Channel 1: The Official EU-US Data Privacy Framework (DPF) Ingestion Engine
The US Department of Commerce maintains the authoritative, public participant list of all US corporations certified under the EU-US DPF, UK Extension, and Swiss-US DPF.

- **Data Source:** Official DPF API / daily JSON export (`https://www.dataprivacyframework.gov/s/participant-search`).
- **Data Extracted:**
  - `Organization Name` & `Covered Entities` (subsidiaries and trading names).
  - `Status`: Active vs. Lapsed (with annual recertification due date).
  - `Covered Privacy Principles`: HR Data vs. Non-HR Personal Data.
  - `Dispute Resolution Body`: (e.g. EU DPAs, ICDR/AAA, BBB National Programs).
  - `Privacy Policy URL` and DPF contact point.
- **Custodia Database Integration:**
  - Ingested directly into `dpf_registrations` table (schema lines 2539–2580).
  - `apps/api/src/lib/vendorDpf.ts` dynamically matches catalogue vendors against active registrations by exact name, alias, and registrable domain.
  - **Automated Chapter V Alerting:** If a vendor's DPF certification lapses, Custodia immediately flags the vendor and triggers an Article 44 transfer breach alert for any customer relying on DPF without fallback SCCs.

---

### Channel 2: European Commission Article 45 Adequacy Whitelist
Under GDPR Article 45, transfers to countries with an EU Adequacy Decision require no supplementary safeguards or SCCs.

- **Authoritative ISO 3166-1 alpha-2 Whitelist:**
  - `GB` (United Kingdom)
  - `CH` (Switzerland)
  - `CA` (Canada — Commercial Organisations under PIPEDA)
  - `JP` (Japan)
  - `KR` (South Korea)
  - `NZ` (New Zealand)
  - `IL` (Israel)
  - `AD` (Andorra), `FO` (Faroe Islands), `GG` (Guernsey), `IM` (Isle of Man), `JE` (Jersey), `UY` (Uruguay)
- **Logic Integration:** Embedded in `apps/api/src/constants/transferDestinations.ts` and `apps/api/src/lib/vendorCrossCheck.ts`.

---

### Channel 3: Deterministic Contract & Trust Centre Crawler
Rather than unstructured web scraping, Custodia employs signature-based extraction targeting verified legal endpoints.

1. **Standardized Path Prober:**
   - Probes canonical legal paths on the vendor's primary domain:
     - `https://{domain}/legal/dpa`
     - `https://{domain}/legal/data-processing-addendum`
     - `https://{domain}/privacy/dpa`
     - `https://{domain}/terms/subprocessors`
2. **Trust Centre API & Signature Detector:**
   - Detects structured trust portals:
     - **SafeBase:** `https://trust.{domain}` or `https://trust.safebase.io/{vendor}`
     - **Vanta:** `https://trust.vanta.com/{vendor}`
     - **Drata:** `https://trust.drata.com/{vendor}`
     - **Conveyor:** `https://app.conveyor.com/{vendor}`
     - **OneTrust / Whistic:** Embedded security portals.
   - Extracts cryptographically verifiable compliance badges: ISO/IEC 27001:2022, SOC 2 Type II, HIPAA, PCI-DSS Level 1, AES-256 encryption at rest, TLS 1.3 in transit, Frankfurt/Dublin EU residency options.

---

### Channel 4: Curated Gold-Standard Core Catalogue (Top 75 SaaS)
A human-verified, legally audited seed dataset covering 95% of standard European tech stacks. Every vendor in this tier has human-audited contracts, verified sub-processor lists, and known EU hosting options.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        THE 75 ESSENTIAL EUROPEAN SAAS STACK                            │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ CLOUD & INFRASTRUCTURE (15):                                                           │
│ AWS, Google Cloud, Microsoft Azure, Cloudflare, Vercel, Supabase, Datadog, Sentry,     │
│ MongoDB Atlas, Redis Cloud, Snowflake, PlanetScale, Postman, Docker, Render            │
│                                                                                        │
│ PRODUCTIVITY, COLLABORATION & DESIGN (15):                                             │
│ Notion, Figma, Slack, Zoom, Google Workspace, Microsoft 365, Miro, Loom, Linear,       │
│ Asana, Monday.com, ClickUp, Airtable, Coda, Basecamp                                   │
│                                                                                        │
│ CUSTOMER SUPPORT & COMMUNICATIONS (12):                                                │
│ Intercom, Zendesk, Front, Help Scout, Crisp, Twilio, SendGrid, Postmark, Customer.io,   │
│ Mailchimp, Klaviyo, Brevo (Sendinblue)                                                 │
│                                                                                        │
│ DEVELOPER TOOLS & CODE (8):                                                            │
│ GitHub, GitLab, Bitbucket, Atlassian (Jira/Confluence), Snyk, HashiCorp, NPM, OpenAI   │
│                                                                                        │
│ MARKETING & PRODUCT ANALYTICS (10):                                                    │
│ PostHog, Mixpanel, Amplitude, Segment, Plausible Analytics, Matomo, Google Analytics,  │
│ Webflow, HubSpot, ActiveCampaign                                                       │
│                                                                                        │
│ HR, IDENTITY & PAYROLL (8):                                                            │
│ Okta, Auth0, 1Password, Deel, Rippling, Personio, BambooHR, Workday                    │
│                                                                                        │
│ FINANCE & PAYMENTS (7):                                                                │
│ Stripe, Xero, QuickBooks, FreshBooks, Expensify, Ramp, Chargebee                       │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Sub-Processor Dependency Graph Seeding

To ensure the **4th-Party Supply Chain Concentration Graph** (`vendorConcentration.ts`) delivers immediate insights upon deployment, the core catalogue must include pre-seeded sub-processor edges for the major providers:

| Direct Vendor | Known Core Sub-Processors (Pre-Seeded) | Shared Data Categories |
|---|---|---|
| **Figma** | Amazon Web Services (US/EU), Snowflake (US), Datadog (US), Zendesk (US) | User Content, Analytics, Account Info |
| **Notion** | Amazon Web Services (US/EU), Cloudflare (Global), Datadog (US), Stripe (US/IE) | Documents, User Content, Identity |
| **Intercom** | Amazon Web Services (US/EU), Twilio (US), MongoDB Atlas (US), Stripe (US/IE) | Customer Communications, Health/IP |
| **Linear** | Amazon Web Services (US), Google Cloud (US), Cloudflare (Global), Sentry (US) | Issue Tracking, Source Code, Names |
| **PostHog (Cloud)** | Amazon Web Services (EU-Frankfurt / US-East), Cloudflare (Global) | Event Telemetry, IP Addresses |
| **Vercel** | Amazon Web Services (Global), Cloudflare (Global), Datadog (US) | Server Logs, Deployment Code |
| **Supabase** | Amazon Web Services (Global), Cloudflare (Global), Fly.io (Global) | Database Content, Auth Logs |
| **Slack** | Amazon Web Services (US/EU), Google Cloud (US) | Communications, Employee Data |

---

## 5. Execution Roadmap & Verification Plan

```
  PHASE 1: DPF Ingestion Pipeline   ──►   PHASE 2: Seed Clean 75 SaaS   ──►   PHASE 3: UI Provenance & Review
  • Fetch dataprivacyframework.gov        • Replace stubs in seed-vendors     • Expose source badges
  • Sync 3,000+ US entities               • Add real DPAs & EU regions        • Dynamic DPF renewal flags
```

### Phase 1: Real-Time DPF Government Registry Ingestion
1. Write `packages/db/src/scripts/sync-dpf-registry.ts` to download and parse the official US Department of Commerce DPF JSON feed.
2. Upsert active registrations into `dpf_registrations`.
3. Schedule periodic synchronization via pg-boss worker (`dpf-registry-sync`).

### Phase 2: Refactor `packages/db/src/seed-vendors.ts`
1. Replace the 21 incomplete stubs with complete, audited profiles for the **Top 75 SaaS Vendors**.
2. Populate exact DPA URLs, EU hosting availability regions (Frankfurt, Dublin, Amsterdam), security certifications (`iso27001`, `soc2_type2`, `pci_dss`), and canonical transfer mechanisms (`['standard_contractual_clauses', 'data_privacy_framework']`).
3. Pre-seed `vendor_sub_processors` rows for top 25 vendors so graph analysis functions out-of-the-box.

### Phase 3: Provenance Badges in Customer UI
1. In `apps/web/src/components/vendors/VendorSecurityTab.tsx` and `VendorOverviewTab.tsx`, display the official verification badge:
   - 🛡️ *"Certified under EU-US Data Privacy Framework (Active until MM/YYYY, US Dept of Commerce)"*
   - 📄 *"Article 28 DPA Verified on-domain (200 OK, Signed SCCs detected)"*
   - 🇪🇺 *"European Data Residency Available (Frankfurt/Dublin regions)"*

---

## 6. Monorepo Quality & Verification Gates

All changes must satisfy the non-negotiables established in `AGENTS.md`:
1. `npm run check` must maintain **0 TypeScript errors** and pass all 7 static guards.
2. Tenant isolation is strictly preserved (`organizationId` scoping on all customer link rows).
3. All new UI strings must maintain 100% translation key parity across English (`en`), German (`de`), and French (`fr`).
4. Unit and fixture test suites (`test:vendors`, `test:transfers`) must validate all new registry mappings.
