# Custodia — Vendor Intelligence: post-Sprint-4 verification

**Independent re-read of `vendor-intelligence-module-audit-final.md` against the code as it
stands.** Confirms what the four sprints actually closed, and records what is still wrong,
newly wrong, or overstated.

**Date:** 28 August 2026. **Branch:** `main`, working tree carrying ten uncommitted files
from the GenAI provider-unification work (`llm.ts`, `ai.ts`, `assessments.ts`, and seven
others).

Marks follow the parent document: **[V]** re-read in this pass, file and line cited;
**[S]** static inference with the mechanism stated so it can be falsified; **[C]** carried,
not re-verified. Nothing was observed against a running instance and no database was
dialled — every claim below is from the source or from the gate output.

---

## 0. Headline

The gates are green and most of the register is genuinely closed. Spot-checking eleven of
the P0s found eleven correctly fixed, and two things the audit asked for arrived beyond
what the sprint notes claim.

Three findings are worth acting on before anything else:

1. **The risk score now has three derivations and two of them are lossy** — including the
   one the deployment runbook tells you to run after every formula change. This is the
   exact defect the Sprint 1 review found in `updateOrgVendor`, fixed, and wrote a
   principle about; it has reappeared in two other places. **[V]**
2. **`ingestTrustCenter` fetches any URL a tenant supplies, server-side, with no host
   restriction** — and separately lets that tenant write to the *shared* catalogue from
   unvalidated pasted text, which reaches other tenants' risk scores through the Sprint 4
   cross-check. **[V]**
3. **The automation gap the audit built its severity model on is still open.** Seven vendor
   jobs remain dormant *and* unscheduled. "D17 closed — every DPA-expiry alert now reaches a
   customer" is true of the code and false of the deployment. **[V]**

> **Correction, 28 August 2026.** An earlier revision of this document called
> `vendor-review-reminder` being scheduled *and* listed in `DORMANT_JOBS` a
> self-contradiction unique to the vendor module. It is not: six other jobs are in exactly
> that state (`impact-assessment`, `dpia-dispatcher`, `ropa-reviews-dispatcher` and the
> three Sprint 4 ROPA dispatchers). Registering the cron once and using `DORMANT_JOBS` as
> the runtime switch is the house convention, so `vendor-review-reminder` follows it
> correctly. What remains true is the part that matters: the job does not run, and neither
> do the six other vendor jobs. §2.3 has been rewritten accordingly.

### Gate state

Every finding in §2 passed every gate below at the time it was found, which is the point
worth keeping. "As audited" is the state on 28 August before any fix; "after" is the state
once §3 was applied.

| Gate | As audited | After |
|---|---|---|
| `typecheck` (both workspaces) | 0 errors | 0 errors |
| `check:tenancy` | 231 procedures, 16 exceptions | 231 procedures, 17 exceptions, 144 write statements |
| `check:relations` | 23 queries / 54 blocks | unchanged |
| `check:params` | 114 route files | unchanged |
| `check:messages` | 3,818 keys, 20 namespaces | 3,819 keys |
| `check:vendor-i18n` | 27 files / 858 keys | 27 files / 859 keys |
| `test:vendors` | 261/261 | **298/298** |
| all fixture suites | 854 assertions | 942 assertions |
| `check:schema` | passed standalone; **not in the `check` chain** | in the chain; reports drift until `0057` is committed |

The scorecard in Appendix D of the parent document reports the "as audited" column
accurately. The only drift is 3,818 keys against its 3,816, which is noise.

---

## 1. Verified closed

Spot-checked against source, not carried from the sprint notes.

| ID | Claim | Verdict |
|---|---|---|
| D1 | `getTemplates` unreachable | **Closed.** `or(isNull(...), eq(...))` at `assessments.ts:281–288`, with the reason in a comment **[V]** |
| D4 | Gap `resolutionUrl` 404s | **Closed.** All seven rules build from `record.vendorId` (`gapRules.ts:28,54,79,208,255,288,340`) **[V]** |
| D7 | Sub-processor diff destroyed | **Closed.** `[^\S\n]+` at `lib/vendorSubProcessors.ts:42` **[V]** |
| D8 | Register tiles over loaded pages | **Closed.** `getRiskStats` consumed at `vendors/page.tsx:82` **[V]** |
| D10 | `addLinked`/`addUnlinked` ungated | **Closed.** `requirePermission('vendors','edit')` plus an ownership proof (`vendors.ts:852–897`) **[V]** |
| D13 | `aiDpasAnalyzed` lifetime counter | **Closed.** `aiWindowReset()` clears both counters (`constants/aiQuota.ts:58`, `ai.ts:1083,1267`) **[V]** |
| D16 | Fabricated incident samples | **Closed.** Removed, with the history kept as a comment at `workers/incidents.ts:226` **[V]** |
| D17 | Alerts to `console.log` | **Closed in code.** `queueNotification` at `workers/vendors.ts:186,716,766`. **Not closed operationally** — see §2.3 **[V]** |
| D26 | `organizationVendors.transferMechanisms` missing | **Closed.** Column exists at `schema.ts:1409` **[V]** |
| D27 | Assessment join on the wrong id | **Closed.** `eq(vendorAssessments.vendorId, orgVendor.id)` at `vendors.ts:144` **[V]** |
| D29 | `vendors.riskScore` never populated | **Partially.** Still ordered on at `vendors.ts:1257`; the intelligence pipeline can now write catalogue rows, but nothing recomputes a catalogue-level score **[S]** |

**Two things arrived that the sprint notes still describe as pending.** Sprint 2's "DPF
awareness is recorded, not wired" is stale — `vendorRisk.ts:87–105` reads `dpfStatus` and
`dpfLapsedDate` and distinguishes active from lapsed certification, and
`recalculateVendorRiskForAllOrgs` computes them for US vendors (`vendors.ts:254–256`). And
the Sprint 4 discrepancy penalty is genuinely wired into the formula (`vendorRisk.ts:72,289`;
`vendors.ts:203–229`). **[V]**

---

## 2. What is wrong now

### 2.1 One number, three derivations — two of them lossy · **Critical**

`calculateVendorRisk` takes six parameters and **every one after the second has a default**
(`vendorRisk.ts:66–73`). Passing fewer arguments is therefore not a type error, and the
missing inputs silently score zero.

| Call site | Args | Drops | Persists? |
|---|---|---|---|
| `updateVendorRiskScore` — `vendors.ts:229` | 6 | — | yes |
| `recalculateVendorRiskForAllOrgs` — `vendors.ts:338` | 5 | `discrepancyPenalty` | **yes** |
| `vendor-risk-recalculation` worker — `workers/vendors.ts:419` | 3 | `scoreModifier`, `dpiaGaps`, `discrepancyPenalty` | **yes** |

**[V]** — all three read, and the two lossy ones write their result back into
`organization_vendors.riskScore`.

This is not theoretical. `recalculateVendorRiskForAllOrgs` has **seven callers**, including
the one the runbook mandates:

```
scripts/recalculate-vendor-risk.ts:86   ← npm run recalc:vendor-risk --apply
routers/vendorIntelligence.ts:214, 303  ← candidate approval
routers/vendors.ts:878, 908, 933        ← sub-processor add / remove
workers/incidents.ts:222                ← incident matched to a vendor
```

So the documented post-deploy recalculation — the one CLAUDE.md says *must* be run because
`risk_score` is denormalised — walks the catalogue and rewrites every linked tenant's score
**without the Sprint 4 cross-check penalty**. A vendor caught contradicting its own
attestations is penalised by `updateVendorRiskScore`, then quietly forgiven the next time
anyone approves a candidate, edits its sub-processors, or runs the recalculation.

The worker is worse — three arguments, so it also discards the reviewed-questionnaire
modifier that D6 exists to protect and the DPIA-gap input. It is mitigated **only** by being
unscheduled (§2.3); enable it and it reverts D6 estate-wide overnight.

The Sprint 1 review wrote the fix for this exact defect and the principle to go with it:
*"It delegates to `updateVendorRiskScore` now: one derivation of one number."* Two call
sites never got the message.

**Fix.** Make the tail parameters required, or take a single options object — then `tsc`
catches the next one. Route both bulk paths through one function that assembles all six
inputs. Add a fixture asserting the bulk path and the per-row path agree on a vendor that
has a reviewed questionnaire *and* a discrepancy.

### 2.2 `ingestTrustCenter` — SSRF, and a shared-catalogue write from pasted text · **High**

`vendors.ts:2686–2760`. Two distinct problems in one procedure. **[V]**

**(a) Unrestricted server-side fetch.** The input takes `trustCenterUrl: z.string().url()`
and line 2719 does `await fetch(input.trustCenterUrl, …)` with a 6-second timeout, an honest
user agent — and no host allowlist, no loopback/private-range/link-local block, and no
scheme restriction beyond what `new URL()` accepts. Any member with `vendors:edit` can point
the backend at `http://169.254.169.254/…`, at a container-internal admin port, or at
anything else the Northflank service can reach. The response is not returned verbatim, but
it is tag-stripped and fed to `parseTrustCenterProfile`, whose booleans come back to the
caller — so the page's contents are observable a signal at a time, and reachability and
timing are observable directly. The deployment makes this worse rather than better: one
container serves Fastify *and* every worker, so "what the API can reach" is a wide surface.

**(b) A tenant can write to the shared catalogue from unvalidated input.** Lines 2743–2747
write `profile.euHostingAvailable` to the **`vendors`** row — the global catalogue — and
`contentToParse` may be `input.rawContent`, free text the caller pasted, never fetched from
anywhere. `euHostingAvailable` is read by `vendorCrossCheck.ts:110`, which is what produces
the discrepancy penalty. So: paste text claiming EU hosting for a shared vendor, flip the
catalogue flag for everyone, and suppress a contradiction — and therefore lower a risk
score — **in other tenants' registers**.

This is the D10 class, reintroduced in a new procedure. The tenancy guard cannot see it and
is not at fault: `existing.vendor.id` was pinned by an earlier org-scoped statement, which is
exactly the pattern pass 2 accepts. The guard proves *"you have this vendor linked"*; it
cannot know the row is shared. That limitation is already written down in CLAUDE.md, and this
is the second time it has been the hole.

**Fix.** Resolve the URL and reject non-public addresses before fetching (and re-check after
redirects). Write trust-centre findings to `organization_vendors`, not `vendors` — or route
them through the `vendor_candidates` review queue that Sprint 2 built for precisely this
purpose. If catalogue writes must stay, gate them behind the same review console and never
accept `rawContent` as their source.

### 2.3 The automation gap is still open · **High**

The parent audit's central operational finding was that no vendor job is scheduled. That is
still substantially true. **[V]** — `workers/index.ts:43–95`, `lib/queue.ts:135–169`.

Two vendor entries exist in `scheduleGlobalJobs()`:

- `dpf-registry-import` — `17 3 * * 1`, deliberately not dormant. **Runs.** Genuine progress.
- `vendor-review-reminder` — `30 6 * * *`, and also in `DORMANT_JOBS`. Scheduled but skipped
  at dispatch, which is the house convention rather than a mistake (see the correction in
  §0): the cron is wired once and the dormant list is the switch. It has never run.

Still dormant *and* unscheduled: `sub-processor-change-detector`, `dpa-expiry-checker`,
`assessment-reminder-checker`, `breach-alert-monitor`, `dpa-page-change-detector`,
`weekly-organization-discovery-trigger`, `vendor-incidents-ingest:ingest-daily`.
`vendor-risk-recalculation` remains in neither list — unscheduled, not dormant, reachable
only by manual enqueue.

The consequence for the record: **D17 is closed in code and inert in production.** The
`queueNotification` call is correct and the 90/60/30/7 tiering is well built, and the job
that would reach it is switched off twice over. Sprint 2's "Every DPA-expiry and renewal
alert now reaches a customer" should read "…now would reach a customer, once the job is
enabled". Same for D7 and the entity-level diff: the parser is good and nothing runs it.

That is a defensible product decision — these jobs email customers, which is what
`DORMANT_JOBS` is for — but it needs to be stated, because the module currently advertises
monitoring it does not perform.

**Fixed.** The state is now visible rather than requiring two files to be read together:
`scheduleGlobalJobs()` calls `logDormantSchedules()`, which prints at startup exactly which
of the crons it just registered will be skipped, and `isJobDormant()` in `lib/queue.ts` is
the shared predicate. Whether to enable any given vendor job remains a product decision and
is deliberately left alone.

### 2.4 The enforcement corpus is hardcoded, stale-by-design, and carries two factual errors · **Medium–High**

`lib/vendorEnforcementFeed.ts`. Appendix D describes this as *"Ingestion of CNIL/AEPD/BfDI/
ICO/DPC enforcement decisions"*. It is a **static array of eight decisions compiled into the
binary** (`EUROPEAN_ENFORCEMENT_CORPUS`, line 26). There is no table, no importer, no job and
no update path — the only references are the module itself and its fixture. **[V]**

The decisions are real, which makes this categorically better than D16. But two entries are
wrong in ways that matter for a compliance product:

- **`cnil_amazon_france_logistique_2024` maps to `matchedVendorName: 'Amazon Web Services'`.**
  The decision is real — €32m, 23 January 2024 — but it concerns warehouse employee
  surveillance at Amazon's French logistics entity and has nothing to do with AWS as a
  processor. `matchRegulatoryDecisions` matches on exact folded name, so **every customer
  using AWS is shown an enforcement alert about it**. Appendix D claims *"0 false matches"*;
  this is a false match built into the data rather than the matcher. **[V]**
- **`cnil_google_analytics_2022` conflates two separate CNIL actions.** It carries the
  Google Analytics date (10 February 2022), the Chapter V legal basis (Art. 44), the
  Analytics summary and the Analytics `sourceUrl` — but attaches a **€150,000,000 fine**.
  The Analytics decision was a formal notice (*mise en demeure*) with no fine; the €150m was
  a separate cookie-consent penalty under Article 82 of the French Data Protection Act,
  announced 6 January 2022. Presenting a fine the decision did not carry, under a legal basis
  it was not issued on, is the kind of error a DPO would catch and lose confidence over.
  **[S]** — worth confirming against the cited URL, which is the Analytics page and shows no
  fine.

Two further gaps: there is **no status field for appealed or overturned decisions** (the ICO
Clearview penalty in the corpus has a contested appellate history), and the newest entry is
January 2024, so the feed is nineteen months stale on the day it ships.

**Fix.** Move the corpus into a table with `status` and `supersededBy`, fix the AWS mapping
(either drop it or add the entity distinction the matcher can act on), split the Google entry
into the two decisions it actually is, and either build the importer or retitle the feature
as a curated corpus. The parent audit's Months 5–8 plan already points at the CNIL/AEPD/BfDI/
AP/ICO/DPC scrapers in `packages/db/src/seeds/`.

### 2.5 The catalogue is empty, and Sprint 4 is built on top of it · **High, by design**

Commit `ad293b2` reset the seed to zero: `VERIFIED_GLOBAL_VENDORS: any[] = []`
(`packages/db/src/seed-vendors.ts:27`). The stated rationale is sound — the 39 hand-typed
rows carried fabricated and unverifiable data, and the sourcing programme replaces them with
verified provenance. **[V]**

But every Sprint 4 capability is scored against a catalogue that is now empty, and the
scorecard's "100% verified / PASS" marks were earned by fixtures, not by data:

- **Benchmarking returns nothing, for every vendor, always.** `vendorBenchmarking.ts:190`
  short-circuits when `vendorRow.organizationId !== null` — correctly, since private custom
  vendors cannot be compared across tenants. With an empty catalogue every vendor a customer
  has *is* a custom vendor, so the k≥5 gate is never even reached. **[V]**
- **The concentration graph is empty.** It hangs off `vendorSubProcessors.parentVendorId`,
  which references catalogue rows (`vendorConcentration.ts:389–396`). **[V]**
- **The enforcement feed matches nothing**, because it matches against vendor names that
  only exist once a catalogue does. **[S]**
- `getPrivacyAlternatives`, `DiscoverModal` and `findMatchedVendor` are all empty or
  degenerate for the same reason. **[S]**

This is a coherent strategy, not a defect — but it means the module's demonstrable state
went *down* while its code quality went up, and the Sprint 4 scorecard does not say so. The
capabilities are real and currently unexercisable.

**Fix.** Nothing in the code. State it in the scorecard, and make the population run —
`enrichBatch` plus the review console — the gate on calling Sprint 4 delivered.

### 2.6 Register defects still open that no sprint claimed

All **[V]** unless noted. None of these were ever marked closed; they are listed because the
parent document's build order has moved past them.

| ID | State |
|---|---|
| **D12** | `auditExport.ts:177` still hardcodes `transferMechanism: null`. The column it needs **now exists** (`schema.ts:1409`, added Sprint 0), so this is a one-line fix that has been sitting behind a closed dependency for four sprints. The Chapter V column in the auditor pack is still blank by construction |
| **D18** | `breach-alert-monitor` and `dpa-page-change-detector` are still `console.log('Simulating…')` (`workers/vendors.ts:225, 383`) |
| **D36** | `respondentIp` still accepted from the client body and stored as audit evidence (`assessments.ts:495, 603`) |
| **D38** | Assessment access tokens still plaintext (`schema.ts:1526`) |
| **D42** | `headquartersCountry: z.string().optional()` (`vendors.ts:769`) — no length or ISO constraint — from a free-text `<input>` (`AddCustomVendorModal.tsx:136–140`) into `char(2)`. Typing "Germany" still raises a raw Postgres error |
| **D45** | Sub-processor detection still capped at `.limit(50)` (`workers/vendors.ts:50`) |
| **D46** | `notifiedAt` still on the shared `vendor_sub_processors` table (`schema.ts:1576`) — one tenant acknowledging clears it for all |
| **D48** | `suggestGlobal` still `LIMIT 5` under its "Mock suggestion for now" comment (`vendors.ts:404–409`) — now permission-gated, still a stub |
| **D58** | TIA save still `requireRole("admin")` (`tia.ts:79, 95`) — a DPO who is not an org admin cannot perform a transfer impact assessment |
| **D61** | `vendor-pipeline/` still has no `dist/`; its npm scripts still point into it |

### 2.7 Smaller things

- **`check:schema` is not in the `npm run check` chain** (`package.json:15`). It passes when
  run by hand, but the command CLAUDE.md calls "run everything" would not catch schema drift.
  Cheap to add. **[V]**
- **Migration state is undocumented past `0053`.** `vendor-intelligence-deployment-notes.md`
  records `0051`–`0053` as applied. `0054`, `0055` and `0056` — which carry
  `vendor_field_provenance`, `vendor_candidates`, `vendor_intelligence_runs`,
  `dpf_registrations`, `vendor_sub_processor_entities`, the catalogue DPA-analysis columns and
  `vendor_intake_requests` — have no recorded application state anywhere. The parent audit
  says `0054`/`0055` were not applied; `0056` is mentioned in no document. Every Sprint 2–4
  feature depends on these tables. **[V]**
- **The journal gap has widened.** 60 `.sql` files against 46 journal entries; idx 20–30 are
  still absent, and `0000`/`0001` have duplicate files. Unchanged in kind from CLAUDE.md's
  note, but the count moved and it still means a fresh database does not reproduce
  production. **[V]**
- **`matchRegulatoryDecisions` builds a regex from corpus data without escaping**
  (`vendorEnforcementFeed.ts:162`: `new RegExp(...${dNameLower}...)`). Harmless for the eight
  names present, a crash or a mis-match the moment a vendor name contains `.`, `+` or `(` —
  and the corpus is a natural candidate to become DB-driven. **[V]**
- **`ai.ts:1546` calls `calculateVendorRisk(finalVendor, finalOrgVendor)`** — two arguments.
  It only builds a prompt string, so nothing is persisted, but the model is handed a risk
  score computed without the questionnaire modifier, DPIA gaps or discrepancy penalty, and
  then asked for advice about it. **[V]**

---

## 2.8 Found while fixing — the French and German products were showing mojibake

Not in the original pass, and worse than anything else in §2.6. All three vendor
message catalogues held double-encoded UTF-8: text that was UTF-8, decoded as
Windows-1252, and written back as UTF-8, so `privée` was stored as `privÃ©e` and every
apostrophe as `â€™`. **1,213 occurrences** — 792 in `fr`, 388 in `de`, 33 in `en` — and
`vendors.json` was the only namespace affected in each locale. **[V]**

Every one of them rendered to the user. `check:messages` could not see it, because it
compares the three catalogues against each other and all three were equally corrupt;
`check:vendor-i18n` could not see it either, because the keys resolve and the strings
are not hardcoded English. It is the same shape as everything else in this module: the
guards were satisfied and the product was wrong.

**Fixed.** All 707 affected strings repaired and the catalogues are now clean UTF-8.
The repair had to reverse cp1252 rather than Latin-1 — byte `0x80` is `€` in cp1252 and
undefined in Latin-1, which is why a naive Latin-1 reversal leaves every apostrophe and
en dash behind — and it only rewrote a string where re-encoding the repair reproduced
the original exactly, so correctly-encoded text was never touched.

---

## 3. What was fixed

Everything in §2 except where noted. `npm run typecheck` is at 0 errors across both
workspaces, `check:tenancy` passes 231 procedures and 144 write statements with 17
reviewed exceptions, and `test:vendors` is at **298 assertions**, up from 261.

| Finding | What changed |
|---|---|
| §2.1 risk derivation | `calculateVendorRisk` takes a **required** `VendorRiskInputs` object, so a dropped factor is now a compile error rather than a silent zero. `questionnaireScoreModifier`, `mergeSubProcessorRows` (in `lib/vendorRisk.ts`) and `discrepancyPenaltyFor` (in `lib/vendorCrossCheck.ts`) are shared by both bulk and per-row paths. The nightly worker delegates to `updateVendorRiskScore` — which also removed an uncast `CASE` that would have thrown `column "risk_score" is of type integer but expression is of type text` on every run that had a row to write. `NEW_LINK_RISK_INPUTS` names the genuinely-zero case at the four create/link sites |
| §2.2 SSRF | New `lib/safeFetch.ts`: resolves the host and refuses loopback, RFC 1918, link-local (169.254.169.254), CGNAT, unique-local IPv6 and IPv4-mapped forms; follows redirects one hop at a time so each is checked; caps the body. Used by `ingestTrustCenter`; `probeUrl` gained the same pre-check with a new `blocked_private_address` failure class |
| §2.2 catalogue write | Trust-centre findings write `organization_vendors.trust_centre_eu_hosting`, not the shared `vendors` row. Promotion to the catalogue belongs behind `vendor_candidates` and a human |
| §2.3 dormancy | `isJobDormant()` plus `logDormantSchedules()`, which prints at startup which registered crons will be skipped. The convention itself is left alone — see the correction in §0 |
| §2.4 corpus | The conflated CNIL entry is split into the Art. 44 Analytics notice (no fine) and the Art. 82 cookie fine (€150m). Amazon France Logistique no longer maps to AWS. New `status` / `statusNote` fields with Clearview marked `under_appeal`. `CORPUS_CURATED_THROUGH` exported so callers can show how stale it is. Regex built from corpus names is escaped |
| §2.6 D12 | `mergeTransferMechanisms()` unions the org's own record with the catalogue's; the auditor pack's Chapter V column and two new CSV columns are populated |
| §2.6 D18 | Both stub workers throw with a pointer instead of `console.log`-ing success — a stub that reports success is worse than an absent feature, because the queue then holds evidence the check ran |
| §2.6 D36 | `respondentIp` taken from `ctx.req.ip`; the input field is removed rather than ignored |
| §2.6 D38 | Tokens stored as SHA-256 (`lib/assessmentTokens.ts`). Lookup accepts the hash and, for in-flight rows, the legacy plaintext. The reminder worker rotates the token, since the plaintext is no longer recoverable |
| §2.6 D42 | `normaliseCountry` exported from `lib/vendorImport.ts` and applied in `createCustom`, so prose and ISO codes both work and an unrecognised value is refused with a message instead of a raw Postgres error |
| §2.6 D45 | The 50-vendor cap is a per-run batch ordered by `sub_processor_list_checked_at ASC NULLS FIRST`, stamped on every examined vendor — so it is a batch size rather than a permanent horizon |
| §2.6 D46 | New `vendor_sub_proc_acks` table, keyed `(organization_id, sub_processor_id)`. The shared `notified_at` column is deprecated and read by nothing. Two stale tenancy-guard exceptions removed |
| §2.6 D48 | `suggestGlobal` excludes what the org already has and ranks by adoption across organisations |
| §2.6 D58 | Both TIA procedures gated on `vendors:view` / `vendors:edit` instead of `requireRole("admin")`, so a DPO can perform one |
| §2.6 D61 | `vendor-pipeline/` retired explicitly with `DEPRECATED.md`; its six scripts say what replaced them instead of pointing at a `dist/` that never existed (the package has no installed dependencies and has never compiled) |
| §2.7 `check:schema` | Added to the `npm run check` chain |
| §2.7 migrations | `0054`–`0057` application state recorded in `vendor-intelligence-deployment-notes.md`, with the verification query |
| §2.7 `ai.ts` | Quotes the stored score where the relationship exists; the unlinked case is labelled indicative in the prompt |
| D29 (§1) | `getPrivacyAlternatives` ranked on the mean score peers actually carry, `NULLS LAST`. `AlternativesSection` badges "Not yet rated" instead of styling unknown as low-risk — the `alt: any` in that component is why `tsc` never saw the mismatch |
| §2.8 mojibake | 707 strings repaired across the three catalogues |

### Not fixed, and why

- **§2.5, the empty catalogue.** Nothing to change in code. It needs a real
  `enrichBatch` run against live credentials and a database, followed by review-console
  approvals. Until that happens benchmarking, concentration and the enforcement feed
  have no data to work on.
- **§2.4, the corpus is still a compiled-in array.** Accuracy and staleness are now
  honest, but there is still no table, importer or schedule. Building one over the
  scrapers in `packages/db/src/seeds/` is a feature, not a defect fix.
- **§2.7, the journal gap.** `_journal.json` still omits idx 20–30, so 11 `.sql` files
  remain inert on a fresh database. This is repo-wide and pre-existing, documented in
  CLAUDE.md, and hand-editing migration state is exactly the operation most likely to
  make disaster recovery worse rather than better. It needs a deliberate reconciliation
  against `drizzle.__drizzle_migrations` in production, not a guess from here.
- **`check:schema` reports drift until `0057` is committed.** That is the check working
  as designed — it asks git, so a generated-but-uncommitted migration is drift. Commit
  `0057_wealthy_anthem.sql`, `meta/0057_snapshot.json` and `meta/_journal.json`
  together.
- **The fabricated pipeline data still exists on disk.** `vendor-pipeline/vendors.json`
  and the repo-root `vendors.json` still hold 200 records, 180 of them synthetic, all
  200 stamped `analystVerifiedAt`. The hazard is documented in
  `vendor-pipeline/DEPRECATED.md`; deleting the files is a destructive change and is
  left as your call.

---

## 4. What to do, in order

The original recommendation had eight items; all but the last three are done — see §3.
What remains:

1. **Apply `0054`–`0057`** and confirm the earlier three really are applied; the
   deployment notes now carry the query. Then run
   `npm run recalc:vendor-risk --workspace=apps/api -- --apply`, because the discrepancy
   penalty now reaches the bulk path and every denormalised `risk_score` predates that.
2. **Run a real enrichment batch** and populate the catalogue, then re-score Sprint 4
   against data. Until then benchmarking, concentration and the enforcement feed are
   untestable in the only way that counts.
3. **Reconcile `_journal.json`** against `drizzle.__drizzle_migrations` in production, so
   a rebuilt database matches. Deliberately not attempted from here.

---

## 5. Assessment

The four sprints did substantially what they claimed. The defects found here are mostly of
one kind — **a correct fix that a second code path quietly undoes** — which is the same
failure mode the Sprint 1 review documented and is a property of this module's shape, not of
carelessness: shared catalogue rows, denormalised scores, and default parameters that make
lossy calls typecheck.

The parent document's own warning is the right closing note, and it held again in this pass:

> Four of the five user-facing surfaces the sprint shipped failed on first contact, and every
> one of them type-checked, passed the tenancy guard, passed the i18n guard and passed
> `npm run check`. This module's defects do not announce themselves.

Every finding in §2 passed all of those gates too.
