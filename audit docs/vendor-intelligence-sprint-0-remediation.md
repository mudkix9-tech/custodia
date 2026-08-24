# Vendor Intelligence — Sprint 0 remediation record

**Status of the Week 1 "stop the bleeding" list in
`vendor-intelligence-module-audit-final.md`, plus the defects found reviewing it.**

Sprint 0 landed as `2c0b0bd` (24 August 2026). This file records what it closed, what it
closed incompletely, and what the follow-up pass changed — the same shape as the ROPA
remediation record in `6cd7dfe`, and for the same reason: a defect register with no
status column stops being read.

**Date:** 24 August 2026. Gate: `npm run check` green — both workspaces at 0 type errors,
five guards, ten fixture suites.

---

## 1. Week 1 list — final state

| Audit ID | Fix | Sprint 0 | After the follow-up |
|---|---|---|---|
| **D1** | `getTemplates` → `or(isNull(organizationId), eq(…, orgId))` | Closed | Closed |
| **D4** | Vendor gap `resolutionUrl` → the global vendor id | Closed | Closed |
| **D5** | Backfill `data_privacy_framework` onto DPF-certified seeded vendors | **Inert** | Closed |
| **D7** | Collapse horizontal whitespace only; backfill the snapshots | Closed | Closed + covered |
| **D8** | Register metrics from `getRiskStats`; server-side CSV | Closed | Closed |
| **D9** | Remove the fake TIA export button | Closed | Closed |
| **D10** | Ownership + permission gate on `addLinked` / `addUnlinked` | **Regression** | Closed |
| **D13** | Monthly, plan-aware quota, incremented after success | **Defective** | Closed + covered |
| **D15** | Permission-gate the mutations | Closed | Closed + extended to reads |
| **D16** | Delete the hardcoded incidents | Closed | Closed |
| **D27** | Join `vendorAssessments` on the org-vendor id | Closed | Closed |

Eleven of eleven attempted; eight genuinely closed on the first pass. The three that were
not are below, because each one reinstated the defect it was meant to remove.

Two items the audit places in Weeks 2–6 were also closed in the follow-up — **D26**
(the phantom transfer-mechanisms column) and **D14** (i18n across the module) — plus one
defect nobody had filed, found by running the code rather than reading it (§2.7).

---

## 2. What the follow-up changed

### 2.1 D13 — the monthly reset did not reset

`organizations.ai_last_reset_at` is one timestamp, and **two** counters hang off it:
`ai_queries_used` (copilot) and `ai_dpas_analyzed` (DPA analysis). Sprint 0 moved the DPA
quota onto that shared window but zeroed only its own column, and `trackAiUsage` zeroed
only its own.

The consequence ran both ways. A month whose first AI action was a copilot query left the
DPA counter carrying the previous month's total forward — a lifetime counter again, which
is precisely what D13 was about. And a month whose first AI action was a DPA analysis
stamped the timestamp without clearing `ai_queries_used`, so the copilot quota never reset
that month either.

Fixed by making the window explicit and indivisible: `isNewAiWindow()` decides, and
`aiWindowReset()` returns all three columns so neither path can clear one and not the
other. Both live in `constants/aiQuota.ts` rather than `lib/billing.ts` — that file imports
`db.js`, which throws without `DATABASE_URL` and would put the arithmetic out of reach of
the standalone fixtures, the same reason `utils/cursor.ts` sits apart from
`utils/pagination.ts`.

Two related corrections in the same path:

- The comment claimed the ceiling was "the plan's allowance". `TIER_LIMITS.ai` is `2000`
  for `starter`, `agency` **and** `professional`, so it was the same hardcoded 2000 as
  before. The allowance is now its own key, `dpaAnalyses`, because it is its own counter.
- Moving the increment after the model call widened the read-then-write race from
  microseconds to the length of a Gemini round trip. The increment is now done in SQL.

### 2.2 D5 — correct in the seed, invisible to every customer

Two reasons the backfill reached nobody:

1. **No script ran it.** `packages/db/package.json` had `seed:trackers` but no
   `seed:vendors`; the file was reachable only by hand. Added — along with
   `reset:subprocessor-baselines`, which D7's own companion script was missing for the
   same reason.
2. **`organization_vendors.risk_score` is denormalised.** It is written at link time and
   when the org's own inputs change; nothing recomputes it when the *catalogue row*
   changes underneath it. So re-seeding moved no existing score, and the inflated "high
   risk vendors" tile — the entire symptom D5 describes — survived the fix.

`npm run recalc:vendor-risk --workspace=apps/api` closes the second. Dry-run by default,
`--apply` to write, `--vendor=<uuid>` to scope it, and it reports how many US catalogue
vendors carry the DPF string so a no-op recalculation explains itself.

**Two internal contradictions in the seed were also resolved.** Mailchimp carried DPF and
QuickBooks did not — both Intuit. GitHub carried it and LinkedIn Recruiter did not — both
Microsoft. Same corporate certification, different answers in the same file.

`seed-vendors.ts` now carries a header stating what the remaining limitation is: these are
hand-typed regulatory assertions with no certified-on date, no source URL and no expiry,
and DPF certifications lapse annually. That is the same shape as the standalone pipeline's
13-name hardcoded array (D19), which the audit rightly calls a defect. It is a stopgap
until `vendor_field_provenance` (P-2) can record value, source, retrieved-at and
verified-by per field. The header also records that an **absent** `transferMechanisms` on
the vertical stubs means "not researched", not "no safeguards" — the risk engine cannot
tell those apart and scores both as unsafeguarded.

### 2.3 D10 — the security fix broke the feature

Restricting `addLinked` / `addUnlinked` to org-owned vendors is right: the sub-processor
table hangs off the *global* catalogue row, so a tenant-initiated write there moves every
other tenant's derived risk score.

But `SubProcessorList.tsx` still rendered the controls unconditionally. On AWS, Google,
Slack — most of a real register — "Add Sub-processor" now returned
`NOT_FOUND: Parent vendor not found` about a vendor plainly on the screen. The
cross-tenant write was gone and a legitimate workflow went with it, behind an error that
blamed the wrong thing.

The detail page now passes `catalogueOwned`, and on a shared row the add and remove
controls are replaced by a sentence saying the list is maintained from the vendor's own
published page — which is what Article 28(2) actually asks about. Both mutation handlers
also surface failures as toasts rather than unhandled rejections.

A per-organisation sub-processor override table is the real fix and is not built.

### 2.4 Tests — Sprint 0 shipped none

`CLAUDE.md` is explicit that `tsc` is the only other static gate here and that fixtures are
what catch the rest. Sprint 0 changed a quota calculation, a risk-scoring input, a
whitespace regex and a CSV writer, and added no fixture — and every one of those defects
type-checked perfectly while it was broken.

`npm run test:vendors --workspace=apps/api` (51 assertions, wired into `npm run check`)
covers the snapshot normaliser and the diff that reads it, the AI window rollover, the DPF
location factor including the vocabulary trap, the DPA status vocabulary, and the CSV
quoting rules. Two extractions were needed to make any of it reachable:
`lib/vendorSubProcessors.ts` (the cleaning chain, previously inline in the worker) and
`constants/aiQuota.ts`.

### 2.5 Smaller things

- **`vendors:manage` is granted by no built-in role.** `publishIncident` was gated on it,
  which resolves to owner-only through `*:*` — roughly the intent for a platform-operator
  action, but accidental. `ROLE_PERMISSION_DEFAULTS` now states that the absence is
  deliberate, so the string is not copied onto a tenant-facing procedure by someone
  assuming it is a normal tier.
- **Reads are gated.** Sprint 0 gated every mutation and left twelve queries open while
  `subProcessors.list` alone carried `vendors:view`. All vendor reads now carry it; the two
  token-authenticated `publicProcedure`s are deliberately excluded.
- **CSV escaping is shared.** `apps/api/src/utils/csv.ts` — the register export had its
  own always-quote helper while `ropaExportFormats.ts` quoted conditionally. Two files
  disagreeing about the format an auditor receives, only one of them tested.
- **`getRiskStats` counts in SQL** instead of pulling every column of every row back to
  call `.filter()` on it, and the DPA status vocabulary is named in
  `constants/dpaStatus.ts` rather than being string literals in three files.
- **The register export handles failure.** It was an `async` click handler with a bare
  `await`; a server error became an unhandled rejection and the button appeared to do
  nothing.

---

### 2.6 D26 — the phantom transfer-mechanisms column, and D14 — i18n

Both were carried past Sprint 0 in the first pass and have since been closed.

**D26.** `lib/vendorRisk.ts:79` and the `third_country_transfer_no_safeguards` gap rule
both union the organisation's transfer mechanisms with the catalogue vendor's — against a
column that did not exist, so the org half was always empty. An organisation relying on
SCCs it signed itself had nowhere to record them, scored the full 20/20 location risk and
raised an Article 44 gap it had in fact closed. Migration `0050_sticky_anthem` adds
`organization_vendors.transfer_mechanisms`; `updateOrgVendor` accepts it, constrained to
`constants/transferMechanisms.ts` rather than free text, and the detail page has a control.
The vocabulary is the load-bearing part: the risk engine matches `data_privacy_framework`
exactly, so "SCCs" typed by hand scores as no safeguard at all, which is why both ends
validate against the same list.

**D14.** All eight vendor components and both routes are translated, ~240 keys across
en/de/fr. The guard was ROPA-only, which is exactly why this could sit at zero
`useTranslations` for a year with every gate green; `scripts/check-ropa-i18n.mjs` is now
`check-module-i18n.mjs`, driven by a `MODULES` table, and `check:vendor-i18n` runs in
`npm run check` alongside `check:ropa-i18n`. **A module absent from that table has no i18n
check at all.**

One limit worth knowing: the guard's key check only sees single-quoted keys, so a dynamic
`` t(`status.${row.status}`) `` is not verified. Those keys were added by hand.

### 2.7 A bulk CASE update that had never run

Found by running the recalculation script rather than by reading the code.
`recalculateVendorRiskForAllOrgs` writes every organisation's recomputed score in one
statement, as `SET risk_score = CASE id WHEN $1 THEN $2 … END`. Every branch is a bound
parameter, so Postgres resolves the expression as `text` and refuses the assignment:

```
column "risk_score" is of type integer but expression is of type text   (SQLSTATE 42804)
```

It threw on **every** invocation that had a row to write — every sub-processor add and
remove, every questionnaire confirmation, every catalogue-driven recalculation. `tsc` sees
a valid SQL template, no fixture can reach it without a database, and no caller checks.
Fixed with `(CASE … END)::integer` and `::varchar(20)`; the `risk_factors` branch already
cast each value to `jsonb`, which is why the other two were easy to miss.

---

## 3. Applied to the live database

Run against Supabase on 24 August 2026, in this order:

1. `npm run migrate --workspace=packages/db` — `0050_sticky_anthem`, one additive
   `ALTER TABLE … ADD COLUMN transfer_mechanisms jsonb DEFAULT '[]'`. Verified present in
   `information_schema` and recorded in `drizzle.__drizzle_migrations`.
2. `npm run seed:vendors --workspace=packages/db` — US catalogue vendors carrying
   `data_privacy_framework` went from **0/2 to 2/2** among the rows any organisation
   actually links.
3. `npm run recalc:vendor-risk --workspace=apps/api -- --apply` — 5 catalogue vendors,
   5 register rows.

What moved:

| Vendor | Before | After | Why |
|---|---|---|---|
| Slack (US) | 40 medium | **25 low** | Location 20/20 → 5/20; DPF now recorded |
| Postmark (US) | 45 medium | **30 medium** | Same |
| Dropbox | 45 medium | **60 high** | Country never recorded — scored as unknown |
| WXA | 45 medium | **60 high** | Same |
| Zendesk | 45 medium | **60 high** | Same |

The three that went **up** are the honest half of this. They are custom vendors with no
`headquarters_country`, and their stored scores dated from link time — the recalculation
that should have corrected them had been throwing since it was written (§2.7). They now
read as high risk because the register cannot say where they process data, which is a
question for whoever added them rather than a scoring artefact.

## 4. Deliberately not done

- **D6 — AI `scoreAdjustment` applied automatically.** Filed P0-live in the register and
  absent from the Week 1 list; the audit's build order has now been annotated to say why,
  and to record that suppressing `scoreAdjustment` alone is a one-line change worth taking
  if the questionnaire reaches customers before the human-review step does.
- **DPF provenance.** Covered above: a stopgap until P-2. The assertions are still
  hand-typed with no source, date or expiry.
- **Per-organisation sub-processor overrides.** The controls are correctly hidden on
  catalogue vendors, but an organisation that learns of a sub-processor from a DPA annex
  still has nowhere to record it. known-concerns #17.

---

## 5. Running the catalogue update again

```bash
npm run seed:vendors --workspace=packages/db
npm run recalc:vendor-risk --workspace=apps/api            # dry run
npm run recalc:vendor-risk --workspace=apps/api -- --apply
```

And, once, for D7 — the collapsed snapshots cannot be reconstructed, only re-captured:

```bash
npm run reset:subprocessor-baselines --workspace=packages/db            # dry run
npm run reset:subprocessor-baselines --workspace=packages/db -- --apply
```
