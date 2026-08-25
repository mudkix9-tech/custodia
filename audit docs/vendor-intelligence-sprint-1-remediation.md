# Vendor Intelligence — Sprint 1 remediation record

**Status of the Sprint 1 "make the module usable" scope from
`vendor-intelligence-module-audit-final.md`, plus the defects found reviewing it.**

Sprint 1 landed as `32eac8d` (25 August 2026). Reviewing it found that four of its
five user-facing surfaces failed on first contact and six items were closed on
paper but inert in the code; those were remediated in `00b8499`, and the three
findings in §3.1.4, §3.2.2 and §3.2.3 in the commit carrying this file.
Database migrations `0051_neat_cerebro`,
`0052_unusual_giant_man` and `0053_third_ma_gnuci` are applied to Supabase.

**Date:** 25 August 2026. Gate: `npm run check` green — both workspaces at 0 type
errors, nine guard invocations, 11 fixture suites (**125 assertions** in
`test:vendors`).

> **Read §1 as of `main`, not as of `32eac8d`.** An earlier version of this file
> reported every scope item "Closed" while §3 simultaneously listed the reasons
> several of them were not — because §1 and §3 were written against different
> commits. The delivered/remediated split below is what actually happened.

---

## 1. Sprint 1 scope — delivered, and what it took

| Audit ID | Feature / fix | Delivered `32eac8d` | Remediated | Status on `main` |
|---|---|---|---|---|
| **D2 / D3** | Art. 30(1)(d) `dataCategoriesShared` write path, editor, special-category risk factor | write path only | vocabulary replaced the English keyword scan | **Closed** |
| **D6** | Human review gate (`reviewedAt`) before questionnaire modifiers move risk | yes | `updateOrgVendor` was silently undoing it; `reviewAssessment` permission-gated | **Closed** |
| **D9 / D24 / D25** | EDPB 01/2020 Step 1 & 6 fields, register sync, real PDF export | fields + export | partial-save semantics; suspend ≠ green tick; three fields the PDF dropped; all three measure groups in the wizard | **Closed** |
| **D11** | Persist analysed DPAs to S3 / `documents`, link `dpaDocumentId` | yes | ownership proved before upload; orphan cleanup; customer filename | **Closed** |
| **D30** | Lifecycle status, Art. 28(3)(g) `deletionCertificateRef`, safe `unlinkVendor` | column written | nothing read it; `unlinkVendor` had no caller and destroyed evidence | **Closed** |
| **D31** | Relationship review tracking | stamped on every edit | separated into `vendors.attestReview` | **Closed** |
| **D32** | Governance fields (`businessOwner`, `contactEmail`, `criticality`, `processingRole`) | columns + inputs | the inputs could not be typed into | **Closed** |
| **D33** | Vendor audit trail timeline and regulator CSV | reader only | the middleware wrote no diffs for any vendor path | **Closed** |
| **D40** | RFC 4180 CSV import, column aliasing, fuzzy matcher, preview/commit | yes | transaction, de-duplication, ignored-column report, real sub-processor counts | **Closed** |
| **D41** | Server-side search, filtering and sorting | parameters only | search was a 500; sort was per-page | **Closed** |

---

## 2. Database migrations and live deployment

Applied and verified against Supabase
(`aws-0-eu-north-1.pooler.supabase.com:6543`, project `vmoyeepqfcufqolsiztb`) on
25 August 2026. Full record, including the before/after score table and the
`__drizzle_migrations` id trap, in `vendor-intelligence-deployment-notes.md`.

1. **`0051_neat_cerebro`** — six columns on `organization_vendors`:
   `business_owner varchar(255)`, `contact_email varchar(255)`,
   `criticality varchar(20)`, `processing_role varchar(30)`,
   `offboarded_at timestamp`, `deletion_certificate_ref varchar(255)`.
2. **`0052_unusual_giant_man`** — composite indexes for the register:
   `idx_ov_org_status (organization_id, status)`,
   `idx_ov_org_risk (organization_id, risk_score)`,
   `idx_ov_org_review (organization_id, next_review_at)`.
3. **`0053_third_ma_gnuci`** — `ON DELETE SET NULL` on
   `transfer_impact_assessments.org_vendor_id`, so unlinking a vendor no longer
   throws a foreign-key violation and the Chapter V document survives. Verified:
   `pg_constraint.confdeltype` is `n`.
4. **Driver correction** — `prepare: false` in `packages/db/src/migrate.ts`.
   PgBouncer transaction mode does not carry prepared statements between
   backends, and postgres-js prepares by default; without this no migration can
   run against this `DATABASE_URL` at all.
5. **Recalculation** — `npm run recalc:vendor-risk -- --apply`. Every score was
   unchanged, which is correct here: this database has 0 completed questionnaires
   and empty `data_categories_shared`, so neither formula change had an input.

---

## 3. Review findings

All ten findings below were real. Seven were fixed in `00b8499`; §3.1.4, §3.2.2
and §3.2.3 in the commit carrying this file. Kept in full because the *shape* is
the lesson: every one of them
type-checked, passed the tenancy and i18n guards, and passed `npm run check`.

### 3.1 High-severity and usability

1. **Keystroke-level mutations and focus loss in `VendorRelationshipPanel`** —
   `contactEmail` fired `updateMutation.mutate` on every keystroke against
   `z.string().email()`, so the first character failed validation and cleared the
   field; no email could ever be entered. `businessOwner`, `contactEmail` and
   `deletionCertificateRef` also set `disabled={isPending}`, which blurred the
   input on the first character.
   **Fixed:** module-scope `DraftField` holding a local draft, committing on
   blur. Module scope matters — a component declared inside a render is a new
   type each pass and remounts.

2. **In-memory sorting over one paginated page in `getOrgVendors`** — sorting by
   `name` or `riskScore` reordered only the 25 fetched rows.
   **Fixed:** and it was worse than reported. The search and category filters
   pushed predicates on `vendors.name` into `paginatedQuery`, which selects from
   one table and never joins the catalogue, so **every search was a 500**
   (`missing FROM-clause entry for table "vendors"`). Replaced with a real join
   and a keyset cursor over (sort column, org-vendor id).

3. **Intra-batch CSV collisions and suppressed commit errors in `importCsv`** —
   two rows matching the same catalogue vendor hit
   `organization_vendors_org_vendor_unq`; the modal called `onClose()` in
   `onSuccess` before anyone could read `commitErrors`; the toast reported only
   `created`, so an all-relink import said "0 imported".
   **Fixed**, though not as suggested: rather than `linked.add()` inside the
   loop, rows are de-duplicated in the preview pass and the whole file commits in
   **one transaction**, so a partial write cannot happen. The commit report is now
   a screen, and the toast counts `created + relinked`.

4. **React key on undefined `m.measure` in `TIABuilder.tsx`** — the items are
   `{ id, label, implemented, detail }`, so `key={m.measure}` was `undefined` on
   every row.
   **Fixed:** `key={m.id ?? i}`. One correction to the mechanism as originally
   reported — React does not *collide* on `undefined`; it treats it as no key and
   falls back to the index, so the symptom was a dev warning and unstable
   reconciliation rather than broken rendering. The same edit also stopped the
   checkbox handler mutating `newM[i].implemented` in place, which wrote through
   to the object react-hook-form still held.

### 3.2 Medium-severity and architectural

1. **Non-transactional custom vendor creation in `importCsv`** — a failed
   `organizationVendors` insert left an orphaned global `vendors` row.
   **Fixed:** one transaction for the whole file.

2. **Hardcoded sub-processor count on import** — `calculateVendorRisk` received
   `0` while `linkVendor` queries `vendorSubProcessors` and passes the real
   count, so the same vendor scored up to 10/10 lower on chain depth depending on
   which door it came through. Importing a register — the path the audit calls
   the biggest change to the first-run experience — therefore understated exactly
   the vendors the catalogue knows most about.
   **Fixed:** one grouped read inside the transaction; newly created custom
   vendors have none by construction and read as `0`.

3. **Step 3 exposed only `technicalMeasures`** — `organizationalMeasures` and
   `contractualMeasures` were `z.array(z.any())`, hydrated from the server and
   rendered by the PDF, but had no inputs anywhere, so they could only ever be
   empty. Recommendations 01/2020 §3 asks for all three, and the exported
   Chapter V document was structurally incomplete on two of them.
   **Fixed:** one `measureSchema` for all three groups, seeded defaults, and a
   `MEASURE_GROUPS` loop rendering them. Eight new measure labels across en/de/fr.

4. **Dead `isBusy` state in `ImportVendorsModal`** — declared, never read.
   **Fixed:** removed. Note that `npx eslint` cannot run in this repo, so nothing
   would have caught it.

---

## 4. Test coverage and verification

- **Fixtures:** **125 assertions** in `apps/api/src/lib/vendors.test.ts` (75
  before the remediation) — sub-processor diffs, AI quota windows, US adequacy,
  DPA status vocabulary, RFC 4180 parsing including unbalanced quotes and
  `;`/tab delimiters, header mapping, Levenshtein matching, the Art. 9 vocabulary
  in three languages, the lifecycle vocabulary, and the audit-trail wiring that
  D33 depended on.
- **Guards**, all green in `npm run check`:
  - `check:tenancy` — 215 procedures, 142 update/delete statements
  - `check:relations` — 23 queries against 49 `relations()` blocks
  - `check:nocheck` — zero `@ts-nocheck` in either workspace
  - `check:params` — 113 route files await `params`
  - `check:sitemap` — 33 sitemap routes against 103 real routes
  - `check:messages` — 3,633 keys across 20 namespaces in en/de/fr
  - `check:ropa-i18n` — 42 files against 1,568 keys
  - `check:vendor-i18n` — 15 files against 673 keys
- **Not covered by any guard:** dynamic `t()` keys. The i18n checker only reads
  single-quoted literals, so `t(\`data_category.${key}\`)` and
  `t(\`step3.measures.${m.id}\`)` are invisible to it. Both were verified by hand
  against all three catalogues.
