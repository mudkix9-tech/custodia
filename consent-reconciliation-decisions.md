# Judgement Calls — Consent / Tracker Reconciliation, Phase 5

**Scope:** decisions made while building the surface layer (tRPC + UI + score
integration) that were **not** specified in `consent-reconciliation-plan.md`, plus the
two out-of-scope fixes made because Phase 5 could not work without them.

**Date:** 2026-08-08

Each entry records what was decided, what the alternatives were, and what would make the
decision wrong. The last part matters most — a decision recorded without its falsifier is
just an assertion.

---

## 1. Added `getCoverage` as a sixth procedure

**The plan specified five procedures** (`listFindings`, `getFinding`, `resolveFinding`,
`runReconciliation`, `getScanRuns`) and described the Coverage panel as "declared
categories vs observed trackers".

None of the five returns observations for a *whole domain* — `getFinding` returns them
per finding. Building the declared-vs-observed matrix from the five would mean the client
fetching every finding, unioning their observations, and re-deriving the category
grouping. That client-side derivation would silently mix observations from **different
scan runs**, because findings carry whatever `last_scan_run_id` last touched them.

**Decision:** add `getCoverage({ domainId })`, which pins the comparison to a single
`status = 'ok'` run and folds observations into one row per tracker across both passes.

**Consequence:** the panel makes one claim sourced from one dated scan, rather than a
composite of several. The cost is a sixth endpoint and a fold that lives inside a tRPC
procedure rather than in a pure, unit-testable function.

**Wrong if:** the fold logic grows past the roughly 40 lines it is now. At that point it
should be extracted to a pure function next to `consentEvaluator.ts` and tested against
fixtures, the way the evaluator already is.

---

## 2. Score deductions: critical and high only, and confidence-gated

The plan says only *"add the open critical/high count to the compliance score inputs"*.
Three sub-decisions were needed.

**Which severities count.** Critical (25) and high (10) only. Medium and low findings are
real, but they describe *documentation* gaps — an unclassified cookie, a processor
missing from the register — rather than trackers running without a lawful basis. Letting
them move a headline number would make the number noisy enough that people stop reading
it. `info` findings (`consent_mode_only`) must never deduct: that finding exists to
record **correct** behaviour.

**Confidence gate at 0.7.** Findings below 0.7 confidence are skipped entirely. This is
the same threshold the UI uses to refuse to present a finding as definitive. It would be
incoherent to tell a customer "we could not verify this" and simultaneously charge them
points for it. Findings with `NULL` confidence are treated as trustworthy, not as
unreliable — the evaluator always sets a confidence, so `NULL` means "predates the
confidence field", not "unknown quality".

**Floor at 0, no cap on findings counted.** Four open criticals zero the pillar. There is
no asymptotic decay like `calculateDpiaScore` uses. A linear floor is easier to explain
to a customer than a curve, and at 0.05 weight the pillar cannot swing the total by more
than 5 points anyway.

**Wrong if:** real scans routinely produce more than three or four criticals per
organisation. Then the pillar saturates at 0 for everyone, stops discriminating, and
should move to the asymptotic form the DPIA pillar already uses.

---

## 3. Rebalanced four pillars rather than one

Adding a ninth pillar required taking 5 points from somewhere. Options were: take all 5
from one pillar, spread across all eight, or spread across the heaviest few.

**Decision:** ropa 0.25→0.23, vendors 0.20→0.19, dpia 0.15→0.14, training 0.10→0.09.

Taking all 5 from `ropa` would have cut the heaviest pillar by a fifth of its weight,
which is a substantive statement about ROPA mattering less. Spreading across all eight
would have moved the 0.05 pillars (`breach`, `transfers`) by rounding noise. Taking small
amounts from the four heaviest keeps every pillar's relative ordering intact and makes
each individual move small enough to be uncontroversial.

**Every organisation's score shifts on the next daily run.** This is unavoidable when the
weight vector changes; it is called out in `consent-reconciliation-ops.md` §5 because the
`complianceReports` history will show a step change on the deploy date.

A regression test (`scoring.test.ts` Test 16) asserts the weights still sum to 1 by
checking that all-pillars-at-100 yields exactly 100. Without it, a future pillar addition
would silently make a perfect score 97.

---

## 4. Added a `consent` PillarCard to the audit page

Not in the plan. The audit page renders eight `PillarCard`s from an explicit list, not by
iterating the breakdown object. Adding the pillar to scoring without adding the card would
have produced a headline score that moved with **no visible cause** — eight cards at 100
and a total of 95.

Added the card plus `pillars.consent` in `en` / `de` / `fr`. The German and French labels
("Einwilligung", "Consentement") are the standard GDPR terms for consent.

**Wrong if:** the audit page is ever refactored to iterate the breakdown. Then the
explicit card becomes duplication and should be removed.

---

## 5. `resolveFinding` accepts `'open'` as a resolution

The plan specified `resolution: 'dismissed' | 'false_positive'`.

The worker's `reconcileFindings()` reopens only findings whose state is `resolved` — the
state *it* sets. A finding a human dismissed stays dismissed forever, which is correct
(a scan should not overrule a person). But it also means a **mis-click is permanent**,
with no path back through the UI.

**Decision:** allow `'open'`, which clears `resolved_at` and `resolved_by`. The UI
exposes it as "Reopen", visible only on already-closed findings.

**Note:** reopening does not clear `resolution_note`, so the note explaining the original
dismissal survives. That is deliberate — it is audit history, not scratch state.

---

## 6. Evidence is rendered generically, not per finding type

The finding types have heterogeneous evidence shapes: `cmp_no_enforcement` carries
`affectedHosts` and `affectedTrackers`, `consent_mode_gap` carries a `setting` name,
`untracked_cookie` carries `expectedCookiePrefixes`.

**Decision:** render `evidence` as a generic key/value grid, lifting only `reason` and
`note` out as prose. Do not write a bespoke renderer per finding type.

The evaluator already writes a plain-English `reason` into every finding, so the prose
carries the meaning and the grid carries the specifics. A per-type renderer would need
updating every time the evaluator gains a finding type, and would silently drop fields
it did not know about — the worse failure, since the dropped field could be the one that
matters.

**Cost:** key names are camelCase-split for display rather than properly labelled, so the
grid reads slightly raw. Acceptable for an evidence panel aimed at a DPO who wants the
underlying facts.

**Wrong if:** a finding type acquires evidence that is actively misleading without
formatting — nested objects, for instance, currently render as `[object Object]`.

---

## 7. Observations are fetched on expand, not with the list

`getFinding` is called only when a row is expanded (`{ enabled: expanded }`).

A domain with 30 findings, each with up to 200 observations, would otherwise ship
thousands of rows to render a collapsed list. The tradeoff is a visible loading state
inside the expanded row.

---

## 8. Out-of-scope fix: `getDomain` had no organisation check

`consent.getDomain` selected by `id` alone. Any authenticated user with `ropa:view` could
read **any organisation's** consent domain, its full cookie inventory, and its consent
record count by guessing or obtaining a UUID.

Every procedure added in Phase 5 filters on `organizationId`, and a new
`assertDomainInOrg()` helper proves domain ownership before returning anything hanging
off it. Leaving `getDomain` unscoped next to six correctly-scoped procedures would have
been an inconsistency that reads as intentional.

**Decision:** fixed it. One added `and(eq(organizationId, ctx.user.orgId))`.

**Risk accepted:** if any caller currently relies on cross-org reads — a support tool, an
admin impersonation path — this breaks it. Nothing in the codebase appeared to, and
`ctx.user.orgId` is already the effective org after impersonation (`trpc.ts` sets
`effectiveOrgId`), so impersonation should be unaffected. Not runtime-verified.

**`updateBannerConfig` has the same gap** and was left alone — it is a mutation on a
different code path with different blast radius, and changing it was further from the
Phase 5 remit than a read used by the page being built. It should be fixed.

---

## 9. Out-of-scope fix: the host page was broken under Next 16

`apps/web/src/app/[locale]/(app)/consent/[id]/page.tsx` read `params.id` synchronously.
Next 16 **removed** synchronous `params` access (it was deprecated-but-working in 15), so
`params.id` is `undefined` at runtime and `ConsentWorkspaceClient` receives no domain id.

The Coverage panel is only reachable through that page, so shipping Phase 5 without this
fix would have meant shipping something unreachable.

**Why `tsc` did not catch it:** the page declares `{ params: { id: string } }` itself.
TypeScript checks the annotation, not what Next actually passes. `apps/web` typechecks at
0 errors either way. This class of bug is invisible to the only static gate this repo has.

**Four more pages have the identical bug** and were left alone as clearly outside the
remit: `dsar/[id]`, `policies/[id]`, `legal/[org_slug]/privacy`, `[org_slug]/request`.
Verify with `grep -rln "params: { " apps/web/src/app --include=page.tsx` — do not trust
the list without re-running it.

---

## 10. What was deliberately not built

- **Evaluator fixture tests.** `consent-reconciliation-plan.md` §Testing calls for
  recorded two-pass output from real sites (one Cookiebot, one OneTrust, one no-CMP, one
  Consent Mode v2) run against `evaluateConsentScan` in CI. That is Phase 4 work and
  Phase 4 was reported complete. It remains the **highest-value missing test** in this
  feature: the Consent Mode false-positive case is the one failure that would discredit
  the whole thing, and nothing currently proves it does not happen.
- **Queue adapter and `matchTrackerByDomain` unit tests.** Also specified in the plan,
  also Phase 0/1 work, also absent.
- **Findings visually grouped under severity headers.** The plan says "findings grouped
  by severity". Implemented as server-side severity ordering plus a five-tile count
  summary. Sorted-worst-first reads better than section headers when most domains have
  two or three findings, and it degrades better when they have thirty.
- **Pagination on `listFindings`.** Bounded in practice by
  `UNIQUE (domain_id, finding_type, observed_host)` — one row per host per finding type
  per domain. A pathological domain with hundreds of tracker hosts would need it.
- **A real-app run.** Nothing here has been exercised against a live database, a live
  queue, or a real Puppeteer scan. `tsc` is clean at baseline on both workspaces and
  `scoring.test.ts` passes 16/16; that is the entire extent of verification.
