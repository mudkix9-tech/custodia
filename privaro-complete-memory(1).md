# Privaro — Complete Product Memory

> **Last updated:** July 19, 2026 (Updated Regulatory Change Impact Analysis, Catch-up patterns, Cost Dashboards, and schema recoveries)
> **Owner:** Nisarg (solo founder, Pune, India)
> **Domain:** getprivaro.com
> **Status:** Pre-launch, core product built, polishing for production

---

## 1. What Privaro Is

Privaro is a GDPR compliance operating system targeting EU businesses of all sizes, with agencies as the initial go-to-market vertical. It replaces spreadsheets, consultants, and 5+ separate compliance tools with one unified platform covering the full GDPR compliance lifecycle.

**Not agency-only.** 95% of the codebase is industry-agnostic. Only client trust portals and some ROPA templates are agency-specific. The product serves any EU business — e-commerce, SaaS, recruitment, healthcare, legal, consulting, etc. Marketing targets agencies first, then expands.

---

## 2. Business Decisions (Final)

### Pricing

| Tier | Price | Key limits |
|---|---|---|
| Free | €0 | Gap assessment only (lead magnet) |
| Starter | €39/mo | 20 activities, 30 vendors, 2 users |
| Professional | €89/mo | Unlimited activities/vendors, DSAR, breach, cookie consent (5 domains), training, 10 client dashboards |
| Business | €179/mo | Unlimited everything + API + audit file generator |
| Enterprise | Custom | SSO, multi-entity, custom roles, data residency, SIEM, dedicated support |

- Annual billing = 20% discount
- NO per-seat pricing (unlimited users on all tiers)
- Usage-based: cookie consent pageview overages at €5 per 100K beyond tier limit
- "Agency" tier renamed to "Business" for multi-industry positioning

### Payments

- **Paddle** as Merchant of Record (NOT Stripe)
- Paddle handles EU VAT collection, filing, invoicing
- Display name: product brand name (email sellers@paddle.com to change)
- Switch to Stripe Ireland when Irish entity is established at meaningful revenue

### Legal Entity

- Start as Indian sole proprietorship (free)
- Register Irish LTD at ~€5-10K MRR
- Irish corporate tax 12.5%
- Cost: ~€2.5-4K year-one including Section 137 bond

### Domain

- **getprivaro.com** (confirmed choice)
- Acquire privaro.com later when revenue justifies it

---

## 3. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 App Router, Tailwind, Radix UI, Zustand + TanStack Query, TanStack Table |
| Backend | Fastify + tRPC, Drizzle ORM, NextAuth.js v5 |
| Database | PostgreSQL 16 on AWS RDS eu-west-1 (Dublin), pgvector for RAG |
| Cache/Queue | Redis (ElastiCache), BullMQ |
| Storage | AWS S3 (eu-west-1), regional buckets for enterprise data residency |
| Email | Resend SDK + React Email templates |
| AI | Claude API (claude-sonnet-4-20250514), Vertex AI gemini-embedding-001 (3072 dimensions) for embeddings |
| Search | Meilisearch |
| CMP | Vanilla JS banner (<15KB), Puppeteer cookie scanner |
| SSO | WorkOS |
| Encryption | AES-256-GCM for OAuth tokens, MFA secrets |
| MFA | otplib (TOTP) + qrcode |
| Error tracking | Sentry EU region |
| Hosting | Vercel (frontend), AWS ECS Fargate (API + workers) |
| CDN/WAF | Cloudflare |
| PDF generation | Puppeteer via puppeteer-cluster browser pool |

---

## 4. Architecture & Schema

### Schema file
- Location: `packages/db/src/schema.ts`
- Regenerated and fixed during Phase 17/18 merge conflict
- Final corrected version at `/mnt/user-data/outputs/schema.ts`
- 30+ tables covering all 18 phases

### Key schema tables
- `organizations` — core tenant with Paddle billing, branding, SSO, SIEM, data residency, notification prefs
- `users` — auth, roles, custom roles, MFA, language, notification overrides
- `processing_activities` — ROPA with full Article 30 fields, completeness scoring
- `client_processing_activities` — many-to-many junction for client-activity linking
- `organization_vendors` — per-org vendor relationships with DPA tracking
- `vendor_sub_processors` — supports both linked (vendor DB reference) and unlinked (manual string) entries
- `transfer_impact_assessments` — 5-step TIA wizard with full Schrems II structure
- `dsar_requests` — with identity verification, extension, refusal, data package delivery
- `breaches` — 72-hour workflow with vendor-originated breach support
- `consent_records` — must be partitioned by month (raw SQL migration required)
- `audit_logs` — immutable (PostgreSQL trigger prevents UPDATE/DELETE)
- `compliance_gaps` — auto-detected by nightly scanner, 20+ detection rules
- `notification_queue` — centralized, all notifications flow through this
- `api_keys` — scoped permissions, IP whitelisting, expiry
- `webhooks` + `webhook_deliveries` — full retry logic with auto-disable
- `organization_integrations` — AES-256-GCM encrypted OAuth tokens
- `custom_roles` — granular per-module permission matrix for enterprise
- `document_embeddings` + `organization_embeddings` — pgvector RAG storage

---

## 5. Implementation Phases — All Complete

| Phase | Module | Status |
|---|---|---|
| 1 | ROPA Engine | ✅ |
| 2 | Gap Assessment & Billing | ✅ |
| 3 | Vendor Intelligence | ✅ |
| 4 | DSAR Automation | ✅ |
| 5 | Privacy Policies & Cookie Consent | ✅ |
| 6 | Breach Management | ✅ |
| 7 | Audit Readiness & Compliance Scoring | ✅ |
| 8 | Production Readiness & Client Portals | ✅ |
| 9 | AI Compliance Layer (RAG) | ✅ |
| 10 | Infrastructure & DevOps | ✅ |
| 11 | Audit Logging | ✅ |
| 12 | Sub-processors & TIA | ✅ |
| 13 | Client Trust Portals | ✅ |
| 14 | Employee Training (LMS) | ✅ |
| 15 | Notifications Queue & DSAR Comms | ✅ |
| 16 | Regulatory Updates Feed | ✅ |
| 17 | Public REST API & Webhooks | ✅ |
| 18 | CRM Integrations | ✅ |

---

## 6. Post-Phase Work — Complete

### Onboarding Wizard (Built, UX Reviewed & Polished)
- 6-step wizard: Org Profile → Add Tools → Create Activities (from templates) → Generate Policy → Invite Team → Summary
- Middleware redirects new users to /onboarding until completed or dismissed
- ROPA templates pre-built for marketing_agency industry, expandable to 15+ industries
- Dashboard shows "Complete setup" card until compliance score > 50%

#### Step 1 — Organization Profile (Reviewed)
- Fields: Organization Name (required), Website URL (optional, triggers background cookie scan), Industry (16 options + Other), Company Size, Country, DPO checkbox
- Country dropdown: searchable combobox, all ~200 countries, EU/EEA 31 grouped at top with divider, rest of world alphabetically below
- Company Size: added "1-4" tier for solo consultants/freelancers
- DPO checkbox: conditional reveal of DPO Name + DPO Email fields when checked, helper text referencing Article 37
- Website URL optional so businesses without one aren't blocked; if provided, background cookie scan runs during remaining steps

#### Step 2 — Add Tools (Reviewed)
- Three-tier tool grid: "Suggested for your industry" (6-8 curated per industry) → "Popular tools" (cross-industry universals: Google Workspace, Microsoft 365, Slack, Zoom, Stripe, QuickBooks, Notion, AWS, Dropbox, Zendesk) → "Show all tools" expandable toggle for full grid
- Deduplication: tools in suggested section filtered out of popular and expanded sections
- "Add custom tool" text input at bottom; custom tools stored as vendor records with `source: 'onboarding_manual'`
- Selection state: checkmark icon in card corner, blue border + bg-blue-50 highlight, entire card clickable
- Continue button shows "Continue with X tools" when X > 0
- Real SVG logos from official brand kits, extracted into separate `toolIcons.ts` map
- Search input within expanded "Show all tools" section
- Each industry must have curated suggestions mapped before launch; "Other" skips straight to popular tools

#### Step 3 — Create Activities (Reviewed)
- 11 ROPA templates for marketing_agency: original 5 + Employee HR Management, Payroll & Tax Processing, Candidate Recruitment & ATS, Client Invoicing & Billing, Event Registration & Hosting, Lead Generation & Web Forms
- New templates named industry-agnostic (no `marketing_` prefix) for reuse across industries
- Card padding tightened (p-5 → p-3.5), reduced gaps between cards
- Selection indicators changed from radio circles to checkboxes (multi-select affordance)
- Lawful basis badges formatted from snake_case to display titles (e.g., `legitimate_interests` → "Legitimate Interests")
- "Add custom activity" input at bottom; custom activities saved with `source: 'onboarding_manual'`, lawful basis defaults to legitimate_interests, flagged for review in dashboard
- Most common activities pre-selected by default; user deselects what doesn't apply
- Continue button shows "Create X activities" when X > 0

#### Step 4 — Generate Policy (Reviewed, Needs Fixes)
- Must wire actual `policyPreview` prop data into rendered sections (org name, vendors, processing activities, lawful bases) — current preview is hardcoded generic text
- Fix runtime error: `handleNext` called before declaration in fallback empty state
- Primary action flipped: "Save as draft and continue" is blue primary button; "Publish now" moved to secondary or deferred to policies module
- Add "Skip for now" option in main view (not just empty state)
- Increase preview max height (max-h-96 → max-h-[600px]) or add "View full policy" modal
- Remove Hosted Privacy Center callout from onboarding (premature; move to policies module)

#### Step 5 — Invite Team (Reviewed)
- Three roles in dropdown: Admin, Member, Viewer
- Each added invite row needs remove (X) button
- "Send invitations" button should send and auto-advance to step 6 (rename to "Send and continue" or auto-advance)
- Add "You're the workspace owner" line above invite fields for role context
- Pre-populate 2-3 empty invite rows when company size from step 1 is 26+ employees

#### Step 6 — Summary (Reviewed, Needs Fixes)
- Fix: green checkmarks should not appear next to "0 vendors" / "0 activities" — show "Skipped" or dash instead
- Fix: "1 team members invited" → handle singular/plural ("1 team member invited")
- Compliance score at 35% with progress bar and next steps list is strong
- Next steps bullets should be clickable deep links to the relevant module, not plain text
- Hide "Save and exit" from header on final step
- If website URL was provided in step 1 and cookie scan finished, surface result here (e.g., "We found 12 cookies on your website")

### Settings Pages (Built)
- 9 settings pages: Organization, Team, Notifications, Integrations, Developers, Billing, Security, Data & Privacy, Profile
- Role-based visibility per page
- MFA via otplib with QR code generation
- Active sessions management with revoke
- Data export worker (generates ZIP, uploads to S3, emails download link)
- Account deletion with 30-day grace period
- Granular notification preferences matrix

### Email Templates (Built)
- React Email package at `packages/emails`
- Shared Layout component with white-label support for DSAR emails
- 30+ templates across auth, assessment, DSAR, breach, vendor, compliance, training, billing categories
- Unified `sendEmail()` called from notification queue worker

### Marketing Site (Built, Redesigned)
- Dark theme (compliance/security aesthetic, similar to Vanta/Drata)
- Interactive tabbed dashboard mockup in hero (Console Overview, Cookie Scanner, ROPA Audit, DSAR Queue)
- On-page GDPR risk calculator with 4 questions, pre-fills assessment via URL params
- Supervisory authority alignment grid (IE DPC, CNIL, BfDI, etc.)
- Integration logo bar with real SVG logos
- 12-module feature grid
- Pricing section with Enterprise "Contact us" column
- All routes under `(marketing)/` route group
- Pages: homepage, features, pricing, for-agencies, cookie-consent, security, about, contact, compare/[competitor], legal/*, blog/*, gdpr/vendors/[slug], gdpr/countries/[slug], tools/cookie-checker, changelog

### Enterprise Features (Built)
- SSO via WorkOS (SAML/OIDC) with domain verification, enforce toggle
- SSO Wall pattern: locked by default, enabled per org on Enterprise upgrade
- Multi-entity management: parent/child orgs, group dashboard, org switcher, consolidated audit files
- Custom roles: granular per-module permission matrix, pre-built enterprise roles (DPO, Department Head, External Auditor)
- Data residency Level 2: dedicated RDS per enterprise customer, connection routing via `getDbForOrg()`, S3 regional buckets, data migration worker, provisioning via AWS SDK
- SIEM log streaming: JSON/CEF/syslog formatters, dispatched via notification queue from audit middleware
- Advanced reporting: Recharts analytics dashboard, executive PDF report, benchmarking, trend forecasting
- Tier gating middleware: `requireTier()` function gating features by subscription level

### Multi-language Support (Built)
- Framework: next-intl with `[locale]/` route prefix
- Launch languages: English, German, French
- Language selector in header/footer
- User language preference persisted in DB
- Cookie consent banner multi-language (auto-detect from navigator.language)
- Privacy policy generator multi-language templates
- Email templates accept locale prop
- PDF export/report labels translated
- Assessment questions with translations JSONB
- Training module per-language content support
- hreflang tags for SEO

---

## 7. Code Review Fixes — All Complete (22 Fixes)

### Critical infrastructure fixes (Fixes 1-7)
1. ✅ DSAR router connected in router.ts
2. ✅ Global audit logging middleware (writes to audit_logs on every mutation, with sanitization and diff calculation)
3. ✅ Notification queue worker (processes pending notifications, routes to email/Slack/in-app/webhook channels, retry with exponential backoff)
4. ✅ Compliance gap scanner worker (20 detection rules, runs nightly, auto-resolves fixed gaps, skips dismissed, severity auto-escalation)
5. ✅ Data export worker (queries all tables, fetches S3 documents, generates ZIP, emails download link)
6. ✅ Webhook dispatcher middleware (auto-dispatches on all mutations via TRPC_PATH_TO_EVENT mapping)
7. ✅ AI fallback fixed (mock only in development, throws + Sentry capture in production)

### Cross-module fixes (Fixes 8-12)
8. ✅ Special category data auto-flags requiresDpia and escalates riskLevel
9. ✅ Hardcoded EU_COUNTRIES replaced with `isAdequateDestination()` from `constants/transferDestinations.ts` (includes UK, Japan, Switzerland, etc.) — applied across ropa.ts, tia.ts, gapRules.ts, gapScanner.ts, vendors.ts
10. ✅ Compliance score calculation engine (8-pillar scoring, daily worker at 3am UTC, handles "no data" = 100%, stores in compliance_reports)
11. ✅ Full audit file export (PDF + CSV for every module: ROPA Article 30, vendor register, DSAR register, breach register, training report, consent analytics, compliance summary, DPIAs, policies, gap history, score history — uses Puppeteer browser pool)
12. ✅ Regulatory update impact assessment generation (runs on publish, matches impact_rules against each org's ROPA, generates per-org impact assessments)

### Performance fixes (Fixes 13-15)
13. ✅ Puppeteer browser pool via puppeteer-cluster (shared across PDF generation and cookie scanning)
14. ✅ Audit log export streams to S3 (no more 10K record memory load)
15. ✅ Pagination on all list endpoints using shared `paginatedQuery` utility with cursor-based pagination

### UX fixes (Fixes 16-22)
16. ✅ Skeleton loaders on every page (Skeleton component + per-page skeleton compositions)
17. ✅ Error boundaries on every route (Sentry capture + friendly error page)
18. ✅ Confirmation dialogs on all destructive actions (useConfirm hook + ConfirmDialogModal, including "type to confirm" for account deletion)
19. ✅ Optimistic updates on hot mutations (ROPA editor, vendor edits, breach tasks, notification mark-as-read, training progress, DSAR tasks)
20. ✅ Inline form validation with react-hook-form + @hookform/resolvers/zod + FieldError component
21. ✅ Accessibility pass (WAI-ARIA combobox pattern on CommandPalette, focus traps on modals, screen reader live regions, skip-to-content link, aria labels throughout)
22. ✅ Mobile DataGrid responsiveness (card layout on mobile, hamburger sidebar)

---

## 8. Key Technical Decisions & Patterns

### Shared BullMQ connection module
- All queues and workers import from `apps/api/src/lib/queue.ts`
- Single Redis connection config
- `createQueue()` and `createWorker()` factory functions

### Scheduled jobs registry (all in workers/index.ts)
- Gap scanner: daily at 2am UTC (`jobId: 'gap-scanner-daily'`)
- Compliance score: daily at 3am UTC (`jobId: 'compliance-score-daily'`)
- Notification enqueue: every 30 seconds
- DPA expiry checker: daily
- DSAR deadline monitor: every 30 minutes
- Breach deadline monitor: every 30 minutes
- Cookie scanner: per domain scan_frequency
- Policy ROPA sync: weekly
- Regulatory scraper: daily
- Data package expiry cleanup: weekly

### Token encryption
- AES-256-GCM (not CBC) for OAuth tokens and MFA secrets
- Encryption key in AWS Secrets Manager, not .env
- `encryptToken()` / `decryptToken()` in `apps/api/src/lib/encryption.ts`

### Database connection routing (enterprise data residency)
- `getDbForOrg(orgId)` returns the correct Drizzle instance
- Primary DB (Dublin) for shared data (orgs, users, global vendors, templates)
- Dedicated DB (customer's region) for org-specific data
- Injected via tRPC context: `ctx.db` for org data, `ctx.primaryDb` for global data
- Connection pool cache with 5-minute idle cleanup

### Audit log immutability
- PostgreSQL trigger prevents UPDATE/DELETE on audit_logs
- `REVOKE UPDATE, DELETE ON audit_logs FROM privaro_app`
- Middleware writes asynchronously via `setImmediate()` to not block mutations

### Consent records partitioning
- Monthly range partitioning on `created_at`
- BullMQ job auto-creates next month's partition on the 25th
- Old partitions detached after 24-month retention

### Consent log endpoint high throughput
- `POST /api/cmp/log` validates payload and pushes to Redis list (LPUSH)
- Batch worker reads from Redis every 5 seconds
- Bulk inserts into consent_records
- Rate limited: 100 req/s per scriptId

### RAG Vector Search, Advanced Retrieval & Versioning Infrastructure (Phase 3 - 7)
- **Flagship Model**: Google Vertex AI `gemini-embedding-001` with **3072-dimensional** vector embeddings. Reverted from `text-embedding-004` to eliminate zero-padding and preserve cosine similarity accuracy.
- **pgvector Indexing and Retrieval**: Vector indexes (ivfflat/hnsw) are dropped in favor of exact flat search to bypass pgvector's 2000-dimension indexing limit. Flat search achieves 100% accuracy and is extremely fast for our corpus sizes (<10k rows).
- **Global GDPR Corpus**: Exactly **5,928 vector chunks** (including the newly crawled **EDPB Guidelines 05/2020 on consent**) representing:
  * 99 GDPR Articles
  * 173 GDPR Recitals
  * 4,554 EDPB Guidelines/Recommendations chunks (including the newly added 90 chunks from the Guidelines 05/2020 on consent)
  * 4 EU Charter of Fundamental Rights documents
  * 72 ePrivacy Directive documents
  * 512 UK ICO Guidelines chunks (utilizes nested selector de-duplication)
  * 108 CNIL (France) translated guidelines chunks (cookie guidance, DPIA methodology, and AI guidelines translated from French to English on-the-fly)
  * 55 BfDI (Germany) translated guidelines chunks (employee data and technical measures translated from German to English on-the-fly, respecting HTML base-href page resolutions)
  * 244 DPC (Ireland) guidelines/decisions chunks (covering big tech enforcement decisions and data transfers)
  * 79 AP Netherlands translated guidelines chunks (cookie wall decisions and legitimate interest guidance translated from Dutch to English on-the-fly)
  * 8 AEPD Spain translated guidelines/tools chunks (covering Evalúa-Riesgo risk assessment tools and DPIA guides translated from Spanish to English on-the-fly)
  * 10 CJEU rulings chunks (covering landmark case decisions including Schrems I & II, Planet49 cookie consent, Fashion ID joint controllership, and Meta Platforms advertising lawful bases)
  * 5 EDPB enforcement fines chunks (covering record-setting administrative fines and Article 65 binding decisions for Meta €1.2B, Amazon €746M, Instagram €405M, Meta €390M, and WhatsApp €225M)
  * 5 GDPRhub decisions chunks (covering landmark DPA decisions curated by GDPRhub including Austrian DSB Google Analytics, French CNIL GA orders, Belgian APD TCF, Swedish IMY Spotify access fine, and Austrian DSB Facebook Tracking Pixel)
- **Advanced Retrieval & Reranking (Phase 3)**:
  * **Intent Classification**: Natural language queries are classified via fast rule-based regex patterns into `regulatory`, `guidance`, `organization_specific`, and `comparison` intents to avoid expensive API calls.
  * **Query Expansion**: Informal terms (e.g. `DSAR`, `DPO`, `cookies`, `transfers`) are expanded to regulatory counterparts to boost keyword relevance.
  * **Reranking Criteria**: similarity scores are adjusted by:
    - **Authority Weights**: GDPR regulations (1.0) > EDPB guidelines (0.9) > CJEU rulings (0.85) > national DPAs (0.75) > general commentaries/documents (0.7).
    - **Recency Decay**: Adjusts scores downwards by **1.5% per year of age** relative to 2026.
    - **Article Match**: Queries matching specific articles (e.g. `Article 6`) receive a **25% boost** on chunks containing the article in metadata.
    - **Category Coherence**: Dominant categories (out of top 3) penalize category outliers by **10%**.
    - **Source Diversity**: Chunks from the same document receive a **20% compound penalty** to prevent returning redundant results.
  * **Adjacent Chunk Retrieval**: Automatically fetches the neighboring chunks (`chunkIndex ± 1`) for the top 3 results to ensure Claude receives complete context.
  * **Context Window Budget**: Capped at **12,000 tokens** to prevent context pollution and context window overflow.
  * **Citation Formatting**: Robust multi-pass regex parsing resolves single indices (`[Source 1]`), ranges (`[Sources 1-3]`), commas (`[Source 1, 2]`), and `and` separators, turning them into clean clickable markdown links.
  * **Gated Insights**: Insights warnings (DPO status, vendor count, etc.) are tightly gated to the `organization_specific` intent.
- **Organization Context Embeddings (Phase 4)**:
  * **Entity Serialization**: Formats organization records into coherent natural-language sentences for all 7 entity types:
    - `processing_activity` (ROPA activities, data categories, and recipients)
    - `vendor` (linked/custom vendors, purpose, DPA status, risk scores, country)
    - `policy` (published markdown policy text)
    - `breach` (reference number, breach description, affected subjects, status, risk assessment)
    - `dsar` (reference, subject details, request type, messages, deadlines)
    - `gap` (gap titles, status, severity, scanned entities, GDPR articles)
    - `dpia` (title, status, descriptions, risks, mitigations)
  * **Manual Joins**: Serialization falls back to manual database left/inner joins to avoid Drizzle query builder relation inference issues.
  * **Background BullMQ Queue**: Implemented BullMQ worker and queue to process organization embedding upserts/deletions asynchronously in the background.
  * **Mutation triggers**: Automated hooks trigger embedding queue jobs on all modifications:
    - **ROPA**: `create`, `bulkCreate`, `update`, `delete`
    - **Vendors**: `linkVendor`, `updateOrgVendor`, `createCustom`
    - **Policies**: `publishVersion`
    - **Breaches**: `report`, `updateAssessment`, `updateStatus`, `close`
    - **DSAR**: `submitPublic`, `updateStatus`, `extendDeadline`, `refuse`, `close`
    - **DPIA**: `create`, `update`, and nested risk/measure creations, updates, or deletions.
    - **Gap Scanner**: `scanOrganization` on gap insertions, updates, and resolutions.
- **Contextual Copilot Integration (Phase 5)**:
  * **Unified Guidance Drawer**: A slide-out panel implemented globally, rendering contextual suggestions fetched on-demand when the panel expands and cached for the session.
  * **Per-Module Interactivity**:
    - **ROPA**: Direct "Help me fill this in" suggestions with clickable "Apply" buttons for data categories, lawful bases, and retention policies.
    - **Vendors**: Highlights Schrems II third-country transfers and calculates DPA sign-off risk metrics.
    - **Breaches**: Surfaces Article 33/34 notification checklists and details the 72-hour reporting countdown.
    - **DSAR**: Drafts template responses and outlines potential legal exemptions.
    - **Cookie Consent**: Analyzes Planet49 compliance.
    - **Compliance Scoring**: Maps gaps directly to one-click deep-link action items.
- **Multi-Language Corpus Support (Phase 6)**:
  * **Bilingual Scrapes**: Crawlers retain original-language French (`fr`) and German (`de`) chunks in the database alongside their English translations.
  * **Dual Semantic Search**: Searches execute dual embeddings: query translation to English via Vertex Gemini 2.5 Flash (with Claude fallback) for the English corpus, and matching original queries directly against the local-language corpus.
  * **Jurisdiction Boost**: Applied a **1.2x boost** to local DPA chunks when user's organization operates in that jurisdiction.
  * **Locale-Aware Cache Key**: Cache hashing includes the active `locale` string parameter to prevent cross-language cache mix-ups.
- **Corpus Maintenance & Versioning (Phase 7)**:
  * **Schema Version Tracking**: `document_embeddings` table tracks `is_current` and `superseded_by` references; `ai_guidance_logs` table logs `top_similarity` metrics.
  * **Archival Intent Handling**: Retrieval limits matches to active versions (`is_current = true`) by default. If the user query specifies archival intent, older guidelines are included but receive a **20% rerank score penalty**.
  * **Scraper Fallbacks**: Scheduled BullMQ scraper fallbacks crawl EDPB guideline list pages directly. Auto-detects reference numbers and updates superseded document statuses.
  * **RAG Quality Alerts**: Worker nightly logs similarity ratings. If >20% of user queries in a 7-day period yield similarity < 70%, a high-priority system alert is queued in `notificationQueue` for admins.
  * **Admin Dashboard & Override controls**: Settings page features interactive corpus graphs, RAG telemetry helpfulness scores, and a form allowing admins to manually toggle document currency or link superseding files.
- **RAG Schema Properties**:
  * **`authority` & `documentType`**: Replaced flat `sourceType` with dedicated fields for exact-match and category-boosted retrieval.
  * **`category`**: Each chunk is dynamically assigned to categories like `'consent'`, `'technology'`, `'transfers'`, `'assessment'`, `'security'`, `'employment'`, `'rights'`, `'enforcement'`, or `'general'`.
  * **`language`**: Standardized to ISO 639-1 language codes (e.g. `'en'`, `'de'`, `'fr'`, `'es'`, `'nl'`) instead of full-word strings across all scrapers, corpus files, and database entries.
  * **`articles`**: Compiled dynamically based on regex-extracted article mentions, with support for ranges (e.g. "Articles 44 to 49"), sequences/lists (e.g. "Articles 44, 45 and 46"), and auto-inclusion of Chapter V transfer articles when "Chapter V" is mentioned.
  * **`chunkIndex` & `totalChunks`**: Embedded within metadata to allow adjacent chunk retrieval.
- **Incremental & High-Concurrency Seeder**: The database seeder (`gdpr-corpus.ts`) uses SHA-256 content hashes to detect and skip unchanged entries in under 4 seconds. When full seeding is executed, it processes batches of 50 documents with a concurrency limit of 10 in parallel, reducing the total generation and seeding time from ~30 minutes to under 40 seconds.
- **EC Newsroom Redirection Scraper**: The crawler handles redirects for older WP29 documents (DPO, DPIA, consent, breach, etc.) hosted on the European Commission's Newsroom by parsing sibling HTML elements and downloading the English PDF binary streams.
- **DPA Scraping Mechanics (SSL & WAF Bypass)**: Scrapers target national DPAs with robust fallback mechanisms. Uses `node-fetch` and user-agent modifications to bypass Web Application Firewalls (e.g., Cloudflare on AP Netherlands and AEPD Spain) and configures `NODE_TLS_REJECT_UNAUTHORIZED = '0'` to crawl sites with incomplete certificate chains (e.g., DPC Ireland, AP Netherlands, and AEPD Spain).

---

## 9. Content Still Needed (Not Code)

| Content | Effort | Priority |
|---|---|---|
| 5 training module courses (full slides, scenarios, quizzes) | 3-4 days | Critical |
| 100+ vendor profiles with real data (DPA URLs, locations, certs) | 3-5 days | Critical |
| RAG corpus (GDPR articles + recitals + EDPB guidelines + EU Charter Articles 7/8 + ePrivacy Directive articles/recitals embedded into pgvector) | ✅ Complete | Critical |
| Legal pages (own privacy policy, terms, DPA, sub-processor list) | 1-2 days | Critical |
| Marketing site copy refinement | 1-2 days | Critical |
| 8 pillar SEO articles | 2 weeks | High |
| Help documentation | 3-4 days | Medium |
| ROPA templates for 10+ industries | 2-3 days | Medium |
| 30+ industry-specific vendors for seed data | 1 day | Medium |

### Vendor seeding approach (decided)
1. AI-assisted research to generate initial 100+ profiles (1 day)
2. Script to verify all DPA URLs and sub-processor list URLs return 200 (2 hours)
3. Manual fix for broken URLs (half day)
4. Manual verification of top 30 most common vendors (1 day)
5. "Report incorrect data" link on each vendor page for ongoing corrections

---

## 10. SEO Strategy

### Layer 1: Programmatic pages
- `/gdpr/vendors/[slug]` — vendor compliance pages (200+ from vendor database)
- `/gdpr/countries/[slug]` — 27 EU country pages
- `/gdpr/transfers/[country]` — 15-20 transfer destination pages

### Layer 2: Educational content
- 8 pillar pages (3,000-5,000 words each): GDPR guide, ROPA, DPA, DSAR, cookies, breach, DPIA, transfers
- 3-5 supporting articles per pillar (1,000-2,000 words)
- 5+ competitor comparison pages (vs iubenda, OneTrust, CookieYes, Usercentrics, Cookiebot)

### Layer 3: Free tools
- Cookie checker at `/tools/cookie-checker` (uses existing Puppeteer scanner)
- DPA template generator
- ROPA template download
- Free gap assessment (already built)

### Publishing cadence
- 2-3 articles/week for first 6 months
- Expected: 5K-15K monthly organic by month 12

### Technical SEO
- SSG for all marketing pages
- MDX blog with frontmatter
- XML sitemap via next-sitemap
- Schema markup (Article, FAQ, SoftwareApplication)
- hreflang for multi-language
- Plausible or PostHog for analytics (NOT Google Analytics — privacy product)

---

## 11. Distribution Strategy

### Primary channels (in order of ROI)
1. SEO content (highest ROI, slowest start)
2. Free gap assessment as viral tool
3. Agency communities and directories
4. Partnerships with adjacent tools (HubSpot marketplace, etc.)
5. LinkedIn outreach (value-first, not cold pitch)

### Paid channels (supplement, not primary)
- Niche newsletter sponsorships: $100-500/placement, 2 per month
- Privacy/compliance podcast sponsorships: $200-800/episode, 1 per month
- Budget: $600-1,400/month
- Expected: 1-3 new customers/month from sponsorships

### What NOT to do
- No fake review sites (catastrophic for trust on compliance product)
- No mass cold email (GDPR irony problem)
- No Google Analytics on own site (privacy product credibility)
- No Vercel Analytics (use privacy-focused alternative)

---

## 12. Competitors

### Tier 1 (Enterprise, not direct competitors)
- OneTrust ($10K+/yr), TrustArc ($1K+/mo), DataGrail, BigID, Securiti

### Tier 2 (Direct competitors)
- **iubenda** — closest competitor, 90K customers, $7-120/mo per site, strong policy generator, weak on ROPA/DSAR/vendors
- **CookieYes** — cookie consent only, $7-59/mo
- **Usercentrics** — CMP focused, €50-200/mo
- **Osano** — consent + basic vendor risk, ~$200/mo, US-focused
- **Enzuzo** — very basic, ~$5/mo
- **Termly** — policy generator + consent, from $15/mo

### Tier 3 (Biggest real competitor)
- Doing nothing + spreadsheets + €2-5K consultants

### Privaro's competitive advantages
1. Completeness (10+ modules vs point solutions)
2. Cross-module intelligence (ROPA feeds policies, vendors feed DSAR tasks, etc.)
3. Unlimited users on all plans (vs per-seat pricing)
4. Free gap assessment as acquisition engine
5. Agency-specific features (client trust portals) while serving all industries
6. EU-native, EU-hosted

---

## 13. Marketing Site Design (Current State)

### Design direction
- Dark theme (dark navy/slate background)
- Geist font for headings, Inter for body
- Glassmorphism cards with visible borders
- Light-themed dashboard mockup (bone/sage app UI) inside browser chrome on dark background for contrast

### Resolved design issues
- Overcorrected from "design agency template" to "cybersecurity startup" — pulled back to balanced professional
- Language simplified from developer jargon to business-owner friendly
- All 12 modules shown (was only showing 6)
- Real integration logos (not text with dots)

### Current issues being fixed
- Section padding too large (200-300px gaps → compress to 80px)
- Dashboard mockup needs to be fully visible in first viewport
- AWS logo orphaned on second row of integration bar
- Dashboard mockup has empty space in bottom third
- Tab bar missing from dashboard mockup

### Pages implemented
- Homepage (hero, dashboard mockup, risk calculator, features grid, integrations, DPA alignment, pricing, final CTA)
- Pricing page with annual/monthly toggle and Enterprise column
- Features page
- For Agencies page
- Security & Trust page
- Legal pages (privacy policy, terms, cookies, DPA, sub-processors)
- Blog layout with MDX support
- Competitor comparison template + 5 pages
- Vendor page template (programmatic)
- Country GDPR pages (programmatic)
- About, Contact, Changelog pages
- Enterprise landing page

---

## 14. SSO Implementation (Final Pattern)

### "SSO Wall" approach
- Microsoft Entra set to "Allow all tenants"
- SSO locked by default in Privaro
- Enabled per organization via `ssoEnabled` toggle in DB when they upgrade to Enterprise
- `ssoEnforced` flag controls whether SSO is optional or mandatory for the org
- Domain verification via DNS TXT record before enabling SSO for a domain
- Login flow: detect email domain → check if org has SSO → redirect to WorkOS → WorkOS redirects to IdP → auth completes

---

## 15. Multi-Industry Expansion (Minimal Code Changes)

### What needs to change for non-agency industries
1. Add ROPA templates for 10+ industries (content, not code)
2. Add industry options to onboarding dropdown (one-line code change)
3. Add `suggestedForIndustries` to vendor seed data
4. Filter onboarding vendor grid by selected industry
5. Rename "Client Portals" to "Trust Portals" in UI labels
6. Rename training modules 2 and 5 to be industry-neutral
7. Add industry condition to assessment questions via branching engine
8. Add 30+ industry-specific vendors to seed data

### Industries supported
Marketing agency, design agency, web development, e-commerce, SaaS/technology, recruitment, healthcare, legal, consulting, real estate, education, accounting, hospitality, construction, nonprofit, other (generic)

---

## 16. Remaining Work to Launch

### Code tasks
- [x] All 18 phases
- [x] Onboarding wizard
- [x] Settings pages
- [x] Email templates
- [x] Marketing site
- [x] All 22 code review fixes
- [x] Enterprise features (SSO, multi-entity, custom roles, data residency L2, SIEM, advanced reporting)
- [x] Multi-language support
- [x] Onboarding UX review and polish decisions (all 6 steps reviewed, fixes specified)
- [ ] Onboarding polish implementation (Step 1 country combobox, Step 2 three-tier grid + logos, Step 3 templates + card fixes, Step 4 wire real preview + fix runtime error, Step 5 minor polish, Step 6 conditional checkmarks + deep links)
- [ ] Marketing site visual polish (padding compression, mockup fixes)
- [ ] Free tools pages (cookie checker, DPA generator)
- [ ] Status page setup (Instatus or similar)
- [ ] Help documentation

### Content tasks
- [ ] 5 training module courses
- [ ] 100+ vendor profiles
- [x] RAG corpus seeding
- [ ] Legal pages (own privacy policy, terms, DPA, sub-processor list)
- [ ] Marketing copy refinement
- [ ] 8 pillar SEO articles
- [ ] ROPA templates for additional industries

### Infrastructure tasks
- [ ] AWS ECS Fargate deployment configured
- [ ] RDS Multi-AZ provisioned in eu-west-1
- [ ] ElastiCache Redis provisioned
- [ ] S3 buckets created (primary + regional for enterprise)
- [ ] Cloudflare DNS + WAF configured
- [ ] GitHub Actions CI/CD pipeline
- [ ] Database migration strategy (drizzle-kit generate, versioned migrations)
- [ ] Health check endpoint verified
- [ ] Secrets in AWS Secrets Manager

---

## 17. Vendor Risk Scoring Engine (Phase 1)

### Overview
Replaced the simplistic binary DPA/no-DPA status check with a comprehensive, multi-factor risk assessment model that calculates a 0-100 numerical risk score and assigns a risk level (Low, Medium, High, Critical) for every vendor linked to an organization.

### Scoring Factors and Weights (Out of 100)
1. **Headquarters Location (20%)**: EU/EEA (0 pts), Adequate Country (5 pts), Non-adequate Country (20 pts). Checks conditional US adequacy (DPF only).
2. **DPA Status (20%)**: Signed and active (0 pts), Expiring in <= 90 days (10 pts), Missing/Expired (20 pts).
3. **Data Categories Processed (15%)**: Processes Article 9 special categories (15 pts), Standard data (0 pts).
4. **Data Subject Volume (10%)**: <1K (0 pts), 1K-10K (3 pts), 10K-100K (6 pts), 100K+ (10 pts).
5. **Sub-processor Chain Depth (10%)**: 0-1 sub-processors (0 pts), 2-3 (5 pts), 4+ (10 pts).
6. **Security Certifications (10%)**: SOC 2 + ISO 27001 (0 pts), Any one cert (5 pts), None (10 pts).
7. **Transfer Safeguards (10%)**: EU/Adequate (0 pts), SCCs/BCRs documented (0 pts), No safeguards (10 pts).
8. **Breach History (5%)**: Decay score: <6 months (5 pts), 6-12 months (3 pts), 12-24 months (1 pt), older (0 pts).

### Architecture & Recalculation
- **Calculation Library**: Centralized in `apps/api/src/lib/vendorRisk.ts`, fully typed.
- **Triggers**: Recalculated dynamically on vendor linking, profile updates, and sub-processor adjustments.
- **Background Worker**: Daily BullMQ workers (`vendor-risk-recalculation` and `dpa-expiry-checker`) scan and recalculate scores to ensure expirations and breach history decay updates.
- **Automated Gaps**: Appended Article 9 (missing DPA for special category data) and Chapter V (unsecured third-country transfer) compliance gap rules.

---

## 18. DPA Clause Analysis & Monitoring (Phase 2)

### Overview
Extended DPA tracking beyond binary signed/unsigned status to audit the 8 mandatory GDPR Article 28(3) clauses. Includes an interactive checklist, sliding risk score penalty scale, stateful expiry and renewal date alerts, and automated compliance gaps.

### Clause Checklist & Key Mappings
1. **Documented Instructions** (`documentedInstructions` - Art. 28(3)(a))
2. **Personnel Confidentiality** (`confidentiality` - Art. 28(3)(b))
3. **Security Measures** (`securityMeasures` - Art. 28(3)(c))
4. **Sub-processor Restrictions** (`subProcessorRestrictions` - Art. 28(3)(d))
5. **Data Subject Rights Assistance** (`dataSubjectRights` - Art. 28(3)(e))
6. **Breach & DPIA Assistance** (`securityBreachDpia` - Art. 28(3)(f))
7. **Deletion or Return of Data** (`deletionOnTermination` - Art. 28(3)(g))
8. **Audits and Inspections** (`auditRights` - Art. 28(3)(h))

### Stateful Alerting & Deduplication
- **Checkers**: Scheduled daily workers check DPA Expiry and Contract Renewal dates at 90, 60, 30, and 7-day thresholds.
- **Deduplication**: Uses `lastExpiryNotificationTier` and `lastRenewalNotificationTier` in the database to log sent status. Only sends one alert per threshold; automatically resets if dates are extended.

### Compliance Gaps
- **Missing Sub-processor Clause (High Severity)**: Triggers if a signed DPA lacks the sub-processor restrictions clause.
- **Incomplete DPA (Medium Severity)**: Triggers if a signed DPA covers fewer than 6 out of 8 required clauses.

---

## 19. Sub-Processor Change Monitoring (Phase 3)

### Overview
Automated weekly change detection engine for tracking vendor sub-processor list updates. Minimizes false positives using whitespace normalization and regex boilerplate removal, providing users with unified line-level differences, email/in-app notifications, and custom webhook events.

### Scraper Worker & Clean-up Engine
- **Weekly Detector Job**: Runs on BullMQ, scraping up to 50 global vendor sub-processor URLs per run using `puppeteer-cluster`.
- **Boilerplate Noise Filtration**: Before hashing, filters headers, footers, scripts, styles, and cookie banners from the DOM. Then, cleans copyright notices, cookie policies, and generic footer link patterns line-by-line.
- **Fail-Safe Processing Order**: Hashes page content and compares it against global baselines. Fans out changes, notifications, and webhooks to all linked customer organizations *before* updating the global vendor hash to prevent crash state skips.

### Frontend Review & Diff Visualizer
- **Timeline UI**: Placed under the Sub-processors tab, showing all past changes chronologically with badges for review status (`pending_review`, `acknowledged`, `objected`).
- **Unified Line Diff**: Renders a clean list highlighting exactly which lines were added (green `+`) or removed (red `-`).
- **Objection Guidance**: Displays legal warnings to users when they choose to "Object" to a change, reminding them of DPA termination rights and links to Phase 2 clause assessments.

---

## 20. Key Principles Established

1. **Don't ship mock/simulated features.** If a scanner is supposed to scan, it scans with real Puppeteer. If an export is supposed to export, it writes a real ZIP to S3.
2. **Every list endpoint has cursor pagination.** Uses shared `paginatedQuery` utility.
3. **Every mutation writes to audit_logs.** Via global tRPC middleware.
4. **Every notification goes through the centralized queue.** No scattered direct email sends.
5. **Every webhook event has a mutation that triggers it.** Via global tRPC middleware with path-to-event mapping.
6. **The agent (Jules) should edit TypeScript files directly.** No Python regex patch scripts.
7. **Commit after every completed feature.** Never lose work to `git reset --hard` again.
8. **"TypeScript compiles" is not verification.** Test end-to-end: trigger mutation → check audit_logs → check email arrived → check webhook fired.
9. **Content is the product.** Empty training modules, empty vendor database, and an AI copilot with no knowledge base are dealbreakers.
10. **Don't build features for imaginary customers.** Enterprise features built but documented: sell when real enterprise customer asks with money.

---

## 21. Breach Intelligence (Phase 4)

### Overview
Automated third-party security incident tracking and alerting system. Monitors global feeds for data breaches, administrative fines, and security alerts involving third-party vendors, triggering immediate in-app and email warnings for organizations using affected services.

### Incident Tracking & Alerts
- **Database Schema**: Adds the `vendor_incidents` table storing incident dates, types, severity levels, affected data categories, administrative fines (e.g., GDPR enforcement fines), and source URLs.
- **Organization Alerts**: Implements `organization_vendor_incident_alerts` to map incidents to organizations using the vendor. Tracks unread notifications, acknowledgement audits (timestamp and user ID), and remediation notes.
- **Incident Feed UI**: Integrates a "Security Incidents" tab on the Vendor profile details view displaying chronological history, severity grades, and fine logs for each vendor.

---

## 22. AI-Powered Vendor Analysis (Phase 5)

### Overview
Integrates Claude 3.5 Sonnet (with Gemini 2.5 Flash fallback) to automate DPA clause auditing, draft tailored security questionnaires, and suggest GDPR-friendly alternative services.

### DPA Auto-Analysis
- **PDF Extraction**: Extracts text from uploaded DPA PDFs and processes them against the 8 mandatory GDPR Article 28 clauses.
- **Risk Detection**: Scans for liability caps, unilateral sub-processor assignment rights, and broad indemnification clauses, extracting exact quote segments from the source text.
- **Draft Reviews**: Saves AI analysis as a draft, allowing compliance officers to verify, edit, and lock clause checklists.

### Alternatives & Questionnaires
- **Alternative Recommendations**: Surfaces same-category privacy-focused alternatives (e.g., Plausible instead of Google Analytics) with lower risk scores.
- **Tailored Questionnaires**: AI writes custom security questions mapped to the vendor's headquarters location, sharing details, and lacking certifications.
- **AI Document Intake**: Enables external vendors to drag-and-drop security policies (SOC 2, ISO 27001) onto public questionnaire forms to auto-extract answers.

---

## 23. Vendor Discovery & Shadow IT Detection (Phase 6)

### Overview
Automated website and DNS monitoring service that discovers undocumented third-party sub-processors, analytics tools, trackers, and email services used by the organization. Integrates matching algorithms and a confidence verification queue to highlight blind spots and maintain an accurate vendor register.

### Scanner Engine & Collectors
- **Puppeteer Network Interceptor**: Orchestrates page loads and intercepting requests (scripts, iframes, pixels, styles). Filters out own-domain networks and standard CDN/font CDNs (e.g., Cloudflare, Google Fonts) to minimize noise.
- **DNS / Mail / SPF Scanners**: Resolves organization domain records to automatically discover email hosts (MX records), transaction email services (SPF patterns), and SaaS solutions routed through subdomains (CNAME lookups).
- **Matching & Normalization**: Strips common subdomains to match against known websites. Uses Levenshtein distance on root domains to fuzzy-match custom organization vendors, placing low-confidence discoveries in an approval queue.

### Inbox & Lifecycle Workflows
- **Discovery Inbox**: Displays discovered services categorized into Undocumented, Tracked, and Dismissed. Provides quick-action buttons to link to existing global registry vendors, create custom vendors, or ignore discoveries.
- **Auto-Discovered Vendor Banner**: Flags auto-created profiles with warnings prompting compliance teams to input headquarters, EU hosting, and cert data before locking the verified profile.
- **BullMQ Weekly Jobs**: Deterministically spreads organization scans across weekly windows (Sunday midnight) based on hash UUIDs to manage rate limits.

---

## 24. Vendor Assessment Questionnaires (Phase 7)

### Overview
Enterprise-grade questionnaire intake and evaluation module. Enables compliance officers to dispatch, track, and score security and privacy assessments sent directly to third-party vendors. Evaluates compliance gaps using AI agents and adjusts vendor risk scores.

### Intake Form & Public Security
- **Secure Link Intake**: Provides single-use, cryptographically secure URLs mapped to individual tokens (`/public/assessments/[token]`) for vendors to answer questions without authenticated registration.
- **Submission Locks**: Implements strict write-locks in both the database schema (via a custom PostgreSQL trigger) and the endpoint layers preventing resubmissions once status is marked `'completed'` or `'expired'`.
- **Expirations & Extensions**: Supports extension requests and displays read-only records once invitations expire.

### tRPC Procedures & AI Review
- **AI Evaluation Agent**: Integrates Claude 3.5 Sonnet (with Vertex Gemini-2.5-Flash and rules-based fallback) to analyze responses, detect compliance gaps, assign confidence ratings, and generate audit summaries.
- **Risk Score Adjustment**: Maps questionnaire results (0-100) directly to vendor risk level calculations as a bounded modifier (up to `-10` for verified security, and up to `+25` for severe gaps or expired responses).
- **Audit Logging & PDF Exports**: Creates Article 30 ROPA compliant provenance reports (`/print` route) detailing timestamps, respondent emails, client IPs, and question details.
- **BullMQ Reminders Sequence**: A daily cron worker tracks pending questionnaires, dispatching reminders via react-email templates at 7, 14, and 21 days, and marking unanswered assessments as expired at 30 days.

---

## 25. Regulatory Change Impact Analysis (Phase 8/RAG Extension)

### Overview
Semantic AI tracking system for mapping regulatory documents (e.g., EDPB Guidelines, DPAs) directly to an organization's specific processing activities, vendors, and risk scores using pgvector and RAG.

### Components
- **Semantic Matching**: Uses `pgvector` operators (`cosine_distance`) to match new regulatory update embeddings against pre-embedded organization contexts (ROPA activities, vendors).
- **Asynchronous Processing**: Scalable `BullMQ` dispatcher. Uses `match-org-semantic` for active orgs and a `match-catchup` mechanism hooked into NextAuth `signIn` to lazily process matches for dormant organizations without dropping notifications.
- **Claude Synthesis**: Uses Claude (via Anthropic API) to translate raw semantic matches into human-readable impact assessments explaining *why* the update affects the organization and suggesting remediation actions.
- **Cost Metrics**: A cost tracking dashboard under AI Copilot Settings (`settings/copilot/page.tsx`) tracks exact `prompt_tokens` and `completion_tokens` to surface Estimated USD Costs and Token Usage dynamically based on API pricing environment variables.
- **Schema Recovery & Integrity**: Reconstructed the lost Drizzle schema types (`0028_regulatory_update_matches.sql` and fixed index syncing in `meta/_journal.json` where redundant prefixes 0018/0019 were remapped to 0029/0030) ensuring type safety for `regulatory_update_matches` and avoiding any git reset regressions.

---

## 26. DPIA-to-Remediation Pipeline Automation

### Overview
Closes the loop on DPIAs by turning them from static documents into living risk assessments. Automatically feeds residual risks identified during a DPIA into the global compliance gaps system for active tracking and remediation.

### Components
- **Schema Enhancements**: Extended `dpias` to store structured `residualRisks` (JSONB) and `lastMitigationReminderSentAt`. Added `dpia_id`, `dpia_risk_id`, and `mitigation_due_date` to `compliance_gaps`.
- **Automated Gap Syncing**: A background worker/logic layer automatically maps high and medium DPIA residual risks into `compliance_gaps`, mapping severities appropriately.
- **Mitigation Reminders**: A cron worker (`dpia-mitigation-reminders`) scans for unresolved DPIA gaps approaching their due date and dispatches warning notifications.
- **Unified Dashboard Visibility**: DPIA risks now appear seamlessly alongside standard compliance gaps (e.g. missing DPAs, incomplete ROPAs), giving compliance officers a single pane of glass for all required remediation actions.
