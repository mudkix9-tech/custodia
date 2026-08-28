# Vendor catalogue — data sourcing programme

**Supersedes `vendor-data-sourcing-and-verification-strategy.md`**, which was written
against an imagined codebase: it proposed building `vendor_field_provenance` (it exists,
`schema.ts:1689`), cited `dpf_registrations` at lines that hold a different table, specified
two `dpaStatus` values that do not exist in the vocabulary, published an Article 45
whitelist missing Argentina that `constants/transferDestinations.ts` already has right, and
declared LLM sourcing "BANNED" in a module whose catalogue is populated by
`gemini-2.5-flash`. The §4 sub-processor table in that document is itself model-generated
content with no source URL — the exact artefact it argues is a regulatory liability.

**Date:** 27 August 2026. **Position:** the catalogue is sourced without a model, at all,
anywhere in the path. **Sequence:** Sprints 5–10, continuing the module's own numbering from
`vendor-intelligence-sprint-4-remediation.md`.

The catalogue is empty right now — `seed-vendors.ts` is 40 lines with zero records, root
`vendors.json` is `[]`, `purge-untrusted-vendors.ts` has run. That is the whole reason this
document is sequenced the way it is: **every semantic change below is free today and gets
more expensive with each row seeded.** Removing a provenance `sourceType` from the union
costs a migration and a backfill once rows carry it. Deciding that a product is not a legal
entity costs a re-key once 75 rows assume otherwise. Sprint 9 — the one that actually adds
vendors — is deliberately last.

---

## 1. Why no model, stated precisely

Not a stylistic preference and not a cost decision. Three reasons, in order of weight:

**A model cannot produce provenance.** Every field the product displays has to answer "where
did this come from and when". A registry row answers with a URL and a fetch date. A probe
answers with an HTTP status, a resolved URL and a matched token. A model answers with a
sentence. `groundingMetadata` looks like it closes this gap and does not: it names pages the
search tool retrieved during generation, not the page the asserted fact came from. It is a
plausible-looking citation, which in an Article 28(3) evidence pack is worse than no
citation, because a reviewer stops checking.

**The confidence floor is too high to be safe.** `fieldConfidence()` scores a model
assertion at 40 (`vendorFieldConfidence.ts:59`), and `fieldDecision()` maps 30–84 to
`'review'`. So a model-asserted `transferMechanisms` reaches a human queue with a number
beside it that reads like measurement. Nobody reviewing a 40-row queue at 40%
distinguishes "the model found this" from "a probe half-confirmed this" — they are the same
colour on `ConfidenceBar.tsx`.

**The fields it is asked for are the Chapter V fields.** `vendorIntelligence.ts:312-316`
writes `sourceType: 'ai_grounded'` for exactly `headquartersCountry`, `transferMechanisms`,
`securityCertifications`, `dataProcessingLocations`, `euHostingAvailable`. Those five decide
whether a customer's transfer is lawful. There is no field in the catalogue where a wrong
answer matters more and no field where a model is less checkable.

**What replaces it is not "the same thing, harder".** The model is currently doing one job
the pipeline needs — guessing candidate URLs — and several jobs it should never have had.
Candidate URLs are a path-permutation problem over a known domain, which is deterministic,
enumerable, and already half-written as the path list in the superseded document's Channel
3. Everything else the model asserts becomes either a registry lookup, a probe result, or an
explicit gap. **A gap is an acceptable output.** `dpaStatus: unknown` displayed honestly
beats `dpaStatus: signed` sourced from a sentence.

### 1.1 The policy is enforced by the type system, not by prose

The superseded document banned hallucination in a bullet point while the code wrote
`ai_grounded` rows. The ban only means something when a model-sourced value has nowhere to
be stored:

```ts
// vendorFieldConfidence.ts + schema.ts:1694 — after Sprint 5
sourceType: 'registry' | 'http_probe' | 'trust_centre' | 'analyst' | 'customer';
```

Note `trust_centre` **enters** the union as `ai_grounded` leaves it. The superseded document
specified a trust-centre channel and a provenance vocabulary that had no value to record it
under — Channel 3's own output could not be stored. Both halves of that are fixed in one
change because they are one change.

### 1.2 Scope of the removal — and what stays

`@google/genai` is imported by eight files. Only two are in this programme's path:

| File | Disposition |
|---|---|
| `apps/api/src/lib/vendorIntelligence.ts` | **Remove.** `callGemini` deleted, `extractAndProbe` re-sourced (Sprint 5) |
| `packages/db/src/scripts/gather-vendors.ts` | **Delete.** Already superseded by the service; appends to a JSON file nothing reads |
| `packages/db/src/seeds/gdpr-corpus.ts`, `scrape-{aepd,ap,bfdi,cnil}.ts` | **Keep.** Regulatory corpus, not the vendor catalogue — different programme, different risk |
| `apps/api/src/lib/genai.ts` | **Keep.** Shared client used by the corpus scrapers |

**One deliberate open question, not a decision this document makes.** `routers/ai.ts` runs
the Article 28(3) clause analysis that writes `vendors.dpa_clause_analysis` and
`organization_vendors.dpa_ai_analysis`, surfaced by `DpaAnalysisModal.tsx` and metered
through `ai_dpas_analyzed`. It is a *different shape of AI use* from catalogue sourcing: it
summarises a document the customer already has, in front of a reviewer who can read the
excerpt beside each verdict, and it asserts nothing about the outside world. That is
defensible where catalogue sourcing is not. It is also a customer-visible metered feature.
**Sprint 5 does not touch it.** If the intent is genuinely zero AI in the product rather
than zero AI in the catalogue, that is a separate removal with billing consequences —
flagged, not assumed. See §7.

---

## 2. The corrected data pyramid

The superseded version assigned "95% truth" and "90% truth" to tiers by assertion. Those
numbers were not calibrated against anything and would not survive being asked where they
came from. Tiers are ordered by *what the evidence is*, and confidence is the number
`fieldConfidence()` already computes from probe outcome and domain authority.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  TIER 1  registry     Official publisher, machine-readable, dated            │
│                       US DoC DPF list · EC Art. 45 decisions                 │
│                       Evidence: source URL + fetch timestamp                 │
├──────────────────────────────────────────────────────────────────────────────┤
│  TIER 2  http_probe   Vendor's own domain, 2xx, document-shaped body         │
│                       Evidence: resolved URL + HTTP status + matched tokens  │
├──────────────────────────────────────────────────────────────────────────────┤
│  TIER 3  trust_centre Structured portal (SafeBase/Vanta/Drata/Conveyor)      │
│                       Evidence: portal URL + badge text. NOT cryptographic.  │
├──────────────────────────────────────────────────────────────────────────────┤
│  TIER 4  analyst      A named human read a document and recorded a finding   │
│                       Evidence: verified_by + verified_at + excerpt          │
├──────────────────────────────────────────────────────────────────────────────┤
│  TIER 5  customer     Tenant's own executed contract. Overrides the          │
│                       catalogue for that tenant only, never writes back.     │
├──────────────────────────────────────────────────────────────────────────────┤
│  ABSENT               No row. Renders as "not yet verified", scores nothing. │
└──────────────────────────────────────────────────────────────────────────────┘
```

Two corrections carried in that table:

**Trust-centre badges are not cryptographic.** The superseded document called them
"cryptographically verifiable compliance badges". They are HTML. There is no signature and
nothing to verify; what a SafeBase page proves is that SafeBase renders a badge, which is a
claim about the portal and not about the SOC 2 report behind it. Tier 3 sits below a probe
of the vendor's own domain for that reason. Writing otherwise in a document intended to
survive an auditor reading it undermines the parts that are true.

**Absent is a tier.** It is the tier most rows will occupy after Sprint 9 and the product has
to render it without embarrassment.

---

## 3. Defect register

Findings from auditing the superseded document against the code. IDs are `VD-n` to avoid
colliding with the module's existing `D-n` / `P-n` series.

| ID | Finding | Where | Sprint |
|---|---|---|---|
| **VD-1** | Catalogue fields sourced from `gemini-2.5-flash`; five Chapter V fields written as `ai_grounded` | `vendorIntelligence.ts:105`, `:312-316` | 5 |
| **VD-2** | Provenance vocabulary has `ai_grounded`, lacks `trust_centre` — the trust-centre channel has nowhere to store its output | `schema.ts:1694`, `vendorFieldConfidence.ts:36` | 5 |
| **VD-3** | `robots.txt` is not fetched anywhere; a comment claims it is "handled at the batch level" | `vendorIntelligence.ts:158` | 6 |
| **VD-4** | `classifyFetchError` has three branches that all return `'timeout'` — NXDOMAIN reads as slow | `vendorProbe.ts:56-66` | 6 |
| **VD-5** | DPA token match is English-only; a German *Auftragsverarbeitungsvertrag* scores `partial` (45) not `verified` (90), in a module shipping en/de/fr | `vendorProbe.ts:114` | 6 |
| **VD-6** | No soft-404 control. Probe concurrency is 3 against a *single* host with no per-host delay | `vendorIntelligence.ts:436-444` | 6 |
| **VD-7** | Two divergent DPF matchers. `routers/vendors.ts` inlines its own fold, skipping `dpfNameKey`'s NFD normalisation and never checking domains — the tested matcher is bypassed at the hot call sites | `vendors.ts:183-186`, `:257-260` vs `vendorDpf.ts` | 7 |
| **VD-8** | `db.select().from(dpfRegistrations)` with no predicate — the whole registry into memory per call. Fine at 0 rows, a full scan per vendor view at the 3,000+ Phase 1 targets | `assessments.ts:739`, `vendors.ts:2872` | 7 |
| **VD-9** | `dpf_registrations` cannot distinguish EU-US from UK Extension from Swiss-US. A UK customer gets an EU-US answer. No column for HR-data coverage, dispute body, or privacy URL — four of Channel 1's six extracted fields have nowhere to land | `schema.ts:1718` | 7 |
| **VD-10** | Superseded Art. 45 list omits Argentina and the US/DPF entry, and drops the `scope` discriminator. Implementing it as written deletes working code | superseded §Channel 2 vs `transferDestinations.ts:11` | 8 |
| **VD-11** | `dpaStatus: 'unknown'` / `'missing'` do not exist. Real vocabulary is `signed / requested / in_review / not_started / expired` | superseded §2.4 vs `dpaStatus.ts:19` | 8 |
| **VD-12** | §2.4 conflates a tenant fact with a catalogue fact — see §3.1. Would suppress genuine Art. 28(3) findings | `schema.ts:1388` | 8 |
| **VD-13** | `vendors.dpa_available` is `boolean.default(false)`: "not looked yet" and "vendor offers none" are the same value | `schema.ts` `vendors` | 8 |
| **VD-14** | Unknown headquarters country scores 20/20 — maximum penalty for an unresearched field, the same conflation VD-12 describes, in the location factor | `vendorRisk.ts:99` | 8 |
| **VD-15** | The 75-vendor target set double-counts legal entities: Twilio/SendGrid/Segment, Okta/Auth0, Atlassian/Bitbucket, Microsoft Azure/365, Google Cloud/Workspace/Analytics. DPF matches entities, DPAs are signed with entities | superseded §Channel 4 | 9 |
| **VD-16** | Superseded plan reseeds the catalogue and stops. `organization_vendors.risk_score` is denormalised; every score stays stale until `recalc:vendor-risk -- --apply`. This is the exact failure D5 records | superseded §Phase 2 | 9 |
| **VD-17** | `check:schema` is not in `npm run check`. Every sprint below ships a migration | root `package.json` | 9 |
| **VD-18** | Pre-seeded sub-processor edges have no source and hang off the *shared* catalogue — wrong once is wrong for every tenant (known-concerns §17). First real snapshot renders as a mass Art. 28(2) change against a fabricated baseline | superseded §4 | 9 |
| **VD-19** | Nothing decays. A probe verified in March reads `confidence: 90` in December. `retrieved_at` is stored and nothing reads it | `vendorFieldConfidence.ts` | 10 |
| **VD-20** | No correction path. Custodia publishes assertions about named third parties with no procedure for "your record of us is wrong" and no precedence rule for an `analyst` override | — | 10 |
| **VD-21** | Phase 3 badges specified as literal English. `components/vendors` is a `check:vendor-i18n` target; the dynamic date segments need template keys the guard's single-quote key check will not verify | superseded §Phase 3 | 10 |
| **VD-22** | "Article 44 transfer breach alert" — a lapsed DPF is a transfer without a Chapter V mechanism, not an Art. 33/34 personal-data breach. Different obligations, different clocks | superseded §Channel 1 | 7 |

### 3.1 VD-12 in full, because it is the one that would have shipped wrong

The superseded §2.4 reads: *a vendor whose DPA has not yet been indexed (`dpaStatus:
'unknown'`, zero penalty) versus a vendor that formally refuses Article 28 terms
(`dpaStatus: 'missing'`, maximum penalty)*.

`dpa_status` lives on **`organization_vendors`**. It records whether *this customer* has
executed a DPA with this vendor. Whether Custodia has indexed the vendor's published
template is `vendors.dpa_url` / `vendors.dpa_available` on the shared catalogue row.

A controller who has signed nothing is in breach of Art. 28(3) no matter how good the
vendor's published template is. Zeroing that penalty because *Custodia's catalogue* is
unindexed would hide a real, reportable gap behind an internal data-collection state — and
`gapRules.ts` currently raises it correctly via `notInArray(dpaStatus, ['signed'])`.

The instinct behind §2.4 is right and is aimed at the wrong column. The tri-state belongs on
the catalogue field (VD-13): `dpa_available` needs `unindexed` distinct from `false`, so the
*catalogue* can say "we have not looked" without the *register* saying "you are compliant".

---

## 4. Sourcing channels

### Channel 1 — US DPF participant list (Tier 1)

**Sprint 7 opens with a verification task, not a parser.** The superseded document names
`https://www.dataprivacyframework.gov/s/participant-search` as an "official DPF API / daily
JSON export". That path is a Salesforce Lightning *UI route*; whether a machine-readable feed
exists at it, behind it, or at all has **not been verified here** and no code should be
written against it until someone has fetched it and looked at the response. If no stable feed
exists, the fallback is a periodic manual export committed as a dated fixture with an
`analyst` provenance row — slower, still Tier 1, still honest.

Fields to capture, with the schema work VD-9 requires:

| Field | Column | Status |
|---|---|---|
| Organisation name | `organisation_name` + folded `name_key` | exists |
| Covered entities / trading names | `covered_entities` jsonb | exists |
| Published domains | `domains` text[] | exists |
| Status + recertification date | `status`, `next_recertification_date` | exists |
| **Which framework** (EU-US / UK Ext. / Swiss-US) | — | **VD-9, add** |
| **HR vs non-HR coverage** | — | **VD-9, add** |
| **Dispute resolution body** | — | **VD-9, add** |
| **Privacy policy URL** | — | **VD-9, add** |

Framework separation is not a nicety. A vendor certified EU-US but not UK Extension is a
correct answer for a German customer and a wrong one for a British customer, and the product
currently cannot represent the difference.

On lapse: the alert says a Chapter V mechanism is no longer evidenced and SCCs are needed —
not "breach" (VD-22). Withdrawal is also not instantaneous in effect; an organisation that
leaves the framework retains obligations for data received while certified, so a lapse is a
prompt to check the fallback mechanism, not a retroactive verdict on past transfers.

### Channel 2 — EC Article 45 adequacy (Tier 1)

**Already implemented and more correct than the plan that proposed replacing it.**
`ADEQUACY_DECISIONS` in `transferDestinations.ts:11` carries fifteen entries with decision
dates and a `scope` discriminator — `commercial` for Canada under PIPEDA,
`data_privacy_framework` for the US. A flat ISO-3166 list cannot carry either, which is why
the superseded Channel 2 would have been a regression.

The work here is not code. It is **VD-19 applied to a constant**: adequacy decisions get
added, and they get withdrawn or invalidated by the CJEU. A hardcoded table with no review
date is the same defect as a hardcoded DPF string with no expiry — the thing this whole
programme exists to remove. Sprint 8 adds a `REVIEWED_ON` constant beside the table and a
fixture that fails once it is more than twelve months old. That converts a silent staleness
into a build failure.

### Channel 3 — deterministic probe (Tier 2)

**More of this is built than the superseded document credits, and its description of the rule
is weaker than the code.** It says a DPA is verified on "an `HTTP 200 OK` … and exact
statutory tokens". `vendorProbe.ts:108` already requires three independent token families — a
name, a role (`controller` / `processor` / `SCC`) and an execution marker — plus a login-wall
check that runs *before* signal matching so a gated page containing the word "agreement"
cannot verify. `classifyResponse` separates bot-walls from 404s from gated content.
`probeUrl` sends an honest, self-identifying User-Agent.

The risk was that someone implementing to the document would build the naive 200-OK version
and lose all of that. The work is the four hardening items — VD-3 through VD-6 — plus the one
genuinely new piece: **candidate URL generation without a model.**

```
for each vendor domain:
  enumerate  /legal/dpa, /legal/data-processing-addendum, /legal/dpa.pdf,
             /privacy/dpa, /dpa, /terms/dpa, /legal/subprocessors,
             /legal/sub-processors, /subprocessors, /privacy, /legal/privacy …
  plus       trust.{domain}, trust.safebase.io/{slug}, trust.vanta.com/{slug},
             trust.drata.com/{slug}, app.conveyor.com/{slug}
  plus       every same-registrable-domain link on /legal and /privacy whose
             anchor text matches the DPA/sub-processor token families
```

That last line is what actually replaces the model for the long tail, and it is a link
extraction, not an inference. A vendor who publishes a DPA anywhere reachable publishes a
link to it from a legal index page. A vendor who does not is a genuine `unindexed`.

Per-host budget: **at most one in-flight request per host and one request per second**, which
is stricter than the current 3-concurrent (VD-6) and matches what a self-identifying
compliance crawler should be able to defend in a support ticket.

### Channel 4 — the curated core (Tier 4, analyst)

The 75-vendor target set is kept, with VD-15 applied: **the unit is the legal entity, not the
product.** Google Cloud, Google Workspace and Google Analytics are three catalogue entries a
customer recognises and one DPF registrant, one DPA and one set of SCCs. The catalogue needs
a `parent_entity` relationship before Sprint 9 seeds anything, or DPF matching by name
silently returns `not_found` for two of every three Google products.

`VENDOR_PARENT_DOMAINS` in `vendorDomains.ts` already models part of this for document
authority — a DPA on `netsuite.com` for Oracle resolves as `parent_domain` rather than
rejecting. Sprint 9 extends that idea from "whose domain is this document on" to "whose legal
entity signs this contract", which is the same question asked one level up.

Entity collapses in the target set, to be resolved before seeding: Twilio ← SendGrid, Segment
· Okta ← Auth0 · Atlassian ← Bitbucket, Jira, Confluence · Microsoft ← Azure, 365, GitHub,
NPM · Google ← Cloud, Workspace, Analytics · Intuit ← QuickBooks, Mailchimp. That is roughly
75 products across roughly 62 entities, and the two numbers should never again appear as one
number.

---

## 5. Sprints

Each sprint states its gate. `npm run check` is 9 guard scripts across 10 invocations plus 11
fixture suites — **not the "7 static guards" the superseded document asserts** — and it does
not include `check:schema` (VD-17).

### Sprint 5 — Zero-AI cutover

*Closes VD-1, VD-2. Must be first: it fixes the meaning of every row the later sprints write.*

1. Delete `callGemini`, `extractGrounding`, `sliceJson`, `makeClient` / `makeGeminiClient` and
   the `GeminiLike` type from `vendorIntelligence.ts`. Drop the `@google/genai` import.
2. Replace `extractAndProbe`'s first line with `enumerateCandidateUrls(target)` — a new pure
   module `lib/vendorUrlCandidates.ts`, testable without a network, which is the whole point
   of putting it beside `vendorProbe.ts` rather than inside the service.
3. `sourceType` union in `vendorFieldConfidence.ts:36`, `vendorIntelligenceMappers.ts:52` and
   the `schema.ts:1694` comment: `ai_grounded` out, `trust_centre` in.
4. Delete the `return evidence.value ? 40 : 0` tier from `fieldConfidence()`. With no model
   tier there is no "asserted but unprobed" state — a field is registry-sourced,
   probe-sourced, portal-sourced, human-sourced, or absent.
5. `vendor_candidates.grounding` and `payload`'s "exactly as the model produced it" comment:
   repurpose `grounding` to hold the enumerated-and-rejected URL list, which is the audit
   trail for *why* a field came back absent. Migration: none — column stays, meaning changes,
   and there are zero rows.
6. Delete `packages/db/src/scripts/gather-vendors.ts`.
7. Fixtures in `vendors.test.ts`: replace the four `ai_grounded` cases at `:616-638` with
   `trust_centre` cases, and add one asserting that an absent field yields **no provenance
   row** rather than a row with `confidence: 0` — a zero-confidence row still renders as a
   field the product has an opinion about.

**Gate:** `npm run check` green. `grep -rn "ai_grounded\|@google/genai" apps/api/src` returns
nothing outside `lib/genai.ts` and the corpus scrapers.

**Shipped, 28 August 2026.** Gate met: `npm run check` exits 0 (which since this document
was written *does* include `check:schema` — VD-17 is already closed, so Sprint 9 task 1 is
a no-op), `test:vendors` is at 330 assertions, and the only surviving `ai_grounded` strings
are comments plus the fixture asserting the value is gone. `@google/genai` survives in
`lib/genai.ts`, `lib/llm.ts`, `scripts/check-genai-config.ts` and the five corpus scrapers —
all shared-client or regulatory-corpus, none in the catalogue path. `routers/ai.ts` is
untouched, per §1.2 and open question 1.

Three things were done differently from the list above, each deliberate:

1. **Per-host pacing arrived a sprint early.** Enumeration turns three model-supplied URLs
   into roughly thirty candidates, and shipping that against the existing 3-concurrent,
   no-delay loop would have made Sprint 5 a regression in exactly the way VD-6 describes.
   `extractAndProbe` is now one request at a time, one per second, with a 24-request budget
   per target and a stop on the first verified hit per document type. Sprint 6 still owns
   the rest of VD-6 — the soft-404 negative control — plus VD-3, VD-4 and VD-5.
2. **The anchor-text matcher is en/de/fr from the first line.** `extractLinkCandidates` is
   new code; writing it English-only and widening it in Sprint 6 would have been VD-5 with
   the ink still wet. `evaluateContentSignals` is untouched and remains Sprint 6's job.
3. **`assessCandidate`'s corroboration test now excludes the DPA itself.** `anyProbeVerified`
   was satisfied by `dpaUrl`, so "the DPA verified AND at least one more corroborating probe"
   was one condition wearing two hats. Harmless while five model-asserted fields at 40 held
   the weighted mean under the bar; not harmless once Sprint 5 removed them, because a
   record asserting one verified field now scores 90. Fixtures cover both halves.

Two consequences worth carrying forward rather than fixing here:

- **`bulkApprove` gates on the candidate's raw `confidence`, not on `autoAcceptable`,** which
  the candidate row has no column for. That number now means "how sure of what we assert",
  not "how much we know", so a one-verified-field record reads 90 where it used to read
  ~55. The record it writes is honest — one column, one provenance row — but the threshold
  is measuring a different thing than it was. A completeness axis alongside the confidence
  axis is the real answer, and it belongs with Sprint 10's provenance surface.
- **`fetchDocument` is split out of `probeUrl`** so the link-extraction pass can read a
  legal index without pretending it is a DPA. While restructuring it, the `isGatedUrl` result
  that had been computed and discarded was wired into `classifyResponse`, so a login wall
  that does not also say "password" in its body now classifies as `gated_content` rather
  than `content_mismatch` — "we could not see it" rather than "it is not there".

### Sprint 6 — Probe hardening

*Closes VD-3, VD-4, VD-5, VD-6. The probe is now the only Tier 2 source; it carries weight it
was not carrying when a model backstopped it.*

1. **VD-3.** `lib/robotsTxt.ts`: fetch, parse, cache per host for the run, honour `Disallow`
   for our User-Agent token and `*`. A disallowed path is a distinct probe outcome —
   `blocked_by_robots` — not a failure, because it says nothing about whether the DPA exists.
   Then either implement it or delete the comment at `vendorIntelligence.ts:158`; a comment
   asserting a control that does not exist is worse than no comment.
2. **VD-4.** Make `classifyFetchError` return what it computes: `dns_failure` for `ENOTFOUND`
   / `EAI_AGAIN` / `getaddrinfo`, `connection_refused` for `ECONNREFUSED` / `ECONNRESET`,
   `timeout` for the abort path. Add both to `PROBE_FAILURE_CLASSES`. A vendor whose domain
   does not resolve is a catalogue data error; a vendor who times out is a retry. They
   currently read identically.
3. **VD-5.** Widen `evaluateContentSignals`' `dpa` families to de/fr:
   `auftragsverarbeitungsvertrag|auftragsverarbeitung|avv`,
   `accord de sous-traitance|sous-traitant`, and roles
   `verantwortlicher|auftragsverarbeiter|responsable de traitement`. Same shape as the Art. 9
   vocabulary fix — a keyword scan in one language inside a three-language product finds
   nothing and says so confidently.
4. **VD-6.** Soft-404 negative control: probe one path known not to exist
   (`/{random-32-hex}`) per host, once, before the real probes. If it returns 2xx with a body,
   the host soft-404s and **every 2xx from it is downgraded to `partial`** regardless of
   tokens. Per-host concurrency to 1, one request per second.
5. Fixtures: a German DPA body verifies; a French one verifies; a soft-404 host downgrades;
   NXDOMAIN classifies as `dns_failure`; a `Disallow`d path returns `blocked_by_robots` and
   writes no provenance row.

**Gate:** `npm run check` green, `test:vendors` covers all five.

**Shipped, 29 August 2026.** Gate met: `npm run check` exits 0 and `test:vendors` is at
375 assertions, with all five listed fixtures plus the vocabulary and cache assertions
behind them. New file: `lib/robotsTxt.ts`. No migration.

Four things were done differently from the list above, each deliberate:

1. **`soft_404` is its own failure class rather than a re-used `content_mismatch`.**
   The list says a soft-404 host's 2xx is "downgraded to `partial`", and it is —
   `statusFromOutcome` maps `soft_404` to `partially_probed`, which is 45, exactly what
   the spec asks for. But the *reject log* is the only record of why a field came back
   absent, and `content_mismatch` there would claim we saw the page and it was something
   else. What actually happened is that the host answers 200 for everything, which sends
   a reviewer somewhere different.
2. **All three signal families went to en/de/fr, not just the DPA's.** VD-5 names the
   `dpa` families. Widening those and leaving `subprocessors` and `privacy` English-only
   would have been the same defect one door down, in a module that ships in three
   languages — and the sub-processor list is what the Art. 28(2) diff is built on. The
   execution family (`unterzeichn`, `vertragsparteien`, `conclu`, …) had to widen too or
   the German fixture cannot verify: `evaluateContentSignals` needs all three families,
   so a German name plus German roles plus English-only execution still scores 45.
3. **`USER_AGENT` moved from `vendorIntelligence.ts` to `vendorProbe.ts`,** beside the
   new `USER_AGENT_TOKEN` that `robotsTxt.ts` matches groups on. If the two ever drift we
   honour a robots.txt group nobody writes while ignoring the one they do, and that
   failure is silent and total; a fixture now asserts the token is a substring of the UA,
   which needs both of them somewhere a fixture can import. `statusFromOutcome` moved the
   same way and for the same reason — it now sits next to the failure classes it maps, so
   adding a class and deciding what it is worth are one edit in one file.
4. **An unreadable robots.txt permits rather than blocks.** RFC 9309 allows treating a
   5xx or a network failure as a complete disallow. We do not: a flaky endpoint would
   erase a whole vendor's record and the reviewer would read `blocked_by_robots` against a
   host that never disallowed anything. Only an actual `Disallow` blocks; a 4xx means no
   robots.txt exists, which is no restriction. Absence of a rule is not a rule.

Three consequences worth carrying forward:

- **The two controls are charged to `MAX_PROBES_PER_TARGET`.** Robots and the negative
  control are two requests per host, and the budget is about what the host is asked, not
  about what we hoped to learn — a ceiling that counted only the interesting requests
  would be measuring our intentions rather than its load. The effective document budget
  is therefore smaller than 24; the candidate list is ordered most-likely-first, so what
  that cuts is its tail.
- **The negative control is not itself robots-checked**, and that is the one deliberate
  fail-open. It only runs once robots has already permitted a real document request to
  that host, and skipping it would mean *not* downgrading — which is the exact outcome
  VD-6 exists to prevent.
- **`classifyFetchError` reads `AggregateError.errors`, not just the `cause` chain.**
  Undici reports a refused connection as `TypeError: fetch failed` whose cause is an
  aggregate with one entry per address the host resolved to. A cause-only walk finds the
  word "failed" and nothing else, so every refusal would have fallen through to the
  default — VD-4's collapse reproduced one level down, in the fix for it.

### Sprint 7 — DPF registry ingestion

*Closes VD-7, VD-8, VD-9, VD-22.*

0. **Verify the feed before writing the parser.** Fetch the candidate endpoint, record what
   comes back, and commit a dated sample. If there is no machine-readable feed, switch to the
   committed-export fallback in §4 Channel 1 and say so in the script's header comment. Do
   not write a parser for a response nobody has seen.
1. **VD-9 migration:** `framework` (`eu_us` / `uk_extension` / `swiss_us`), `hr_data_covered`,
   `dispute_resolution_body`, `privacy_policy_url`. The unique key moves from `name_key` to
   `(name_key, framework)` — one organisation holds up to three certifications and they lapse
   independently.
2. `packages/db/src/scripts/sync-dpf-registry.ts`, following the `consent_findings`
   upsert-and-resolve pattern: bump `fetched_at` on what the feed contains, flip what it omits
   to `lapsed`. Idempotent, so re-running is free and disappearance is detected.
3. **VD-7:** delete both inline matchers in `routers/vendors.ts` and route every call through
   `matchDpfStatus()`. It is domain-first, NFD-normalised, never substring, and it is the one
   with fixtures behind it.
4. **VD-8:** load by predicate, not by table. `matchDpfStatus` takes an entry array; give it
   the entries for one vendor's `name_key` and domains, not all 3,000.
5. `dpf-registry-sync` worker. Registered via `createQueue().add()` with `wrapJobPayload` —
   never `boss.send()`. **Not in `DORMANT_JOBS`:** it writes a shared catalogue table and
   emails nobody. The *alerting* built on top of it is what needs the dormancy decision, and
   it belongs to a later sprint.
6. **VD-22:** the lapse alert copy says "no longer evidenced under the Data Privacy Framework
   — confirm SCCs or another Chapter V safeguard". Not "breach".

**Gate:** `npm run check` and `npm run check:schema --workspace=packages/db` both green;
migration `.sql`, `meta/NNNN_snapshot.json` and `meta/_journal.json` committed together.

### Sprint 8 — Adequacy and the tri-state semantics

*Closes VD-10, VD-11, VD-12, VD-13, VD-14.*

1. **VD-10:** keep `ADEQUACY_DECISIONS`. Add `ADEQUACY_REVIEWED_ON` and a `test:transfers`
   case that fails once it is twelve months stale.
2. **VD-13 + VD-12:** `vendors.dpa_available` becomes
   `varchar: 'available' | 'unavailable' | 'unindexed'`, defaulting to `'unindexed'`.
   Migration backfills `true → 'available'`, `false → 'unindexed'` — **not** `'unavailable'`,
   because every existing `false` is a default nobody set. Zero rows today, which is the whole
   argument for doing it now.
3. `organization_vendors.dpa_status` is **unchanged**. Its vocabulary stays
   `signed / requested / in_review / not_started / expired` (VD-11) and `gapRules.ts` keeps
   raising Art. 28(3) on anything but `signed`. The catalogue's ignorance never excuses the
   tenant's missing contract.
4. **VD-14:** unknown headquarters country stops scoring 20/20. It becomes a `risk_factors`
   entry of its own — `location: unverified` — that the register can filter on and that reads
   as "go and find out", separate from `Non-adequate country` which reads as "you have a
   Chapter V problem". Same distinction as `computeDisposalDate`'s `no_period` versus
   `no_anchor`: two findings that send someone to fix different things.
5. Fixtures in `vendors.test.ts` and `transferDestinations.test.ts` for each state, including
   the one that matters most — **an unverified vendor must not outscore a verified adequate
   one**, or the scoring rewards not looking.

**Gate:** `npm run check` + `check:schema`. `recalc:vendor-risk` dry-run reports the score
delta for every existing row before anything is applied.

### Sprint 9 — Seeding the catalogue

*Closes VD-15, VD-16, VD-17, VD-18. The first sprint that adds a vendor.*

1. **VD-17 first:** add `check:schema --workspace=packages/db` to the root `check` script.
   Sprints 7 and 8 both shipped migrations without it.
2. **VD-15:** `vendors.parent_entity_id` self-reference plus `legal_entity_name`. DPF matching
   runs against the entity; the product still lists the products.
3. Seed procedure, in order, per vendor: resolve entity → registry lookup (Tier 1) →
   enumerate and probe (Tier 2) → trust centre (Tier 3) → **stop**. What is unresolved stays
   `unindexed` with no provenance row. An analyst may add Tier 4 rows afterwards with
   `verified_by` and an excerpt; nobody may add a row without one.
4. **VD-18:** no pre-seeded sub-processor edges. `vendor_sub_processors` is populated only
   from a probed `sub_processor_list_url`, so the first snapshot is a real baseline and the
   Art. 28(2) diff means something. A vendor with no reachable list has no edges and the
   concentration graph is honestly sparse.
5. **VD-16:** the seed script's final line, and the runbook's:
   ```bash
   npm run seed:vendors        --workspace=packages/db
   npm run recalc:vendor-risk  --workspace=apps/api -- --apply
   ```
   Without the second, nothing the first did reaches a customer's score. This is D5 exactly,
   and the superseded plan reproduced it.

**Gate:** `npm run check` + `check:schema`. Every seeded row has either a provenance row per
populated field or the field is absent. A query returning any row with a populated
`transfer_mechanisms` and no matching `vendor_field_provenance` entry is a failed gate.

### Sprint 10 — Provenance surface and freshness

*Closes VD-19, VD-20, VD-21.*

1. **VD-19:** `provenanceAge()` — a pure function decaying `confidence` by `sourceType`.
   Registry rows decay slowly (the feed re-confirms them); probe rows halve at 180 days and
   floor at 30; `analyst` rows carry an explicit `review_by`. A field below its floor renders
   as "last verified {date}", not as a bare value. Decay is computed at read time from
   `retrieved_at`, never written back — a background recompute of a shared catalogue row is
   how the ROPA register learned not to touch `updated_at`.
2. **VD-20:** an entity-correction procedure. An `analyst` row supersedes `http_probe` and
   `registry` for its field, carries `verified_by` and an excerpt, and is the *only* tier a
   human can write. `customer` rows override for one tenant and never propagate to the
   catalogue — a tenant's private contract is not evidence about the vendor in general.
   Document who receives a correction request and what the SLA is; a data-quality process with
   no named owner is a process that does not exist.
3. **VD-21:** badges via `useTranslations`, keys in `messages/{en,de,fr}/vendors.json`
   (currently 858 keys). Dates through the existing formatter, not concatenated. Note the
   guard only checks single-quoted keys, so any `t(\`provenance.${sourceType}\`)` needs its
   five keys added and verified by hand.
4. `ConfidenceBar.tsx` shows the tier, not just the number. "90%" and "probe-verified on
   stripe.com, 3 days ago" are the same figure and different information.

**Gate:** `npm run check` including `check:vendor-i18n`; all badge keys present in all three
catalogues.

---

## 6. Verification gates

What `npm run check` actually runs, corrected from the superseded §6:

| | |
|---|---|
| Typecheck | `apps/api`, `apps/web` — both at 0 errors, keep them there |
| Guards (9 scripts, 10 invocations) | `check:tenancy`, `check:relations`, `check:nocheck` ×2, `check:params`, `check:sitemap`, `check:messages`, `check:ropa-i18n`, `check:vendor-i18n` |
| Fixtures (11 suites) | including `test:vendors` and `test:transfers`, both of which this programme extends |
| **Not included** | `check:schema` — VD-17, added in Sprint 9. `npx eslint` cannot run at all (pre-existing plugin incompatibility), so `tsc` plus these guards is the entire static gate |

Standing constraints that apply to every sprint above:

- New API code reading the database uses `db.query.<table>.findMany()` where the surrounding
  file does — `db.select()` escapes the standalone fixtures' mocks and opens a real connection.
- `vendors` and `dpf_registrations` are **shared catalogues**; writes to them belong in the
  tenancy guard's `ALLOWED_WRITES` with a reason. `organization_vendors` writes are org-scoped
  per statement, not per procedure.
- Any mutation that should appear in a History tab needs entries in `ACTION_TYPE_OVERRIDES`,
  `RESOURCE_TABLE_MAP` and `ACTION_DESCRIPTIONS` — the vendor module already lost a year of
  audit diffs to this.
- Every sprint shipping a migration commits the `.sql`, its `meta/NNNN_snapshot.json` and
  `meta/_journal.json` together, and does not hand-write the `.sql`.

---

## 7. Open questions

Flagged rather than decided, because each changes the work materially and none blocks
Sprint 5.

1. **Does the DPA clause analysis stay?** §1.2 argues it is a different and defensible shape
   of AI use, and it is metered and customer-visible. If the position is zero AI in the
   product rather than zero AI in the catalogue, removing it means `routers/ai.ts`,
   `DpaAnalysisModal.tsx`, `vendors.dpa_clause_analysis`,
   `organization_vendors.dpa_ai_analysis`, `dpa_analysis_status`, the `ai_dpas_analyzed`
   counter and the `dpaAnalyses` plan allowance — with billing consequences. **Needs a
   decision before Sprint 9**, because the seed either populates `dpa_clause_analysis` or the
   column goes.
2. **Does a DPF feed exist?** Sprint 7 task 0. If not, Tier 1 for DPF becomes a dated
   committed export and the sync worker becomes a staleness check.
3. **Trust-centre portals and terms of service.** Sprint 6 handles robots.txt; SafeBase, Vanta
   and Drata each have ToS that may address automated access. Reading them is a pre-Sprint-6
   task, and the answer may remove Tier 3 for some portals.
4. **What is the catalogue's coverage promise?** A 62-entity catalogue seeded from registries
   and probes will have real gaps, and the marketing claim implied by "300+ authoritative
   profiles" in the superseded header is not one this programme can honour. Better to promise
   provenance than coverage: every field either cites its source or says it has none.
