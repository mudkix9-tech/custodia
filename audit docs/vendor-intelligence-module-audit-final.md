# Custodia — Vendor Intelligence Module

**Consolidated audit · verified defect register · regulatory gap analysis · build order**

Supersedes `vendor-intelligence-audit1.md`, `vendor-intelligence-assessment2.md` and
`vendor-intelligence-audit3.md`. Where those three disagreed, this document states which one was
right and why — the adjudications are recorded in Appendix A. Six of the source audits' claims were
wrong on re-reading and are corrected here; two of the three missed the single most important fact
about the module's automation, which changes the severity of four of their headline findings.

Module = the nav item labelled **"Vendor Intelligence"**, routed at `/vendors`, served by
`apps/api/src/routers/vendors.ts` (~1,100 lines, 34 procedures), `routers/tia.ts`,
`routers/assessments.ts` and the DPA procedures in `routers/ai.ts`; rendered by
`apps/web/src/app/[locale]/(app)/vendors/**` plus eight components in `components/vendors/`;
persisted in `packages/db/src/schema.ts:1313–1600` and `:2539`; fed — in intention — by
`packages/db/src/scripts/gather-vendors.ts` and the standalone `vendor-pipeline/` workspace.

**Date:** 23 August 2026.

---

## 0. Method and confidence

Three independent audits were merged. Every load-bearing claim was then re-read against the source
rather than carried across; where two audits agreed and the code disagreed, the code won. Findings
are marked:

| Mark | Meaning |
|---|---|
| **[V]** | Re-verified in this pass. File and line cited; the code was read, not inferred. |
| **[S]** | Static inference from verified code. Mechanism stated so it can be falsified by reading the same code. No database was exercised and no browser was opened. |
| **[C]** | Carried from a source audit, plausible, not re-verified here. |

Nothing here was observed against a running instance. Counts of records in
`packages/db/src/seed-data/*.json` and the repo-root `vendors.json` were taken by parsing the files.

**One fact underpins the severity of a third of this document and none of the three source audits
established it correctly.** `scheduleGlobalJobs()` in `apps/api/src/workers/index.ts:39–75` is the
only place recurring work is registered, and **it schedules no vendor job of any kind**. Separately,
`DORMANT_JOBS` in `apps/api/src/lib/queue.ts:135–166` contains seven vendor entries:

```
vendor-incidents-ingest:ingest-daily
vendor-intelligence:sub-processor-change-detector
vendor-intelligence:breach-alert-monitor
vendor-intelligence:dpa-expiry-checker
vendor-intelligence:dpa-page-change-detector
vendor-intelligence:assessment-reminder-checker
vendor-intelligence:weekly-organization-discovery-trigger
```

So each of those is off twice over: unscheduled, and gated behind the revival allowlist even if it
were scheduled. Tracing every `.add()` call confirms the consequence — the **only** vendor job with
any enqueue path at all is `vendor-discovery`, reached from `routers/onboarding.ts:834`,
`routers/vendors.ts:1006` (the scan button) and `workers/vendors.ts:602` (the weekly trigger, which
itself never runs). **[V]**

This does not make the defects in those workers unreal. It changes what they are: they are latent —
armed code that fires the day somebody adds a `boss.schedule()` line or sets `WORKERS_ENABLED_JOBS` —
rather than damage a customer is taking today. The distinction matters because it is the difference
between a hotfix and a gate on a future sprint, and because a defect register that cries P0 at
dormant code will be ignored when it cries P0 at live code.

---

## 1. Executive verdict

Custodia has built most of the *surface* of a vendor management module and a fraction of its
*substance*. The schema is thoughtful, the risk engine is the best-reasoned file in the module, the
Article 28(3) clause checklist is genuinely strong, and the Gemini enrichment pipeline has the right
instincts. Underneath: **four data systems that were designed to feed each other and are connected to
nothing**, a catalogue of 39 hand-typed rows, thirteen columns on the tenant's own record that no UI
can write, and a set of monitoring workers that are all either stubs, unscheduled, or both.

The seven findings that matter, in the order a reader should care about them:

1. **Neither enrichment pipeline has ever delivered a record to the product.**
   `gather-vendors.ts` writes `packages/db/src/seed-data/vendors.json`; nothing reads it. The
   `vendor-pipeline/` workspace writes `vendor-pipeline/vendors.json` and the repo-root
   `vendors.json`; nothing reads either. The `vendors` table is populated exclusively by 39
   hand-written literals in `packages/db/src/seed-vendors.ts`. There is no importer, no ingestion
   job and no in-product review queue. **[V]**

2. **The AI pipeline's real yield is three records, not thirty-three.**
   `seed-data/vendors.json` holds 33 entries but only **3** carry a `provenance` block — ClickUp,
   OneTrust and Okta. The other 30 predate the gatherer. Against 43 non-duplicate targets that is a
   **7% acceptance rate**, and it is the number any decision about the pipeline has to be taken
   against. Two of the three source audits reported "33 high-confidence records", overstating the
   pipeline's output by an order of magnitude. **[V]**

3. **15% of the risk score is dead, and it takes the only Article 9 vendor gap with it.**
   `dataCategoriesShared` is read by `lib/vendorRisk.ts:155`, `constants/gapRules.ts:195`,
   `lib/orgEmbeddings.ts:87` and the ROPA discovery worker. It is written by nothing:
   `vendors.ts:287` and `:1084` hardcode `[]`, `updateOrgVendor`'s Zod input has no such field, and
   no UI control exists. The special-category factor therefore always scores 0, and
   `missing_dpa_special_category` — severity *critical*, Articles 9 and 28, the most serious vendor
   finding the compliance engine can produce — can never fire. **[V]**

4. **Every US vendor is pinned at maximum location risk.**
   `vendorRisk.ts:82` gates US adequacy on `mechanisms.includes('data_privacy_framework')`. The
   string `data_privacy_framework` appears **zero times** in `seed-vendors.ts`; every seeded vendor
   carries `['standard_contractual_clauses']` or nothing. So Google, AWS, HubSpot, Salesforce,
   Slack, Stripe and Zoom all score `20/20 — United States (conditional adequacy, no DPF certified)`,
   and every customer's "high risk vendors" tile is inflated. Three data sources use three
   incompatible vocabularies for this one field and nothing normalises between them. **[V]**

5. **The sub-processor change diff is destroyed before it is stored.**
   `workers/vendors.ts:101` ends its cleaning chain with `.join('\n').replace(/\s+/g, ' ')` — and
   `\s` includes `\n`, so both snapshots are persisted as a single line.
   `SubProcessorList.tsx:268–274` then computes additions and removals with `.split('\n')`. Every
   detected change renders as **"1 addition, 1 removal"** with two unreadable blobs. The Article
   28(2) objection workflow, which is the entire point of the feature, sits on a diff that shows the
   reviewer nothing. Two of the three source audits praised this feature as working; one called it
   the module's strongest. **[V]**

6. **Every "fix this gap" link from the compliance dashboard 404s.**
   All seven vendor rules in `constants/gapRules.ts` (lines 28, 54, 79, 208, 251, 283, 334) build
   `resolutionUrl: /vendors/${record.id}` from a row selected out of `organizationVendors`, so
   `record.id` is the join-row id. The detail page passes that value as `vendorId` to
   `getOrgVendorDetails`, which matches `eq(organizationVendors.vendorId, input.vendorId)` — the
   *global* vendor id. The ids can never coincide. **[V]**

7. **Chapter V evidence cannot leave the product, and the assessment behind it is half-recorded.**
   `tia.exportPdf` (`routers/tia.ts:150–165`) generates nothing; it returns the hardcoded string
   `https://s3.custodia.io/exports/tia_${tia.id}.pdf` under a comment reading "Mocking PDF
   generation and S3 upload", and the UI opens it in a new tab. The save path's Zod input also drops
   all six EDPB Recommendations 01/2020 Step 1 fields and both Step 6 fields, which the schema
   models correctly. And the *update* path, unlike the insert path, never sets
   `organizationVendors.tiaCompleted` — so completing an existing draft leaves the register saying
   no TIA exists. **[V]**

**Two things the source audits called ship-stoppers, downgraded here.** The fabricated incident feed
(`workers/incidents.ts:233–290` — the EDPB and GDPRhub responses are checked for `res.ok`, the bodies
discarded, and three hardcoded samples processed instead, one citing an invented TechCrunch URL) and
the DPA-expiry alerting that terminates in `console.log` (`workers/vendors.ts:635–639`) are both real
and both indefensible in code. Neither is reaching a customer, because neither job is scheduled and
both are in `DORMANT_JOBS`. They are P0-on-enablement, not P0-today. See D1 and D6.

**What is genuinely good, and should be said before the register of failures:** the risk engine's
nine-factor transparent point allocation with a human-readable `detail` string per factor, which is
more explainable than what most commercial scoring produces; the Article 28(3)(a)–(h) clause
checklist with citations and exact-substring excerpts, which is the best-designed thing in the
module; the Gemini pipeline's refuse-to-guess directive, which measurably worked — 21 of 40 pending
records have `dpaUrl: null` because the model declined rather than constructing `domain.com/dpa`;
the independent HTTP probe with content-signal verification and gated-content detection, which is
the difference between a demo and a pipeline; the discovery inbox's consent-category chip resolved
from the tracker registry; and `derivedRiskFlags.ts` in the standalone pipeline, whose nine flags map
to real Article 28 negotiation positions and exist nowhere in the product.

### Scorecard

Scored as audited, 23 August 2026.

| Dimension | Score | One line |
|---|---|---|
| Catalogue population | **2/10** | 39 hand-typed rows, no aliases, no risk scores, free-text categories. A 200-person European company runs 80–150 SaaS tools; the hit rate against a real stack is under 25% |
| Enrichment delivery | **0/10** | Two pipelines, 273 generated records, **zero** reaching the database. There is no importer to score |
| Enrichment quality | **4/10** | Right instincts — grounded search, refuse-to-guess, independent probe, domain authority, two-bucket output. 7% acceptance, no citations captured, no per-field confidence, collects almost none of the fields the risk engine scores |
| Article 28 contract management | **4/10** | The clause checklist is excellent. Around it: no document storage, no `dpaSignedAt`, no request workflow, no negotiation record, no annex tracking, five free-floating status toggles with no state machine |
| Article 30(1)(d) recipient record | **2/10** | `purpose` and `dataCategoriesShared` both unwritable, `processingActivities` dead, no vendor↔ROPA linking UI. The register cannot state what data goes to a recipient or why |
| Chapter V / TIA | **3/10** | A well-shaped five-step wizard over a six-step regulation, per vendor rather than per transfer, dropping eight schema fields on save, with a fake PDF export and a completion path that does not mark completion |
| Sub-processor management | **3/10** | The scrape, hash, per-org change row, notification and objection UI are all built — on top of a diff destroyed at line 101. Capped at 50 catalogue vendors. `notifiedAt` is shared across tenants |
| Risk methodology | **6/10** | The best file in the module. One factor dead, one reading a column that does not exist, one fed by fabricated data, one counting other tenants' rows. Fixed weights, no criticality axis, no history, no override |
| Assessments | **2/10** | Unusable by any customer — the only seeded template is `organizationId: null` and `getTemplates` filters on equality with the org id. Behind that gate: no attachments, no save-and-resume, no human review before the score moves |
| Incident intelligence | **1/10** | Fabricated in code, dormant in production. The matching, alert fan-out and response workflow around it are real and waiting for a real feed |
| Discovery | **6/10** | Genuinely works. Puppeteer plus MX/SPF/CNAME heuristics, a good triage inbox, tracker-registry enrichment. Accepts 0.50 Levenshtein and discards the confidence it computes |
| Register operations | **1/10** | No owner, no contact, no status control, no offboarding, no delete, no review cycle, no notes field. A register that can only grow |
| Evidence and audit trail | **0/10** | The vendor module has no audit trail at all. ROPA has a well-built one; none of it is extended here |
| Exports | **2/10** | A 7-column CSV over loaded pages only; an audit pack with `transferMechanism` hardcoded null, `dpaSignedAt` and `lastReviewedAt` permanently blank, and a DPA folder that is always empty |
| Search, filter, bulk | **1/10** | Client-side name filter over 25 loaded rows, one sort, no filters, no bulk selection, no saved views. `DiscoverModal` loads the whole catalogue into the browser |
| Automation that runs | **1/10** | One on-demand job. Everything recurring is unscheduled, dormant, or a `console.log` |
| Tenancy and permissions | **3/10** | 4 of 34 procedures carry `requirePermission`; a read-only viewer can flip DPA status and create vendors. One cross-tenant insert the guard cannot see |
| i18n | **1/10** | 7 of 8 vendor components have zero `useTranslations`; `check:ropa-i18n` scans only the ROPA register, so nothing catches it |
| Visual design | **8/10** | Coherent, fast, on-palette — and the reason the defects are a surprise |

---

# PART I — What the module is today

## 1.1 Four islands, no bridges

```
 ISLAND A                  ISLAND B                 ISLAND C              ISLAND D
 vendor-pipeline/          gather-vendors.ts        seed-vendors.ts       THE PRODUCT
 (never built)             (Gemini + probe)         (39 literals)         apps/api + apps/web
      |                          |                        |                     |
 200 JSON files            3 accepted / 40 pending   39 rows --seed--> vendors table
 (180 synthetic)                 |                        |                     |
 vendors.json ──X          seed-data/vendors.json ──X     |              organization_vendors
 (repo root)               pending-review.json ──X        |                     |
      |                                                   |              [risk · DPA · TIA ·
 review-queue.db (SQLite) ──X                             |               sub-processors ·
                                                    the ONLY live path    discovery · incidents]
```

Verified by tracing every reference to `seed-data/vendors.json` (one file — the script that writes
it) and to the repo-root `vendors.json` (none). **[V]**

## 1.2 The data layer

### `vendors` — the shared global catalogue (`schema.ts:1313`)

37 columns. **Eleven are fully dead** — written by nothing and read by nothing, or written by
nothing and read by code that therefore never works: `dsarSearchInstructions`, `dpaAvailable`,
`privacyPolicyUrl`, `encryptionAtRest`, `encryptionInTransit`, `subProcessorNotification`,
`aliases`, `typicalDataCategories`, `regulatoryActions`, `isPrivacyFriendly`, and the
`riskScore`/`riskLevel`/`riskFactors` triple. **[V]**

Two of those breakages are load-bearing:

- **`aliases` is never seeded** (0 occurrences in `seed-vendors.ts`). `findMatchedVendor` and the
  incident matcher both consult it as their strongest non-domain signal, and both are reduced to
  exact-domain matching or fuzzy name distance as a result. "Office 365" never matches Microsoft. **[V]**
- **`riskScore` is never computed.** The risk engine writes to `organization_vendors`, never to
  `vendors`. `getPrivacyAlternatives` orders by `COALESCE(vendors.riskScore, 100)`, which is
  therefore constant across every row, and `AlternativesSection` renders `alt.riskScore` with a
  fall-through to the gold "low risk" style. The panel headed *"Consider these lower-risk
  alternative vendors"* shows every vendor in the category, unsorted, all badged low risk. **[V]**

`transferMechanisms` is live but carries the wrong vocabulary (finding 4).

### `organization_vendors` — the tenant's own record (`schema.ts:1365`)

**A customer can edit eight fields**: DPA status, DPA expiry date, contract renewal date, data
subject volume, two certification checkboxes, the EU-hosting toggle, and the eight Article 28
clause checkboxes.

**Thirteen columns that exist and matter are unreachable**: `status` (no lifecycle control),
`dpaSignedAt` (read by the audit export → always blank), `dpaDocumentId` (the audit pack's DPA
folder → always empty), `dpaNotes` (the API accepts `notes`; there is no textarea), `tiaRequired`,
`tiaDocumentId` (zero references repo-wide), `dataCategoriesShared` (finding 3), `processingActivities`,
`purpose` (zero references — Article 30(1) purpose per recipient), `lastReviewedAt` (the
`high_risk_vendor_no_review` gap rule tests `lt(lastReviewedAt, oneYearAgo)`; NULL compares false, so
it never fires) and `nextReviewAt` (zero references — no review cadence exists anywhere). **[V]**

**And one column the risk engine reads does not exist.** `vendorRisk.ts:79` spreads
`orgVendor.transferMechanisms` into the mechanism list. `organization_vendors` has no such column —
line 1333 is on `vendors`. An organisation can never record "we signed SCCs Module 2 with this
processor". **[V]**

Absent from the schema entirely and needed: business owner, vendor contacts, criticality tier,
processing role (processor / joint controller / independent controller), contract start, notice
period, auto-renewal, documented Article 28(3)(a) instructions, approval state, onboarding and
offboarding dates, deletion-certificate reference, risk-acceptance record.

## 1.3 Island A — `vendor-pipeline/` (standalone, never built)

Six scripts, five test files, 200 vendor JSON files, ~1,000 lines. **`dist/` does not exist and every
npm script points into it** (`node dist/scripts/linkSentinel.js` and five siblings), so no script has
ever been runnable through its documented entry point. **[V]**

`generateVendors.ts` produces 20 hand-written brand templates plus **180 procedurally generated
fillers** — verified by parsing the output: 180 of 200 records match `/Service\d+$/`, with
fabricated domains (`accountingservice102.com`), fabricated DPA URLs beneath them and Clearbit logo
URLs for domains that do not exist. **All 200 records carry `analystVerifiedAt`**, stamped with the
generation timestamp alongside `automatedVerifiedAt`. No analyst has reviewed anything. **[V]**

The 20 "real" templates also carry fabricated URLs — AWS on `amazon-web-services.com`, every DPA URL
pattern-built as `{slug}.com/legal/dpa` — and unverified legal assertions ("Mailchimp: no SCCs")
presented as fact. **[C]**

`registryPoller.ts` claims in its docstring to poll the US Department of Commerce DPF registry. It
reads a 13-name hardcoded array, matches by bidirectional substring, and overwrites
`vendor.isDpfCertified` with the result — destroying correct data for the 187 records not in the
list. `changeDetector.ts` caches with no TTL, so once seeded it can never detect a change again, and
its PDF branch calls `.text()` on a binary. **[C]**

What is worth keeping: `derivedRiskFlags.ts`, `linkSentinel.ts` and the unified-diff review queue in
`diffRenderer.ts`, which is better than what the product does.

## 1.4 Island B — `gather-vendors.ts` (Gemini, search-grounded)

506 lines, 55 hardcoded targets across 16 verticals, Gemini 2.5 Flash with the `googleSearch` tool on
Vertex AI. The architecture is right: grounded search → brace-slice JSON → three independent HTTP
probes with content-signal verification → domain-authority check → two-bucket accept/pending split
with a structured `provenance` block.

**Measured output** (Appendix B): 43 processed after duplicate-skipping, **3 accepted**, 40 pending.

Where it loses records it should keep:

- **`isHighConfidence = dpaOk && privacyOk`** is an AND across two independent artefacts. Eight
  records have a *verified* DPA and were rejected on the privacy policy alone. The DPA is the field
  that matters most and it is being discarded for the field that matters least. **[C]**
- **The domain-authority guard is a 13-entry hardcoded parent map**, and five pending records failed
  on it alone: Oracle/NetSuite, Adobe/Magento, Salesforce/Tableau, Atlassian/Loom, and Moodle's
  `.com` versus its seeded `.org`. All five are true positives thrown away. **[C]**
- **`failed_gated` fires on substrings.** The gate regex includes `register`, `portal` and `gate`,
  which several legitimate privacy URLs contain. **[C]**
- **40 of 40 pending records failed all three probes.** Sites that certainly publish DPAs — DocuSign,
  ADP, Canva — are in that set. That is a bot-block, user-agent or timeout signature, not a
  data-quality signal, and the quarantine is currently indistinguishable from "bad data". This is the
  sharpest single observation in the three source audits and it belongs at the top of any pipeline
  work. **[C]**

What it never captures: `response.candidates[].groundingMetadata` — which sources the answer rests
on — is available from the API and discarded at the point it is produced. Without it `provenance`
says `automated_rag_search` and nothing more. There is also no per-field confidence, no structured
output mode, no retry or repair on a malformed response, no re-verification loop, and no concurrency
(sequential with a fixed 3s sleep; 5,000 targets would take about nine hours with no resume).

## 1.5 Island C — the seed catalogue

`seed-vendors.ts`: **39** vendors, hand-written literals, 17 free-text category strings, real DPA and
sub-processor URLs, real certification lists. Zero aliases, zero `data_privacy_framework`, zero risk
scores. Categories such as `'CRM & Marketing'` are title-cased with an ampersand and will never be
reproduced by a user typing into the free-text Add Custom Vendor field, so custom vendors are
permanently ungrouped and permanently without alternatives. **[V]**

## 1.6 The workers

`createQueue('vendor-intelligence')` multiplexes seven job names, plus `vendor-incidents-ingest`
alongside. Implementation state versus operational state:

| Job | Code | Scheduled? | In `DORMANT_JOBS`? |
|---|---|---|---|
| `vendor-discovery` | complete | on demand only | no |
| `sub-processor-change-detector` | complete, diff destroyed | **no** | yes |
| `dpa-expiry-checker` | complete, alerts to `console.log` | **no** | yes |
| `assessment-reminder-checker` | complete | **no** | yes |
| `vendor-risk-recalculation` | complete | **no** | **no** — simply absent from both lists |
| `weekly-organization-discovery-trigger` | complete | **no** | yes |
| `breach-alert-monitor` | `console.log('Simulating…')` | **no** | yes |
| `dpa-page-change-detector` | `console.log('Simulating…')` | **no** | yes |
| `vendor-incidents-ingest:ingest-daily` | fabricated data | **no** | yes |

**[V]** — verified against `workers/index.ts:39–75`, `lib/queue.ts:135–166` and every `.add()` call
site.

The `dpa-expiry-checker` deserves a specific note: its 90/60/30/7/expired tiering with
`lastExpiryNotificationTier` idempotency and reset-on-extension is genuinely well built, and it
terminates in `createNotification()` at `workers/vendors.ts:635`, whose entire body is a
`console.log` under the comment *"Assuming a generic notifications table exists"*. The platform has a
real `queueNotification`; the sub-processor detector already uses it correctly two hundred lines
away. **[V]**

`findMatchedVendor` (`workers/vendors.ts:777`) loads **every row of `vendors`** — including other
tenants' custom vendors — for each detected domain, then does exact-domain → alias → Levenshtein with
a **0.50** acceptance threshold. It computes a confidence and **the call site discards it**
(`const { vendor: matchedVendor } = await findMatchedVendor(...)`, line 530). The UI shows a 0.51
name guess and a 1.00 exact-domain hit with the same green "Global Registry Match" tick. **[V]**

## 1.7 The API surface

**34 vendor procedures. Four carry `requirePermission`** — `subProcessors.list` / `remove` /
`markNotified` and `publishIncident` (lines 450, 505, 536, 699). Everything else is bare
`protectedProcedure`, so any authenticated member — including a read-only viewer — can flip DPA
status, edit risk inputs, create vendors and confirm discoveries. **[V]**

**Unreachable from any UI (8):** `suggestGlobal` (a `LIMIT 5` under the comment "Mock suggestion for
now"), `createQuestionnaire`, `getQuestionnaires`, `confirmQuestionnaire`, `publishIncident`,
`subProcessors.markNotified`, `ai.generateVendorQuestionnaire`, `ai.analyzeVendorQuestionnaire`. **[V]**

**Two parallel questionnaire systems.** `vendorAssessments` is live and reachable;
`vendorQuestionnaires` is a complete second implementation — one table, five procedures, two AI
endpoints, one public page — reachable from nothing, and carrying a live unauthenticated
`submitQuestionnaireAnswers` mutation with no expiry, no single-use guard and no rate limit. **[C]**

**`subProcessors.addLinked` / `addUnlinked`** insert into `vendorSubProcessors` keyed on a
client-supplied `parentVendorId` with **no ownership check and no permission gate**, then call
`recalculateVendorRiskForAllOrgs(parentVendorId)`. Any authenticated user can attach fabricated
sub-processors to AWS's shared catalogue row and move every tenant's AWS risk score. The tenancy
guard does not catch it because its second pass audits `update`/`delete` per statement, and this is
an `insert`. **[V]**

**`ai.analyzeDpa`**: the quota is incremented before the work (`ai.ts:1037`), so a failed parse still
costs the user; `let limit = 2000` is never reassigned, so every plan gets the same allowance; and
`aiDpasAnalyzed` has exactly two references repo-wide — the check and the increment. **There is no
reset anywhere.** The message reads *"Monthly DPA analysis limit reached… Please upgrade your plan"*
and is wrong on both counts. **[V]**

**`assessments.submitAssessmentResponses`** is a `publicProcedure` that fires an unmetered LLM call
and then applies the model's `scoreAdjustment` to the customer's risk score automatically via
`updateVendorRiskScore` (line 618), with no human in the loop. Because a good questionnaire score
maps to a negative modifier, **a vendor self-attesting favourably lowers its own risk rating in the
customer's register before any DPO sees it.** **[V]**

## 1.8 The UI

The register's four metric tiles, the tab count and the CSV export are all computed over
`vendorsResp?.pages.flatMap(...)` at 25 rows per page (`vendors/page.tsx:31, 83–85`). An organisation
with 60 vendors sees "Total tracked: 25" and a DPA-coverage percentage over a quarter of its
register — and hands that CSV to an auditor. `getRiskStats` exists, is whole-org and correct, and is
called only from the dashboard, never from the page that needs it. **[V]**

`AddCustomVendorModal` takes country as free text (`country.trim()`) into
`char('headquarters_country', { length: 2 })`. Typing "Germany" either raises a raw
*"value too long for type character(2)"* or, where a value fits, lands as something the ISO lookup
reads as a different country. **[V]**

**Seven of eight vendor components have zero `useTranslations`** — `AlternativesSection`,
`DiscoveryTab`, `DpaAnalysisModal`, `QuestionnaireTab`, `SubProcessorList`, `TIABuilder`,
`VendorIncidentFeed`. Only `AddCustomVendorModal` is translated. `check:ropa-i18n` scans the ROPA
register only, so nothing catches this. **[V]**

Missing from the detail page entirely: owner, contact, notes, data categories, purpose, processing
activity link, criticality, status, offboarding, document library, activity log, review scheduling,
and any delete or unlink control at all.

## 1.9 Downstream consumers

- **Compliance gaps** — seven vendor rules; all seven produce 404 links (finding 6);
  `missing_dpa_special_category` can never fire (finding 3); `high_risk_vendor_no_review` never
  fires and does not filter on high risk despite its name; `missing_dpa` escalates severity on
  `record.vendor?.riskLevel`, the global column that is never populated, so it never escalates. **[V]**
- **Audit export** (`lib/auditExport.ts`) — `transferMechanism: null` hardcoded at line 177;
  `dpaSignedAt` (172) and `lastReviewedAt` (178) read from columns nothing writes; the `vendors/dpas/`
  folder collects `dpaDocumentId` values that no flow ever sets. Four blank columns and zero
  documents in the auditor-facing pack. **[V]**
- **`recalculateVendorRiskForAllOrgs`** filters `eq(vendorAssessments.vendorId, vendorId)` with the
  *global* vendor id, but that column references `organizationVendors.id` (`schema.ts:1462`).
  Assessments are never found on this path and the questionnaire modifier silently vanishes from
  every score it recalculates. **[V]**
- **ROPA / DSAR** — `processingRecipients.vendorId` links a recipient to a vendor; the vendor module
  offers no reverse view. `dsarSearchInstructions` exists to tell an operator how to run a DSAR
  against a processor and is never written or read.
- **Webhooks** — `vendor.sub_processor_changed` and `vendor.incident_detected` only, both dispatched
  from dormant workers.

---

# PART II — Verified defect register

Ranked by damage to a customer who trusts the product. **P0** = unsafe, misleading, or the feature
does not work at all. **P1** = a DPO cannot run their programme. **P2** = erodes trust.
**P0-latent** = the code is indefensible but nothing currently executes it; it fires the day the job
is enabled.

## P0 — live today

| ID | Defect | Evidence | Consequence |
|---|---|---|---|
| **D1** | Assessment templates unreachable: the only seed writes `organizationId: null`, `getTemplates` filters `eq(organizationId, orgId)` | `seed-vendor-assessment.ts:208`, `assessments.ts:275–282` | The entire vendor questionnaire feature is dead on arrival for every customer. `getSystemTemplates` exists, is correct, and is wired to nothing. No template builder UI exists as a workaround **[V]** |
| **D2** | `dataCategoriesShared` has no write path anywhere | `vendors.ts:287, 1084`; `updateOrgVendor` input; no UI control | 15% of the risk score is permanently 0; Article 9 detection impossible **[V]** |
| **D3** | `missing_dpa_special_category` (critical, Art. 9 + 28) can never fire | `gapRules.ts:195`, depends on D2 | The most severe vendor finding the engine can produce is unreachable **[V]** |
| **D4** | All seven vendor gap rules build `resolutionUrl` from the join-row id; the route resolves the global vendor id | `gapRules.ts:28,54,79,208,251,283,334` vs `vendors.ts:255–268` | Every "fix this gap" link from the compliance dashboard 404s **[V]** |
| **D5** | No seeded vendor carries `data_privacy_framework`; the risk engine gates US adequacy on that exact string | `seed-vendors.ts` (0 occurrences), `vendorRisk.ts:82` | Every US vendor scores maximum location risk; the "high risk" tile is inflated for every customer **[V]** |
| **D6** | AI `scoreAdjustment` applied to the customer's risk score automatically from vendor-supplied answers | `assessments.ts:603–618` | A vendor self-attesting favourably lowers its own risk rating before any DPO sees it **[V]** |
| **D7** | Sub-processor snapshots whitespace-collapsed to one line, then diffed by `split('\n')` | `workers/vendors.ts:101`, `SubProcessorList.tsx:268–274` | Every change renders "1 addition, 1 removal" with two unreadable blobs; the Art. 28(2) objection workflow sits on a diff showing nothing **[V]** |
| **D8** | Register metric tiles, tab count and CSV export computed over loaded pages only | `vendors/page.tsx:31, 83–85` | An org with 60 vendors sees "Total: 25" — in a file handed to an auditor. `getRiskStats` is correct and used only on the dashboard **[V]** |
| **D9** | `tia.exportPdf` returns a fabricated S3 URL and generates nothing | `routers/tia.ts:150–165` | "Export PDF" opens a dead link. The Chapter V evidence document cannot be produced **[V]** |
| **D10** | `subProcessors.addLinked`/`addUnlinked`: no ownership check, no permission gate, invisible to the tenancy guard (which audits update/delete, not insert) | `vendors.ts:468–501`; `check-tenant-scoping.ts` | Any authenticated user can add fabricated sub-processors to a shared catalogue vendor and shift **every tenant's** risk score **[V]** |
| **D11** | Uploaded DPA PDFs are never stored | `ai.ts` — no `documents` insert, no S3 put, no `dpaDocumentId` write | No evidence chain; the audit pack's `vendors/dpas/` folder is always empty **[V]** |
| **D12** | Audit export hardcodes `transferMechanism: null` and reads two never-written columns | `auditExport.ts:172, 177, 178` | The one column a supervisory authority cares about for Chapter V is blank by construction, plus signature date and review date **[V]** |
| **D13** | `aiDpasAnalyzed` is a lifetime counter with no reset; `let limit = 2000` never reassigned; incremented before the work | `ai.ts:1026, 1029, 1037` | After 2,000 analyses ever, DPA analysis is permanently disabled, with a message claiming a monthly limit and inviting an upgrade that changes nothing. Failed analyses consume quota **[V]** |
| **D14** | 7 of 8 vendor UI components have zero i18n | `components/vendors/*.tsx` | The German and French products show English TIA wizards, sub-processor lists, discovery inboxes and questionnaires **[V]** |
| **D15** | 4 of 34 vendor procedures carry permission gates | `vendors.ts` | A read-only viewer can change DPA status, edit risk inputs and create vendors **[V]** |

## P0-latent — armed, not currently executing

| ID | Defect | Evidence | Consequence on enablement |
|---|---|---|---|
| **D16** | Incident ingest discards the RSS bodies it fetches and processes three hardcoded samples, one citing an invented TechCrunch URL, each stamped `incidentDate: new Date()` | `workers/incidents.ts:233–290` | Customers using Mailchimp, Meta or Google Analytics receive in-app, email and webhook alerts about breaches that did not happen. The ±7-day dedupe window means a fresh duplicate weekly. Each appends to `knownIncidents` and pins those vendors' breach factor at maximum, in every tenant, permanently **[V]** |
| **D17** | `createNotification()` is a `console.log` | `workers/vendors.ts:635–639` | Every DPA expiry and contract renewal alert is invisible. The tiering logic is correct and reaches nobody **[V]** |
| **D18** | `breach-alert-monitor` and `dpa-page-change-detector` are `console.log` stubs | `workers/vendors.ts` | Two advertised monitoring capabilities do nothing **[V]** |
| **D19** | `registryPoller` overwrites real `isDpfCertified` from a 13-name hardcoded array by bidirectional substring match | `vendor-pipeline/src/scripts/registryPoller.ts` | Destroys correct data for 187 of 200 records; "Go" matches "google" **[C]** |
| **D20** | 180 of 200 pipeline files are synthetic; all 200 carry `analystVerifiedAt` stamped at generation | root `vendors.json`, parsed | Any import floods the catalogue with fabricated vendors bearing a false human-verification attestation **[V]** |

## P1 — a DPO cannot run their programme

| ID | Defect | Evidence |
|---|---|---|
| **D21** | Neither pipeline's output is ever imported | no consumer of `seed-data/vendors.json` or root `vendors.json` **[V]** |
| **D22** | Pipeline acceptance rate 3/43; 5 true positives rejected by the 13-entry parent map; 8 verified DPAs discarded on the privacy check | `seed-data/*.json`, parsed **[V]** / `gather-vendors.ts` **[C]** |
| **D23** | No `groundingMetadata` captured — the audit trail is discarded where it is produced | `gather-vendors.ts` **[C]** |
| **D24** | TIA update path with `status:'completed'` does not set `organizationVendors.tiaCompleted`; only the insert path does | `routers/tia.ts:100–130` **[V]** |
| **D25** | TIA save drops all six EDPB Step 1 fields and both Step 6 fields the schema models | `routers/tia.ts` Zod input vs `schema.ts:1631–1646` **[C]** |
| **D26** | `organizationVendors.transferMechanisms` is read by the risk engine and does not exist | `vendorRisk.ts:79` vs `schema.ts:1365+` **[V]** |
| **D27** | `recalculateVendorRiskForAllOrgs` matches `vendorAssessments.vendorId` against the global vendor id; the column FKs `organizationVendors.id` | `vendors.ts:113`, `schema.ts:1462` **[V]** |
| **D28** | `aliases` never seeded | `seed-vendors.ts` (0 occurrences) **[V]** |
| **D29** | `vendors.riskScore` never populated; `getPrivacyAlternatives` sorts by it and `AlternativesSection` displays it | `vendors.ts:734`, `AlternativesSection.tsx` **[V]** |
| **D30** | No remove, unlink, offboard or status control for a vendor anywhere | no procedure, no UI **[V]** |
| **D31** | No review cycle: `lastReviewedAt` / `nextReviewAt` written by nothing | schema vs write paths **[V]** |
| **D32** | No business owner, no vendor contact, no notes field, no criticality, no processing role | schema **[V]** |
| **D33** | The vendor module has no audit trail | no `CHILD_TABLE_BY_PATH` entries, no History tab **[C]** |
| **D34** | Assessment invitation email failure swallowed; status still set to `sent` | `assessments.ts` **[C]** |
| **D35** | Rule-based AI fallback hardcodes system-template question ids; on a custom template it writes "No major security gaps detected" as the AI's verdict when the AI failed | `assessments.ts:584–593` **[C]** |
| **D36** | `respondentIp` accepted from the client body and stored as audit evidence | `assessments.ts:487` **[C]** |
| **D37** | `submitQuestionnaireAnswers` (public) has no expiry, no lock, no rate limit | `vendors.ts` **[C]** |
| **D38** | Assessment access tokens stored in plaintext | `schema.ts:1470` (acknowledged TODO) **[C]** |
| **D39** | `findMatchedVendor` accepts 0.50 Levenshtein, discards the confidence it computes, and loads every tenant's vendors | `workers/vendors.ts:777–826`, call site 530 **[V]** |
| **D40** | No bulk import of any kind — no CSV, no paste-a-list, no multi-select in the Discover modal | UI **[V]** |
| **D41** | `getOrgVendors` sortable only by `createdAt`; no filters, no server-side search | `vendors.ts:210–218` **[C]** |
| **D42** | `AddCustomVendorModal` country is free text into `char(2)`; category free text that never matches seeded strings | `AddCustomVendorModal.tsx:56,137`, `schema.ts:1327` **[V]** |
| **D43** | REST `GET /api/v1/vendors` returns raw join rows — no name, no website, no country, no risk; no detail endpoint; documents `tiaRequired`, which is never written | `routes/v1/vendors.ts` **[C]** |

## P2 — rough edges that erode trust

| ID | Defect |
|---|---|
| **D44** | `vendorQuestionnaires` — one table, five procedures, two AI endpoints, one public page — entirely orphaned **[C]** |
| **D45** | Sub-processor change detection capped at `.limit(50)` catalogue vendors globally **[V]** |
| **D46** | `notifiedAt` lives on the shared sub-processor row — one tenant acknowledging clears it for all (known-concerns #13) **[C]** |
| **D47** | Sub-processor count in the risk score is the shared catalogue count, not per-organisation **[V]** |
| **D48** | `suggestGlobal` is a `LIMIT 5` stub with a comment admitting it **[V]** |
| **D49** | No duplicate detection on `createCustom` / `linkVendor` / `confirmDiscovery`; re-linking surfaces a raw unique-constraint error **[C]** |
| **D50** | `confirmDiscovery` bypasses `enforceLimit`, which the other two entry paths call **[C]** |
| **D51** | `linkVendor` throws a raw `Error` rather than a `TRPCError` **[C]** |
| **D52** | `DiscoverModal` loads the entire global catalogue client-side and filters on `name` only **[C]** |
| **D53** | Discovery scan is fire-and-forget with no job status; the inbox does not paginate **[C]** |
| **D54** | AI DPA excerpts are never validated as substrings despite the prompt demanding it; hallucinated quotations render in a monospace evidence block **[C]** |
| **D55** | `potential_special_category` is computed by the model, shown, then discarded — it is exactly the signal `dataCategoriesShared` needs **[C]** |
| **D56** | `/vendors/analyzer` discards its result entirely, having consumed a quota unit **[C]** |
| **D57** | `sendAssessment` does not verify template ownership; `getAssessmentByToken` returns the whole row to the unauthenticated respondent **[C]** |
| **D58** | TIA gated on `requireRole("admin")` — a DPO who is not an org admin cannot perform one **[V]** |
| **D59** | `getForVendor` returns `LIMIT 1`; `save` without an id always inserts, so drafts accumulate invisibly **[C]** |
| **D60** | TIA offers three hardcoded technical measures and no organisational or contractual families, despite schema support **[C]** |
| **D61** | `vendor-pipeline` has no `dist/`; all six npm scripts point into it. Three of five test files make live network calls **[V]** |
| **D62** | Ten fully dead columns and eight unreachable procedures (Appendix C) **[V]** |
| **D63** | `de`/`fr` carry an orphan key `_review_notes.title` absent from `en` **[C]** |
| **D64** | Risk-factor keys rendered by `key.replace(/([A-Z])/g,' $1')` — "subProcessors" displays as "sub Processors" **[C]** |

---

# PART III — Article-by-article assessment

**Article 28(1) — using only processors providing sufficient guarantees.** The mechanism exists: a
risk score, a certification record, a questionnaire. Two of the three are compromised — the
questionnaire cannot be sent (D1) and the score's special-category factor is dead (D2). There is no
record of the *decision* that a processor's guarantees were sufficient: no approval state, no
approver, no date, no rationale. An auditor asking "how did you satisfy yourself about this
processor" gets a number with no author.

**Article 28(2) — sub-processor authorisation and objection.** The best-built workflow in the module
and the one most completely undermined by a single line. Detection, per-org change rows,
acknowledge/object with notes and reviewer attribution all exist; the reviewer sees two blobs (D7).
The vendor's contractual objection window is not stored anywhere, so no deadline is computed, and the
objection produces no letter, no task and no follow-up. `notifiedAt` is shared across tenants (D46).

**Article 28(3) — the contract's mandatory terms.** The clause checklist with citations and
exact-substring excerpts is genuinely strong and should be the module's marketing centrepiece. What
sits around it is not a contract record: the signed DPA is destroyed after analysis (D11),
`dpaSignedAt` is never set, there is no version, no parties, no annexes, and the analyser's
tri-state (`present`/`weak`/`missing`) is flattened to a boolean on confirmation, discarding the
weakness the model found. **28(3)(a)** — documented instructions — has nowhere to be recorded at all.
**28(3)(g)** — deletion or return at end of processing — cannot be evidenced, because the lifecycle
has no end (D30).

**Article 30(1)(d) — categories of recipients.** The register knows a vendor exists and cannot say
what data goes to it or for what purpose: `dataCategoriesShared` and `purpose` are both unwritable
(D2), and `processingActivities` is dead. The vendor register is therefore a supplier list, not a
component of the Article 30 record, and the CSV export's seven columns contain no data category.

**Article 30(1)(e) and Chapter V (44–49).** `transferMechanism: null` is hardcoded into the audit
export (D12). The org cannot record which mechanism it relies on, because the column the risk engine
reads does not exist (D26). The TIA is per vendor rather than per transfer, though
`processingTransferId` and `processingActivityId` are both on the table; it drops eight EDPB fields
on save (D25); it cannot be exported (D9); and completing a draft does not mark it complete (D24).
DPF status — which flips the location factor by 15 points and decides the US adequacy conclusion — is
checked in the product against a string no seed contains (D5) and in the standalone pipeline against
a 13-name fiction (D19). Adequacy decisions carry no expiry or challenge tracking, so a lapse would
pass unnoticed.

**Article 32 — security of processing.** Two certification checkboxes, SOC 2 and ISO 27001, with no
evidence, no report period and no expiry. A SOC 2 ticked in 2023 is still true in 2026. The
questionnaire that would gather the rest cannot be sent (D1), and when it can, it accepts no
attachments — the SOC 2 report, the pen test and the ISO certificate are the only things an auditor
will accept and there is nowhere to put them.

**Articles 33 and 34 — breach notification.** The incident feed's response workflow, Article 33
guidance box and per-org alert states are all built on top of fabricated data (D16). There is no
impact triage — the question that matters is "did we send them the data categories this breach
affected", the intersection of `dataCategoriesShared` and `affectedDataCategories`, and one side of
that intersection is permanently empty (D2). The documented negative — "assessed, not affected" — is
what an auditor wants and cannot be produced.

**Article 5(2) — accountability.** The module has no audit trail (D33). "Who marked this DPA as
signed, and when" is unanswerable without a SQL console. Worker-initiated state changes bypass the
tRPC audit middleware entirely. Point-in-time reconstruction — "show me the register as it stood in
March" — is impossible.

**Articles 9 and 10.** The one gap rule that would detect special-category processing without a DPA
can never fire (D3).

---

# PART IV — Build order

## Week 1 — stop the bleeding

Every item is under a day; several are one line. This list alone closes seven P0s.

| Fix | Effort |
|---|---|
| **D1** — `getTemplates` → `or(isNull(organizationId), eq(organizationId, orgId))` | 1 line |
| **D4** — vendor gap `resolutionUrl` → the global vendor id | 7 lines |
| **D5** — backfill `data_privacy_framework` onto the DPF-certified seeded vendors | hours |
| **D7** — collapse only horizontal whitespace (`[^\S\n]+`), backfill the snapshots | 1 line + backfill |
| **D9** — remove the fake TIA export button until P-9 ships | minutes |
| **D10** — ownership check plus permission gate on `addLinked` / `addUnlinked` | hours |
| **D13** — monthly, plan-aware quota, incremented after success | half a day |
| **D8** — register metrics from `getRiskStats`; server-side CSV export | ~1 day |
| **D16** — delete the hardcoded incidents before anything can enable that job | hours |
| **D27** — join `vendorAssessments` on the org-vendor id | 1 line |
| **D15** — permission-gate the mutations | ~1 day |

## Weeks 2–6 — make the module usable

`dataCategoriesShared` write path, controlled vocabulary and UI (D2, closing D3). Business owner,
contacts, criticality, processing role, notes (D32). Vendor status lifecycle, unlink and offboarding
with a deletion-certificate record (D30, Art. 28(3)(g)). DPA document storage wired to
`dpaDocumentId` (D11, closing the audit pack's empty folder). CSV import with column mapping and
fuzzy catalogue matching (D40) — **this changes the first-run experience more than anything else in
this document, and every DPO already has the spreadsheet.** A vendor audit trail reusing ROPA's
middleware and `CHILD_TABLE_BY_PATH` machinery (D33). Real TIA PDF via the existing
`lib/pdf/registry.ts` pipeline, and the full field save (D9, D25, D24). Human review before an
assessment score moves the register (D6). Register filtering, sorting and server-side search (D41).
i18n the seven components and extend a ROPA-style guard to `components/vendors/**` (D14).

## Weeks 7–16 — connect the pipeline

This is the spine, and nothing above it compounds until data flows.

**P-1.** One vendor intelligence service inside `apps/api` exposing `enrich(name, domain)`
synchronously for the add-vendor path, `enrichBatch(targets[])` for the queue, and `reverify(vendorId)`
for freshness. Replace both islands.

**P-2.** `vendor_field_provenance` — one row per `(vendor_id, field_name)`: value, source type
(`ai_grounded` / `http_probe` / `registry` / `analyst` / `customer`), source URL, confidence,
evidence snippet, retrieved-at, verified-by. **This is the single highest-leverage schema change
available.** Trust is not "the pipeline is accurate"; trust is "the pipeline tells me which fields to
check". A DPO who sees *HQ = US, confidence 0.98, source: incorporation record, verified 3 days ago*
next to *sub-processor list, confidence 0.55, unverified* will accept the first and check the second,
which is exactly the behaviour to design for.

**P-3.** `vendor_candidates` and `vendor_intelligence_runs` — the staging table and run log the
pending-review JSON and the SQLite queue were sketching. Then the admin review console: side-by-side
current versus candidate, per-field accept/reject, evidence inline, bulk-approve above a threshold.

**P-4.** Normalise the vocabularies at the boundary — one canonical enum for transfer mechanisms,
certifications and categories, with every ingestion path mapping into it (D5, D22).

**P-5.** Import the real DPF participant list on a schedule into `dpf_registrations`, with covered
entities, status and effective dates. **A lapsed DPF certification is a Chapter V event and nothing
today would notice.**

**P-6.** Diagnose the 40/40 probe failures before tuning anything else — reuse the worker's Puppeteer
fallback behind fetch, and distinguish `blocked_bot_protection` from `url_not_found` from `timeout`.
The current quarantine is indistinguishable from bad data, and that single ambiguity is why the
acceptance rate reads as 7%.

**P-7.** Per-field confidence and routing rather than the boolean AND gate; registrable-domain
comparison via the public suffix list plus a real ownership source, with "parent-company domain,
needs confirmation" as an outcome instead of a reject (D22).

**P-8.** Capture `groundingMetadata` into provenance (D23); structured output with one repair retry;
concurrency with checkpointing; robots.txt and an honest user agent — a compliance product crawling
behind a spoofed Chrome UA will eventually be a support ticket from a vendor's security team.

**P-9.** **Catalogue-level DPA clause analysis.** Once a DPA URL is verified, fetch it, extract the
text, run the Article 28(3) analysis once, server-side, and store it with excerpts. Every customer
who links that vendor inherits a pre-filled checklist to confirm rather than compile. This turns the
most tedious task in the module into a review step and is the strongest argument for the pipeline
existing at all.

**P-10.** **Sub-processor list parsing into structured rows** (name, service, country, purpose),
diffed as entities. This fixes D7 at the root: "Added: Twilio Inc., US, SMS delivery" rather than two
blobs.

**P-11.** An evaluation harness with a gold set of ~200 hand-verified vendors, precision and recall
per field per prompt version. **You cannot improve a pipeline you cannot measure, and the 7% figure in
this document had to be derived by counting JSON files.**

## Months 5–8 — the differentiators

Google Workspace / Microsoft 365 OAuth app inventory — the highest-yield discovery source in
existence, returning the actual SaaS estate with actual scopes. SSO inventory (Okta, Entra) for user
counts. Expense and accounting reconciliation, which is the standard audit test for completeness of a
vendor inventory and the answer to "how do you know you have them all". Review cycles with owner
assignment and a monthly owner digest — compliance work that lives only in the DPO's inbox does not
get done. DPA request workflow with e-signature, and Custodia's own Article 28 template for vendors
that have none. Real incident intelligence, extending the CNIL/AEPD/BfDI/AP/ICO/DPC scrapers that
already exist in `packages/db/src/seeds/` for the regulatory corpus. The Article 30(1)(d) extract and
the Article 28 evidence pack. Vendor request intake, reusing the ROPA delegated-intake pattern in
`routers/ropaIntake.ts`. Offboarding with deletion certificates.

## Months 9–12 — the moat

Cross-customer aggregate signal ("38 organisations record this DPA as covering all eight clauses"),
carefully and anonymously. Trust-centre ingestion — `gather-config.json` already allowlists seven
trust platforms; parse them and the questionnaire is pre-answered before it is sent. Answer
verification: cross-check what the vendor claims against what the pipeline found — *"they say EU-only
hosting; their sub-processor list names us-east-1"* — which is the highest-value thing the pipeline
and the questionnaire could do together and neither knows the other exists. Benchmarking.
Concentration and consolidation analytics over the sub-processor graph. Catalogue to 3,000+.

## The three things that would win the deal

Feature parity is not the argument; OneTrust will always have more boxes.

1. **The register is populated and correct on day one, not month three.** Import the spreadsheet,
   read the Workspace OAuth grants, enrich every match from the catalogue, and show a complete,
   risk-ranked, gap-annotated register in under an hour with visible provenance on every pre-filled
   field. OneTrust onboarding is a professional-services engagement measured in months. That is the
   gap to attack.
2. **The output is the deliverable, not an input to one.** Every DPO using OneTrust or Vanta still
   hand-builds the Article 30 extract and the Article 28 pack, because the export is a data dump.
   `lib/ropaArticle30.ts` and `lib/ropaExportFormats.ts` already demonstrate the pattern in this
   codebase — one dataset, many renderers, built server-side. Apply it to vendors.
3. **The pipeline is honest about what it knows.** Nobody trusts an unlabelled AI-populated field.
   Everybody trusts a field that carries its source, its confidence and its date next to one that
   says "unverified — please check". The answer to "what would make a user trust the output" is not
   higher accuracy; it is calibrated and visible uncertainty.

---

# Appendix A — Adjudications between the three source audits

Where the three disagreed, this is what the code says. `audit1` = `vendor-intelligence-audit1.md`;
`assessment2` = `vendor-intelligence-assessment2.md`; `audit3` = `vendor-intelligence-audit3.md`.

| Question | Ground truth | audit1 | assessment2 | audit3 |
|---|---|---|---|---|
| Seeded catalogue size | **39** | "~48" ✗ | "~40" ≈ | **39 ✓** |
| Gemini pipeline targets | **55** | "64" ✗ | "54" ≈ | **55 ✓** |
| Records the AI pipeline actually produced | **3** (33 in the file, 3 with `provenance`) | "33" ✗ | "33 high-confidence" ✗ | **3 of 43 = 7% ✓** |
| Are the recurring vendor jobs running? | **None. Nothing is scheduled; seven are also in `DORMANT_JOBS`** | **✓ — the only one to establish it, and correct that `vendor-risk-recalculation` is in neither list** | ✗ — labels four of them "Real", and states weekly discovery scans happen | ✗ — never mentions the gate; labels them "live", flags only the weekly trigger as unscheduled |
| Sub-processor diff | **Destroyed at `workers/vendors.ts:101`** | ✗ praises the timeline | ✗ calls it "the strongest feature" | **✓ found it** |
| Assessment templates | **Unreachable for every org** | ✓ | ✗ describes the flow as working | ✓ |
| Vendor gap `resolutionUrl` | **All seven 404** | missed | missed | **✓** |
| TIA update path and `tiaCompleted` | **Update path does not set it** | missed | missed | **✓** |
| `aiDpasAnalyzed` reset | **No reset exists** | partial — noted increment-before-work only | missed | **✓** |
| `organizationVendors.transferMechanisms` | **Column does not exist** | ≈ "never writable" | missed | **✓** |
| `recalculateVendorRiskForAllOrgs` assessment join | **Broken — matches the wrong id** | **✓ — unique to audit1** | missed | missed |
| `getRiskStats` usage | **Used on the dashboard, not on the vendors page** | ≈ | ≈ | ✗ "0 UI refs" |
| Permission gates | **4 of 34** | not counted | not counted | ≈ "5 of 34" |

**Verdict.** `audit3` is the strongest of the three by a wide margin: it is the only one with
file-and-line evidence throughout, it found six substantive defects the others missed, and it was
right on every count where the three disagreed except two minor ones. `audit1` is the only one that
understood the module's automation, and it owns one real bug the others missed. `assessment2` is the
weakest — it asserts as working the two features that are most broken and reports the dormant workers
as live — and its one genuinely superior contribution is the reading of the 40/40 probe failures as a
bot-block signature rather than a data-quality signal, which is carried into P-6 above.

The correction that matters most for planning: `audit3`'s two loudest ship-stoppers, the fabricated
incident feed and the `console.log` expiry alerts, describe code that cannot currently execute.
They are recorded here as **P0-latent** — gates on enabling those jobs, not hotfixes — and the
Week 1 list carries D16 anyway, because deleting fabricated breach data is hours of work and leaving
it armed behind a flag somebody will eventually flip is not a decision worth defending.

---

# Appendix B — Pipeline run statistics

Counted by parsing `packages/db/src/seed-data/vendors.json`, `pending-review.json` and the repo-root
`vendors.json`.

| Metric | Value |
|---|---|
| Gemini targets defined | 55 across 16 verticals |
| Skipped as duplicates | 12 |
| Processed | 43 |
| **Accepted (carrying `provenance`)** | **3** — ClickUp, OneTrust, Okta |
| Sent to pending review | 40 |
| **Acceptance rate** | **7.0%** |
| Records in `seed-data/vendors.json` | 33 (30 predate the gatherer) |
| Pending with `dpaUrl: null` (model declined rather than guessed) | 21 / 40 |
| Pending rejected on domain authority alone | 5 — all five verified true positives |
| Pending with DPA verified but privacy failed | 8 |
| Pending with all three probes failed | 40 / 40 |
| Records in repo-root `vendors.json` | 200 |
| — of which synthetic (`/Service\d+$/`) | **180** |
| — of which carry `analystVerifiedAt` | **200** |
| **Records reaching the product database** | **0** |

---

# Appendix C — Dead code and columns

**Fully dead columns.** `vendors`: `dsarSearchInstructions`, `dpaAvailable`, `privacyPolicyUrl`,
`encryptionAtRest`, `encryptionInTransit`, `subProcessorNotification`, `aliases`,
`typicalDataCategories`, `regulatoryActions`, `isPrivacyFriendly`, `riskScore` / `riskLevel` /
`riskFactors`. `organization_vendors`: `status`, `purpose`, `processingActivities`, `tiaRequired`,
`tiaDocumentId`, `nextReviewAt`, `lastReviewedAt`, `dataCategoriesShared`, `dpaSignedAt`,
`dpaDocumentId`, `dpaNotes`.

**Write-only.** `vendors.lastVerifiedAt` / `verifiedBy` — set by `verifyVendorProfile`, displayed
nowhere, so the user cannot see that verification happened. `vendors.logoUrl` — seeded, never
rendered; the UI shows `name.charAt(0)`.

**Unreachable procedures (8).** `vendors.suggestGlobal`, `createQuestionnaire`, `getQuestionnaires`,
`confirmQuestionnaire`, `publishIncident`, `subProcessors.markNotified`,
`ai.generateVendorQuestionnaire`, `ai.analyzeVendorQuestionnaire`.

**Stub workers (2).** `breach-alert-monitor`, `dpa-page-change-detector`.

**Orphaned subsystem (1).** `vendorQuestionnaires` — one table, five procedures, two AI endpoints,
one public page, one live unauthenticated mutation.

**Unbuilt package (1).** `vendor-pipeline/` — six scripts, 200 data files, no `dist/`.

**Disconnected artefacts (3).** `packages/db/src/seed-data/vendors.json` (33),
`pending-review.json` (40), repo-root `vendors.json` (200).
