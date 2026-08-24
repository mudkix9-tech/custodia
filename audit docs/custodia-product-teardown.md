# Custodia — Complete Product Teardown
**Product:** Custodia (trycustodia.com) — "GDPR Compliance OS for Agencies"
**Account tested:** MudKix / mudkix9@gmail.com (Google OAuth), Owner role, Professional plan
**Test date:** 23 August 2026
**Method:** Live exploration in visible Chrome via Playwright. Every sidebar item, tab, modal, form, dropdown, export menu, and empty state was opened and its DOM extracted. One test record ("Test Processing Activity") was created to exercise the create flow; no destructive actions were performed.

---

## 1. Executive Summary

Custodia is a multi-tenant GDPR compliance platform aimed at agencies managing compliance for themselves and client organisations. It is a Next.js 16 App Router SPA-style app over a tRPC API, dark-themed (black `#0D0F11`/`#08090A` surfaces, gold `#C9A227` accent, Geist + Instrument Serif + JetBrains Mono typography), with next-intl localisation (en/de/fr) and a Radix-based component system.

**Overall verdict:** This is a genuinely deep product — far beyond typical "GDPR checklist SaaS" fare. The ROPA module in particular is the most legally literate implementation of Article 30 record-keeping I have seen in a product at this stage: per-record completeness scoring tied to specific sub-paragraphs of Art. 30(1), publish-gating fields, DPIA screening built on the actual EDPB WP248 criteria plus a per-authority Art. 35(4) list, attestation with qualified statements, versioning, approval workflow that excludes the author, and an immutable audit ledger with IP addresses and diffs.

**But it is visibly a product mid-construction.** Several modules are shells (Training, Regulatory Updates, Privacy Policies list, DSAR board), the Co-Pilot returns mock responses because the Anthropic API key is a dummy, German/French localisation is largely untranslated beyond nav chrome, one catalogue table renders 19 empty rows, and there is **no way to delete a processing activity from the UI**.

**Strongest modules:** ROPA (exceptional), Audit Readiness (evidence ledger + gap engine), Vendors (risk scoring + Schrems II TIA wizard), Cookie Consent (scanner reconciliation concept is best-in-class).
**Weakest modules:** Training (empty), Regulatory Updates (empty), DSAR (board only, no intake flow reachable), Privacy Policies (list with no visible generator flow), Co-Pilot (mocked).

---

## 2. Global Chrome (every page)

### 2.1 Layout
- **Left sidebar** (~230px, collapsible to icon rail "W" logo): fixed, dark `#0D0F11`, grouped nav sections with small uppercase letter-spaced labels.
- **Top bar** (per-page): page title left; right side: Search button (`Search... CtrlK`), bell (Notifications), then below in sidebar footer: Settings, Support, Language selector, user chip.
- **Main content:** max-width container, generous padding, cards with `border-white/10`, `rounded-2xl`.

### 2.2 Sidebar navigation inventory (exact, in order)
| Group | Items |
|---|---|
| **OVERVIEW** | Dashboard (`/dashboard`), Analytics (`/analytics`) |
| **RECORDS** | Data Processing (`/ropa`), Impact Assessments (`/dpia`), Vendors (`/vendors`), Trust Portals (`/clients`) |
| **REQUESTS & INCIDENTS** | Data Requests (`/dsar`), Breaches (`/breaches`) |
| **COMPLIANCE** | Privacy Policies (`/policies`), Cookie Consent (`/consent`), Audit Readiness (`/audit`), Training (`/training`) |
| **INTELLIGENCE** | Compliance Co-Pilot (`/copilot`), Regulatory Updates (`/updates`) |
| **Footer** | Settings (`/settings`), Support (`/support`), Language: English ▾, User chip (avatar M, MudKix, mudkix9@gmail.com) |

Detail pages add a "Detail" breadcrumb chip next to the page title (e.g., "Data Processing · Detail").

### 2.3 User menu (click user chip)
Dropdown contains: avatar M, **MudKix**, mudkix9@gmail.com, **Log out**. Nothing else — no profile link, no org switcher, no plan indicator. (Profile lives under Settings → My Profile instead.)

### 2.4 Command palette (Ctrl+K or click Search)
- Radix dialog, input placeholder: **"Search activities, vendors, policies..."**
- Footer hint: "Ctrl K — Start typing to search your workspace"
- Default results grouped by type, each with "Jump to →":
  - **PROCESSING ACTIVITY:** all 6 activities by name
  - **VENDOR:** Slack, Dropbox, Zendesk, WXA
- Searches entity names; typing filters. No commands/actions (no "New activity", no navigation commands), no recent items, no keyboard nav hints beyond the footer.

### 2.5 Notifications bell
Present on every page. (Did not populate — no notifications pending in test account.)

### 2.6 Language switcher
Button "English" opens a `menuitemradio` group: **English / Deutsch / Français**. Switching prefixes the URL with the locale (`/de/...`, `/fr/...`).

**i18n finding (significant):** On the German locale, only the sidebar chrome translates ("Cookie Consent" → "Cookie-Einwilligung"). Page content — headings like "Advanced Analytics Available Soon", buttons "Configure Banner", stat labels "TOTAL PAGEVIEWS", "ACCEPT ALL RATE" — remains English. This matches the known constraint that next-intl does not fall back: untranslated keys would render as raw dotted paths, so large portions appear to be hard-coded English rather than keyed. **German and French are effectively nav-chrome-only.**

### 2.7 AI Guidance panel
A right-hand (or inline) collapsible panel appears across ROPA, Vendors, and Consent detail views:
- Header: **"AI Guidance"**, badge: **"Grounded in GDPR & Org Context"**
- Sub-panel: **"Ask follow-up questions"** with input placeholder "Ask follow-up..." and submit arrow (disabled until text entered).
- The contextual-suggestion calls are wired (`ai.getContextualSuggestions` appears in the audit ledger), but the chat backend returns the mock: *"Disclaimer: No direct matching sources were found in the database... This is a mock response because the Anthropic API failed or is not configured."*

### 2.8 Visual system (consistent across app)
- Surfaces: panel `#0D0F11`, recessed `#08090A`; borders `white/10`; radius `2xl` (16px) on cards, smaller on inputs.
- Text: primary `#F4F5F6`, secondary `#9BA1A6`, muted `#6E747A`.
- Accent: gold `#C9A227` for primary buttons, active nav, score highlights.
- Fonts: Geist (UI), Instrument Serif (display headings — gives the product a distinctive "legal document" feel), JetBrains Mono (numbers, code snippets, script IDs).
- Buttons: primary = gold fill, dark text; secondary = dark w/ border; destructive = red (seen in Danger Zone).
- Status colors: draft = gray, medium risk = amber, high = orange/red, critical = red, low = green/neutral.

---

## 3. Dashboard (`/dashboard`)

**Header:** "Dashboard" + Search + Notifications.
**Content:** "Welcome back" (h1) — "Here's your compliance overview and pending tasks."

Five stat cards (each a link where noted):
| Card | Value at test | Links to |
|---|---|---|
| Compliance Score | 62% | — |
| Active Processing Activities | 0 | — |
| Pending DSARs | 0 | — |
| High Risk Vendors | 0 | `/vendors` |
| Undocumented Services | 1 | `/vendors?tab=discovery` |

**Findings:**
- **Inconsistency:** "Active Processing Activities: 0" while the ROPA register holds 6 activities (all `draft` status). The card evidently counts only `active`-status records — defensible, but the label invites misreading; a "0 of 6 published" framing would be honest.
- **Compliance Score 62% here vs 72% "Overall Compliance" on Analytics vs 62 on Audit Readiness.** Three different headline numbers across three pages with no visible reconciliation. This is the single most confusing metric story in the product.
- No task list, no "pending approvals" queue, no recent activity feed, no onboarding checklist. For an "OS" pitch, the dashboard is thin — it's five numbers and nothing actionable.
- **Missing (expected at this price point):** deadline widgets (DSAR/breach clocks), "your gaps" top-5 with deep links, approval requests awaiting you, recent audit-log digest, per-client roll-up for agency use.

## 4. Analytics (`/analytics`)

**Header:** "Advanced Analytics" — "Board-ready metrics, benchmarking, and predictive insights."
**Primary action:** **Executive Report (PDF)** button (gold).

**Stat cards:**
| Card | Value |
|---|---|
| Overall Compliance | **72%** |
| Industry Average (Technology) | 58% |
| Top Quartile | 85% |

**Charts (Recharts, gold/gray series):**
1. **12-Month Compliance Trajectory & Forecast** — line chart, Sep→Oct (14 months; last 2 dashed = Forecast), legend: Forecast / Historical Score. Y axis 0–100.
2. **Pillar Performance vs Previous** — bar chart, pillars: Privacy / Security / Governance, series: Current Score / Previous Quarter.
3. **DSAR Response Time Distribution** — bar chart, buckets 1-7 / 8-14 / 15-21 / >21 days. Tooltip shows "Number of DSARs : 8" for the 8-14 bucket (hover state observed).
4. **Gap Resolution Velocity (Past 4 Weeks)** — bar chart W1–W4, y 0–8.
5. **Employee Training Completion** — bar chart Jan–Apr, y 0–100.

**Findings:**
- **Data honesty problem:** the DSAR chart shows 8 DSARs in a bucket while the DSAR module reports **0 requests**; Training Completion shows a rising series while Training has **no assigned modules**; the trajectory shows 14 months of history on an account whose audit ledger begins ~2 weeks before testing. These charts are **seed/demo data, not live data**. On a compliance product this is worse than an empty chart — an executive deck built from this page would misstate the org's position.
- Console warnings on load: Recharts `width(-1) and height(-1)` — charts render with negative dimensions before layout settles (5 warnings). Cosmetic, but visible in devtools and occasionally causes a flash of collapsed charts.
- Benchmark figures ("Industry Average (Technology) 58%", "Top Quartile 85%") have no source, no date, no methodology link.
- Executive Report (PDF) button was not clicked to completion (would generate a real export); the audit ledger shows prior `export.generateExecutiveReport` calls, so it is wired server-side.

**Missing:** date-range selector; per-pillar drill-down; export of the charts themselves; benchmark methodology; a "data as of" stamp; and reconciliation with the Audit score.

---

## 5. Data Processing / ROPA (`/ropa`) — flagship module

### 5.1 List view
**Header:** "Records of Processing Activities" — "Manage your Article 30 compliance records and data processing activities."

**Toolbar (left→right):** `Insights` `Retention` `Discovery` `Data collection` (sub-nav buttons — see 5.6), then `Catalogues`, `Import CSV` (hidden file input), `Export ▾`, **New Activity** (gold).

**Ownership scope toggle:** `All activities` / `Mine` / `Unowned` + **Filters ▾** button.

**Search input:** placeholder "Search names, purposes, categories, recipients, countries…" — covers name, purpose, categories, recipients, countries per the placeholder.

**Table columns (exact):** `[checkbox] | Complete | Name | Purpose | Role | Lawful Basis | Status | Review | Tags | Data Subjects | Retention | Risk`

**Rows at test (6):**
| Complete | Name | Role | Lawful basis | Status | Data subjects | Retention | Risk |
|---|---|---|---|---|---|---|---|
| 42 | Test Processing Activity | Controller | Consent 6(1)(a) | draft | Not recorded | Not recorded | low |
| 47 | Custom Processing Activity | Controller | Legitimate Interest 6(1)(f) | draft | General public | Not recorded | low |
| 72 | Payroll & Tax Processing | Controller | Legal Obligation 6(1)(c) | draft | Employees | 7 years (statutory requirement for tax audit purposes) | high |
| 76 | Employee HR Management | Controller | Contract 6(1)(b) | draft | employees | Duration of employment + 6 years | low |
| 76 | Email Marketing Campaigns | Controller | Consent 6(1)(a) | draft | customers, website_visitors | Until consent is withdrawn | low |
| 69 | Website Analytics Tracking | Controller | Legitimate Interest 6(1)(f) | draft | website_visitors | 24 months | low |

- "Complete" is the per-record completeness % (computed from Art. 30 sub-paragraph coverage — see 5.3).
- Tags column shows "—" for all (no tag UI found on the record itself — see Missing).
- Review column: "Not scheduled" for all.
- Pagination footer: "Showing 1 to 6 of 6" with Previous/Next (both disabled at one page). Page size not configurable.
- No bulk actions bar appears when checkboxes are ticked (checkboxes exist; no bulk UI observed — **unfinished**).
- Row click → detail page. No inline edit, no sort indicators on headers (clicking headers did nothing observable).

**Filters panel** (opens under toolbar; multi-select groups):
- STATUS: draft / under_review / active / archived
- APPROVAL: Not submitted / In review / Approved / Rejected
- ROLE: Controller / Processor / Joint controller
- RISK: low / medium / high / critical
- LAWFUL BASIS: all six Art. 6 bases
- COMPLETENESS: Under 50% / 50–79% / 80% and above
- RETENTION: Recorded / Not recorded

**Export dropdown** (rich; exact copy): "Every format below is produced on the server from the whole register, not from the rows this page has loaded."
- **Article 30 record (PDF)** — "The canonical record — controller identity, all seven sub-paragraphs, both records, and the assertions each activity makes about what it does not do."
- **Register workbook (XLSX)** — "One sheet per object: activities, subjects, categories, recipients, transfers, retention."
- **Register (CSV)** — "One row per activity, for a spreadsheet or a re-import."
- **Exchange format (JSON)** — "Keyed by Article, for archival or migration to another system."
- Section **"Regulator template"** — "The supervisory authority's own template, in its own language." with four pre-built templates:
  - Registre des activités de traitement — **CNIL (France)**
  - Record of processing activities — **ICO (United Kingdom)**
  - Verzeichnis von Verarbeitungstätigkeiten — **Datenschutzkonferenz (Deutschland)**
  - Registro de actividades de tratamiento — **AEPD (España)**
- Footer: **Loaded rows (CSV)** — "Just what this page has loaded. Use the register export above for everything."

This export menu is the best I've seen in any ROPA product — regulator-native templates are a genuine differentiator. (Not exercised to download; server-side generation is confirmed via audit ledger entries.)

**Import CSV:** triggers a native file chooser (hidden input). No visible template download, no column-mapping UI, no preview/validate step before import — **risky for a compliance register**; a bad CSV can silently create junk records (my test record was created through the form, but the import path has no guard rails visible).

### 5.2 Create flow (`/ropa/new`)
**Header:** "New Processing Activity" / button "Create Activity" (disabled until required fields valid). Breadcrumb "Data Processing · Detail". Side link: **"Draft it from a description instead"** (AI drafting — not exercised; the AI backend is mocked).

**Section: General Information**
- Activity Name * (text, id `ropa-general-activity-name`)
- Purpose of Processing * (text)
- Description (textarea)
- Lawful Basis (Art. 6) * — combobox, options exactly: Consent (Art. 6(1)(a)) / Contract (Art. 6(1)(b)) / Legal Obligation (Art. 6(1)(c)) / Vital Interests (Art. 6(1)(d)) / Public Task (Art. 6(1)(e)) / Legitimate Interest (Art. 6(1)(f))
- Status — combobox (default Draft)
- Risk Level — combobox (default Low)
- Toggle: **Systematic Monitoring** — "Processing involves regular and systematic monitoring of data subjects on a large scale."
- Help text: "Article 30(1) is the controller's record; Article 30(2) is the processor's. They require different information." (Role selection lives on the Legal tab post-create, not here — slight friction.)

**On submit:** creates the record and navigates to `/ropa/{uuid}`. My test record appeared instantly in the list with completeness 42.

### 5.3 Detail page (`/ropa/{id}`) — 11 tabs
Header: activity name, status chip (`draft`), completeness badge (e.g., **42**), buttons: **Full record ▾**, **Publish**, **Help me fill this in**.

**Tabs (exact):** General · Legal Basis · Data Categories · Recipients · Transfers · Retention · Security · DPIA · Review & approval · Tasks & discussion · History

A **"Record completeness"** card lists outstanding items with legal citations, e.g.:
- Categories of data subject — ART. 30(1)(C) — **BLOCKS PUBLISHING**
- Categories of personal data — ART. 30(1)(C) — **BLOCKS PUBLISHING**
- Retention period — ART. 30(1)(F) — **BLOCKS PUBLISHING**
- Technical and organisational measures — ART. 30(1)(G) / ART. 32
- Retention justification — ART. 5(1)(E) — "Storage limitation is a principle the controller has to be able to demonstrate, not assert."
- Business and privacy owner — ART. 5(2) — "An unowned record is the one that goes stale — accountability under Art. 5(2) needs a name behind it."

This citation-level completeness model is the module's core strength — completeness is not a vibe, it's a checklist mapped to the Regulation, and publishing is hard-gated on the BLOCKS PUBLISHING items.

**Tab: General**
- Activity Name *, Purpose *, Description
- Status (Draft ▾), Risk Level (Low ▾)
- **Business owner** (combobox "Unassigned") — "Who knows what this activity actually does day to day."
- **Privacy owner** (combobox "Unassigned") — "Who answers for it under Article 5(2)."
- Toggle: Systematic Monitoring
- Section **"Profiling and automated decisions"** — "Article 22. Only asked about further if this activity makes decisions without a person in the loop."
  - Toggle: "This activity profiles data subjects" — "Article 4(4) — automated evaluation of personal aspects such as performance, preferences, behaviour or location."
  - Toggle (nested, appears when profiling on): "Decisions are made solely by automated means" — "With legal or similarly significant effects. Article 22(1) prohibits this unless 22(2)(a)-(c) applies."

The progressive Art. 22 disclosure is exactly right.

**Tab: Legal Basis**
- Lawful Basis (Art. 6) * (combobox)
- **Your role in this activity** — combobox: "Controller — we decide why and how" (Processor / Joint controller options exist per the filter list)
- Contextual note when basis ≠ Legitimate Interest: "This activity does not rely on legitimate interests, so no assessment is required. Change the lawful basis on the Legal tab if that is wrong."
- (When LI is selected, an LIA/assessment requirement appears — the Audit gap engine flags "Legitimate interests with no assessment" as a MEDIUM gap for the two LI activities, so the LIA capture exists in the gap model.)

**Tab: Data Categories** — two sections:
1. **Data Subject Categories** (Art. 30(1)(c)) — "whose personal data this activity processes. Scale feeds the Art. 35(3) DPIA screening."
   - "Add from your catalogue" combobox ("Select a category...") + Add
   - "Or record one not in the catalogue" text input (placeholder "E.g. Scheme trustees") + Add — note: "Recorded against this activity only. Add it to the catalogue to reuse it across the register."
   - Table: CATEGORY | ESTIMATED VOLUME | (delete)
   - Empty: "No data subject categories recorded. Art. 30(1)(c) requires at least one."
2. **Data Categories** (Art. 30(1)(c)) — "what personal data this activity processes. Expand a row for the Art. 9(2) condition, the Art. 10 authority and the retention rule for that category."
   - "Add from your data element catalogue..." combobox + Add
   - Table: DATA CATEGORY | GROUP | SOURCE | RETENTION | CLASSIFICATION | SPECIAL
   - "Add Row" button for manual entries.
   - Empty: "No data categories added yet."

**Tab: Recipients**
- **"Link an Existing Vendor"** — combobox "Select a vendor from your register..." + **Link Vendor**. Note: "Linking a vendor keeps DPA status in step and creates a cross-border transfer record where one is required."
- **"Add Other Recipient"** — text input (placeholder "E.g. Internal HR Team, Local Auditor") + **Add Manual**
- Table: RECIPIENT NAME | CATEGORY | ROLE | DPA STATUS | VENDOR RISK | DATA PROCESSING LOCATIONS
- Empty: "No recipients documented for this processing activity." + pagination chrome ("Showing 1 to 0 of 0 results").

**Tab: Transfers**
- **International Transfers** — "Art. 30(1)(e) and Chapter V. Adequacy is computed from the Commission's decisions; expand a row to record the mechanism itself, which is what an auditor asks to see."
- Table: DESTINATION COUNTRY | IMPORTER | TRANSFER MECHANISM | VENDOR (DATA IMPORTER) | TIA STATUS
- **Add Row**. Empty: "No international transfers documented."
- Adequacy "computed from the Commission's decisions" implies a maintained adequacy table — strong.

**Tab: Retention**
- Retention Period * (combobox "Select Retention Period...")
- Justification for Retention Period * (textarea; placeholder "Explain why this data must be kept for this period (e.g., statutory requirements, business needs)...")
- Next Review Date (date input)
- Deletion Procedure (textarea; placeholder "How is this data securely destroyed at the end of its lifecycle?")

**Tab: Security**
- **Technical & Organizational Measures (TOMs)** — 8 toggles, all defaulted ON in the test record: Encryption at Rest / Encryption in Transit (TLS/SSL) / Role-Based Access Controls (RBAC) / Multi-Factor Authentication (MFA) / Pseudonymization / Data Anonymization / Regular Backups / System Audit Logging
- **Additional Security Details** textarea (placeholder "Describe any other specific technical or organizational measures...")
- **Finding:** defaulting all TOMs to "on" for a new record is dangerous — a record that asserts measures nobody implemented. Should default off with an explicit assertion step.

**Tab: DPIA** — the deepest screen in the product:
- **DPIA screening** — "Article 35(1) asks whether this processing is likely to result in a high risk. Whichever way you answer, the reasoning has to be recorded."
- **Article 35(3) — the cases where a DPIA is always required** (3 Yes/No pairs):
  1. Systematic and extensive evaluation by automated processing, including profiling, on which decisions with legal or similarly significant effects are based
  2. Processing on a large scale of special category data (Art. 9) or criminal offence data (Art. 10)
  3. Systematic monitoring of a publicly accessible area on a large scale
- **The nine EDPB criteria (WP248 rev.01)** — "Two or more met means a DPIA is required. One means it may be." (9 Yes/No pairs):
  Evaluation or scoring · Automated decision-making with legal or similarly significant effect · Systematic monitoring of data subjects · Sensitive data or data of a highly personal nature · Processing on a large scale · Matching or combining datasets · Data concerning vulnerable data subjects · Innovative use or application of new technological or organisational solutions · Processing that prevents data subjects from exercising a right or using a service or contract
- **Your supervisory authority's Article 35(4) list** — "Operations the authority has published as always requiring a DPIA in **IE**." — 8 checkbox items: Biometric identification on a large scale / Processing of genetic data / Tracking the location of individuals / Monitoring of employees / Profiling or marketing directed at children / Large-scale profiling with a significant effect / Systematic monitoring of employees / Special category data used to train AI
  - The authority ("IE") derives from the org's country setting — genuinely jurisdiction-aware.
- **Screening verdict card:** "A DPIA is not required — 12 criteria have not been answered. The verdict is provisional until they are." + **Save answers**
- **Data Protection Impact Assessment** section — "A DPIA is required if this processing activity is likely to result in a high risk..." Buttons: **Create New DPIA** / **Or Link Existing DPIA** → "New DPIA for Activity — Status: draft" + **Link to this activity**.

The WP248 checklist with provisional verdicts and an authority-specific Art. 35(4) list is expert-grade.

**Tab: Review & approval**
- **Review cycle** — "How often this record is looked at, and the signed statement that it was accurate when it was."
  - LAST REVIEWED: — | NEXT REVIEW: Not scheduled | CADENCE: combobox "Organisation default"
  - **"What you are attesting"** — optional textarea (placeholder "Accurate as at today, except that the retention period is under review.") — "Optional. A qualified attestation is a more honest record than a tick." — this is a genuinely sophisticated touch.
  - "Review again on" (date) + button **Attest this record is accurate**
- **Approval** — "Nothing about an Article 30 register should be editable in place by anyone, instantly."
  - Status: **Not submitted** — "Approval before publishing — Not required. Approval is recorded when it happens, but publishing does not wait for it."
  - **Reviewer** combobox "Choose someone" — "The person who wrote the record is not offered — that is the point of the workflow." + Note input ("What should they look at?") + **Request approval**
- **Versions** — "A point-in-time copy of the whole record, kept whenever it is approved, published, or you ask." + **Take a snapshot now**. Empty: "No versions yet."

**Tab: Tasks & discussion**
- **Tasks** — "Work arising from this record, assigned to someone with a date on it."
  - Fields: What needs doing (input, placeholder "Complete the retention section") · Assignee (combobox Unassigned; options Unassigned/MudKix) · Section (combobox: Whole record/General/Legal Basis/Data Categories/Recipients/Transfers/Retention/Security/DPIA) · Due (date) · **Add task**
  - Empty: "Nothing outstanding on this record."
- **Discussion** — "Questions about this record, asked where the answer belongs." Comment textarea (placeholder "Why is this retention five years?") + hint "Type @ followed by a colleague's name to notify them." + **Post** (disabled when empty). Empty: "Nothing has been asked about this record yet."

**Tab: History**
- **Audit Trail** + **Filters** + **Export CSV**. Empty for a new record: "No history found for this activity."

### 5.4 Publish flow
- **Publish** button is enabled even with BLOCKS PUBLISHING gaps visible — clicking it with gaps present was **not** exercised to avoid creating junk state; the completeness card says those fields block publishing, so the server presumably rejects. **The UI affordance is contradictory** (enabled button + "blocks publishing" labels) and needs a disabled-with-reasons state or a confirmation dialog listing the blockers.
- **Full record ▾** dropdown was not expanded (kebab-style menu adjacent to Publish).

### 5.5 Delete
**There is no delete for a processing activity anywhere in the UI.** No context menu on list rows, no danger zone on the detail page, no bulk delete. Records can only be archived (via Status → archived, presumably). For a product whose Data & Privacy settings boast a 30-day hard-delete grace period, the absence of record-level deletion is a real gap (GDPR Art. 17 applies to *data subjects'* data, not the register itself, so this is defensible — but every competitor offers it, and my test record is now permanently in this workspace).

### 5.6 Sub-nav: Insights (`/ropa/insights`)
All four toolbar buttons (Insights / Retention / Discovery / Data collection) navigate to the **same** `/ropa/insights` page titled **"Register insights"** — "Where the data is, where it goes, whether the record is improving, and what has changed that somebody now owes a data subject."
Sub-tabs rendered: **Data map · Transfers · Completeness · Material changes · Special category only** (these are anchor tabs; the content below is the Data map).

**Data map:**
- **Personal data** element frequency chips: full_name (3), email (2), address 1, bank_details 1, browsing_history 1, cookies 1, device_id 1, email_engagement 1, employment_contracts 1, ip_address 1, national_id_ssn 1, phone 1
- **Data subjects:** Employees 1, General public 1
- **Countries:** — | **Recipients:** — (both empty)
- "Showing 6 of 6 activities" — per-activity cards: name, status, Data subjects, Personal data list, Recipients, Countries.

**Findings:** Four buttons → one page is a UX lie (three are dead labels). The Transfers/Completeness/Material changes tabs did not switch content when clicked (single-panel page). "Material changes" is advertised in the page subtitle ("what has changed that somebody now owes a data subject") and exists as a backend concept (recent commit "material change detection") but has **no visible UI surface** on this page.

### 5.7 Catalogues (`/ropa/catalogues`)
**"Register catalogues"** — "The shared vocabulary your processing activities draw on. Kept here rather than typed per activity so that one element means one thing across the register — and so that 'which activities process health data?' has an answer."
- Toggle: **Show archived**
- Tabs: **Data elements (45)** | **Data subject categories (19)**
- **Data elements table:** ELEMENT | GROUP | SENSITIVITY | ART. 9 | ART. 9 TYPE | ART. 10 | IDENTIFIABILITY. Sensitivity values observed: Standard / Confidential / Special category. Identifiability: Directly identifying / Indirectly identifying. Rows are editable inline (comboboxes). Pagination "Showing 1 to 10 of 45 results".
- **Data subject categories table:** CATEGORY | CHILDREN | VULNERABLE | NOTE — **BUG: renders 10 empty rows** (19 claimed, zero visible cell content). The table body fails to render its data.
- **Add** button (disabled until a tab row context? — it was disabled at capture).

**Missing:** bulk import for catalogue elements; element usage counts ("used by 3 activities") which the insights map proves is computable.

## 6. Impact Assessments / DPIA (`/dpia`)

### 6.1 List view
**"Data protection impact assessments"** — "Every assessment, in one place. Until now a DPIA was reachable only through a processing activity, so 'which of ours are unsigned?' had no answer." (This copy is refreshingly self-aware about the module's recency.)

**Actions:** **New assessment** (gold).
**Status filter chips (with counts):** `All 1` · `Not signed off 1` · `Review overdue 0` · `Needs Article 36 0`
**Table:** Assessment | Status | Residual risk | Next review
Row at test: "New DPIA for Activity" | Draft | — | Not scheduled. Row click navigates to detail.

**"New assessment" flow:** opens an inline **"Start from a template"** panel — "A template supplies the risks that apply to this kind of processing and the measures normally offered against them, so the assessment opens as a document to argue with rather than a blank page. Everything stays editable."
Five template cards, each "3 risks pre-populated":
1. **CCTV and video surveillance** — "Systematic monitoring of a publicly accessible area — Art. 35(3)(c)."
2. **Employee monitoring** — "Systematic monitoring of staff — an imbalance of power that WP248 treats as a vulnerable-subject case."
3. **Marketing profiling and audience segmentation** — "Evaluation and scoring of individuals, often combined from several sources."
4. **Health data processing** — "Art. 9(1) data at scale — Art. 35(3)(b) applies wherever the scale is large."
5. **AI and automated decision-making** — "Art. 35(3)(a) — evaluation with legal or similarly significant effect, and innovative technology."
Plus a **Title** input (id `dpia-title`) for a blank assessment.

The template copy is domain-expert writing (WP248 vulnerable-subject framing is correct). Templates are a major accelerator vs OneTrust's blank-page DPIA editor.

### 6.2 Detail page (`/dpia/{id}`)
Header: assessment name + status chip "Draft" + **Residual risk: —**.

Single long-form document (no tabs), structured exactly on Art. 35(7):
1. **The processing — Article 35(7)(a)** — "Systematic description of the processing. The nature, scope, context and purposes. This is the section a supervisory authority reads first."
   - Fields: Purposes of the processing · Scope — who and how much · Context — the relationship with the individuals and what they expect · Legitimate interest pursued, where the basis is Article 6(1)(f) · How the data moves — collection, storage, sharing, deletion (textareas)
2. **Necessity and proportionality — Article 35(7)(b)** — Necessity Assessment · Proportionality Assessment ("Why the processing is necessary for the purpose" / "Why it is proportionate — what is limited, and how")
3. **Risks and measures — Article 35(7)(c) and (d)** — **Add a risk** — "Likelihood and severity on a 1–4 scale, before and after the measures. Four rather than five because an odd scale has a middle, and a middle is where every risk lands when nobody wants to argue about it." Empty state: "No risks recorded. An assessment cannot be signed off without them."
4. **DPO advice — Article 35(2)** — "The controller decides, not the DPO. Departing from the advice is allowed; not recording why is the gap an authority looks for first." Fields: Outcome (Approve / Approve with conditions / Object) · "The advice was followed" toggle · **Record the advice** (disabled until outcome chosen) · consult-reason input.
5. **Views of data subjects — Article 35(9)** — "'Where appropriate' is a judgement, and both answers are legitimate. Silence is not." Toggle "The views of data subjects were sought" + **Record this** (consult-reason input when not sought).
6. **Sign-off** — "Refused without a description of the processing, a risk assessment, and — where a DPO is designated — their advice. Signing off a document missing those is signing off a document that does not exist yet." Decision: Proceed / Proceed with conditions / Do not proceed + **Sign off** + **Save** (disabled until changes).

**Findings:**
- The micro-copy throughout is the best in the product — it explains *why* each element exists legally and pre-empts the failure modes (odd-scale gaming, silent DPO disagreement, unrecorded consultation).
- 1–4 risk scale with before/after measures is the EDPB-consistent approach.
- **Missing:** residual-risk computation display (header shows "—" with no visible way the number is derived), risk matrix/heatmap visual, attachment of evidence to risks, DPIA-to-ROPA backlink display (the link exists from ROPA side), Art. 36 prior-consultation trigger flow (the list filter "Needs Article 36" exists, but no UI path to *initiate* consultation), version history for the assessment itself, reviewer/assignee workflow (a DPIA is a document that gets reviewed; there's no approval chain like ROPA has).

---

## 7. Vendors (`/vendors`)

### 7.1 List view
**"Vendor Intelligence"** — "Automated tracking for DPAs, TIAs, and sub-processor risk."
**Actions:** **Analyze DPA** (→ `/vendors/analyzer`) · **Export Register** · **Discover Vendors** · **Add Custom Vendor**

**View toggle:** `Tracked Register (4)` | `Vendor Discovery & Shadow IT`

**Stat cards:** TOTAL TRACKED 4 · DPA COVERAGE **0%** · MISSING / EXPIRED DPAS **4** · HIGH / CRITICAL RISK 0

**Table:** Vendor | Category | DPA Status | Risk Score & Level | Data Locations
| Vendor | Category | DPA | Risk | Locations |
|---|---|---|---|---|
| S Slack | Communication | Missing | MEDIUM (40) | HQ: US |
| D Dropbox | Custom Tools | Missing | MEDIUM (45) | HQ: Unknown |
| Z Zendesk | Custom Tools | Missing | MEDIUM (45) | HQ: Unknown |
| W WXA | Custom Tools | Missing | MEDIUM (45) | HQ: Unknown |

- Vendor names link to `/vendors/{uuid}` detail pages.
- Pagination chrome present ("Showing 1 to 4 of 4 results").
- No search/sort/filter on this table (unlike ROPA) — **inconsistent**.

**Add Custom Vendor modal:** "Add custom vendor" — fields: Vendor name * (placeholder "e.g. Northbound Analytics") · Website ("https://example.com") · Category ("Analytics") · HQ country ("IE"). Buttons: Cancel / **Add vendor** (disabled until name entered).

### 7.2 Vendor Discovery & Shadow IT (tab)
- **"Trigger Website & DNS Discovery Scan"** — "Scan your public site for tracking scripts, pixels, CDNs, and MX/SPF records to discover undocumented shadow IT." Button: **Scan Website**.
- Two sub-views: **ACTIONABLE INBOX** (1 ITEMS) | **SCAN LOGS & ARCHIVE**
- Inbox item: **Intercom (intercom.com)** — "Source: Dns Analysis | First seen: 7/19/2026 | Unrecognized Domain" + **Add Custom Vendor** action.
- The dashboard's "Undocumented Services: 1" links here — good cross-linking.

### 7.3 DPA Analyzer (`/vendors/analyzer`)
**"AI DPA Analyzer"** — "Automatically review vendor Data Processing Agreements against Article 28." Single control: **Select PDF File** → **Analyze DPA** (disabled until file chosen). No sample output shown; the AI backend is the mocked one, so analysis quality could not be verified. No list of past analyses on this page.

### 7.4 Vendor detail (`/vendors/{id}`) — tested on Slack
**Header:** logo tile "S", name, website link (https://slack.com), **Headquarters: US**, **Certifications:** SOC2 TYPE2 · SOC3 · ISO27001 chips, **EU Data Residency: Available** + toggle "We use the EU data centre".

**CALCULATED RISK SCORE: 40 — MEDIUM.** "Score is dynamically calculated based on jurisdiction (US), DPAs (Not started), security posture, and threat intelligence."

**Risk Factors Breakdown** (weighted, transparent):
| Factor | Points | Detail |
|---|---|---|
| Dpa | +20 / 20 | DPA missing or expired (20/20 pts) |
| Dpia | +0 / 30 | No unmitigated high/critical DPIA risks (0 pts) |
| Breach | +0 / 5 | No known breaches in the last 24 months (0/5 pts) |
| Volume | +0 / 10 | Less than 1,000 data subjects (0/10 pts) |
| Location | +20 / 20 | United States (conditional adequacy, no DPF certified) (20/20 pts) |
| Categories | +0 / 15 | Processes standard data categories (0/15 pts) |
| Safeguards | +0 / 10 | Appropriate transfer mechanisms in place (SCCs/BCRs) (0/10 pts) |
| Sub Processors | +0 / 10 | 0-1 sub-processors (0) (0/10 pts) |
| Certifications | +0 / 10 | SOC 2 + ISO 27001 certified (0/10 pts) |

A fully explainable risk score with visible weights — better than OneTrust's opaque vendor risk scores. (Note the US-location scoring text "conditional adequacy, no DPF certified" is a judgement call the product makes for you; the EU-US DPF exists since 2023, so this scoring string reads stale unless the vendor record explicitly says DPF status is unknown.)

**Five sub-tabs:**

**1. DPA Management** — "Track your legal relationship. A signed DPA is strictly required under GDPR Article 28."
- Status stepper: NOT STARTED → DRAFT → SENT → SIGNED → EXPIRED (clickable states)
- **Upload Signed Document** — "Securely store your executed DPA. This will automatically update your risk score and schedule expiry alerts." + **Select PDF File** (file input id `dpa-upload-input`)
- **Risk Assessment Inputs:** DATA SUBJECT VOLUME (select: < 1,000 subjects / 1,000–10,000 / 10,000–100,000 / 100,000+) · CONTRACT RENEWAL DATE (date) · DPA EXPIRY DATE (date) · SECURITY CERTIFICATIONS (SOC 2, ISO 27001 checkboxes)
- **Vendor DPA Template** — "Publicly provided by Slack" + **Review Template** (opens the vendor's public DPA)

**2. Transfer Impact** — **SCHREMS II PROCESS**, 5-step wizard: 1 Transfer Details · 2 Legal Assessment · 3 Supplementary Measures · 4 Residual Risk · 5 Conclusion
- Step 1 fields: Destination Country · Transfer Mechanism (select: Standard Contractual Clauses (SCCs) …)
- Contextual note: "US Context: Since the invalidation of the Privacy Shield, transfers to the US using SCCs require a TIA to assess risks associated with FISA 702 and EO 12333."
- Nav: ← Previous Step / Next Step →
(The TIA status column on the ROPA Transfers tab links into this — coherent data model.)

**3. Sub-processors** — "Track third-party vendors used by this vendor to process your data."
- **Add Sub-processor** button; table: Sub-processor | Jurisdiction | Risk Status | Added. Empty: "No sub-processors recorded."
- **Sub-processor Change History** — "Track and respond to changes detected on the public sub-processor webpage of this vendor." Empty: "No changes have been detected or recorded for this vendor." (Automated sub-processor page diffing — a premium feature done properly.)

**4. Incidents & Breaches** — "Breach & Regulatory Intelligence — Real-time alerts, GDPR enforcement fines, and data breach updates tracked for this vendor." Empty: "Zero incidents on record. No data breaches, fines, or regulatory actions have been detected for this vendor."

**5. Security Questionnaire** — "Assessments History — Track vendor questionnaires, completed audits, and compliance risk adjustments." **Send Assessment** button. Empty: "No Assessments Found. We haven't sent any security review requests to this vendor yet. Send one to kick off compliance audits." (Questionnaire content/flow not reachable without sending one — not exercised.)

**Missing at module level:** no vendor→ROPA reverse link ("used in 2 activities"), no contract repository beyond single DPA PDF, no renewal workflow beyond a date field (no reminders visible beyond "expiry alerts" claim), no DPA coverage trend, no multi-org vendor sharing (an agency re-vets the same Slack per client).

---

## 8. Trust Portals (`/clients`)
**"Client Management"** — "Manage clients, DPAs, and their secure compliance portals."
**Action:** **Add Client**.
**Stats:** TOTAL CLIENTS 0 · ACTIVE PORTALS 0 · SIGNED DPAS 0
**Table:** Client Name | Primary Contact | Processing Activities | DPA Status | Portal Status. Empty: "No clients added yet. Click 'Add Client' to start managing agency clients."

**Add Client modal ("Add New Client", multi-step):**
- Fields: **Client Name *** ("e.g., Acme Corp") · Legal Entity Name ("e.g., Acme Corporation LLC") · Contact Name · Contact Email · Industry (text/select)
- Buttons: × close · Cancel · **Create Client**
- A "Search clients..." input exists in the modal backdrop area (likely the underlying page search leaking into the modal DOM).

**Findings:** This is the agency-specific differentiator module and it is **the least built**. No portal URL, no client-side invite flow visible from the list, no per-client ROPA scoping demo, no DPA template for the agency→client relationship. The "portal status" column implies client-facing portals exist but nothing in this workspace demonstrates one. For an "OS for Agencies" positioning, this module needs to be the flagship; today it's a CRM table stub.

---

## 9. Data Requests / DSAR (`/dsar`)
**"DSAR Automation"** — "Manage Data Subject Access Requests within the legal 30-day deadline."

**Top stat cards:** OPEN 0 · OVERDUE 0 · DUE WITHIN 7 DAYS 0 · COMPLETED THIS MONTH 0

**Kanban board (5 columns, each a heading with count):**
New 0 · Verification 0 · In Progress 0 · Review 0 · Completed 0

**That is the entire page.** No "New request" button anywhere, no intake form, no import, no empty-state CTA. The board is unreachable-in-practice: with no creation path visible, a user cannot start the core workflow the module exists for.

**Findings:** The status pipeline (verification → review) is the right shape for DSARs (identity verification is a distinct stage — correct). Notification routing has 5 DSAR event types configured (received, 7d/3d warnings, overdue, subject reply), and integrations advertise "Auto-search HubSpot contacts during DSAR processing" — the backend machinery clearly exists. **The front door is missing.** Also missing: statutory clock display (Art. 12(3) "without undue delay… within one month"), extension handling (+2 months, Art. 12(3)), identity-verification evidence storage, response template library, delivery/redaction workflow, Art. 15/16/17/20 request-type distinction (the module says "Access Requests" but real DSAR queues are type-mixed), fee/manifestly-unfounded handling, audit of what was disclosed.

---

## 10. Breaches (`/breaches`)
**"Breach Register"** — "Manage incidents, risk assessments, and supervisory authority notifications."
**Action:** **Report Incident** (opens modal, not a page).

**Empty state:** "No breaches reported — Report a new incident to begin the triage and assessment process."

**Report New Incident modal** (emoji 🚨 header):
- **Incident Title** * (placeholder "e.g., Unauthorized access to CRM")
- **Description** (textarea, "Briefly describe what happened...")
- **Discovery Method** (select; observed option: **Internal Monitoring**)
- **Discovered At** (datetime-local)
- **Breach Type** (select; observed option: **Confidentiality (Unauthorized Access/Disclosure)**)
- Buttons: Cancel · **Start Triage Process** (disabled until required fields valid)

**Findings:**
- "Start Triage Process" implies a dedicated triage workflow (risk assessment → 72h clock → authority decision) downstream — not reachable without creating a real incident, so not exercised. The notification matrix has breach events (new, 48h/12h deadlines, overdue) which implies the 72-hour Art. 33 machinery exists server-side.
- **Route bug:** `/breaches/new` renders **"Breach not found."** — a bare error string page with no heading, no back link. The modal-only flow means deep links to "report a breach" 404 ugly.
- **Missing for Art. 33/34 credibility:** the Art. 33(3) mandatory content list as structured fields (nature/categories/approximate numbers/likely consequences/measures), the Art. 36-style authority contact book per jurisdiction, the "lead vs concerned" supervisory authority determination, data-subject notification decision record (Art. 34 "undue delay" wording), processor→controller breach intake (agencies receive these from clients!), and a post-incident review template.

---

## 11. Privacy Policies (`/policies`)
**"Privacy Policies"** — "Manage and auto-generate legal policies from your ROPA."
**Action:** **New Policy**. **That is the entire page** — no list, no table, no empty state message, not even "No policies yet".

**Findings:** The audit ledger shows two policies exist server-side ("Employee Privacy Policy", "General Privacy Policy" created Aug 21) — **they don't render here.** Either the list query is broken or policies are scoped elsewhere. The ROPA↔policy sync claim ("auto-generate from your ROPA", plus a notification event "Policy out of sync with ROPA") is invisible from this surface. This is the most obviously unfinished module in the product: a headline feature with no working surface.

---

## 12. Cookie Consent / CMP (`/consent`)

### 12.1 Domains list
**"Cookie Consent Manager"** — "Manage consent banners, scan for trackers, and monitor compliance."
**Action:** **Add Domain** (inline form: text input placeholder "www.example.com" + Cancel / **Add Domain** (disabled until input)).

**Domain cards (2):**
| Domain | Script ID | Flags | Pageviews (30d) | Consent rate | Actions |
|---|---|---|---|---|---|
| trycustodia.com | live81ja53 | GCM V2 · TCF | 0 | 0.00% | Analytics · Configure Banner |
| facebook.com | z8rvoqj5 | GCM V2 · TCF | 0 | 0.00% | Analytics · Configure Banner |

(Links: `/consent/{uuid}?tab=analytics` and `?tab=customize`.)

### 12.2 Domain detail — 5 tabs: Installation · Customization · Cookies · Coverage · Analytics

**Installation** — "Install Consent Banner. Copy and paste this snippet into the `<head>` of your website. It must be the very first script to properly intercept and block other tracking scripts."
```
<!-- Custodia Consent Management Platform -->
<script src="https://api.custodia.io/api/cmp/live81ja53/banner.js" async></script>
```
+ **Copy** button. Note: "Google Consent Mode v2 — This script natively supports Google Consent Mode v2. If you are using Google Tag Manager or Google Analytics, simply ensure this script loads before the Google tags. The banner will automatically signal consent updates to Google." Status chip: **GCM V2 DISABLED**.

**Customization** — **"Theme Settings"**: Primary Color (color picker, value #2c3e38 observed in settings context) · Banner Position (select: **Bottom Modal**) · **Save Changes**. Below: a **live banner preview** — "We value your privacy — We use cookies to enhance your browsing experience and analyze our traffic." with **Accept All** / **Reject All** buttons.
- **Missing customization that competitors have:** per-category toggles preview, text/copy editor (banner title/description are hard-coded), language per banner (critical for EU sites), granular "Manage preferences" modal design, geo-targeting rules, blocking mode (strict vs soft).

**Cookies** — "Discovered Cookies — Never scanned." Button: **Run Scanner Now**. Table: NAME | DOMAIN | CATEGORY | PROVIDER. Empty: "No cookies discovered yet. Run the scanner to populate this list."
- **Inconsistency:** the Coverage tab (below) has scan results from Aug 09, but Cookies says "Never scanned" — two tabs disagree about scanner state.

**Coverage** — the standout feature. **"Tracker Reconciliation"** — "The page is loaded twice — once without answering the banner, once with consent given — and every tracker seen is checked against the categories this banner declares."
- Meta: "Last scan: Aug 09, 2026 12:02 AM | CMP: none detected | 1 hosts before consent, 1 after"
- Warning: "This scan could not confirm it reached a consented state, so findings that depend on the second pass are marked as needing verification." + **Scan running…** indicator
- Severity counters: CRITICAL 0 · HIGH 0 · MEDIUM 3 · LOW 0 · INFO 0
- **"Declared categories vs observed trackers"** — "A category with trackers but no banner option can never have consent collected for it." Four category cards (ANALYTICS / FUNCTIONAL / MARKETING / NECESSARY), each "Offered by the banner · 0 trackers — Nothing observed needing this category." + note "1 other host loaded before consent that match no tracker in the registry."
- **Findings list** (filters: "Show informational", "Include closed"): 3 × **MEDIUM "Cookie with no documented purpose — Unknown — Last seen Aug 09, 2026"**

This pre/post-consent dual-load reconciliation is genuinely best-in-class thinking (it's how you catch trackers that fire before consent). The "CMP: none detected" on Custodia's own domain is an honest (embarrassing) self-finding.

**Analytics** — TOTAL PAGEVIEWS 0 · ACCEPT ALL RATE --% "Awaiting data" · REJECT ALL RATE --% "Awaiting data" + "Advanced Analytics Available Soon — Detailed breakdowns by country, interaction type, and browser will appear here once enough consent logs are collected."

**Module findings:** GCM V2 flag is advertised on the card but shows DISABLED in Installation with no visible toggle to enable it. TCF is flagged but no TCF configuration surface exists. No cookie policy generator, no consent log export (Art. 7(1) *demonstrating* consent requires exportable records — the retention policy mentions "Consent records: retained for 5 years" so they exist server-side), no IAB TCF vendor list management, no cross-domain consent, no bot filtering stats.

## 13. Audit Readiness (`/audit`)

Three sub-views: **Dashboard · Evidence · Immutable Ledger**

### 13.1 Dashboard
- **OVERALL COMPLIANCE SCORE: 62** — "SCORE: Fair posture. Action required."
- **Compliance Pillars** (each a % score): ROPA 100 · VENDORS **0** · DPIAS **0** · POLICIES 50 · DSARS 100 · BREACHES 100 · TRAINING 100 · TRANSFERS 100 · CONSENT 100
  - **Finding:** DSARS/Breaches/Training/Transfers/Consent all score 100% while those modules are empty or stubs. The scoring rewards *absence of detected problems* as perfection. A vendor register with zero DPAs signed scores Vendors 0 (correct), but a DSAR queue that has never processed a request scores 100 (absurd). The score model needs "no data ≠ compliant" handling.
- **Detected Gaps: 12 Active** — filter chips: `All Gaps` · `Scanner Detected` · `DPIA Identified`
  Each gap card: severity chip · title · explanation · "Detected: {date}" · article citations · actions **Explain / Resolve / Dismiss** (Resolve deep-links, e.g. `/ropa/{id}?tab=legal`).

  The 12 gaps at test:
  1. MEDIUM — Legitimate interests with no assessment: Custom Processing Activity — "Legitimate interests is the one lawful basis that is a judgement rather than a fact, and Article 5(2) makes the controller responsible for demonstrating that it was made..." (Art. 6(1)(f), 5(2))
  2. MEDIUM — Legitimate interests with no assessment: Website Analytics Tracking (same text)
  3. CRITICAL — Special-category data with no Article 9(2) condition: Payroll & Tax Processing — "'salary_information' is recorded as special-category data. Article 9(1) prohibits processing it unless one of the Article 9(2) conditions applies, and none is recorded — so the register asserts a prohibition is engaged and offers no lawful route through it." (Art. 9(2))
  4. MEDIUM — No categories of personal data: Custom Processing Activity (Art. 30(1)(c))
  5. MEDIUM — No categories of data subject: Employee HR Management (Art. 30(1)(c))
  6. MEDIUM — No categories of data subject: Email Marketing Campaigns
  7. MEDIUM — No categories of data subject: Website Analytics Tracking
  8. MEDIUM — No retention period: Custom Processing Activity (Art. 30(1)(f), 5(1)(e))
  9. HIGH — Missing DPA: Slack (Detected 8/19/2026)
  10. HIGH — Missing DPA: WXA (8/12/2026)
  11. HIGH — Missing DPA: Zendesk (8/12/2026)
  12. HIGH — Missing DPA: Dropbox (8/12/2026)

  The gap explanations are written like a DPO wrote them — the Art. 9(2) one in particular ("the register asserts a prohibition is engaged") is exactly the right framing. This gap engine is the product's second-best feature after the ROPA completeness model.
- **Reporting & Exports:**
  - **Article 30 Record (ROPA)** — "Export the legally required Record of Processing Activities. Includes both Controller and Processor (Client) records." → **Download CSV**
  - **One-Click Audit File** — "Generates a comprehensive .zip package containing all required compliance documentation for an auditor (Article 30, Vendor DPAs, DPIAs, Policies)." → **Generate Complete Audit ZIP**

### 13.2 Evidence
- Stat cards: **ARTICLES COVERED 0/23** · EVIDENCE EXPIRED 0 · NO EVIDENCE 23 · DOCUMENTATION 0%
- **"Evidence by article"** + **Add evidence** button. One card per article (23), each with title, rationale, item count:
  Art. 5 Principles of processing · Art. 6 Lawfulness · Art. 7 Conditions for consent · Art. 9 Special categories · Art. 12 Transparent information · Art. 13 Information to be provided · Art. 14 Information where data not obtained from the subject · Art. 15 Right of access · Art. 17 Right to erasure · Art. 20 Right to data portability · Art. 24 Responsibility of the controller · Art. 25 Data protection by design and by default · Art. 28 Processor contracts · Art. 30 Records of processing activities · Art. 32 Security of processing · Art. 33 Breach notification to the authority · Art. 34 Breach communication to data subjects · Art. 35 Data protection impact assessment · Art. 37 Designation of a DPO · Art. 39 Tasks of the DPO · Art. 44 General principle for transfers · Art. 46 Appropriate safeguards · Art. 49 Derogations
  Each has a one-line "what an auditor wants" rationale, e.g. Art. 33: "A breach register and evidence the 72-hour path has been rehearsed."
- Empty-state footer: "No evidence recorded yet — An auditor asks, for each obligation, to be shown the document that discharges it. Attach the first one and the articles above start filling in."
- **Add evidence modal:** fields **What is it? *** (name) · **Link** (URL) · **Review by** (date) — "After this date the article it covers reverts to uncovered — evidence nobody has revisited proves nothing." · **Articles it covers *** (multi-select of all 23 articles) · Cancel / **Add evidence**.
- **Evidence expiry** as a first-class concept ("evidence nobody has revisited proves nothing") is the correct accountability model and rare in competitors.

### 13.3 Immutable Ledger
- **"Immutable Audit Ledger"** — "Article 5(2) Demonstrable Accountability. All records are read-only and cryptographically secure."
- Toolbar: **All Resource Types ▾** filter · **Export CSV** · **Filters**
- Table: Timestamp | User | Action | Resource | IP Address | Details
- Sample entries (all mudkix9@gmail.com): "Performed ai → streamCopilot" (ai) · "Created processing activity 'Test Processing Activity'" (processing_activity) · "Created privacy policy 'Employee Privacy Policy'" (privacy_policy) · "Performed export → generateExecutiveReport" (export) · "Performed dpia → updateResidualRisks" ×many · "Performed vendors → confirmDiscovery" (vendor) · "Updated a data category" — each with **View Diff** link and public-ish IPs (10.60.x.x internal range observed).
- "Cryptographically secure" is claimed in the header copy; no hash-chain verification UI or proof export is exposed. Either ship the verification or soften the claim.

**Module findings:** strongest cross-cutting module. Missing: ledger search by entity (only type filter), retention/purge policy visibility, SIEM/log shipping, and a "compliance score methodology" page explaining pillar math.

---

## 14. Training (`/training`)
**"My Training"** — "Complete your mandatory data protection and security training."
**Section:** "Assigned Modules — You have no assigned training modules."

That is the entire module. No admin view to create/assign courses, no course catalogue, no completion tracking UI, no certificates. Yet Training is a **compliance pillar scored 100%** in Audit, appears in Analytics as a completion chart, has a notification event ("Training assigned"), and is listed in the Professional plan features. **The module is a placeholder with downstream dependencies wired.**

**What a buyer expects:** course library (GDPR basics, phishing, role-specific DPO/processor modules), assignment campaigns with deadlines, per-user completion + reminder escalation, certificates as audit evidence (feeding Art. 39 / ISO 27001 A.7), SCORM import at minimum.

---

## 15. Compliance Co-Pilot (`/copilot`)
**"Context-aware AI assistant grounded in official GDPR text and your organisation's data."**

- Greeting: "Hello! I'm your Custodia Co-Pilot. Ask me anything about GDPR compliance, Article 28 requirements, or your organisation's specific processing activities."
- **Suggested prompts** (clickable): "Do I need a DPIA for tracking employee locations?" · "What must an Article 28 processor contract contain?" · "How long can I keep job applicant data?"
- **New conversation** button appears after the first exchange.
- Input: "E.g., Do I need a DPIA for tracking employee locations?" + **Ask** (disabled when empty).
- Disclaimer under input: "AI can make mistakes. Please verify important compliance advice."

**Tested:** clicked the DPIA suggestion. Response:
> "Disclaimer: No direct matching sources were found in the database. The following is general compliance guidance based on standard data protection knowledge.
> **This is a mock response because the Anthropic API failed or is not configured.**"

**Findings:** The RAG framing ("grounded in official GDPR text and your organisation's data") is the right architecture, and the corpus exists (`packages/db/corpus/edpb-corpus.json`, `bfdi-corpus.json` in the repo). But in this deployment the flagship AI feature returns its own error message to end users. The per-context **AI Guidance** panels across ROPA/Vendors/Consent presumably share this backend — all AI surfaces are inert here. The disclaimer and "New conversation" reset are good touches.

---

## 16. Regulatory Updates (`/updates`)
**"Regulatory Feed"** — "Chronological history of all GDPR updates and DPA guidelines."
**Controls:** **Filter** button. **Empty:** "No regulatory updates found."

A feed module with no content and a filter for content that doesn't exist. For a product whose corpus includes EDPB documents, populating this is low-effort high-value (EDPB guidelines, national DPA fines, EDPB opinions 28/2024 on AI models, etc.). As shipped it's an empty promise.

---

## 17. Settings (`/settings/*`)

Settings has its own left sub-nav, two groups:
**ORGANIZATION:** Organization · Team · Notifications · Integrations · Billing · Security · Data & Privacy
**PERSONAL:** My Profile

### 17.1 Organization Profile (`/settings/organization`)
- **Basic Information:** Organization Name (value "W") · Legal Name · Public Slug (value "w"; preview `custodia.io/legal/w/privacy`) · Registration Number
- **Location & Jurisdiction:** Country (select, value **Ireland**) · Street Address · City · Postal Code · **Lead Supervisory Authority** (placeholder "e.g. BfDI (Germany) or CNIL (France)")
- **Data Protection Officer:** "Do you have a DPO?" toggle — "Under GDPR, a DPO is required if you regularly process personal data on a large scale or process special category data." · DPO Name (value "Nisarg") · DPO Email (value "nisugajera22@gmail.com") · "Is the DPO external?" toggle
- **Branding:** Organization Logo (Upload Logo — "Recommended: 400x100px PNG or SVG") · Primary Brand Color (color input, value `#2c3e38`) + **Trust Portal Preview** (live mini-preview with "W" tile)

The country setting drives the DPIA module's Art. 35(4) authority list ("in IE") — real functional coupling, not decoration.

### 17.2 Team (`/settings/team`)
**"Team Management" — "Members, roles, and granular access permissions for this workspace."**
- **MEMBERS ACTIVE: 1 / 1** — "Everyone has accepted their invitation." Buttons: **Invite new members** · **Bulk invite via CSV**
- Invite row: email input · Role select (**Admin / Member / Viewer**) · **Send invite** — "Invitations expire after 7 days. Roles can be changed at any time after joining."
- Members table: MEMBER | EMAIL | ROLE | STATUS | ACTIONS → "M MudKix — You · Workspace owner — mudkix9@gmail.com — Owner — Active — Joined Jul 12, 2026"
- **Pending invitations: 0** — "No invitations awaiting a response."

**Findings:** "1 / 1" members implies a seat cap on the current plan, but Billing says Professional = "Unlimited users" — contradiction. Roles are only Admin/Member/Viewer + Owner; "granular access permissions" is claimed in the subtitle but no permission matrix exists (no per-module roles, no approval-only roles — which the ROPA approval workflow begs for: a "Reviewer" who can approve but not edit). No SSO on this plan (Enterprise only), no SCIM, no 2FA enforcement policy (MFA exists per-user in Security), no audit of invite/role changes surfaced here (they do hit the ledger).

### 17.3 Notifications (`/settings/notifications`)
**"Platform Settings — Manage integrations and global notification routing."** + **Save Changes**

**Slack Integration:** Incoming Webhook URL input — "Create an Incoming Webhook in your Slack workspace settings and paste the URL here to enable Slack notifications."

**Notification Routing matrix** — "Admin Note: The checkboxes control the organization-wide defaults. Individual team members can click the bell icon next to a channel to mute it for themselves personally."
Columns: EVENT TYPE | EMAIL | SLACK | IN-APP
- **DSARS:** New DSAR received · DSAR deadline warning (7d) · DSAR deadline warning (3d) · DSAR overdue · DSAR subject reply received
- **BREACHES:** New breach reported · Breach notification deadline (48h) · Breach notification deadline (12h) · Breach overdue
- **VENDORS & COMPLIANCE:** Vendor DPA expiring (30d) · Vendor DPA expired · Compliance gap detected · Training assigned · Policy out of sync with ROPA

(43 checkboxes rendered; a mix of checked/unchecked defaults.) The 48h/12h breach escalation ladder and 7d/3d DSAR ladder show real operational thinking. **Missing:** digest mode, quiet hours, per-event webhook (beyond Slack), Microsoft Teams, email template preview.

### 17.4 Integrations (`/settings/integrations`)
**"Connect CRM and marketing tools for automated DSAR discovery."**
Each available card: "When connected, Custodia can: Auto-search {system} contacts during DSAR processing · Auto-discover processing activities" + **Connect**:
- **HubSpot** · **Salesforce** · **Google Workspace** · **Mailchimp**
**Coming Soon** (with **Request** buttons): Xero · QuickBooks · ActiveCampaign · Brevo

**Missing:** the Connect flows were not exercised (would need real OAuth apps); no Jira/ServiceNow (where DSAR intake actually lands in enterprises), no data-subject-facing intake form embed, no API keys/webhooks section for custom integration — notable omission for a "Compliance OS".

### 17.5 Billing (`/settings/billing`)
**"Billing & Subscriptions — Manage your plan and payment methods."**
**Available Plans:**
- **Professional — €99/mo** — "The complete OS for growing agencies." Unlimited users & activities · Unlimited vendors & DPIAs · Cookie consent (50 domains) · AI compliance advisor (2,000 queries) — chip: **Current Plan**
- **Enterprise — Custom/mo** — "For large organizations needing custom compliance controls." Everything in Professional · Custom data residency · SSO & Custom Roles · Dedicated Account Manager — **Contact us**

No payment methods section, no invoices/receipts, no seat usage (despite Team showing "1 / 1"), no plan-comparison table, no Paddle customer portal link (Paddle is the billing backend per config). The "AI compliance advisor (2,000 queries)" quota has no usage meter anywhere.

### 17.6 Security (`/settings/security`)
- **Password:** Current Password · New Password · Confirm New Password + **Update Password** (console notes missing `autocomplete="current-password"/"new-password"` attributes — minor a11y/UX gap for password managers).
- **Multi-factor Authentication (MFA):** "Authenticator App — Not configured" + **Enable MFA**
- **Active Sessions:** "No active sessions found." — **finding:** the current session exists (we're logged in); an empty sessions list means session tracking isn't wired to the display (or Google-OAuth sessions are excluded). Also no "sign out all devices".

### 17.7 Data & Privacy (`/settings/data`)
- **Export Data** — "You can request a complete export of your organization's data. This includes all processing activities, vendor assessments, DSAR records, breaches, and uploaded documents." → **Download All Data** — "A zip file will be sent to your email when ready."
- **Data Retention Policy** (display): Active account data: retained as long as active · Consent records: 5 years after collection (regulatory requirement) · Audit logs: 3 years after event · Deleted account data: permanently removed 30 days after deletion request · Backups: purged within 90 days of deletion
- **Danger Zone** — "Permanently delete this organization and all of its data. This action cannot be undone. Data will be hard-deleted after a 30-day grace period." → **Delete Organization** (red)

Good GDPR-native retention disclosure. **Missing:** per-module export selection, export history/status, a documented DPA with the customer (Custodia is a processor for its customers' compliance data — where's the Art. 28 contract?), sub-processor list for Custodia itself (an auditor will ask), and data-residency display.

### 17.8 My Profile (`/settings/profile`)
- **Personal Information:** Full Name (MudKix) · Email Address (mudkix9@gmail.com) · Language (English) · Timezone (UTC) + **Save Changes**
- **My Notification Preferences** — same 15-event × EMAIL/SLACK/IN-APP matrix as org settings — "Mute specific notifications that you don't want to receive. If unchecked, the organization default routing will be used."

**Missing:** avatar upload, password change link (it's under Security), linked OAuth accounts display (Google is connected — invisible here), API tokens, download-my-data (Art. 15 for the user as a data subject of Custodia).

---

## 18. Support (`/support`)
**"Enterprise Support"** — "Priority support is available exclusively for Enterprise customers. Upgrade your plan to get guaranteed SLAs and a dedicated account manager." + **Manage Subscription** (→ `/settings`)

That's the whole page: a paywall. No knowledge base, no docs link, no community, no ticket form for non-enterprise, no status page link. For a compliance product where users will have urgent regulatory questions, this is the weakest single page in the app.

---

## 19. Complete Sitemap (every route found)

**Public/auth:** `/login` (email + Google OAuth; OAuth callback `/api/auth/callback/google`)

**Overview**
- `/dashboard`
- `/analytics`

**Records**
- `/ropa`
- `/ropa/new`
- `/ropa/{id}` (tabs: general, legal, data, recipients, transfers, retention, security, dpia, governance, work, history)
- `/ropa/insights` (sub-tabs: data map, transfers, completeness, material changes, special-category-only — all one page)
- `/ropa/catalogues` (tabs: data elements, data subject categories)
- `/ropa/import` (file input; no dedicated page observed)
- `/dpia`
- `/dpia/{id}` (single long-form document)
- `/vendors`
- `/vendors?tab=discovery`
- `/vendors/analyzer`
- `/vendors/{id}` (tabs: DPA management, transfer impact, sub-processors, incidents, questionnaire)
- `/clients` (+ Add Client modal)

**Requests & incidents**
- `/dsar` (kanban; no intake route found)
- `/breaches` (Report Incident modal)
- `/breaches/new` — **BROKEN: renders "Breach not found."**

**Compliance**
- `/policies` (list only; no new-policy route surfaced)
- `/consent`
- `/consent/{id}?tab=installation|customize|cookies|coverage|analytics`
- `/audit` (sub-views: dashboard, evidence, ledger)
- `/training`

**Intelligence**
- `/copilot`
- `/updates`

**Settings**
- `/settings` → `/settings/organization`
- `/settings/team`
- `/settings/notifications`
- `/settings/integrations`
- `/settings/billing`
- `/settings/security`
- `/settings/data`
- `/settings/profile`

**Locale-prefixed variants:** `/de/...`, `/fr/...` (all routes)

**Not found but implied by copy:** client trust-portal public URLs, DPIA Art. 36 consultation flow, policy editor/generator, DSAR intake, breach triage detail, evidence library list view.

---

## 20. Component Inventory & Consistency

| Component | Where used | Consistent? |
|---|---|---|
| **Sidebar nav (grouped, icon+label)** | Global | ✅ consistent; detail pages add "Detail" breadcrumb chip |
| **Top bar (title + search + bell)** | Global | ✅ |
| **Command palette (Ctrl+K)** | Global | ✅ single implementation; entity-jump only, no commands |
| **Data tables (sticky header, pagination footer)** | ROPA, Vendors, Clients, Catalogues, Ledger, DSAR(n/a) | ✅ same chrome ("Showing X to Y of Z", Previous/Next); ⚠️ no sorting anywhere, no column config, no bulk actions |
| **Stat card rows** | Dashboard, Analytics, Vendors, Clients, DSAR, Audit, Consent | ✅ consistent pattern |
| **Modals (Radix dialog, × + Cancel + primary)** | Add Client, Add Custom Vendor, Report Incident, Add evidence | ✅ consistent; ⚠️ Add Domain renders as inline form, not modal (inconsistent) |
| **Comboboxes (Radix select)** | Lawful basis, status, risk, owners, retention period, country, reviewer, cadence, vendor pickers | ✅ consistent |
| **Toggles/switches** | Systematic monitoring, profiling, TOMs (8), EU residency, DPO, attestation | ✅ |
| **Tabs (Radix)** | ROPA detail (11), Vendor detail (5), Consent detail (5), Audit (3), Catalogues (2) | ✅ same style; ⚠️ ROPA list "Insights/Retention/Discovery/Data collection" buttons look like tabs but are 4 links to 1 page |
| **Wizards/steppers** | Schrems II TIA (5 steps) | only instance; no shared stepper component reused |
| **Kanban board** | DSAR only | only instance |
| **Charts (Recharts)** | Analytics (5) | ✅ gold/gray theme; ⚠️ negative-dimension console warnings |
| **Toasts/alerts** | seen in DOM (`alert` region) | present but rarely fired during testing — feedback for saves was mostly silent |
| **AI Guidance panel** | ROPA tabs, Vendor tabs, Consent tabs | ✅ consistent placement + "Grounded in GDPR & Org Context" badge |
| **Severity chips** | Audit gaps (CRITICAL/HIGH/MEDIUM/LOW/INFO), vendor risk | ✅ consistent palette |
| **Empty states** | every module | ✅ always present, usually with guidance copy — a real strength; ⚠️ `/policies` and `/updates` lack the guidance copy; catalogue DSC table renders empty rows instead of an empty state (bug) |
| **Forms** | ROPA new, DPIA, all modals | ✅ labels + required `*` + help text pattern consistent; validation is disable-the-submit (no inline error messages observed) |

**Cross-cutting inconsistencies:** three different compliance headline numbers (62/72/62); four ROPA sub-nav buttons → one page; DSAR chart data vs module data; Cookies tab vs Coverage tab scanner-state disagreement; "1/1 members" vs "Unlimited users" plan; enabled Publish button vs BLOCKS PUBLISHING labels.

---

## 21. Bugs & Broken Things (consolidated)

1. **`/breaches/new` → "Breach not found."** — bare error page, no layout, no recovery link.
2. **Catalogues → Data subject categories table renders 19 empty rows** (headers only, zero cell content). Data exists (19 count, and ROPA records reference categories).
3. **Co-Pilot (and all AI surfaces) return mock-error responses** — `ANTHROPIC_API_KEY="dummy_key"` in deployment config; the flagship AI feature is inert in production.
4. **Analytics charts show seed/demo data** (8 DSARs, training completions, 14-month history) that contradicts the account's real (empty) state — misleading on a compliance product.
5. **`/policies` renders no policy list** even though two policies exist (audit ledger proves creation) — list query or scoping broken.
6. **ROPA sub-nav: Insights/Retention/Discovery/Data collection all link to `/ropa/insights`** — three dead buttons; the page's own sub-tabs (Transfers, Completeness, Material changes) don't switch content.
7. **Publish button enabled while completeness card says fields "BLOCKS PUBLISHING"** — contradictory affordance.
8. **No delete for processing activities** anywhere (test record cannot be removed via UI).
9. **Recharts width/height(-1) console warnings** on Analytics load (×5).
10. **Security → Active Sessions shows "No active sessions found"** while a session is obviously active.
11. **Cookies tab says "Never scanned"** while Coverage tab shows a completed Aug 09 scan with findings — state disagreement.
12. **GCM V2 badge on domain card vs "GCM V2 DISABLED" in Installation** with no toggle to reconcile.
13. **Password fields missing `autocomplete` attributes** (console warnings; password-manager friction).
14. **German/French localisation is nav-chrome-only** — page content untranslated; switching locales yields mixed-language UI (and untranslated keys would show as raw dotted paths if ever keyed).
15. **Team "MEMBERS ACTIVE 1 / 1"** contradicts Billing "Unlimited users & activities".
16. **Import CSV has no template/mapping/preview** — direct file-chooser fire.
17. **No inline validation messages** — forms only disable submit; a user gets no reason why.
18. **No table sorting anywhere**; ROPA list lacks search-visible column coverage confirmation (search scope is only promised in placeholder text).

---

## 22. What's Missing — Domain-Expert Assessment

### ROPA (Art. 30)
- **Joint-controller arrangement capture (Art. 26)** — role option exists, but no field for the arrangement/essence-of-division document.
- **Processor records (Art. 30(2))** — the role selector implies them, the exports mention "both records", but no processor-specific surface (subject matter/duration/processing nature/categories/obligations evidence) is visible.
- **Data-subject rights operationalisation per activity** — which rights apply to which activity (e.g., portability only where consent/contract + automated means) is not modelled.
- **International transfer row → TIA linkage is present**, good — but no adequacy-decision date/version display.
- **No record-level sharing/publish to client portal** (the agency use case).
- **Tags column exists with no tag editor** — dead column.

### DPIA
- No **Art. 36 prior consultation** workflow (filter chip exists; flow doesn't).
- No **residual-risk heatmap** or computed residual score display.
- No **re-review scheduling** tied to ROPA review cadence.
- No **template customisation** (org-level template editor).
- Risks lack **mitigation owner/due date** (they're static text+scale).

### DSAR
- **The intake flow is entirely missing** (no create button/form/route). This alone makes the module unusable.
- No request-type model (access/erasure/rectification/portability/objection/automated-decision), no statutory clock UI, no extension logic, no identity-verification evidence, no response templates, no secure delivery, no exemption logging (Art. 12(6)/23).

### Breaches
- No **Art. 33(3) structured content** fields, no 72-hour countdown clock UI, no authority contact book, no Art. 34 decision record, no processor-intake channel, no post-incident review.

### Consent/CMP
- No **consent record export** (Art. 7(1) demonstrability) despite 5-year retention claim.
- No **per-category banner preview**, no multi-language banners, no geo-rules, no TCF configuration surface, no GCM V2 enable toggle.
- No **cookie policy generator** (policies module is broken anyway).

### Vendor
- No **vendor↔activity reverse lookup**, no renewal reminder configuration, no questionnaire template library, no multi-client vendor reuse (agency pain), DPF-era US scoring text is stale.

### Platform
- **No API/webhooks** for a "Compliance OS".
- **No client-facing trust portal demo path** despite the module name.
- **No onboarding** (sample-data toggle, guided setup, ROPA import wizard).
- **No notification centre UI** behind the bell (unverified with content).
- **No help/docs anywhere** in-app (Support is a paywall).
- **No data-residency/region display**, no Custodia sub-processor list, no customer-facing DPA.
- **Training and Regulatory Updates are placeholders** with downstream metrics wired to them.

---

## 23. Price-Point Assessment (€99/mo Professional)

**Competes with:** OneTrust (~$50k+/yr), TrustArc, Osano (~$10k/yr), Iubenda (~€89/yr per site, single-purpose), Termly (similar), Secure Privacy, CookieYes.

**At €99/mo, what you get here that competitors don't at 5–10× the price:**
- Article-citation-level ROPA completeness with publish gating — OneTrust doesn't do this per-record.
- Regulator-native ROPA export templates (CNIL/ICO/DSK/AEPD) — unique.
- WP248 + Art. 35(4) jurisdiction-aware DPIA screening.
- Explainable vendor risk with published weights.
- Pre/post-consent tracker reconciliation.
- Evidence-with-expiry audit model.
- Immutable ledger with diffs and IPs.

**What you don't get at €99/mo that cheaper tools ship:**
- A working DSAR intake (Iubenda/Termly have web widgets).
- A working policy generator (Termly/Iubenda's core).
- Training content (Osano/OneTrust bundles it).
- Working AI features (the marketing promise).
- Non-English UI beyond nav chrome (Iubenda ships 8+ languages).

**Verdict:** The compliance *engine* is under-priced for its depth; the *product surface* is over-priced for its completeness. If the broken/shell modules (DSAR intake, policies, training, AI, i18n) were finished, this is a €299–499/mo product. As shipped, a buyer trialing it will hit the empty DSAR module within ten minutes and churn — despite the best ROPA on the market.

---

## 24. Final Scores (1–10)

| Module | Depth | Working? | Polish | Overall |
|---|---|---|---|---|
| ROPA | 10 | 9 (no delete, publish affordance) | 9 | **9.5** |
| Audit Readiness | 9 | 9 | 8 | **9** |
| Vendors | 8 | 8 | 8 | **8** |
| DPIA | 8 | 8 | 8 | **8** |
| Cookie Consent | 8 | 7 (GCM toggle, scanner-state bugs) | 7 | **7.5** |
| Dashboard/Analytics | 6 | 5 (demo data) | 7 | **6** |
| Settings | 7 | 8 | 7 | **7.5** |
| Trust Portals | 3 | 3 | 5 | **3** |
| Breaches | 4 | 4 (modal works; route broken) | 5 | **4** |
| DSAR | 3 | **1 (no intake)** | 5 | **2** |
| Privacy Policies | 2 | **1 (list broken)** | 2 | **1.5** |
| Training | 1 | 1 | 3 | **1.5** |
| Regulatory Updates | 1 | 1 | 3 | **1.5** |
| Co-Pilot | 5 (design) | **1 (mock)** | 4 | **2** |

**Product readiness: ~65%.** Ship-ready today for a solo DPO who lives in ROPA + Audit. Not ship-ready for the "agencies" in the tagline (Trust Portals stub) nor for anyone whose primary pain is DSARs.

**Strongest:** ROPA, Audit Readiness, Vendors, DPIA — the records-and-evidence core is genuinely expert-grade and the copy quality is a moat.
**Weakest:** DSAR (unusable), Policies (broken), Training/Updates (shells), Co-Pilot (mocked in prod).

**The five fixes that change the buying decision, in order:**
1. DSAR intake flow (button → form → board card → clock).
2. Fix `/policies` list + ship the ROPA→policy generator.
3. Wire the real Anthropic key or hide AI surfaces until configured.
4. Purge demo data from Analytics; reconcile the three compliance scores.
5. Delete/archive for records + fix `/breaches/new` + catalogue DSC table rendering.

---

## 25. Test Log — What Was Exercised vs Not

**Fully explored:** all 14 sidebar modules; ROPA list/create/detail (11 tabs)/filters/export menu/catalogues/insights; DPIA list/templates/detail; Vendors list/discovery/analyzer/detail (5 tabs); Consent list/add-domain/detail (5 tabs); Audit (3 sub-views + Add-evidence modal); all 8 settings pages; Add Client, Add Custom Vendor, Report Incident modals; command palette; user menu; language switcher (en→de→en); create-flow (one test activity created end-to-end).

**Not exercised (and why):** Publish/attestation/approval submission (creates real workflow state), export downloads (server-side generation confirmed via ledger), DPA upload/TIA wizard completion (needs real PDFs), scanner runs (external side effects), integrations OAuth (needs real apps), billing checkout (real money), Delete Organization (destructive), MFA enrolment (locks account), DSAR/breach record creation (module has no intake), Co-Pilot beyond one mock response (backend mocked), responsive/mobile layouts (single viewport tested ~1920px), browser resize behaviour.

**Console errors observed:** Recharts dimension warnings (Analytics ×5); password-field autocomplete suggestions (Security ×3); no hard errors during navigation.

*Report ends.*



