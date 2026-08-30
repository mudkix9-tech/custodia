# Vendor catalogue — data sourcing programme

**Supersedes [`vendor-data-sourcing-and-verification-strategy.md`](./vendor-data-sourcing-and-verification-strategy.md)**,
which was written against an imagined codebase: it proposed building
`vendor_field_provenance` (it already existed), cited `dpf_registrations` at lines that
hold a different table, specified two `dpaStatus` values that do not exist in the
vocabulary, published an Article 45 whitelist missing Argentina that
`constants/transferDestinations.ts` already has right, and declared LLM sourcing "BANNED"
in a module whose catalogue was, at the time, populated by `gemini-2.5-flash` (Sprint 5
ended that). The §4 sub-processor table in that document is itself model-generated content
with no source URL — the exact artefact it argues is a regulatory liability. That file now
carries a banner saying so; it did not for the first three days, which meant the
supersession was asserted only in the replacement and anyone opening the wrong file first
had no way to know.

| | |
|---|---|
| **Written** | 27 August 2026 |
| **Last reconciled against the code** | 30 August 2026 |
| **Owner** | The DPO role, as in [`vendor-data-correction-process.md`](./vendor-data-correction-process.md) — held by the product owner until [`vendor-data-correction-rota.md`](./vendor-data-correction-rota.md) names someone else |
| **Next reconciliation due** | 28 February 2027, or the next sprint that touches the module, whichever is first |
| **Position** | The catalogue is sourced without a model, at all, anywhere in the path |
| **Sequence** | Sprints 5–11, continuing the module's numbering from `vendor-intelligence-sprint-4-remediation.md` |

**The review date is not decoration.** This document sets a twelve-month clock on the
adequacy list, a `review_by` on every analyst row and a 5/20-working-day service level on
corrections, and for its first three days carried none of those for itself — the same
defect it charges `ADEQUACY_DECISIONS` with in §4, Channel 2. Reconciling means opening
the code and checking the claims, then moving the date whether or not anything changed.
Moving it without looking defeats the mechanism, which is exactly what §4 says about the
adequacy clock.

**This document cites code by symbol, not by line.** Every sprint in it ships a migration
or moves a function, so a line number written here is wrong by the sprint after the one
that wrote it — which is the first charge this document lays against its predecessor, and
one it earned itself between Sprints 7 and 10. Names survive; positions do not.

---

## 0. Where this stands

**Read this section and §1. Everything after them is reference and history.**

The programme is closed. Twenty-three defects were found and all twenty-three are fixed;
the sprint plans in §5 are superseded by their own *Shipped* blocks, and both are kept
only because the reasoning in them is occasionally load-bearing.

**What the module does now.** Every catalogue field is sourced from an official register,
a probe of the vendor's own domain, a structured trust portal, a named human, or nothing
at all — and it records which, with a URL and a date. Nothing anywhere in the path asks a
model. A weekly job syncs the US Data Privacy Framework register, re-resolves every linked
vendor against it, moves the risk scores that depend on it and reports any certification
that has stopped being current. Where a field has no source, the product says so rather
than guessing.

**What is open, and where it lives.** The carried-forward items are in
[`known-concerns.md` §20](../known-concerns.md) — the register the rest of this repo tells
people to read — rather than at the bottom of this file. That move is the point: §8 used
to open by saying that collecting these "is the difference between a note somebody wrote
and a thing somebody will find", and then left them in an audit document nothing points
at. Three of the items are decisions rather than code, and they are restated in §7 below
because they change what somebody would build next:

1. whether the Article 28(3) clause analysis — the last model in the product — stays;
2. whether anyone has read the trust-centre terms of service that Tier 3 rests on;
3. what the catalogue's coverage promise is, now that there is a real number for it.

**What the numbers are.** 82 catalogue rows, 52 resolved to a named legal entity, 49
holding a current EU-U.S. certification, 15 products linked to a parent entity, 29 resolved
to nothing at all, 101 provenance rows, zero sub-processor edges. Two of those — the 82 and
the 15 — are checkable from the repo, because `CATALOGUE_SEED` is the seed's own input. The
other five are production observations, read off a console once and retyped, which is a
lower standard than this document applies to the DPF feed twenty lines later. `seed:catalogue` now writes
`apps/api/src/lib/fixtures/catalogue-seed-summary.json` on every run for that reason —
after the next seed, a change in these figures is a diff rather than an assertion.

---

## Status

**All seven sprints have shipped and all twenty-three findings in §3 are closed.** Each
sprint in §5 carries a *Shipped* block recording what was done differently from its own
plan and what it left behind; those blocks, not the plans above them, describe the system.
What remains open is in [`known-concerns.md` §20](../known-concerns.md), summarised in §0.

Sprint 11 is not part of the original programme. It closes the findings a review of *this
document* turned up in August 2026 — including VD-23, which is the largest defect the
programme itself produced and the one it was best placed to have caught.

| Sprint | Closes | Shipped |
|---|---|---|
| 5 — zero-AI cutover | VD-1, VD-2 | 28 Aug 2026 |
| 6 — probe hardening | VD-3, VD-4, VD-5, VD-6 | 29 Aug 2026 |
| 7 — DPF registry ingestion | VD-7, VD-8, VD-9, VD-22 | 29 Aug 2026 |
| 8 — adequacy and tri-state semantics | VD-10, VD-11, VD-12, VD-13, VD-14 | 29 Aug 2026 |
| 9 — seeding against the legal entity | VD-15, VD-16, VD-18 | 29 Aug 2026 |
| — | VD-17 | closed out of band, `46b7055` |
| 10 — provenance surface and freshness | VD-19, VD-20, VD-21 | 29 Aug 2026 |
| 11 — review remediation | VD-23, and the sixteen document and wiring defects in §8 | 30 Aug 2026 |

**This document cites code by symbol, not by line.** Every sprint in it ships a migration
or moves a function, so a line number written here is wrong by the sprint after the one
that wrote it — which is the first charge this document lays against its predecessor, and
the one it earned itself between Sprints 7 and 10. Names survive; positions do not.

### The premise this was sequenced on, and what happened to it

The catalogue was empty when this was written — `seed-vendors.ts` held zero records, root
`vendors.json` was `[]`, `purge-untrusted-vendors.ts` had run — and that is the whole
reason the order is what it is: **every semantic change below was free then and gets more
expensive with each row seeded.** Removing a provenance `sourceType` from the union costs a
migration and a backfill once rows carry it. Deciding that a product is not a legal entity
costs a re-key once rows assume otherwise. Sprint 9 — the one that actually adds vendors —
was deliberately last.

That window has closed. Sprint 9 seeded 82 catalogue rows and 101 provenance rows, and
Sprint 10 already paid the toll once: widening `vendor_field_provenance`'s unique key from
(vendor, field) to (vendor, field, source_type) was safe only because all 101 rows were
`registry` and none could collide. A semantic change to the catalogue is now a migration
with a backfill and a recalculation behind it — see VD-16 and [`known-concerns.md` §20](../known-concerns.md).

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
assertion at 40, and `fieldDecision()` maps 30–84 to
`'review'`. So a model-asserted `transferMechanisms` reaches a human queue with a number
beside it that reads like measurement. Nobody reviewing a 40-row queue at 40%
distinguishes "the model found this" from "a probe half-confirmed this" — they are the same
colour on `ConfidenceBar.tsx`.

**The fields it is asked for are the Chapter V fields.** `extractAndProbe` in
`vendorIntelligence.ts` writes `sourceType: 'ai_grounded'` for exactly
`headquartersCountry`, `transferMechanisms`,
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

### 1.1 The policy is enforced by the type system, and now by a guard

The superseded document banned hallucination in a bullet point while the code wrote
`ai_grounded` rows. The ban only means something when a model-sourced value has nowhere to
be stored:

```ts
// VENDOR_SOURCE_TYPES in vendorFieldConfidence.ts, mirrored by the sourceType
// comment on vendorFieldProvenance in schema.ts — after Sprint 5
sourceType: 'registry' | 'http_probe' | 'trust_centre' | 'analyst' | 'customer';
```

Note `trust_centre` **enters** the union as `ai_grounded` leaves it. The superseded document
specified a trust-centre channel and a provenance vocabulary that had no value to record it
under — Channel 3's own output could not be stored. Both halves of that are fixed in one
change because they are one change.

**That sentence was only ever half true, and the half it was missing is the one that
matters.** The union stops a model-sourced value being *labelled* as one. Nothing stopped a
value being written straight into `vendors.headquarters_country` with no provenance row at
all — a Chapter V field the product asserts and cannot say where it got, which is the same
defect one door down. The only thing that ever checked the invariant was
`seed:catalogue --verify`, a query that runs when somebody runs the seed.

Sprint 11 added `check:vendor-provenance` to the root `check` chain, so the CI half exists
too. It fails on any statement setting a sourced column in a scope that writes no
provenance row. Two structural exemptions are recognised rather than allowlisted, because a
rule about what a payload *is* cannot go stale the way a rule about where it lives can: a
tenant's own private vendor (`isGlobal: false` with an `organizationId`) is the customer
describing their own supplier, not Custodia asserting anything about a third party.

It also carries a floor that the guards already in this repo do not, and should. **A scan
that matches nothing passes.** The first version of that script had a word boundary written
as an escape that JavaScript reads as a backspace character, so every column regex matched
nothing and it reported a clean codebase — in a repo with four unguarded writes in a single
file. It now fails if it parses zero writes, on the grounds that the detector being broken
and the codebase being clean produce identical output and only one of them is good news.

### 1.2 Scope of the removal — and what stays

`@google/genai` was imported by eight files. Only two were in this programme's path:

| File | Disposition | Outcome |
|---|---|---|
| `apps/api/src/lib/vendorIntelligence.ts` | **Remove.** `callGemini` deleted, `extractAndProbe` re-sourced (Sprint 5) | done |
| `packages/db/src/scripts/gather-vendors.ts` | **Delete.** Already superseded by the service; appends to a JSON file nothing reads | done |
| `packages/db/src/seeds/gdpr-corpus.ts`, `scrape-{aepd,ap,bfdi,cnil}.ts` | **Keep.** Regulatory corpus, not the vendor catalogue — different programme, different risk | kept |
| `apps/api/src/lib/genai.ts` | **Keep.** Shared client used by the corpus scrapers | kept |

It is still eight files, which is a coincidence worth spelling out so nobody reads the count
as evidence that nothing happened. The two removed here were replaced in the total by
`lib/llm.ts` and `scripts/check-genai-config.ts`, both shared-client rather than catalogue
path. The surviving set is `lib/genai.ts`, `lib/llm.ts`, `scripts/check-genai-config.ts` and
the five corpus scrapers.

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
│  ABSENT               No row. Renders as "not yet verified". Not free: §2.1  │
└──────────────────────────────────────────────────────────────────────────────┘
```

Two corrections carried in that table:

**Trust-centre badges are not cryptographic.** The superseded document called them
"cryptographically verifiable compliance badges". They are HTML. There is no signature and
nothing to verify; what a SafeBase page proves is that SafeBase renders a badge, which is a
claim about the portal and not about the SOC 2 report behind it. Tier 3 sits below a probe
of the vendor's own domain for that reason. Writing otherwise in a document intended to
survive an auditor reading it undermines the parts that are true.

**Absent is a tier.** It is the tier most rows occupy after Sprint 9 — 29 of the 82 seeded
rows resolved to nothing and keep no country and no entity name — and the product has to
render it without embarrassment. Sprint 10's `ProvenanceBadge` renders it as "not yet
verified" with a hint saying it is a statement about us rather than a finding about the
vendor.

### 2.1 The pyramid is evidence quality. It is not write precedence.

Two orderings live in this module and they are not the same ordering. Reading the pyramid
as though it decided which row wins is the mistake this section exists to stop.

**The pyramid ranks how good the evidence is**, and it is what `fieldConfidence()` scores:
registry 95, analyst 90, probe and portal below them by outcome.

**`PROVENANCE_PRECEDENCE` (`lib/vendorProvenance.ts`, Sprint 10) ranks which row the product
displays** when a field has more than one, and it is deliberately *not* the confidence
ordering:

```ts
customer: 5, analyst: 4, registry: 3, http_probe: 2, trust_centre: 1
```

Analyst sits above registry on purpose. If precedence followed confidence, a catalogue error
sourced from an official feed would be uncorrectable by anything the product offers — the
Department of Commerce would outrank the named human who read the vendor's own page and
found it wrong. That is why `validateAnalystCorrection` is strict: the row that beats the
registry has to be at least as inspectable as the thing it beats, so it carries an author,
a URL, an excerpt of at least twenty characters and a `review_by` date.

`customer` sits at the top of precedence and outside catalogue resolution entirely.
`selectAuthoritativeProvenance` drops those rows rather than ranking them first, because
ranking would leave a tenant's private contract one deletion away from becoming a public
assertion about the vendor.

**And absent is not free.** The box above used to end "scores nothing", which was true of
the pyramid as an evidence model and false of the product. Sprint 8 (VD-14) settled what an
unrecorded headquarters country actually costs: `UNVERIFIED_LOCATION_POINTS`, which is
**10 of 20** — half the penalty of a confirmed transfer to a non-adequate country, not
zero. Both bounds are load-bearing and both are fixtures. At or below the adequate score the
register would reward not looking; at 20 the defect VD-14 describes is back. What absent
buys is a different *finding*, not a free pass: `state: 'unverified'` reads as "go and find
out" where `non_adequate` reads as "you have a Chapter V problem".

---

## 3. Defect register

Findings from auditing the superseded document against the code. IDs are `VD-n` to avoid
colliding with the module's existing `D-n` / `P-n` series.

**All twenty-three are closed.** VD-23 was found by a review of this document rather than
by the programme, and it is the one the programme was best placed to catch: Sprint 8 fixed
the US/DPF conditional in `calculateVendorRisk` and did not grep for the helper it had just
qualified. See §3.2.

One finding was not closed by this programme at all: `check:schema`
entered the root `check` chain in `46b7055`, two commits after this document was written, as
a side effect of the post-Sprint-4 fixes. It was true when recorded and false within the
week, and nothing swept the register. That pattern — a finding nobody was assigned going
stale unnoticed — recurred twice more and is written up once, in §8, rather than retold at
each site.

| ID | Finding | Where | Closed in sprint |
|---|---|---|---|
| **VD-1** | Catalogue fields sourced from `gemini-2.5-flash`; five Chapter V fields written as `ai_grounded` | `callGemini` and `extractAndProbe`, `lib/vendorIntelligence.ts` | 5 |
| **VD-2** | Provenance vocabulary has `ai_grounded`, lacks `trust_centre` — the trust-centre channel has nowhere to store its output | `VENDOR_SOURCE_TYPES`, `lib/vendorFieldConfidence.ts`; `vendorFieldProvenance.sourceType`, `schema.ts` | 5 |
| **VD-3** | `robots.txt` is not fetched anywhere; a comment claims it is "handled at the batch level" | `extractAndProbe`'s batch comment, `lib/vendorIntelligence.ts` | 6 |
| **VD-4** | `classifyFetchError` has three branches that all return `'timeout'` — NXDOMAIN reads as slow | `classifyFetchError`, `lib/vendorProbe.ts` | 6 |
| **VD-5** | DPA token match is English-only; a German *Auftragsverarbeitungsvertrag* scores `partial` (45) not `verified` (90), in a module shipping en/de/fr | `evaluateContentSignals`, `lib/vendorProbe.ts` | 6 |
| **VD-6** | No soft-404 control. Probe concurrency is 3 against a *single* host with no per-host delay | `extractAndProbe`, `lib/vendorIntelligence.ts` | 5 (pacing) + 6 |
| **VD-7** | Two divergent DPF matchers. `routers/vendors.ts` inlines its own fold, skipping `dpfNameKey`'s NFD normalisation and never checking domains — the tested matcher is bypassed at the hot call sites | the inline folds in `routers/vendors.ts` vs `matchDpfStatus`, `lib/vendorDpf.ts` | 7 |
| **VD-8** | `db.select().from(dpfRegistrations)` with no predicate — the whole registry into memory per call. Fine at 0 rows, a full scan per vendor view at scale. The estimate here was "3,000+"; the feed turned out to be **16,534** rows | `routers/assessments.ts`, `routers/vendors.ts` | 7 |
| **VD-9** | `dpf_registrations` cannot distinguish EU-US from UK Extension from Swiss-US. A UK customer gets an EU-US answer. No column for HR-data coverage, dispute body, or privacy URL — four of Channel 1's six extracted fields have nowhere to land | `dpfRegistrations`, `schema.ts` | 7 |
| **VD-10** | Superseded Art. 45 list omits Argentina and the US/DPF entry, and drops the `scope` discriminator. Implementing it as written deletes working code | superseded §Channel 2 vs `ADEQUACY_DECISIONS`, `constants/transferDestinations.ts` | 8 |
| **VD-11** | `dpaStatus: 'unknown'` / `'missing'` do not exist. Real vocabulary is `signed / requested / in_review / not_started / expired` | superseded §2.4 vs `DPA_STATUSES`, `constants/dpaStatus.ts` | 8 — confirmed, no change |
| **VD-12** | Superseded §2.4 conflates a tenant fact with a catalogue fact — see §3.1. Would suppress genuine Art. 28(3) findings | `organizationVendors.dpaStatus` vs `vendors.dpaAvailable`, `schema.ts` | 8 |
| **VD-13** | `vendors.dpa_available` is `boolean.default(false)`: "not looked yet" and "vendor offers none" are the same value | `vendors.dpaAvailable`, `schema.ts` | 8 |
| **VD-14** | Unknown headquarters country scores 20/20 — maximum penalty for an unresearched field, the same conflation VD-12 describes, in the location factor | the location factor in `calculateVendorRisk`, `lib/vendorRisk.ts` | 8 |
| **VD-15** | The 75-vendor target set double-counts legal entities: Twilio/SendGrid/Segment, Okta/Auth0, Atlassian/Bitbucket, Microsoft Azure/365, Google Cloud/Workspace/Analytics. DPF matches entities, DPAs are signed with entities | superseded §Channel 4 | 9 |
| **VD-16** | Superseded plan reseeds the catalogue and stops. `organization_vendors.risk_score` is denormalised; every score stays stale until `recalc:vendor-risk -- --apply`. This is the exact failure D5 records | superseded §Phase 2 | 9 |
| **VD-17** | `check:schema` is not in `npm run check`. Every sprint below ships a migration | root `package.json` | **out of band** — `46b7055` |
| **VD-18** | Pre-seeded sub-processor edges have no source and hang off the *shared* catalogue — wrong once is wrong for every tenant (known-concerns §17). First real snapshot renders as a mass Art. 28(2) change against a fabricated baseline | superseded §4 | 9 |
| **VD-19** | Nothing decays. A probe verified in March reads `confidence: 90` in December. `retrieved_at` is stored and nothing reads it | `fieldConfidence`, `lib/vendorFieldConfidence.ts` | 10 |
| **VD-20** | No correction path. Custodia publishes assertions about named third parties with no procedure for "your record of us is wrong" and no precedence rule for an `analyst` override | — | 10 |
| **VD-21** | Phase 3 badges specified as literal English. `components/vendors` is a `check:vendor-i18n` target; the dynamic date segments need template keys the guard's single-quote key check will not verify | superseded §Phase 3 | 10 |
| **VD-22** | "Article 44 transfer breach alert" — a lapsed DPF is a transfer without a Chapter V mechanism, not an Art. 33/34 personal-data breach. Different obligations, different clocks | superseded §Channel 1 | 7 |
| **VD-23** | `isAdequateDestination('US')` returns true unconditionally, and thirteen of its fourteen call sites believe it. Only `calculateVendorRisk` qualifies the answer, inline, where nothing else can reuse it | `isAdequateDestination`, `constants/transferDestinations.ts`, against `gapRules.ts`, `ropaArticle30.ts`, `ropaDataMap.ts`, `registerOutputs.ts`, `ropa.ts`, `onboarding.ts` | 11 |

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

### 3.2 VD-23, because it is the one this programme produced

The US entry in `ADEQUACY_DECISIONS` carries `scope: 'data_privacy_framework'`, and §4's
Channel 2 argues — correctly — that a flat ISO-3166 list could not carry that and would
have been a regression. What it did not check is whether anything *reads* the
discriminator. Nothing did. `isAdequateDestination` returned true for the US and every
caller took it at face value except `calculateVendorRisk`, which qualified it with an
inline `country !== 'US' || isDpfActive` that no other call site could reach.

So one module scored an uncertified US processor at the full 20/20 location risk while, at
the same time:

- `gapRules.ts` excused it from the Article 44 missing-safeguard gap entirely;
- `ropaArticle30.ts` printed `isAdequate: true` for its transfers in the Article 30 record
  a regulator reads;
- the TIA queue told a reviewer no assessment was needed;
- `registerOutputs.ts` described the transfer as adequate in a published privacy notice,
  which is an Art. 13(1)(f) misstatement rather than a formatting choice;
- and linking the vendor created *no* `processing_transfers` row at all, so the register
  omitted a third-country transfer instead of recording it without a mechanism.

The shape is exactly VD-12, VD-13 and VD-14 — a value that means "we have not established
this" being read as "yes" — arriving in the sprint that fixed all three of them, in the
helper they were fixed next to.

**How it is fixed.** Adequacy takes the caller's evidence:
`isAdequateDestination(country, { conditionMet })`, with `adequacyState()` returning a
fourth value, `conditional`, for a decision whose condition nobody has evidenced. Called
with no evidence the US now reads **false**, which is the safe direction and the same one
VD-14 chose for an unrecorded country. `lib/vendorAdequacy.ts` resolves the condition from
the register in one batched query, preferring what the Department of Commerce publishes
today over what a controller ticked in 2024 — but only in that direction, because a
`not_found` is as likely to be a legal-entity name we got wrong (VD-15) as an uncertified
vendor, and charging a customer for our own matching problem is the wrong way round.

**Canada is the deliberate non-case,** and the reason is worth keeping. Its decision is
also scoped — PIPEDA covers commercial organisations and not federal public bodies — and it
is *not* treated as conditional, because the product models no sector for a recipient and
nothing in it could ever evidence the condition. Failing every Canadian transfer on a
distinction nobody using this can act on would be VD-14's queue-poisoning with the sign
flipped. A scope nothing can check is documentation; a scope something can check is a gate.

---

## 4. Sourcing channels

### Channel 1 — US DPF participant list (Tier 1)

**The feed is real, and it is not where any document said it was.** Sprint 7 opened with a
verification task rather than a parser, and the answer was worse than "no feed". The
superseded document named `https://www.dataprivacyframework.gov/s/participant-search` as an
"official DPF API / daily JSON export"; that path is a Salesforce Lightning *UI route*, and
`www.dataprivacyframework.gov` returns the same 2,116-byte SPA shell for every path — a
soft-404 host in exactly the sense VD-6 describes, so probing it for an export path finds a
200 every time. The endpoint this repo had been calling since Sprint 2,
`dataframework-api.trade.gov`, does not resolve at all.

What exists is the participant list's own unauthenticated API, verified by fetching it:

| | |
|---|---|
| `GET /api/Framework` | the three frameworks and their ids |
| `POST /api/downloadFile` | the whole participant list as XLSX, 1.45MB |
| `GET /api/participants/{id}` | one participant in full — dispute body, privacy policy URL |

all under `dpfapi.azurewebsites.net/api`. A dated sample of both response shapes is committed
at `lib/fixtures/dpf-registry-2026-08-29.json` and the fixtures parse it, so a change to the
feed shows up as a diff against a response somebody actually received. The
committed-manual-export fallback this section originally anticipated was not needed and is
kept only as the contingency if the endpoint disappears.

Fields captured, and where they landed:

| Field | Column | Status |
|---|---|---|
| Organisation name | `organisation_name` + folded `name_key` | pre-existing |
| Covered entities / trading names | `covered_entities` jsonb | pre-existing |
| Published domains | `domains` text[] | pre-existing — but see below |
| Status + recertification date | `status`, `next_recertification_date` | pre-existing |
| **Which framework** (EU-US / UK Ext. / Swiss-US) | `framework` | added, Sprint 7 |
| **HR vs non-HR coverage** | `hr_data_covered` **and** `non_hr_data_covered` | added, Sprint 7 |
| **Dispute resolution body** | `dispute_resolution_body` | added, Sprint 7 |
| **Privacy policy URL** | `privacy_policy_url` | added, Sprint 7 |
| Lapse date | `inactive_start_date` | added, Sprint 7 |
| Participant id, detail fetch time | `participant_id`, `detail_fetched_at` | added, Sprint 7 |

**The bulk export carries no domains column.** The only domain signal the feed has is on the
per-participant detail record, and that pass is scoped to participants a catalogue vendor
already matches. So DPF matching starts as a folded-name match and gains domains as the
catalogue grows.

Framework separation is not a nicety, and the export confirmed it is the ordinary case
rather than an edge: 16,534 rows across 7,563 organisations — 7,557 EU-U.S., 3,584 UK
Extension, 5,393 Swiss-U.S. A vendor certified EU-US but not UK Extension is a correct answer
for a German customer and a wrong one for a British customer, and the single-row table could
not represent the difference.

On lapse: the alert says a Chapter V mechanism is no longer evidenced and SCCs are needed —
not "breach" (VD-22). Withdrawal is also not instantaneous in effect; an organisation that
leaves the framework retains obligations for data received while certified, so a lapse is a
prompt to check the fallback mechanism, not a retroactive verdict on past transfers.

### Channel 2 — EC Article 45 adequacy (Tier 1)

**Already implemented and more correct than the plan that proposed replacing it — and
carrying a discriminator that nothing read.** `ADEQUACY_DECISIONS` in
`constants/transferDestinations.ts` carries fifteen entries with decision dates and a
`scope` discriminator — `commercial` for Canada under PIPEDA, `data_privacy_framework` for
the US. A flat ISO-3166 list cannot carry either, which is why the superseded Channel 2
would have been a regression.

That paragraph stood here for three sprints and was half of an argument. Carrying a scope
is not reading one: `isAdequateDestination` ignored it, so thirteen of its fourteen callers
reported an uncertified US importer as adequate while the vendor risk score — alone — got
it right. This section made the case for keeping the constant and never checked that the
thing it was being kept for was wired to anything. Sprint 11 closed it as VD-23; see
§3.2.

The work here is not code. It is **VD-19 applied to a constant**: adequacy decisions get
added, and they get withdrawn or invalidated by the CJEU. A hardcoded table with no review
date is the same defect as a hardcoded DPF string with no expiry — the thing this whole
programme exists to remove. Sprint 8 shipped `ADEQUACY_REVIEWED_ON` beside the table and
`isAdequacyReviewOverdue`, which `test:transfers` fails on after twelve months. That converts
a silent staleness into a build failure. The interval arithmetic is fixture-covered in both
directions, so a green result means the clock works rather than that it is stuck.

### Channel 3 — deterministic probe (Tier 2)

**More of this is built than the superseded document credits, and its description of the rule
is weaker than the code.** It says a DPA is verified on "an `HTTP 200 OK` … and exact
statutory tokens". `evaluateContentSignals` in `lib/vendorProbe.ts` already requires three
independent token families — a
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
is stricter than the 3-concurrent loop it replaced (VD-6) and matches what a self-identifying
compliance crawler should be able to defend in a support ticket. It shipped in Sprint 5
rather than Sprint 6, because enumeration turns three URLs into roughly thirty and shipping
that against the old loop would have been a regression.

### Channel 4 — the curated core (Tier 4, analyst)

The 75-vendor target set is kept, with VD-15 applied: **the unit is the legal entity, not the
product.** Google Cloud, Google Workspace and Google Analytics are three catalogue entries a
customer recognises and one DPF registrant, one DPA and one set of SCCs. The catalogue needed
a parent-entity relationship before Sprint 9 seeded anything, or DPF matching by name
silently returns `not_found` for two of every three Google products. Sprint 9 shipped it as
`vendors.parent_entity_id` (self-reference) and `legal_entity_name`, with `dpfLookupName()`
as the one place that chooses between the two names.

`VENDOR_PARENT_DOMAINS` in `vendorDomains.ts` already models part of this for document
authority — a DPA on `netsuite.com` for Oracle resolves as `parent_domain` rather than
rejecting. Sprint 9 extends that idea from "whose domain is this document on" to "whose legal
entity signs this contract", which is the same question asked one level up.

Entity collapses in the target set: Twilio ← SendGrid, Segment · Okta ← Auth0 · Atlassian ←
Bitbucket, Jira, Confluence · Microsoft ← Azure, 365, GitHub, NPM · Google ← Cloud,
Workspace, Analytics · Intuit ← QuickBooks, Mailchimp. The estimate of "roughly 75 products
across roughly 62 entities" was written before anything was seeded and the two numbers should
never appear as one number.

**What the seed actually produced**, which supersedes both estimates:

| | |
|---|---|
| Catalogue rows | 82 |
| Resolved to a named legal entity | 52 |
| Products linked to a parent entity | 15 |
| Holding a current EU-U.S. certification | 49 |
| Resolved to nothing — no country, no entity name | 29 |
| Provenance rows | 101 |
| Sub-processor edges | 0 (VD-18) |

The 29 that resolved to nothing are not a failure of the seed. They are the absent tier, and
guessing at a corporate structure to shrink that number is the sourcing this programme exists
to stop.

---

## 5. Sprint log

Each sprint states its gate. `npm run check` is two workspace typechecks, **10 guard
scripts across 11 invocations** (`check:nocheck` runs in both workspaces) and **11 fixture
suites** — not the "7 static guards" the superseded document asserts. That count has been
wrong here twice, in both directions, so re-derive it from `package.json` rather than
trusting it. Full list in §6.

### Sprint 5 — Zero-AI cutover

*Closes VD-1, VD-2. Must be first: it fixes the meaning of every row the later sprints write.*

1. Delete `callGemini`, `extractGrounding`, `sliceJson`, `makeClient` / `makeGeminiClient` and
   the `GeminiLike` type from `vendorIntelligence.ts`. Drop the `@google/genai` import.
2. Replace `extractAndProbe`'s first line with `enumerateCandidateUrls(target)` — a new pure
   module `lib/vendorUrlCandidates.ts`, testable without a network, which is the whole point
   of putting it beside `vendorProbe.ts` rather than inside the service.
3. `sourceType` union in `VENDOR_SOURCE_TYPES` (`lib/vendorFieldConfidence.ts`),
   `lib/vendorIntelligenceMappers.ts` and the `vendorFieldProvenance.sourceType` comment in
   `schema.ts`: `ai_grounded` out, `trust_centre` in.
4. Delete the `return evidence.value ? 40 : 0` tier from `fieldConfidence()`. With no model
   tier there is no "asserted but unprobed" state — a field is registry-sourced,
   probe-sourced, portal-sourced, human-sourced, or absent.
5. `vendor_candidates.grounding` and `payload`'s "exactly as the model produced it" comment:
   repurpose `grounding` to hold the enumerated-and-rejected URL list, which is the audit
   trail for *why* a field came back absent. Migration: none — column stays, meaning changes,
   and there are zero rows.
6. Delete `packages/db/src/scripts/gather-vendors.ts`.
7. Fixtures in `lib/vendors.test.ts`: replace the four `ai_grounded` cases with
   `trust_centre` cases, and add one asserting that an absent field yields **no provenance
   row** rather than a row with `confidence: 0` — a zero-confidence row still renders as a
   field the product has an opinion about.

**Gate:** `npm run check` green, and no `@google/genai` import or `ai_grounded` write
anywhere in the catalogue path:

```bash
grep -rln "@google/genai" apps/api/src packages/db/src
#   expect exactly: lib/genai.ts, lib/llm.ts, scripts/check-genai-config.ts,
#   and the five packages/db corpus scrapers. Nothing under lib/vendor*.
grep -rn "sourceType: 'ai_grounded'" apps/api/src   # expect nothing
```

The gate originally written here said the grep "returns nothing outside `lib/genai.ts` and
the corpus scrapers", and that command has never returned that: the corpus scrapers are in
`packages/db` and were not in the search path at all, and `lib/llm.ts` and
`scripts/check-genai-config.ts` both match. The *Shipped* block below then restated the
gate as the wider set and reported it met. A gate quoted as an intention rather than as a
command that passes is not a gate, which is the same charge §6 lays against its own
guard count.

**Shipped, 28 August 2026.** Gate met: `npm run check` exits 0, `test:vendors` is at 330
assertions, and the only surviving `ai_grounded` strings
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
   Then either implement it or delete the batch-level comment in `lib/vendorIntelligence.ts`; a comment
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

**Shipped, 29 August 2026.** Gate met: both typechecks at 0, all nine guards green, all
eleven fixture suites green with `test:vendors` at 421 assertions, and `check:schema`
green once `0058_grey_kronos.sql` and its snapshot are committed — the guard asks git, so
an uncommitted migration reads as drift.

**Task 0 answered open question 2, and the answer was worse than "no feed".** The
endpoint this repo has called since Sprint 2 —
`https://dataframework-api.trade.gov/api/v1/participants` — **does not resolve**. Nor is
there anything at the URL the superseded document named:
`www.dataprivacyframework.gov` is a Vite SPA that returns the same 2,116-byte shell for
every path, which is a soft-404 host in exactly the sense VD-6 describes. What does exist
is the SPA's own unauthenticated API at `dpfapi.azurewebsites.net/api`, verified by
fetching it:

| | |
|---|---|
| `GET /api/Framework` | the three frameworks and their ids |
| `POST /api/downloadFile` | the whole participant list as XLSX, 1.45MB |
| `GET /api/participants/{id}` | one participant in full |

So Tier 1 for DPF is a real machine-readable feed, not the dated committed export the
fallback anticipated. A dated sample of both response shapes is committed at
`apps/api/src/lib/fixtures/dpf-registry-2026-08-29.json` and the fixtures parse it, so a
change to the feed shows up as a diff against a response somebody actually received.

**The export's shape is the one VD-9 predicted before anyone had looked.** 16,534 rows,
one per (organisation, framework): 7,557 EU-U.S., 3,584 UK Extension, 5,393 Swiss-U.S.
across 7,563 organisations. A vendor certified under one framework and not another is the
ordinary case, not an edge, and the single-row table could not represent it.

Six things were done differently from the list above, each deliberate:

1. **The status vocabulary is four values, not three.** The registry publishes `Active`,
   `Active - Re-certification under Review`, `Inactive - Lapse` and `Inactive -
   Withdrawal`. `under_review` is stored rather than folded into `active` because the
   Department still lists those 1,646 certifications as active participations, so it is
   not a lapse — but a reviewer looking at a renewal in progress wants to know that is
   what they are looking at. `matchDpfStatus` folds it back to active for the Chapter V
   question. `discontinued` became `withdrawn` throughout, which is the registry's own
   word, and lapse stays separate from withdrawal for VD-22's reason: one is a missed
   deadline, the other is a decision, and they send someone to ask different questions.

2. **HR coverage is two columns.** VD-9 names `hr_data_covered`. The feed publishes
   `HR Data` *and* `Non-HR Data` independently, and 445 rows are HR-only against 10,782
   non-HR-only — so one boolean cannot say which of "HR too" and "HR instead" it means,
   and an HR transfer to an importer certified for non-HR data alone has no mechanism.
   Three more columns arrived with them and are not padding: `inactive_start_date`,
   because `vendorRisk` renders "DPF certification lapsed on {date}" and the code filling
   it read a column that does not exist, so that date has never once printed;
   `participant_id`, because without it a row already imported can never be matched to its
   own detail record; and `detail_fetched_at`, because the two detail-only columns are
   null on every bulk-imported row and "we have not asked" is not "none published" —
   leaving that out would have reintroduced VD-13 in the sprint that fixes the pattern.

3. **The sync is in `apps/api/src/scripts`, not `packages/db/src/scripts`.** It needs
   `dpfNameKey` and the row normaliser, both of which live in `apps/api/src/lib` where
   `test:vendors` can reach them. Moving the script would have meant either duplicating
   the name fold into `packages/db` or having `packages/db` import from `apps/api`, and
   the first of those is VD-7 exactly — a second copy of a matching rule, somewhere the
   fixtures cannot see it.

4. **`dpf-registry-sync` is on its own queue, and that is why it now runs at all.**
   pg-boss keys its schedule table on the *queue* name — `name text primary key`, upserted
   `ON CONFLICT (name) DO UPDATE` — so `boss.schedule()` twice on one queue is one cron
   written twice. `workers/index.ts` scheduled `dpf-registry-import` and then
   `vendor-review-reminder`, both on `vendor-intelligence`, so the second silently took the
   first's row: the DPF import had never been registered, and would have failed at DNS if
   it had been. Two independent silent failures on the job standing between a customer and
   a dead adequacy claim. `scheduleGlobalJobs` now throws at startup on a second schedule
   for a queue, so the next one is a failed deploy rather than a year of nothing.

5. **`matchDpfStatus` reports what a domain match actually says.** The domain pass matched
   `status === 'active'` entries only, so a vendor found by domain whose certification had
   lapsed fell through to the name pass and came back `not_found` — "the registry has never
   heard of them" in place of "their certification lapsed on 6 February". That is VD-22's
   own distinction, lost inside the matcher rather than in the copy, and it matters more
   now than it did: 6,719 of the 16,534 rows are inactive.

6. **Two listings for one organisation resolve by status, not by row order.** Fourteen
   organisations hold both an old participant record and a current one under the same
   framework, under different participant ids. They must collapse before the insert —
   Postgres refuses a statement whose `ON CONFLICT DO UPDATE` would touch one row twice —
   and the obvious "last one wins" is decided by the export's alphabetical sort, which for
   `US Cloud` and `Personify` keeps the withdrawn listing over the active one. A Chapter V
   mechanism deleted by a sort order. `preferDpfRegistration` takes the live listing, then
   the later certification.

Two consequences worth carrying forward:

- **The sync refuses to write past 5% unrecognised rows.** The resolve pass downgrades
  anything a completed run did not touch, so a parser that silently stopped recognising a
  renamed framework or status would lapse thousands of live certifications at once, on a
  shared catalogue, arriving in every tenant as a risk-score move nobody asked for. A
  vocabulary change at the Department should be an alert, not a mass downgrade. Against
  the live feed today the figure is 0 of 16,534.

- **The detail pass is scoped to the catalogue, so it does nothing yet.** Dispute
  resolution body and privacy policy URL are per-participant, and fetching 7,563 of them at
  the one-request-per-second budget is two hours of somebody else's server for facts about
  vendors nobody has linked. It fetches only participants a catalogue vendor matches, which
  is currently none, and widens by itself as Sprint 9 seeds. The domains those records
  supply are the only domain signal the feed has — the bulk export has no domains column at
  all — so until a vendor is seeded, DPF matching is by folded name alone.

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

**Shipped, 29 August 2026.** Gate met: `npm run check` exits 0, `test:vendors` 445 → 461 and
`test:transfers` 57 → 62. Migration `0060_next_black_widow.sql`.

Four things were done differently from the list above, each deliberate:

1. **The tested thing is the age of the adequacy list, not its contents.** Task 1 says a
   `test:transfers` case that fails at twelve months, and that is what shipped — but the
   reason is worth recording, because a fixture over the entries themselves is the obvious
   thing to write and it is useless. A *withdrawn* decision leaves `ADEQUACY_DECISIONS`
   asserting a Chapter V safeguard that no longer exists, silently and identically to a
   correct entry, and no test on the contents can detect that. `isAdequacyReviewOverdue` is
   fixture-covered in both directions so a green result means the clock runs, not that it
   has stopped.
2. **`UNVERIFIED_LOCATION_POINTS` is 10, and both bounds are fixtures.** VD-14 says an
   unrecorded country "stops scoring 20/20" and does not say what it scores instead. The
   answer is bounded on both sides: at or below the adequate score the register rewards not
   looking, and at 20 the defect is back. The tests pin the *ordering* rather
   than the number, so the number can move without the guarantee moving. `RiskFactorDetail`
   also gained `state`, because the register has to ask "which of these are unverified
   rather than bad" without pattern-matching prose that has a score interpolated into it.
3. **The gate's dry run had to be built before it could be met.** "`recalc:vendor-risk`
   dry-run reports the score delta for every existing row" was not answerable: the script
   printed counts and returned. On a denormalised column, for a formula change, that is
   precisely when a delta is wanted. `recalculateVendorRiskForAllOrgs` now takes `dryRun`,
   computes without writing and without filling the embedding queue, and the script prints
   per-row movement. Against production: both linked rows moved 60 → 50, which is VD-14 on
   two vendors with no country recorded.
4. **`0060` is hand-edited, deliberately, and it is the only migration in this programme
   that is.** drizzle-kit cannot infer a value mapping for a type change, so what it
   generated was a bare `SET DATA TYPE varchar(20)`. That does not fail — Postgres has an
   assignment cast from boolean, so it applies cleanly and leaves `'true'`/`'false'` in the
   column: two values outside the vocabulary, in a field the gap rules read. Verified on a
   temp table rather than assumed, because the intuitive answer is that Postgres would
   refuse and that is wrong. `meta/0060_snapshot.json` is drizzle's and untouched, so
   `check:schema` still compares `schema.ts` against it.

One consequence worth carrying forward:

- **A fixture now asserts no value is legal in both DPA vocabularies.** VD-12 is a category
  error rather than a bug, and a category error recurs by someone reasonably deciding the
  two columns should agree. The fixture is the shape the defect would take if it came back.

### Sprint 9 — Seeding the catalogue

*Closes VD-15, VD-16, VD-17, VD-18. The first sprint that adds a vendor.*

1. ~~**VD-17 first:** add `check:schema --workspace=packages/db` to the root `check`
   script.~~ **Already done when this sprint ran** (§3).
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
   npm run seed:catalogue      --workspace=apps/api
   npm run recalc:vendor-risk  --workspace=apps/api -- --apply
   ```
   Without the second, nothing the first did reaches a customer's score. This is D5 exactly,
   and the superseded plan reproduced it.

   **The seed moved workspaces while shipping.** It is `seed:catalogue` in `apps/api`, not
   `seed:vendors` in `packages/db`, for Sprint 7's reason: it needs `dpfNameKey`,
   `dpfBaseNameKey` and `matchDpfStatus` from `apps/api/src/lib`, where `test:vendors` can
   reach them. `seed:vendors` still exists and now prints both commands and exits, because
   the old one is in runbooks and a seed command that silently does nothing is worse than
   one that has moved.

**Gate:** `npm run check` + `check:schema`. Every seeded row has either a provenance row per
populated field or the field is absent. A query returning any row with a populated
`transfer_mechanisms` and no matching `vendor_field_provenance` entry is a failed gate.

**Shipped, 29 August 2026.** Gate met: `npm run check` exits 0, `test:vendors` 461 → 489.
Migration `0061_serious_mastermind.sql`. Applied against production: **82 catalogue rows, 52
resolved to a named legal entity, 49 with a current EU-U.S. certification, 15 products linked
to a parent entity, 101 provenance rows** — every one citing the participant record it
matched rather than the register's index — **29 rows resolved to nothing**, keeping no country
and no entity name, and **zero sub-processor edges**.

**The gate is a query, not a promise.** `seed:catalogue --verify` fails on any populated
sourced column with no `vendor_field_provenance` row, and re-checks it after the fact rather
than only during the run, so a half-failed seed is detectable. Identity — name, slug,
website, category — is deliberately *not* in that list: the seed asserts it, and a
provenance row claiming otherwise would misdescribe where it came from.

**A runtime 500 that had never fired.** `loadDpfEntriesFor`'s domain predicate was a raw
template, which drizzle renders as `domains && ($1, $2)` — a row constructor, one placeholder
per candidate, not an array. Postgres answers `invalid input syntax for type text[]: must
start with "{"` and the whole lookup throws. Every call carrying a website hit it; the two
rows in the catalogue had none, so it never ran until this sprint gave every vendor a domain.
`tsc` sees a valid template either way and no fixture could reach it inline, so the predicate
is extracted and `dpfLookupSqlShape()` renders it through drizzle's dialect with no
connection. Six fixtures assert the shape: one placeholder for two candidates, and a `{...}`
array literal in the parameter.

Writing those found a second thing. The candidate enumeration's comment said it stops before
public suffixes so `co.uk` cannot match every British registrant. It did not — "the last two
labels" *is* the public suffix for `a.b.co.uk`. It now stops at the registrable domain via
`getRegistrableDomain`, rather than growing a second copy of the multi-label suffix list.

Two more things were done differently from the list above:

1. **VD-18 is enforced by the seed's shape, not by its discipline.** The seed writes no
   `vendor_sub_processors` rows *and the seed table has no field that could carry one*. A
   plan not to seed edges is a promise; a record with nowhere to put an edge is a mechanism.
2. **`dpfLookupName()` is the one place that chooses between the product name and the legal
   entity name**, and all three call sites go through it. The detail pass in
   `dpfRegistrySync` asks for both the exact and the base key, so it reaches the same rows
   the lookup does — otherwise the two would drift and the drift would be invisible.

One consequence worth carrying forward:

- **The concentration graph is empty and the Art. 28(2) diff has nothing to diff.** That is
  VD-18 working as specified, not a gap: edges arrive only from a probed
  `sub_processor_list_url`. But it is a customer-visible state, and the defect register
  describes it only as a closure — nowhere as a condition the product is currently in. A
  vendor with no reachable list has no edges, and the graph is honestly sparse until probing
  fills it. Carried into [`known-concerns.md` §20](../known-concerns.md).

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
   Document who receives a correction request and what the response time is; a data-quality
   process with no named owner is a process that does not exist.
3. **VD-21:** badges via `useTranslations`, keys in `messages/{en,de,fr}/vendors.json`
   (858 keys when this was written; 875 in `en` after the sprint). Dates through the existing
   formatter, not concatenated. Note the
   guard only checks single-quoted keys, so any `t(\`provenance.${sourceType}\`)` needs its
   five keys added and verified by hand.
4. `ConfidenceBar.tsx` shows the tier, not just the number. "90%" and "probe-verified on
   stripe.com, 3 days ago" are the same figure and different information.

**Gate:** `npm run check` including `check:vendor-i18n`; all badge keys present in all three
catalogues.

**Shipped, 29 August 2026.** Gate met: `npm run check` exits 0, `test:vendors` 489 → 517.
Migration `0062_clever_maverick.sql`. New files: `lib/vendorProvenance.ts`,
`components/vendors/ProvenanceBadge.tsx`, and 16 keys in each of en/de/fr.

**The unique key had to widen before any of this was storable.** `vendor_field_provenance`
was unique on (vendor, field), so recording an analyst correction *deleted* the registry row
rather than superseding it, and a trust-centre badge silently destroyed the probe that
outranks it. It is now (vendor, field, source_type), with both existing upserts retargeted.
Safe at this point and not later: all 101 rows were `registry`, so nothing could collide.
`selectAuthoritativeProvenance` returns the superseded rows so a surface can show what was
overridden.

Four things were done differently from the list above, each deliberate:

1. **`provenanceAge()` halves the distance *to the floor*, not the value.** An aged probe is
   weaker than a fresh one and is not equivalent to never having looked; halving the value
   would eventually make those two the same number. Registry decays slowly because the weekly
   sync re-confirms it, probe and portal share a 180-day half-life, `analyst` steps down in
   one move on its `review_by`, and a customer's executed contract does not decay at all. It
   is never written back — a background re-score of a shared catalogue is the mistake the
   ROPA register already made with `updated_at`, and it would destroy the only number a
   re-probe can be compared against.
2. **`PROVENANCE_PRECEDENCE` is deliberately not the confidence ordering**, which is what
   §2.1 exists to record. Analyst outranks registry — registry scores 95 and analyst 90 —
   because otherwise a catalogue error sourced from an official feed would be uncorrectable
   by anything the product offers. `validateAnalystCorrection` is strict for the same reason:
   the row that beats the Department of Commerce has to be at least as inspectable as the
   thing it beats, so it carries an author, a URL, an excerpt of at least twenty characters
   and a `review_by`.
3. **`submitFieldCorrection` writes the provenance row and not the vendor column.** Folding a
   correction into `vendors` is a separate, reversible step; doing both at once makes an
   override indistinguishable from the thing it overrode.
4. **`customer` rows are dropped from catalogue resolution entirely, not ranked last.**
   Ranking would leave a tenant's private contract one deletion away from becoming a public
   assertion about the vendor.

**Two defects found on the way.** The Trust Centre importer wrote `trust_center`, which is
not in `VENDOR_SOURCE_TYPES` — VD-2 spells it `trust_centre` — so those rows carried a tier
nothing recognised and would have rendered as a missing i18n key. And the Article 28 dossier,
the document a customer hands a regulator, printed each field's confidence *as gathered*
rather than as it stands today; it now shows both and flags stale and superseded rows.

**On VD-21's own warning.** The five tier labels are reached as a template key that
`check:vendor-i18n` cannot verify — its key check only sees single-quoted literals — so they
were checked by hand across all three catalogues. Dates interpolate into translated sentences
rather than being concatenated onto them. Absent renders as "not yet verified" with a hint
saying it is a statement about us rather than a finding about the vendor: it is the tier most
rows occupy after Sprint 9, and it has to read without embarrassment.

**The process document shipped with five fields marked TO BE CONFIRMED, and they were the one
part that could not be decided in code.** Two follow-up commits settled them:

- [`vendor-data-correction-process.md`](./vendor-data-correction-process.md) — published and
  **role-based**. Corrections go to `support@custodia.io` with a subject-line convention: the
  address the product already publishes, because inventing a dedicated alias would have
  published a route nobody monitors. The owner is the **DPO role**, which `seed-roles.ts`
  already models — an individual's name in a document a vendor reads is wrong the first time
  somebody changes job, and the reader cannot tell. Acknowledgement 5 working days,
  resolution 20, stated as **administrative commitments and not legal ones**: a correction
  about business-level facts is not an Art. 16 rectification request, and where a request
  genuinely is about personal data it goes down the DSAR path on the Art. 12(3) clock
  instead. Answering one of those on a 20-day service level would be a breach dressed up as a
  service level. Escalation suppresses the disputed field while the DPO reviews — its
  provenance row is deleted, returning the field to the absent tier. That is a mechanism
  rather than a promise, and it is why VD-21 had to land before this process could commit to
  using it.
- [`vendor-data-correction-rota.md`](./vendor-data-correction-rota.md) — internal and
  **person-based**, because naming only a role left the person unrecorded anywhere, which is
  the same gap one level down. Its first rule is that it cannot be empty: **until the table
  names someone else, the role is held by the owner of the product.** A rota with a blank
  holder is the failure VD-20 describes, so this one always resolves to somebody and
  delegating is an act of adding a row rather than a precondition for the process working at
  all. Handover has to enumerate the three things a handover otherwise loses: open
  corrections, which have clocks running and so hand over by request rather than in bulk;
  **suppressed fields, which are invisible by design** — a field whose provenance row was
  deleted pending a dispute renders exactly like one nobody has got to yet, so the outgoing
  holder lists them or they are silently abandoned; and `analyst` rows falling due in the next
  90 days, which are undertakings a person made to read something again and which travel with
  the role. It also records that the 5/20 working-day intervals were set with no volume behind
  them, and that the honest response to missing them is to change the published document
  rather than quietly miss them.

### Sprint 11 — Review remediation

*Closes VD-23 and the sixteen defects a review of this document found in its own claims and
wiring. Not part of the original programme: it exists because the programme closed, the
register said twenty-two of twenty-two, and a re-read against the code found more.*

**Shipped, 30 August 2026.** `npm run check` exits 0 with the tenth guard in the chain,
`test:vendors` 517 → 534 and `test:transfers` 62 → 77. No migration.

**VD-23 — adequacy takes evidence.** Covered in full at §3.2. `isAdequateDestination` gains
an optional second argument, `adequacyState()` gains a fourth value (`conditional`), and
`lib/vendorAdequacy.ts` resolves the DPF condition from the register in one batched query
for a whole organisation rather than one per vendor — reintroducing a per-row lookup would
have put VD-8's full-table scan back one level up. All fourteen call sites now pass what
evidence they hold; `calculateVendorRisk`'s inline conditional is gone, routed through the
same helper as everything else.

One thing the fixtures caught that the design had wrong: `vendorAdequacyState` returned
`conditional` for a vendor whose certification the register had positively marked lapsed,
which collapses "nobody has checked" into "we checked and the answer is no". Those are the
two findings VD-14 exists to keep apart. A known lapse is now `third_country`.

**The weekly sync moves scores and says what it found.** Two defects, both of which had sat
open across three sprints while being described as consequences rather than as bugs:

1. `organization_vendors.risk_score` is denormalised, and the sync moved none of it. A
   certification going inactive on a Monday changed no customer's register until somebody
   ran `recalc:vendor-risk -- --apply` by hand. That is VD-16 — this document's own finding
   — applied to the recurring feed rather than to the one-off seed, and the recurring case
   is the worse one because nobody is standing over it. `reconcileDpfDependentVendors()`
   now runs after every sync, bounded by the vendors an organisation actually links rather
   than by the catalogue or the 16,534-row register.
2. `dpfLapseFinding()` shipped in Sprint 7 with fixtures and exactly one caller — the
   questionnaire cross-check, which fires when a *vendor* fills in a form. The job that
   actually discovers a lapse had no way to say anything. Sprint 7 wrote that the alerting
   "belongs to a later sprint"; Sprints 8, 9 and 10 shipped and none of them was it, and
   nothing carried it forward. The sync now emits the finding per affected vendor, and the
   nightly gap scanner raises the Art. 44 gap for the same vendors off the back of VD-23.

Reconciliation deliberately stays on the live `dpf-registry` queue rather than becoming a
dormant alerting job: none of it emails anybody, and recomputing a derived column is the
register being correct rather than a notification. Anything that *mails* a customer about a
lapse is still a separate job and still needs the dormancy decision.

**The provenance surface reaches a screen.** Sprint 10 built `ProvenanceBadge`, decayed
confidence, precedence, and sixteen keys in each of three catalogues — and wired none of it
to anything. The component was imported only by `ConfidenceBar`, which returns early when
handed no provenance, and its one call site passed a number and nothing else. So every
screen in the product showed a value with no source while the component that says the
source sat one import away, and the only place a tier was ever visible was the Article 28
dossier, printing the raw `sourceType` slug in backticks.

`getOrgVendorDetails` now resolves precedence and decay server-side and returns them per
field, and the vendor detail page renders the badge against headquarters country,
certifications and the DPA template — including the absent tier, which is the one most
fields occupy. The dossier prints the human label beside the slug, because that table is
read by someone who has never seen `VENDOR_SOURCE_TYPES` and is being asked to accept the
row as evidence.

Sprint 10's gate was "all badge keys present in all three catalogues", which is a
translation-completeness check and cannot see that nothing renders. **A sprint that ships a
component should gate on it being rendered with real data, not on its strings existing** —
that is the same class of error as `bulkApprove` gating on the wrong number.

**`check:vendor-provenance`, and a floor under it.** §1.1 has the reasoning. The floor is
the part worth repeating: the guard fails if it parses zero writes, because a broken
detector and a clean codebase produce identical output and the first version of this script
was the broken one.

**Six smaller things.**

- The superseded document now carries a banner naming what in it is wrong. It had none, so
  the supersession existed only in this file and anyone opening the other one first had no
  way to know.
- The single-approve path stopped synthesising `confidence: 40` for a probe result with no
  number. 40 was the model tier's score, deleted with the tier in Sprint 5, and it outlived
  it here — so an unprobed field still read as "the model asserted this" in a module with
  no model. The entry is now dropped and `buildCatalogueWrites` applies its documented
  `partially_probed` fallback, which is what the value actually is.
- `seed:catalogue` writes `lib/fixtures/catalogue-seed-summary.json` on every run. The five
  production figures this document quotes in five places had no artefact anywhere — read
  off a console once and retyped — which is a lower standard than it applies to the DPF
  feed, where it rightly commits a dated sample so a change shows as a diff.
- The German and French module titles were settled. Both catalogues carried an open
  translator note asking which of two renderings to use, and `check:messages` skips
  `_`-prefixed annotations by design, so it would have sat there indefinitely while Sprint
  10 reported vendor i18n complete.
- The carried-forward items moved to [`known-concerns.md` §20](../known-concerns.md), and
  `known-concerns.md` §18 — DPF certification asserted by hand in the seed — is marked
  fixed, which it has been since Sprint 7 and was still described as open.
- This document gained an owner and a review date, having set clocks on everything except
  itself.


---

## 6. Verification gates

What `npm run check` actually runs, corrected from the superseded §6:

| | |
|---|---|
| Typecheck | `apps/api`, `apps/web` — both at 0 errors, keep them there |
| Guards (10 scripts, 11 invocations) | `check:schema`, `check:tenancy`, `check:relations`, `check:vendor-provenance`, `check:nocheck` ×2, `check:params`, `check:sitemap`, `check:messages`, `check:ropa-i18n`, `check:vendor-i18n` |
| Fixtures (11 suites) | `test:fixtures`, `test:consent-cookies`, `test:transfers`, `test:ropa-completeness`, `test:ropa-vocab`, `test:ropa-lifecycle`, `test:assessments`, `test:ropa-exports`, `test:retention`, `test:ropa-intelligence`, `test:vendors`. This programme extends `test:vendors` (330 → 534) and `test:transfers` (57 → 77) |
| **Not included** | `npx eslint`, which cannot run at all (pre-existing plugin incompatibility), so `tsc` plus these guards is the entire static gate |

This section has been wrong twice — it once claimed `check:schema` was excluded while
counting it, and it went on reporting nine scripts after a tenth was added — so the numbers
above are worth re-deriving from `package.json` rather than trusting. That is what a
reconciliation date is for; see the header.

Standing constraints that apply to every sprint above:

- New API code reading the database uses `db.query.<table>.findMany()` where the surrounding
  file does — `db.select()` escapes the standalone fixtures' mocks and opens a real connection.
- `vendors` and `dpf_registrations` are **shared catalogues**; writes to them belong in the
  tenancy guard's `ALLOWED_WRITES` with a reason. `organization_vendors` writes are org-scoped
  per statement, not per procedure.
- A write that sets a **sourced** catalogue column writes its provenance row in the same
  scope, or `check:vendor-provenance` fails. Identity — name, slug, website, category — is
  not sourced: the seed asserts it, and a provenance row claiming otherwise would
  misdescribe where it came from.
- Adequacy is asked with evidence: `isAdequateDestination(country, { conditionMet })`. A
  caller that cannot evidence the condition gets `false`, and that is deliberate (VD-23).
  Anything holding a vendor should resolve the condition from the register through
  `lib/vendorAdequacy.ts` rather than from the recorded mechanism alone.
- Any mutation that should appear in a History tab needs entries in `ACTION_TYPE_OVERRIDES`,
  `RESOURCE_TABLE_MAP` and `ACTION_DESCRIPTIONS` — the vendor module already lost a year of
  audit diffs to this.
- Every sprint shipping a migration commits the `.sql`, its `meta/NNNN_snapshot.json` and
  `meta/_journal.json` together. `check:schema` asks git, so a generated-but-uncommitted
  migration reads as drift.
- **Do not hand-write the `.sql`.** One migration in this programme is hand-edited and it is
  the exception that shows why: `0060` changes a column's type, drizzle-kit cannot infer a
  value mapping for that, and the bare `SET DATA TYPE` it generated would have applied
  cleanly and left `'true'`/`'false'` in a vocabulary column. Hand-editing is for the value
  mapping drizzle-kit cannot generate, never for the DDL it can; `meta/NNNN_snapshot.json`
  stays drizzle's, untouched, or `check:schema` is comparing against something a person
  wrote.

---

## 7. Open questions

Flagged rather than decided, because each changes the work materially and none blocked the
sprints. **Three of the four are still open.** Only question 2 is answered. Question 1 was
overtaken rather than decided, and it is recorded that way rather than struck out, because
"settled by inaction" and "decided" have different consequences for whoever inherits it.

1. **Does the DPA clause analysis stay? — still open, and Sprint 9 went past it.** §1.2
   argues it is a different and defensible shape of AI use, and it is metered and
   customer-visible. If the position is zero AI in the product rather than zero AI in the
   catalogue, removing it means `routers/ai.ts`, `DpaAnalysisModal.tsx`,
   `vendors.dpa_clause_analysis`, `organization_vendors.dpa_ai_analysis`,
   `dpa_analysis_status`, the `ai_dpas_analyzed` counter and the `dpaAnalyses` plan allowance
   — with billing consequences.

   This was marked "needs a decision before Sprint 9, because the seed either populates
   `dpa_clause_analysis` or the column goes". **Sprint 9 shipped and neither happened.**
   `seed-catalogue.ts` does not touch `dpa_clause_analysis`, `routers/ai.ts` is untouched,
   and the column is still there and empty. The question was settled by inaction rather than
   by decision, which is a third outcome the framing did not allow for and which is not
   obviously wrong: an empty column costs nothing and keeps both options open. What it does
   cost is that nobody has said which one is intended, so the next person to look at
   `dpa_clause_analysis` cannot tell whether it is deprecated or unfilled.
2. ~~**Does a DPF feed exist?**~~ **Answered, 29 August 2026.** Yes — an
   unauthenticated bulk XLSX export and a per-participant JSON record at
   `dpfapi.azurewebsites.net/api`, verified by fetching both. The endpoint this repo had
   been calling does not resolve, and the one the superseded document named is a UI route
   on a soft-404 host. See Sprint 7 above.
3. **Trust-centre portals and terms of service — still open, and now with a date on it.**
   Sprint 6 shipped robots.txt handling; SafeBase, Vanta, Drata and Conveyor each publish
   terms that may address automated access. This was written as a *pre-Sprint-6* task whose
   answer might remove Tier 3 for some portals, and Sprint 6 shipped anyway, `trust_centre`
   went into the vocabulary, and a Trust Centre importer was still being debugged in Sprint
   10 — with nothing anywhere recording whether anyone had read the terms. A gate this
   document set for itself and walked through, then named as having walked through, which
   is not the same as closing it.

   **Neither is this, and that is the point of writing it down.** Sprint 11 did not read
   four sets of legal terms — that is a decision with legal consequences and it belongs to
   the owner, not to a remediation sprint. What it did is stop the question drifting: the
   owner named in the header holds it, the reconciliation date in the header is when it
   gets asked again, and the two acceptable answers are unchanged. Read them, or record in
   writing that the risk was accepted and by whom. Tier 3 rests on an assumption until one
   of those happens, and it is the lowest tier in the pyramid partly for this reason.

4. **What is the catalogue's coverage promise? — still open, and now answerable with real
   numbers.** The estimate behind this question was a 62-entity catalogue. What shipped is
   **82 rows, 52 with a resolved legal entity, 49 with a current EU-U.S. certification, 29
   resolved to nothing, and no sub-processor edges at all.** The marketing claim implied by
   "300+ authoritative profiles" in the superseded header is not one this programme can
   honour, and now there is a figure to say so with. Better to promise provenance than
   coverage: every field either cites its source or says it has none. Somebody still has to
   decide what the product's own copy claims, because the copy is what a customer relies
   on.

---

## 8. What this document got wrong

The carried-forward consequences that used to live here are in
[`known-concerns.md` §20](../known-concerns.md), which is the register this repo tells
people to read. Leaving them at the bottom of an audit file was the failure this section
opened by warning against — "the difference between a note somebody wrote and a thing
somebody will find" — committed in the act of describing it.

What is left here is the part that belongs to the document rather than to the code: how a
programme that audited its predecessor accurately produced twenty-three defects of its own,
and what would have caught them. A review in August 2026 found sixteen problems in this
file's claims and four in the wiring behind them. Sprint 11 fixed them. These are the
patterns underneath.

**Re-check the register every sprint, not once.** VD-17 was true on the day it was recorded
and false within the week, and nothing swept it: Sprint 9 opened with a task that was
already a no-op and §6 went on asserting the gap for three more sprints. That is written up
in §3 as a one-off. It was not one. The deferred lapse alerting (Sprint 7 → "a later
sprint", which never came) and the trust-centre terms gate are the same failure, and so is
`known-concerns.md` §18 sitting open for four sprints after Sprint 7 closed it. A finding
nobody is assigned is a finding nobody re-reads.

**Write gates as commands that pass, and run them at close-out.** Sprint 5's gate as
written was never met — the grep it names excludes files it cannot see and matches files it
does not mention — and the *Shipped* block silently restated it wider and reported success.
A gate quoted as an intention is a description of what somebody hoped to be true.

**When a sprint closes a conflation defect, grep every call site of the helper.** VD-23 is
Sprint 8's own defect: it fixed the US/DPF conditional inside `calculateVendorRisk` and
never asked who else called the function it had just qualified. Thirteen callers did.
Fixing the instance in front of you and not the class is how one module ends up correct
while five others are confidently wrong in the same way.

**When a sprint ships a component, gate on it rendering with real data.** Sprint 10's gate
was that its i18n keys existed in three catalogues. They did. The component they belonged
to was never handed any data by anything, which no key check can see. The gate tested the
part that was easy to test.

**A guard that finds nothing has told you nothing.** `check:vendor-provenance` fails if it
parses zero writes, because its first version had a broken regex and reported a clean
codebase in a repo with four unguarded writes in one file. Every guard whose evidence is an
absence needs a floor under it, and the ones in this repo mostly do not.

**Numbers a document leans on need an artefact.** This file quotes five seed figures in
five places and rests an open question on them, and none of them had a committed source —
while twenty lines away it rightly commits a dated sample of the DPF feed so that a change
shows up as a diff. Two standards, one document.

**A document that sets review clocks needs one.** This one put a twelve-month clock on the
adequacy list, a `review_by` on analyst rows and a 5/20-working-day service level on
corrections, and carried no owner and no next-review date of its own until Sprint 11. Both
are now in the header.

**And the shape of the thing itself.** By Sprint 10 the *Shipped* blocks had superseded the
plans above them — the Status section says so outright — which left a reader holding the
delta between a plan and its correction forty lines apart, and the only live content at the
very bottom of eleven hundred lines. §0 is the fix, and it is a patch on a structure that
should have been "how it works now" and "how it got here" from the beginning. The next
document like this one should start there.
