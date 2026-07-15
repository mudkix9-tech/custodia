# Privaro — Complete Product Memory

> **Last updated:** July 13, 2026
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

---

## 9. Content Still Needed (Not Code)

| Content | Effort | Priority |
|---|---|---|
| 5 training module courses (full slides, scenarios, quizzes) | 3-4 days | Critical |
| 100+ vendor profiles with real data (DPA URLs, locations, certs) | 3-5 days | Critical |
| RAG corpus (GDPR articles + EDPB guidelines embedded into pgvector) | ✅ Complete | Critical |
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

### Estimated time to launch: 3-5 weeks
- Content creation: 2-3 weeks
- Visual polish + free tools: 1 week
- Infrastructure setup + deployment: 1 week
- Testing and bug fixes: overlapping

---

## 17. Key Principles Established

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
