# Custodia — Data Processing (ROPA) Module

**Consolidated audit · verified defect register · regulatory gap analysis · build order**

Supersedes `data-processing-module-assessment-model1.md`, `data-processing-module-audit-model2.md`
and `data-processing-module-audit-model3.md`. Where those three disagreed, this document states
which one was right and why — the adjudications are recorded in Appendix A.

Module = the nav item labelled **"Data Processing"** (`shared.json` → `navigation.ropa`), routed at
`/ropa`, served by `apps/api/src/routers/ropa.ts` (648 lines), rendered by
`apps/web/src/components/ropa/RopaEditor.tsx` plus five tab components, persisted in
`packages/db/src/schema.ts:225–390`.

Reviewed 17 August 2026 against commit `9d28953`, drizzle-orm 0.45.2.

**Sprint 0 was remediated on 17 August 2026** on branch `fix/ropa-sprint0-tenancy`.
Twenty-two defects are fixed; see §0.1 for the register and what each commit covers.

**Sprint 1 was built on 19 August 2026.** The register can now record its own subject
matter: catalogues, Article 9(2) and Article 10, per-category retention, Article 22,
mechanism-specific transfer evidence, recipient categories and roles, owners,
completeness scoring and a publication gate. See §0.2 for what shipped and what did
not. Migration `0046_regular_amphibian` is applied to production.

**Sprint 2 was built on 19 August 2026.** The register now has a lifecycle: a review
cycle with attestation, an approval workflow, point-in-time versions, archive,
restore, duplicate and dependency-aware delete, server-side search and filters with
saved views, working bulk operations, tasks and comments, notification coverage, and
the i18n and accessibility sweep the five child tabs had been waiting for. See §0.3.
Migration `0047_numerous_black_bolt` is applied to production.

**The three items §0.3 held back were built on 19 August 2026** — version restore, the
organisation-level approval requirement, and the migration itself. See §0.3's amended
tail for the two defects that surfaced while building them.

**Sprint 3 was built on 21 August 2026.** The register is now defensible: one canonical
Article 30 export with controller identity, all seven sub-paragraphs, both records and
negative assertions, rendered as PDF, XLSX, CSV, an EDPB-shaped JSON and four regulator
template packs from a single server-side dataset; a filterable, paginated audit trail
that finally shows child-row changes and can be exported; the LIA, the DPIA screening,
a DPIA module with its own route, and a per-transfer TIA. See §0.4. Migration
`0048_steep_blue_shield` is applied.

**Sprint 4 was built on 21 August 2026.** The register is now populated by something
other than typing: delegated intake questionnaires answered over a token by the people
who actually know, discovery from the vendor register, the tracker scan and connected
SaaS, AI drafting with a decision per field, retention schedules with triggers and
disposal evidence, legal holds, the three data maps, a public REST API and webhooks
that fire, a real ROPA score with a daily trend, fourteen register gap rules, and
generalised material-change evaluation with three separable consequences. See §0.5.
Migration `0049_striped_mephistopheles` is applied, and so is `0048` — see §0.5 for
what was checked afterwards, and for the four foreign-key names Postgres truncated.

**The document is otherwise unrevised.** Part II's findings are left exactly as written,
each with a **FIXED** marker, its commit, and a one-line note on what the fix was, so the
audit and the remediation can be read against each other. Part I still describes the
module **as audited** — most of the behaviours it documents no longer exist — and
Parts III to VI still stand as the record of what was found, with §0.2 to §0.5
stating which Part IV items are now closed. The Article 30 verdict in Part III is
superseded for the items Sprints 1 to 4 built and unchanged for everything else.

---

## 0.5 Build status — Sprint 4

Built 21 August 2026. `npm run check` passes at 0 type errors in both workspaces with
every guard green, plus two new fixture suites (149 assertions).

### Schema

`packages/db/drizzle/0049_striped_mephistopheles.sql` — nine `CREATE TABLE`, four
`ADD COLUMN`, twenty-two indexes, six unique constraints and thirty-nine foreign
keys. **No drops, no type changes, no `SET NOT NULL`, no `DROP NOT NULL`.** It is
purely additive, which is what made it possible to ship a retention model beside
the free-text columns rather than in place of them.

**Applied to the live database on 21 August 2026 at 12:07 UTC**, and then checked
object by object rather than taken on trust: all nine tables present, all four added
columns present, thirty-nine foreign keys, twenty-two indexes, six unique
constraints. `0048` is applied too — §0.4 recorded it as awaiting `npm run migrate`
and that was **wrong**; the migration table has it applied on 19 August, two days
before §0.4 was written. Nothing in Sprints 3 or 4 is inert any longer.

**Postgres truncated four of the new foreign-key names to 63 characters** and said
so, at NOTICE level, during the run:
`ropa_intake_requests_processing_activity_id_processing_activiti`,
`ropa_intake_requests_created_activity_id_processing_activities_`,
`ropa_discovery_signals_accepted_activity_id_processing_activiti`,
`ropa_discovery_signals_integration_id_organization_integrations`.
Harmless here — checked, and no two constraint names in the schema collide — but the
names in the database now differ from the names in `0049`, so a future
`DROP CONSTRAINT` written from the migration file would not find its target. The
underlying cause is that drizzle-kit composes an FK name from
`<table>_<column>_<reftable>_<refcolumn>_fk`, and both of these tables have long
names pointing at `processing_activities`.

| Item | What was added |
|---|---|
| **E47** | `retention_schedules` — period value and unit, trigger, trigger detail, statutory citation, jurisdiction, justification, disposal method, owner, review cadence, status |
| **E48** | `processing_activities.retention_schedule_id` and `retention_anchor_at`; `processing_data_categories.retention_schedule_id` |
| **E51** | `retention_disposals` — due key, due date, status, method, record count, systems, evidence, performer, deferral |
| **E52** | `legal_holds` and `legal_hold_activities` |
| **C32/C33** | `ropa_intake_requests` — token, recipient, frozen question set, answers, status, due and expiry, reminder counter, merge provenance |
| **C34–C36** | `ropa_discovery_signals` — source, source key, confidence, the suggested draft as fields, evidence, accept/dismiss trail, `UNIQUE (org, source, source_key)` |
| **C37** | `ropa_activity_drafts` — prompt, model, proposal and decisions as jsonb, apply trail |
| **P123** | `ropa_completeness_snapshots` — one row per org per day, with `by_requirement` |
| **P125** | `material_change_events`; `reconsent_flags.material_change_event_id` |

### Eight decisions worth stating

1. **The retention schedule and the free-text period both stay, and the schedule
   wins.** `retentionAnswer()` resolves Art. 30(1)(f) from whichever the register
   actually holds and reports *which* in `source`. A migration that required every
   period to be re-entered as a schedule before the Retention tab would open is a
   migration nobody completes; a register that silently preferred one without
   saying so is D19 in a different tab. Attaching a schedule is an upgrade.

2. **`computeDisposalDate` returns a reason, not a nullable date.** `no_period`
   and `no_anchor` are different findings and they send someone to fix different
   things — the first is "nobody decided how long", the second is "the clock has
   not started", and the second is the *ordinary* state of a correctly configured
   employment schedule until an employment ends. Only `collection` starts its own
   clock from the activity's creation date; every other trigger waits for
   `retention_anchor_at`, because the event lives in a business system Custodia
   does not watch. The due report counts all three separately, and "no disposal
   date" is usually the more actionable number.

3. **Nothing in the retention module deletes anything.** The nightly scan writes a
   `due` row and stops. A product that executed its customers' retention policy
   would be destroying evidence on a schedule, on the strength of a period somebody
   typed into a form — and the one time it got a trigger date wrong there would be
   nothing to recover. The disposal log is a work queue; the work happens in the
   system that holds the data, and what is recorded here is the method, the count,
   the systems and the evidence, which is the part an auditor asks for.

4. **A material change has three consequences and they do not travel together.**
   This is the whole of P125 and it is why "extend the re-consent worker" was the
   wrong shape. Adding a data category to a consent-based activity needs fresh
   consent. The same change on a contract-based one needs the privacy notice
   updated under Art. 13(3) and no consent whatever — and a product that told the
   controller to ask for permission it does not rely on is a product whose advice
   gets switched off. Widening the subject population to children needs the DPIA
   looked at again under Art. 35(11) and possibly neither of the other two.
   `evaluateMaterialChange` returns a verdict per consequence, with the Articles.

5. **The rules decide; the model is asked one question and may only raise.**
   Whether a recipient was added is a fact about two rows, not a judgement — sending
   it to a model costs money, adds latency and adds a way for the answer to be
   wrong. The one thing that *is* a judgement is whether a rewritten purpose
   describes different processing, and that is the only call `materialChange.ts`
   makes. `applyNarrativeVerdict` can upgrade a verdict the rules already found
   possible and cannot clear one they found decisive: a model that could downgrade
   "a new third-country transfer was added" to immaterial would have a veto over
   Chapter V. `workers/reconsent.ts` is untouched and still runs.

6. **Delegated intake proposes; it never writes.** What comes back from a
   questionnaire sits in `answers` until a reviewer accepts it field by field. A
   department head who can edit the Article 30 record directly is not delegated
   intake — it is an unreviewed register with more authors. The mapping is also
   deliberately unclever in two places: "I am not sure" produces **no candidate**
   rather than a confident `false`, and a "yes, data leaves the EEA" is recorded as
   a prompt with a note saying it cannot be accepted as a transfer record, because
   a business owner genuinely does not know where their SaaS vendor hosts data.

7. **The AI draft reports what it rejected.** `validateProposal` drops any value the
   register's own vocabularies cannot hold — a lawful basis of "legitimate business
   need", a destination country written as "United States" — and returns the
   rejections, which the panel shows. A field silently discarded is one the reviewer
   believes was considered and found not to apply, which is precisely the
   distinction F56 spent a sprint making about unanswered screening criteria. The
   plural `legitimate_interests` is normalised rather than rejected: the value is
   right and the spelling is not.

8. **The REST API is read-and-append.** `GET` the register, `GET` one record with
   its four child collections, `GET` the canonical Article 30 export, `POST` a
   draft. No `PATCH`, no `DELETE`. An Article 30 record carries an optimistic lock,
   a publication gate, a completeness recompute, a version snapshot, an approval
   state and a subject-category mirror; a REST write that bypassed any one of them
   would leave the register in a state the editor cannot represent. Writes that
   matter go through tRPC, where all six run.

### Closed by Sprint 4

`C32` · `C33` · `C34` · `C35` · `C36` · `C37` · `D41` · `D42` · `D43` · `E47` ·
`E48` · `E49` · `E50` · `E51` · `E52` · `O119` · `O120` · `P123` · `P124` · `P125`,
and `D44` and `D45`-adjacent reverse lookups as a side-effect: the org-level data
map answers "which activities process health data", "which send data to the US" and
"which involve this vendor" from the same facets, which is D44 in full.

`D19` (the blind ROPA compliance pillar), `D20` (`retentionReviewDate` write-only),
`D38`'s retention half (`6_months` printed raw) and `D40` (no public API) are closed
too, as consequences rather than as items.

### Three bugs found while building, in code Sprint 4 did not otherwise touch

**No webhook this product has ever offered was delivered.**
`utils/webhookDispatcher.ts` enqueued on a queue named `webhooks`;
`workers/webhooks.ts` consumes one named `webhook-deliveries`. pg-boss routes by
queue name, so every delivery row ever written sat at `status: 'pending'` for
ever — including the one the Test button creates, which reported success because
*enqueueing* succeeded. `tsc` cannot see a string mismatch between two files and
there is no integration test that would. D39 recorded that the three ROPA events
were never *emitted*; this is the layer under it, and it was worse.

**Two procedures in `webhooks.ts` used `require` in an ESM module.**
`webhooks.test` and `webhooks.redeliver` both call `require('../utils/webhookDispatcher')`.
The package is `"type": "module"`, so that is a `ReferenceError` at runtime — and it
typechecks, because `@types/node` declares `require` globally. Neither has ever run.
Both are static imports now, and `test` gained the ownership check it was missing.

**`X-Custodia-Timestamp` was the string "undefined" on every delivery.** The worker
read `delivery.payload.timestamp`; the envelope `dispatchWebhook` builds carries
`created`. Subscribers are told to use that header for replay protection.

### Two guards and two fixture suites

- **`npm run test:retention --workspace=apps/api`** — 71 assertions over
  `lib/retention.ts` and `lib/ropaDataMap.ts`. A disposal date that is out by a month
  reads exactly like one that is right, and the whole product between the arithmetic
  and the customer is a table of dates. The load-bearing cases: 31 January plus one
  month is 28 February and not 3 March; `pending_assessment` counts as *no* Chapter V
  mechanism on the transfer map; a hold whose expiry has passed is not in force even
  though nobody released it; and "reviewed annually" is never parsed into a
  one-year disposal date.
- **`npm run test:ropa-intelligence --workspace=apps/api`** — 78 assertions over
  `lib/materialChange.ts`, `lib/registerOutputs.ts`, `lib/ropaDrafting.ts` and
  `lib/ropaIntake.ts`. Every one of those four produces something that *looks like an
  answer* when it is wrong. The cases worth naming: the same change produces
  re-consent on a consent activity and only a notice update on a contract one; a
  model saying "not material" cannot clear a transfer the rules found decisive; a
  transfer with no mechanism is left out of the notice and reported as a gap rather
  than described; and "I am not sure" produces no merge candidate.
- `check:ropa-i18n` now covers `app/[locale]/intake`, the token-authenticated
  questionnaire. It sits outside the `(app)` group because its reader has no
  account, and a new surface outside the guard is how the next year of hardcoded
  English gets in.

### Deliberately not built, so the omissions are not mistaken for oversights

- **The intake questionnaire is English in every locale.** Its chrome is
  translated; the *questions* are served by the API and frozen onto the request when
  it was sent. That is the same call J93 made about the negative assertions — they
  are the content of the request rather than UI copy, and the merge screen has to be
  able to show a reviewer what was actually put to the respondent. Translating the
  question set belongs with J101.
- **`C38`'s industry template packs, `C39`'s competitor import and `C40`'s database
  scans.** All P2/P3. The 32 agnostic templates still live only in onboarding.
- **`D45`'s vendor-centric view and `D46`'s field-level lineage.** P2 and P3.
- **`P126`'s change-driven prompts, `P127`'s AI review, `P128`'s regulatory diffs
  and `P129`'s ask-the-register.** P1 and P2. `P128` in particular is not a build
  problem — the impact-assessment jobs exist and are in `DORMANT_JOBS` (D34).
- **`P130` is built as three server-side builders and one screen, not as four.** The
  notice sections, the DSAR scope and the blast radius are `ropa.insights.outputs.*`
  and are reachable through the API and the insights page; wiring them into the DSAR
  and Breach modules' own screens is where they belong long-term, and that is those
  modules' work rather than the register's.
- **A DSAR id on its own cannot narrow the scope, and the endpoint says so.**
  `dsar_requests` records who the requester *is* — name, email, an identifier blob —
  and not which category of data subject they fall into, so `outputs.dsarScope`
  passed a `dsarId` alone returns the whole register with a note explaining why.
  The alternative was to read a column that does not exist, get `undefined`, and
  return everything as though it had been narrowed — which is the shape of failure
  this module has been audited for twice. Adding that column is DSAR module work.
- **`O121` and `O122`'s integrations** — Zapier, Jira, Sheets, Confluence, SIEM
  streaming, MCP. P1/P2, and none of them is what "there is no API" meant.
- **The intake merge does not create child rows for transfers.** A respondent's
  "yes, I think so" about data leaving the EEA is a prompt for a DPO, not a Chapter V
  record, and the merge says so rather than writing a transfer with no mechanism.

### One thing found while building, in Sprint 4's own code

**The tenancy guard caught a delete that could not actually leak.**
`retention.holds.removeActivity` deletes a `legal_hold_activities` row keyed on a
hold id proved owned two lines earlier and an activity id that only narrows it —
the same shape as `clients.unlinkActivity`, which is in `ALLOWED_WRITES` with that
reason. Pass 2 flagged it because the *statement* carried no scope of its own, which
is exactly the property `tia.save` lacked when it rewrote every tenant's transfer
rows. It now carries a scoping subquery rather than an allowlist entry: an argument
about a statement's shape is worth less than the statement proving it.

---

## 0.4 Build status — Sprint 3

Built 21 August 2026. `npm run check` passes at 0 type errors in both workspaces with
every guard green, plus two new fixture suites (159 assertions) and nine added to the
completeness suite.

### Schema

`packages/db/drizzle/0048_steep_blue_shield.sql` — three `CREATE TABLE`, ninety-one
`ADD COLUMN`, eight indexes, and five `DROP NOT NULL`. No drops, no type changes, no
`SET NOT NULL`. The five loosened constraints are all on
`legitimate_interest_assessments` and are the reason F55 could not be built without one:
the narrative columns and the outcome were `NOT NULL`, so a *draft* could not be saved.
A balancing test is written over a week, and a form that refuses to keep half an answer
is a form people finish in Word instead.

**Generated and committed; not yet applied to production.** `check:schema` is green, so
`schema.ts` and `drizzle/` agree — the outstanding step is
`npm run migrate --workspace=packages/db` against the live database. Everything below is
written against the schema and is inert until that runs. Unlike 0046 and 0047, which §0.2
and §0.3 record as applied and verified, **0048 has not been run and nothing here has been
verified against live data.**

*Corrected 21 August 2026, after Sprint 4 ran the migration. **This paragraph was wrong.**
`drizzle.__drizzle_migrations` has 0048 applied on 19 August — before §0.4 was written,
not after. The likeliest explanation is that a `npm run migrate` run alongside Sprint 2's
held-back items carried it, and this section was written from the intent rather than from
the database. It is left in place rather than rewritten, because the useful record is that
the status of a migration was asserted here without being checked, and the check is one
query. Everything in this section is applied and verified — see §0.5.*

| Item | What was added |
|---|---|
| **F55** | `legitimate_interest_assessments` gains `status`, the WP217 purpose-test limbs, `necessity_test_proportionate`, the four balancing factors, `objection_mechanism`, `outcome_rationale`, `evidence`, `version` — and loses five `NOT NULL`s |
| **F56** | `dpia_screenings` — answers, criteria met, blacklist matches, verdict, decision, **rationale**, jurisdiction, supersession chain |
| **F57** | `dpias` gains twenty-nine columns: Art. 35(7)(a) description, DPO advice under 35(2), consultation under 35(9), sign-off, Art. 36 prior consultation, template and screening links, owner, cadence; `dpia_risks` gains the residual half of the matrix plus category, harms, affected subjects and source; `dpia_measures` gains type, owner, due date, effectiveness and evidence; `dpia_versions` is new |
| **F58** | `transfer_impact_assessments` gains `processing_activity_id`, the step-1 "know your transfer" columns, the step-6 re-evaluation interval and triggers, and the suspension decision |
| **I86** | `audit_logs.parent_resource_id` and `child_resource_type`, with the two indexes the filtered timeline needs |
| **I90** | `processing_activity_versions.content_hash`, and the same on `dpia_versions` |
| **N114** | `clients` gains `controller_address`, `controller_representative`, `controller_dpo_name`, `controller_dpo_email`, `processing_categories` |

### Six decisions worth stating

1. **One dataset, five renderers.** `lib/ropaArticle30.ts` builds the Article 30 record
   and `lib/ropaExportFormats.ts` renders it; the PDF, the XLSX, the CSV, the JSON and
   the four regulator packs all read the same object. That split is the whole of J93.
   The module previously produced *three* Article 30 documents — `export.generatePdf`
   rendered nine fields per activity through `ropa-record`, the audit pack rendered
   eight through `ropa-register`, and the register's CSV button exported whichever
   twenty-five rows the browser had loaded — and which one a customer got depended on
   which button they pressed. `ropaRecord.tsx` is deleted.

2. **Negative assertions are content, not chrome.** "No transfers to third countries" is
   a statement an Article 30 record has to make; a blank cell is not it, and a
   supervisory authority reading one cannot tell a controller with no transfers from one
   that has not filled the column in. Every record now prints what it asserts it does
   *not* do, and so does the register. They are English in every locale, deliberately:
   they are the *content* of the record rather than UI copy, and a locale-shifting
   assertion is a different assertion. Translating the whole document is J101, a P2, and
   it has to translate all of it rather than half.

3. **A draft LIA is enough to publish; "do not proceed" is not.** F55's own bar is
   "blocked until an LIA is at least drafted". Art. 5(2) asks that the reasoning be
   documented, and documentation in progress is documentation — a gate demanding a
   finished assessment would refuse every record on the day its basis was chosen, which
   is how a control gets switched off. The one case that blocks is an assessment whose
   own outcome was `do_not_proceed`: the register would be asserting a basis its own
   assessment rejected.

4. **The screening's rationale is mandatory for every decision, including "not
   required".** That is the entire finding F56 names. The boolean it replaces could not
   carry one, so a register full of activities marked "DPIA not required" could not
   demonstrate that the Art. 35(1) judgement had ever been made. Unanswered criteria are
   tracked separately from "no" and the verdict says how many are outstanding: "we
   considered whether this is large-scale and concluded it is not" and "nobody looked"
   are different statements.

5. **The TIA is per transfer, and it can contradict itself.** `tia.ts` files one per
   *vendor*, which cannot describe an organisation sending HR data to a processor under
   2021 SCCs and marketing data to the same processor under a derogation. The new
   assessment hangs off the transfer, so tenancy is proved through the activity and no
   vendor-keyed write exists in the router — the class D3 was. `evaluateTia` also
   reports three contradictions, of which the load-bearing one is a conclusion of "not
   essentially equivalent" followed by only contractual and organisational measures:
   Recommendations 01/2020 § 48 is explicit that those cannot bind a public authority
   whose law permits the access. That assessment reads as complete on screen and is the
   one an authority would reject.

6. **National Art. 35(4) lists are applied by jurisdiction, not merged.** A German
   *Muss-Liste* entry ticked by an Irish controller is not a statutory trigger for them.
   Merging the six lists would have told most customers a DPIA was mandatory when it was
   not, which is the direction of error that gets a control ignored.

7. **The PDF states its own limit instead of truncating quietly.** The route that renders
   it has a sixty-second ceiling (`maxDuration`), and a per-activity detail page each is
   the expensive part — a four-hundred-activity register would exceed it and the export
   would fail outright. So the summary tables cover every record, detail pages are capped
   at sixty, and the document *prints how many were rendered and where the rest are*. A
   silently truncated Article 30 record is precisely the failure this template was built
   to remove; a stated one is a limitation the reader can act on. The workbook has no cap,
   which is what the note points at.

### Closed by Sprint 3

`F55` · `F56` · `F57` · `F58` · `I85` · `I86` · `I87` (already closed by D1) · `I88` ·
`I89` · `I90` · `J93` · `J94` · `J95` · `J97` · `N114`, and `J96`, `J98` and `J99` as
side-effects: filtered export falls out of J94 once both take the same filter schema,
the EDPB JSON is a third renderer over the same dataset, and the audit pack now carries
the canonical record plus the workbook and the JSON.

`F60` (Art. 36 prior consultation tracking) is closed too, as columns and a payload
rather than as a workflow — it is a P1 that turned out to be five fields on the DPIA
that the sign-off already needed.

### Two guards and two fixture suites

- **`npm run test:assessments --workspace=apps/api`** — 109 assertions over
  `lib/assessments.ts`, `lib/dpiaTemplates.ts` and `lib/auditTrail.ts`. Everything in
  those three answers a legal question and returns a plausible-looking value when it is
  wrong: a screening reporting "not required" over three unanswered criteria renders
  identically to one that considered them; a content hash that varies with key order
  reports tampering on every verification; a risk with no residual assessment scored as
  "no residual risk" reports low against three unaddressed risks.
- **`npm run test:ropa-exports --workspace=apps/api`** — 50 assertions over the renderers,
  reading each workbook back out of its own buffer. An export is the one output nobody
  looks at until a regulator does, and `tsc` sees a valid `Buffer` whether the sheet
  names collided, the empty sheets lost their headers, or the Art. 9(2) column printed an
  empty string for a category with no condition recorded.
- `check:ropa-i18n` now covers `components/dpia` and `app/[locale]/(app)/dpia`. A new
  surface outside the guard is how the next year of hardcoded English gets in.

### Deliberately not built, so the omissions are not mistaken for oversights

- **`J101`'s locale-aware exports.** The PDF, the workbook and the CSV are English
  whatever the reader's locale, apart from the four regulator packs, whose headers are in
  the authority's own language because that is the point of a pack. Translating the
  register itself means translating the *record*, not the chrome — including the negative
  assertions and the Article citations — and half of it would be worse than none.
- **`J100`'s scheduled exports and board summary**, `J98`'s DOCX, and `J96`'s export
  presets. All P1/P2, and none is what "the register cannot be exported" meant.
- **`F59`'s Art. 6(4) compatibility assessment and `F61`'s assessment library.** P1. The
  library in particular wants due dates, owners and reminders across all three
  assessments, which is the same shape as B19's review cadence and belongs with it rather
  than bolted onto three separate tables.
- **`F63`'s assessment re-trigger on material change.** P2, and it depends on P125's
  generalised material-change evaluation, which is Sprint 4.
- **`I91`'s "show me the register as at <date>"** and `I92`'s hash-chained log. The
  content hash in I90 is the building block for both; neither is what "the trail cannot
  be read" meant.
- **The DPIA measure editor.** Measures are created from templates, listed under their
  risk, and carry an owner, a type and a due date in the schema and the API — but the
  route's editor renders them read-only. Adding one by hand still goes through
  `dpia.measures.create`. Named here because the risk matrix above it is fully editable
  and the asymmetry otherwise reads as a bug.

### Two things found while building

**An export inherited a pagination side-effect.** `buildRegisterFilters` adds
`next_review_at IS NOT NULL` when the sort is `nextReviewAt` — correct for the list,
because a NULL compares false against a cursor and the page would silently end early.
An export does not paginate, so carrying it over would have dropped every activity with
no review date out of an Article 30 record, and the document could not have disclosed
the omission because the server would not have known it happened. `exportFilters()`
normalises the sort away; every export procedure goes through it.

**A form that took one character per click.** The four Sprint 3 panels each declared
their field helpers *inside* the render — `const Text = (...) => ...`. A component
declared inside a render is a new component type on every render, so React remounts the
subtree instead of updating it, and a controlled textarea that remounts loses focus. The
shared helpers moved to `components/ropa/fields.tsx` and each panel now *calls* its thin
wrapper rather than rendering it as JSX, which inlines the elements with no new type.
Invisible to `tsc`, invisible to a screenshot, and obvious the moment anyone types a
second character.

---

## 0.3 Build status — Sprint 2

Built 19 August 2026. `npm run check` passes at 0 type errors in both workspaces with
every guard green, plus one new guard and 32 new assertions.

### Schema

`packages/db/drizzle/0047_numerous_black_bolt.sql` — purely additive: six
`CREATE TABLE`, thirteen `ADD COLUMN` on `processing_activities`, and the indexes and
foreign keys they need. No drops, no type changes, no `SET NOT NULL` without a
default.

**Applied to production**, and verified rather than assumed: `drizzle.__drizzle_migrations`
went 44 → 45 rows with the greatest `created_at` matching 0047's journal `when`
exactly, all 13 columns are present with their defaults and NOT NULLs, and the two
constraints that carry logic landed with them — the partial unique index
(`WHERE decision = 'pending'`) that allows one open approval per activity, and
`UNIQUE (processing_activity_id, version)`. The five existing activities are intact and
defaulted correctly. The journal drift §0.2 recorded is unchanged and did not affect
what ran: drizzle takes the single greatest `created_at` and 0047 was the only entry
past it.

| Item | What was added |
|---|---|
| **B19** | `review_cadence_months`; `processing_activity_attestations` |
| **B20** | `approval_state`, `approval_requested_by/_at`, `current_reviewer_id`, `approved_by/_at`; `processing_activity_approvals` with a partial unique index allowing one open request per activity |
| **B21** | `processing_activity_versions` — a jsonb snapshot of the activity and its four child tables, `UNIQUE (activity, version)` |
| **B22** | `archived_at`, `archived_by`, `status_before_archive` |
| **B24** | `duplicated_from_id` |
| **K103** | `tags` (jsonb), `completeness_score` (denormalised), and the three indexes R143 asks for |
| **K104** | `ropa_saved_views`, `UNIQUE (org, author, name)` |
| **M110/M111** | `processing_activity_tasks`, `processing_activity_comments` |

### Four decisions worth stating

1. **Approval is a separate axis from status.** Collapsing them would mean a record
   could not be both published and awaiting re-approval, which is the ordinary state
   of one somebody has just edited. An edit to a *substantive* field drops an
   approved record back to draft; an owner, tag or cadence change does not. If every
   save re-opened approval, nothing would ever stay approved, and the workflow would
   be the first thing a customer switched off.

2. **`completeness_score` is denormalised onto the activity.** The score is a pure
   function and the editor still computes it live; the stored copy exists so the
   register can *filter and sort* on it. Answering "show me everything under 50%"
   without it means loading every activity's children on every list request. It is
   refreshed by the API after each of the fourteen mutations that can move it, and
   deliberately does not touch `updated_at` — for the two reasons the subject-category
   mirror does not either (D1's sort, D45's optimistic lock).

3. **No bulk publish.** `bulk.update` offers draft and under_review and not active.
   Publication runs through B23's gate, which is a per-record judgement about
   Article 30 completeness; a bulk version would either bypass the gate or fail on
   the first record and leave the rest in an unknown state. The UI says so where the
   option would have been, rather than leaving a gap somebody reads as a bug.

4. **A version is a jsonb snapshot, not a shadow schema.** What is being preserved is
   the *document* an approver signed. A shadow table per entity would have to be
   migrated in step with the live one forever, and the first time it drifted every
   historic version would silently start reading differently. The cost is that a
   snapshot is not queryable field by field, which is the right trade: nobody filters
   the register on what it said in March.

### Closed by Sprint 2

`B19` · `B20` · `B21` · `B22` · `B24` · `K102` · `K103` · `K104` · `L107` · `L108` ·
`M110` · `M111` · `M112` · `R141` · `R142`, and `R143`'s three indexes as a
side-effect of the filters that need them.

`R142` went further than extracting the five tabs: `utils/ropaVocabularies.ts` held
about eighty English labels and thirty hints as string literals, which is why every
enum in the register rendered in English even on the tabs that were translated. The
module now exposes values only, and `useRopaVocabulary()` resolves wording through
`ropa.vocab` / `ropa.vocab_hints`. That is the "format enums through the message
catalogue" half of the finding, and it is the half that was going to be forgotten.

### Two guards and a fixture suite

- **`npm run check:ropa-i18n --workspace=apps/web`** is R142's "add a check so it
  cannot regress". It fails on a literal in a translated position and on a `t()` key
  that is not in `en/ropa.json` — the second because next-intl renders a missing key
  as its own dotted path, in every locale, and neither `tsc` nor `check:messages` can
  see it: the first sees a string literal, the second compares the catalogues only
  against each other.
- **`npm run test:ropa-lifecycle --workspace=apps/api`** — 83 assertions over
  `lib/ropaLifecycle.ts`. Everything in it decides something on the user's behalf and
  fails silently: a review date that drifts three days a cycle looks fine in a
  browser; a reminder ladder matching "anything in the past" looks fine until an
  owner has been emailed about the same record forty nights running; a child-row diff
  paired by position looks fine and is a lie somebody will act on.

### One bug found while building, in code Sprint 2 did not otherwise touch

`utils/pagination.ts` decided whether a cursor's sort value was a date by trying to
parse it. Every caller sorted on a timestamp, so it was right every time — until
K102 added `name` and `completenessScore` as sort options. An activity named "2024"
mints a cursor that parses as a date, so the second page compares a varchar column
against a timestamp; a score of 85 parses as 85 milliseconds past the epoch. Both
surface as a list that silently ends after one page, which reads as "there are no
more records". The cursor now records the type rather than inviting a guess, older
cursors held in open tabs still decode, and the codec moved to `utils/cursor.ts` so
that encoding one no longer requires a database connection — which is what let it be
covered by fixtures at all.

### Deliberately not built, so the omissions are not mistaken for oversights

- **`K105`'s column chooser and grouping, and `K106`'s audit mode.** Both are P1/P2
  and neither is what "the register cannot be filtered" meant.
- **`M113`** — presence, locking, delegation, and the change-proposal model for
  approved records. All P2, and the last of them is a different shape of workflow
  from the one B20 asked for.
- **`L109`'s undo**, and bulk retention-schedule application, which depends on `E`.
- **Translated requirement labels.** `CompletenessPanel` renders `req.label` — the
  English fallback the API attaches to each `Requirement` — so the "what's missing"
  list reads in English in every locale. That is true of all fifteen requirements and
  predates this sprint; it needs an id-to-catalogue-key mapping on the web side, not a
  string extraction, so `check:ropa-i18n` cannot see it either. Named here because
  R142 otherwise reads as finished.
- **The 34 route-segment error boundaries** are still hardcoded English, ROPA's three
  among them. They are one shared template; translating three of them would leave the
  register inconsistent with the rest of the app. `check:ropa-i18n` skips them by
  name, with that reason recorded where it skips them.

### Amended — the three held-back items, built 19 August 2026

**Version restore (B21).** `ropa.versions.restore` puts the record back to what a
version said. Three decisions make it safe enough to offer, and they are the three
reasons it was held back:

- *It snapshots first*, as `pre_restore` — a restore is an edit, and the state it
  overwrites is exactly what somebody wants back when they realise they restored the
  wrong version. Those snapshots are not themselves offered for restore.
- *It restores what the record said, not where it was.* Publication, review dates,
  archive state, approval and the links to a DPIA, an LIA or a client are excluded
  (`RESTORE_EXCLUDED_FIELDS`). Restoring `status` would republish a record somebody
  deliberately withdrew, around B23's gate, on the strength of a button labelled
  "restore". An approved record drops back to draft, because a restore always rewrites
  substantive content — the same rule an ordinary edit follows, reached differently.
- *It reconciles child rows on their primary key* rather than deleting and
  re-inserting them. This is the part that had to be got right:
  `transfer_impact_assessments.processing_transfer_id` references
  `processing_transfers.id` **with no `ON DELETE` clause**, so the obvious
  implementation fails outright against any transfer that has had a TIA — and where it
  did succeed it would sever the link between a Chapter V transfer and the assessment
  justifying it, which is the pair an auditor asks to see together. Rows present in
  both are updated; only rows added since are deleted, and a TIA on one of those is
  refused by name rather than as a raw constraint violation. Confirmed against the
  live schema: the database does refuse the delete, and reconciliation leaves the TIA
  pointing at its transfer.

**The organisation-level approval requirement (B20).**
`organizations.settings.ropaApprovalRequired`, read by `evaluatePublication` and set
through `ropa.governance.update` (admin only). **Off unless turned on** — that default
is the whole reason it is a setting: making approval mandatory changes what
`ropa.update` does for every existing customer on the day it ships, and the refusal
names a workflow nobody has been trained on.

It is the one blocker a publication exception may **not** clear. The Article 30
blockers are about a record being *incomplete*, which a named and dated exception can
legitimately override — that is B23's design. Approval is about a record being
*unreviewed*, and a control anybody can wave through with ten characters is not a
control. It appears in the blocker list beside the Article 30 ones, deep-linked to the
Review & approval tab, so the editor can say which tab fixes it.

### Two defects found while building these

**Existing activities scored 0 on the completeness *filter*.** `completeness_score`
defaulted to 0 for every row that predated 0047, and nothing recomputed it until the
record was next edited — so the ring on the register showed the truth while the filter
called every one of them "under 50%". `completenessBatch` now writes back any score
that has drifted, in the pass that computes them anyway: it heals the first time
anyone opens the list, for every organisation, with no runbook step to forget. Only
rows that differ are touched, so the second load writes nothing, and like
`refreshCompleteness` it does not touch `updated_at`.

**A snapshot's timestamps come back out of jsonb as strings**, and a drizzle
`timestamp` column calls `.toISOString()` on whatever it is handed. Writing a snapshot
back without reviving them throws at the first child row carrying a date — an SCC
execution date, a DPF expiry, a `retentionReviewDate`. `reviveSnapshotDates` is
deliberately strict about the full ISO instant so that free text merely starting with
digits is left alone. Caught before it shipped, and covered both by fixtures and by
the live round-trip.

The lifecycle fixtures are 101 assertions (from 83) and the completeness fixtures 55
(from 42).

---

## 0.2 Build status — Sprint 1

Built 19 August 2026. `npm run check` passes at 0 type errors in both workspaces with
every guard green, and 95 new assertions across two standalone `tsx` fixture suites.

### Schema

`packages/db/drizzle/0046_regular_amphibian.sql` — 52 statements, purely additive: three
`CREATE TABLE`, the rest `ADD COLUMN` and `ADD CONSTRAINT`. No drops, no type changes,
no `SET NOT NULL` without a default. Applied to the Supabase instance on 19 August 2026;
`drizzle.__drizzle_migrations` went 43 → 44 rows and the five existing activities, their
sixteen data categories and the single organisation were untouched.

| Item | What was added |
|---|---|
| **A2** | `data_element_catalogue` — org-scoped, seeded with 45 elements across Identity, Contact, Financial, Employment, Online identifiers, Special category and Criminal data |
| **A3** | `data_subject_category_catalogue` — 19 seeded categories carrying `is_child` and `is_vulnerable`; `processing_data_subjects` links them to an activity with a volume band |
| **A4** | `retention_period`, `retention_trigger`, `retention_justification` on `processing_data_categories` |
| **A6** | `special_category_type`, `article_9_condition`, `article_9_national_law_basis`, `is_criminal_data`, `article_10_basis`, `identifiability` |
| **A12** | `involves_profiling`, `involves_automated_decision_making`, `adm_logic`, `adm_significance`, `adm_human_intervention` |
| **B18** | `business_owner_id`, `privacy_owner_id` |
| **B23** | `published_at`, `published_by`, `publication_exception_reason`, `publication_exception_by`, `publication_exception_at` |
| **G64/G65** | `recipient_category`, `role` on `processing_recipients` |
| **H76/H77** | `scc_year`, `scc_module`, `annexes_complete`, `execution_date`, `expiry_date`, `signatories`, `document_id`, `bcr_reference`, `adequacy_decision_reference`, `article_49_sub_reason`, `article_49_justification`, `dpf_certification_number`, `dpf_scope`, `dpf_expiry_date` |

Both catalogues carry a `UNIQUE (organization_id, name)`, and `processing_data_subjects`
a `UNIQUE (processing_activity_id, category)` — the pattern the Database section of
`CLAUDE.md` describes, where the constraint carries the logic: seeding is idempotent
because of it, and it is what makes "Employees" one row rather than four.

### Three decisions worth stating, because they are not what the audit asked for

1. **The jsonb array survives as a derived mirror.** `processing_activities.data_subject_categories`
   is read by the CSV export, both PDF templates, the audit pack, the embeddings worker
   and the register list. Rather than migrate five readers at once, the API rewrites the
   array from `processing_data_subjects` after every mutation. It is authoritative
   nowhere. The sync deliberately does **not** touch `updated_at`: the register sorts on
   it (D1's lesson) and the editor's optimistic lock compares against it (D45's).

2. **`active` is no longer reachable from the Status dropdown, the create form or the
   CSV importer.** B23 says draft-versus-active is a costume; a gate behind a dropdown
   that autosaves would only ever have surfaced as "Error saving", because a debounced
   whole-form save cannot report which field was refused. Publication is now an explicit
   button that names the unanswered Articles and offers the exception in the same place.
   `ropa.create` and `ropa.bulkCreate` drop `active` from their input enums — a row with
   no subjects, categories or recipients cannot meet the gate — and the CSV importer
   names and refuses such a row the way it already refuses an unrecognised lawful basis,
   rather than downgrading it silently, which is the class of defect D10 was.

3. **D43 is bridged, not resolved.** `transfer_mechanism` still holds two vocabularies —
   the tab's old prose and the auto-create slug. `normaliseTransferMechanism` maps both
   onto one enum on read, so an existing row opens in the picker instead of rendering
   blank; new writes use the enum. Tightening the column itself would 400 the first edit
   of every existing row and belongs with a data migration.

### Closed by Sprint 1

`A2` · `A3` · `A4` · `A6` · `A12` · `B18` · `B23` · `B25` · `B26` · `D30` · `G64` ·
`G65` · `H75` · `H76` · `Q132`, and `H77` in part.

The publication gate and the completeness scorer are one module,
`apps/api/src/lib/ropaCompleteness.ts` — pure, and the same judgement asked twice.
It is the one piece of Sprint 1 that decides something on the user's behalf, so it
carries 42 fixture assertions: a wrong "met" lets a register reach a supervisory
authority with an Article 30 field empty, and a wrong "missing" trains people to reach
for the exception. Both failures are silent in a browser and invisible to `tsc`.

### Deliberately not built, so the omissions are not mistaken for oversights

- **`H77`'s certification lookup** against the US Department of Commerce list, and DPF
  expiry *monitoring*. The framework is a first-class mechanism with certification
  number, certified scope and expiry recorded and rendered; the automated lookup is an
  external integration and the expiry reminder is `H81`.
- **`B18`'s unowned-activity reporting** beyond the Mine / Unowned / All filter on the
  register, which is server-side. A report is `K`-series work.
- **`R142`.** The five child tabs remain hardcoded English and the new panels match
  them. Extracting all of them is one sweep; a half-translated tab would render raw key
  paths to German and French readers, which `check:messages` cannot catch because the
  keys would be absent rather than divergent. Everything added to the translated
  surfaces — the editor, the register list, the full-record view — carries en/de/fr.
- Everything still named as open in §0.1: `supplementaryMeasures` stays unreachable
  (H78), `D38` is unfixed in both PDFs, and the canonical Article 30 export is `J93`.

### One thing found while migrating, unrelated to this work

`drizzle.__drizzle_migrations` holds 44 rows against 36 journal entries and 50 `.sql`
files. Seven applied migrations are no longer in `meta/_journal.json`, and several
`.sql` files are not journalled. It does not affect what runs — `PgDialect.migrate`
takes the single greatest `created_at` and applies every journal entry with a later
`folderMillis`, so it never consults a hash — but it means the journal is not a record
of what the database has had done to it, and a future `check:schema` disagreement will
be harder to reason about than it looks.

---

## 0.1 Remediation status — Sprint 0

`npm run check` passes at 0 type errors in both workspaces, with every guard green.

| Commit | Defects |
|---|---|
| `a8bef40` | D3 cross-tenant TIA write · D2 mass assignment (four mutations, not three) · `check:tenancy` pass 2 |
| `cee40c1` | D1 autosave write loop · D45 spurious optimistic-locking conflicts |
| `3b80a4c` | D5 data-category columns · D6 add-row country · D7 safeguards binding · D8 vendor dropdown |
| `82b34b0` | D4 soft-delete filter · D9/D10 create-form fields · D11 vendor id spaces · D12 audit diff · D13 child-row logging · D17 adequacy list |
| `e970ea3` | D14 custom retention · D15 template values · D18 initial DPIA risks · D27/D28/D29 dead buttons · D38 (list and CSV only) · D63 history labels |

**Fixed:** D1 · D2 · D3 · D4 · D5 · D6 · D7 · D8 · D9 · D10 · D11 · D12 · D13 · D14 ·
D15 · D17 · D18 · D27 · D28 · D29 · D45 · D63, and D38 in the register list and CSV.

**Three things the fixes changed that this document did not ask for, and one it got wrong:**

1. **D2 is four mutations, not three.** The audit cites `ropa.ts:169`, `:335` and `:535`
   and calls the third one transfers. `:535` is *recipients*; transfers at `:613` was
   missed. All four now take explicit per-field schemas.
2. **The tenancy guard could not have caught D3, and now can.** Pass 1 proves ownership
   per *procedure*, so `tia.save` passed on the strength of the two writes it did scope.
   Pass 2 checks `update`/`delete` per *statement*, and counts an earlier proof only when
   it pinned the value to a row's **own id** — proving `organizationVendors.vendorId =
   input.vendorId` says the caller has that vendor linked, not that the rows about to be
   updated are theirs. The original D3 shape was reintroduced to confirm the guard fires.
3. **D51 got worse before it gets better.** The D1 loop was accidentally providing retry.
   A failed autosave now stays "Error saving" until the next edit rather than retrying
   every 500 ms. Queuing or persisting it locally is still open.
4. **D28, D29 and D27 were removed, not wired.** The LIA, a DPIA route and real bulk
   operations are F55, F57 and L107/L108 — Sprint 3 and Sprint 2 work. The advice each
   button sat beside is correct and stays; the control that promised to act on it does not.

**Deliberately still open, and named here so the omissions are not mistaken for oversights:**
`supplementaryMeasures` stays unreachable (jsonb, wants the EDPB Recommendations 01/2020
catalogue rather than a text box — H78); per-category retention still needs a column that
does not exist (A4); D38 is unfixed in both PDFs; D43's two vocabularies in
`transfer_mechanism` survive; and everything in Sprints 1–4 is untouched.

---

## 0. Method and confidence

Three independent audits were merged. Every load-bearing claim was then re-read against the source
rather than carried across. Findings are marked:

| Mark | Meaning |
|---|---|
| **[V]** | Re-verified in this pass. File and line cited; the code was read, not inferred. |
| **[S]** | Static inference from verified code plus verified library behaviour. Mechanism stated so it can be falsified by reading the same code. No database was exercised. |
| **[C]** | Carried from a source audit, plausible, not re-verified here. |

Nothing in this document was observed in a running browser or against a live database. Items marked
**[S]** that describe runtime failures (D5, D6, D7, D8) should be reproduced against an instance
before they are scheduled — the mechanism is stated precisely enough that reproduction is cheap.

One library behaviour underpins several findings and was settled by reading
`node_modules/drizzle-orm/pg-core/dialect.cjs:102–118`:

> `PgDialect.buildUpdateSet` iterates the **table's** columns and keeps only those present in the
> set object. Keys that are not columns are therefore **silently ignored**, not rejected. If the set
> object contains *no* real column, `columnNames` is empty, `sql.join([])` yields nothing, and the
> emitted statement is `update "t" set  where …` — a Postgres syntax error.

That single fact splits two classes of bug that the source audits conflated: phantom keys on the
main autosave are *silently dropped* (annoying, not fatal), while an inline grid edit that sends
**only** a phantom key *errors* (fatal). See D5 and D7.

---

## 1. Executive verdict

*As audited, 17 August 2026. Sprint 0 fixed the defects below and Sprint 1 built the capability
the last paragraph calls for; §0.1 and §0.2 record what changed. This section is left as written
because it is the finding, and the finding is what the module has to be measured against.*

The module is an eight-column activity list with a nine-tab editor behind it. Four of the nine tabs
are wholly or partly non-functional, two of them contain buttons that do nothing, and the two tabs
that carry the two Article 30 requirements a supervisory authority asks about first —
**categories of personal data (30(1)(c)) and third-country transfers (30(1)(e))** — cannot record
their subject matter at all.

The five things that matter, before any discussion of features — **all five are fixed as of
`e970ea3`; they are left here as found, because what they say about how the module was built
is the part that outlives the patch:**

1. **A cross-tenant write.** `tia.ts:92` and `:115` update `processing_transfers` by `vendorId`
   with no organisation predicate, against a **shared** vendor catalogue. When one customer
   completes a TIA for AWS, every other customer's AWS transfer row flips to "TIA: Completed" — or
   to "Suspended" — on the strength of a stranger's assessment. This is fabricated Chapter V
   evidence appearing inside a paying customer's register. **[V]**
2. **Opening an activity writes to the database in a loop.** The autosave effect depends on
   `watch()`'s return value, which is a new object every render, and the save's own state updates
   and cache invalidation cause renders. An open editor issues an `UPDATE` plus an `audit_logs`
   `INSERT` roughly every 0.5–2 seconds, indefinitely. **[V]**
3. **The Data Categories tab cannot record a data category.** Two of its four columns bind to
   columns that do not exist; the one that does exist (`category`) is hardcoded to the literal
   string `'New Category'` and is never displayed. **[V]**
4. **The Transfers tab cannot record a transfer.** The add-row default writes `'United States'`
   into `char(2)`; the safeguards column binds to a non-column; the vendor dropdown's options all
   carry `value={undefined}`. **[V]**
5. **The register cannot be shown to a regulator.** The module's own PDF omits controller identity,
   DPO, data subject categories, data categories, recipients and transfers. The better template
   exists — and is reachable only from the audit-archive module. **[V]**

Beneath the defects sits a structural problem that no bug fix addresses: **the data model is a
summary, not a register.** Article 30 is a many-to-many structure — purposes × subject categories ×
data categories × recipients × retention rules × bases × transfer routes. Custodia models it as one
flat row with a single lawful basis, one retention dropdown and a `jsonb` array of security
checkboxes. Every serious competitor made that mistake once and rebuilt.

*Sprint 1 rebuilt four of those seven axes — subject categories, data categories with their own
retention rules and Article 9(2)/10 conditions, recipients with categories and roles, and transfer
routes with mechanism-specific evidence. **Purposes are still not first-class** (A1), so an
activity still carries one lawful basis for everything it does. That is the remaining half of this
paragraph and it is the single largest thing left in the data model.*

### Scorecard

Scored as audited, before Sprint 0. Left as scored, because what the numbers say about how
the module was built is the part that outlives the patch. Sprint 0 moved only the tenancy row —
the rest were scored on capability and it built none. **Sprints 1, 2 and 3 built capability, so the
right-hand column below carries a later figure wherever it moves; the reasoning in each
line is the reasoning as audited, and the italic note says what has changed since.**

| Dimension | Score | One line |
|---|---|---|
| Article 30(1) field coverage | **3/10** → **7/10** → **9/10** | (b) and (g) present; (a) absent; (c) unwritable; (d) partial; (e) broken; (f) enum-only. *(c) to (f) writable and structured after Sprint 1; (a) is now in the record — controller, legal name, address, country, Art. 27 representative and DPO, with "None designated" printed where there is none. What holds it below 10 is A1: one lawful basis per activity, because purposes are still not first-class* |
| Article 30(2) processor record | **2/10** → **8/10** | Role captured, then ignored by both PDFs; the split keys on a column nothing writes. *The split now keys on declared **role**, consults both links (D16's join table first), and each section carries that client's own legal entity, address, representative, DPO and 30(2)(b) categories. A processor record with no controller recorded prints "Controller not recorded" rather than being hidden. Multiple controllers per activity is still one-to-one — N115* |
| Data model fidelity | **2/10** → **5/10** | One flat row per activity; no per-category retention, no purpose/basis pairs, no lineage. *Per-category retention, subject and element catalogues and structured transfers exist; purposes are still not first-class — A1* |
| Retention management | **1/10** → **8/10** | A six-option dropdown writing the word `custom`, a `retentionReviewDate` nothing read, and no trigger, disposal or hold model at all. *Schedules are org-level objects with a period, a trigger, a citation, a jurisdiction, an owner and a review cadence; disposal dates are computed, and the report distinguishes "no period recorded" from "the clock has not started"; the disposal log holds method, count, systems and evidence; legal holds suspend it and are evaluated rather than trusted. Nothing deletes anything — see §0.5. Below 10 because retention conflict detection (E53) and the statutory library per jurisdiction (E54) are unbuilt* |
| Special categories (Art. 9 / 10) | **2/10** → **8/10** | A boolean. No Art. 9(2)(a)–(j) condition; no Art. 10 concept at all. *Both now recorded per data category, with the national-law citation the four conditions that need it demand* |
| Chapter V transfers (44–49) | **1/10** → **7/10** → **8/10** | Tab non-functional; adequacy list wrong where it works; no DPF, no SCC metadata, no chaining. *Mechanism-specific evidence, DPF, computed adequacy and the repealed-2010-clauses warning arrived in Sprint 1; Sprint 3 adds the per-transfer TIA with the EDPB six steps, a supplementary-measures catalogue that knows which measures work alone, a suspension decision that propagates, and safeguard evidence rendered into the export. Onward-transfer chaining is still not there — H79* |
| Register operations (lifecycle, review, ownership) | **1/10** → **9/10** | No owner, no approval, no review cycle, no delete UI, no versioning. *All of it exists: owners, publication gate, review cycle with attestation, an approval workflow an organisation can make mandatory, versions that restore as well as diff, archive, duplicate and dependency-aware delete. The change-proposal model for approved records (M113) is the remaining shape* |
| Assessments (LIA / DPIA / TIA) | **2/10** → **8/10** | LIA table exists with zero procedures; DPIA has no route; TIA is per-vendor, not per-transfer. *All three built: the LIA's three-part test with a publication gate that reads it, an Art. 35(1) screening whose rationale is mandatory either way, a DPIA module at `/dpia` with the 35(7) structure, five templates, a 1–4 matrix, DPO advice, 35(9) consultation and hashed sign-off, and a TIA per transfer that refuses to complete when it contradicts itself. Missing: the Art. 6(4) compatibility assessment (F59) and the cross-assessment library with due dates and reminders (F61)* |
| Evidence and audit trail | **1/10** → **5/10** → **8/10** | History reads `newValue`/`details`; the columns are `changes`/`metadata`. Always empty. *Sprint 0 fixed the diff and the child-row logging; Sprint 2 dated and attributed every lifecycle act. Sprint 3 makes the trail readable: field labels rather than column names, values rendered as values, child-row edits filed against the record they belong to, filters by actor, field, type and date, keyset pagination, a CSV export, and a sha256 over every version so "unaltered since approval" can be checked rather than asserted. "Show me the register as at a date" (I91) and the hash-chained log (I92) are not there* |
| Exports and regulator readiness | **3/10** → **9/10** | Two divergent PDFs, neither an Article 30 record; CSV exports only loaded pages. *One canonical record now, built server-side and rendered five ways — PDF, XLSX with a sheet per object, CSV, an EDPB-shaped JSON, and CNIL/ICO/DSK/AEPD packs headed in the authority's own language. Every field the register holds reaches it, every export carries the negative assertions, and a filtered export says so on its cover. What holds it below 10 is J101: the document itself is English in every locale* |
| Search, filter, views | **1/10** → **8/10** | Client-side search over the loaded 25 rows. No filters at all. *Server-side search across the register and its children, seventeen filters, five sorts and saved views, shareable. The column chooser and grouping (K105) and audit mode (K106) are not there* |
| Bulk operations | **0/10** → **7/10** | Two buttons with no handlers, behind a selection UI that cannot select. *Selection works, including select-all-matching-filter rather than the loaded page, and carries owner, status, review date, tags, archive, delete and a server-side export. No undo, and no bulk publish — the Article 30 gate is a per-record judgement* |
| Population and discovery | **4/10** → **8/10** | 32 seeded templates and a genuinely good CSV importer; nothing else. *Sprint 4 adds delegated intake over a token, discovery from the vendor register, the tracker scan and connected SaaS on one upsert-and-resolve queue, and AI drafting where every field arrives with its reasoning and is accepted separately. What holds it below 10 is C38–C40: industry template packs still live only in onboarding, there is no importer for a competitor export, and nothing scans a database schema* |
| Cross-module automation | **3/10** → **7/10** | Re-consent detection and embeddings work; seven ROPA-adjacent jobs are dormant. *Material-change evaluation is generalised to every field that can be material and routes to three separable consequences; the register now produces the Art. 13/14 notice sections, a DSAR search scope and a breach blast radius; and webhooks fire — the reason they never had is in §0.5. What holds it below 10 is that the three outputs are served but not yet read by the DSAR and Breach modules on their own screens, and that P126–P129 are unbuilt* |
| Tenancy and data integrity | **4/10** → **8/10** | Ownership checks are excellent; one cross-tenant write; mass assignment on three mutations. *All fixed, and the guard extended to the class it could not see* |
| i18n | **4/10** → **9/10** | List and four tabs translated; five tabs hardcoded English. *All of it is extracted, including the ~110 enum labels and hints in `utils/ropaVocabularies.ts` that made every picker read in English regardless of locale, and `check:ropa-i18n` fails on a regression. The 34 shared route error boundaries are still English, app-wide* |
| Visual design and responsiveness | **8/10** | Genuinely good. Fast, clean, coherent — and the reason the defects are a surprise |

**What is genuinely good, and should be said before the register of failures:** the CSV importer's
refusal to guess a lawful basis; the Article 30(1)/30(2) role awareness in the Legal tab's copy; the
special-category auto-escalation to `requiresDpia`; the live vendor linkage in the Recipients tab
(DPA status, risk score, hosting location); the residual-risk cards in the DPIA tab; the
Claude-judged re-consent material-change detector, which no competitor ships; and the tenancy
hardening in `ropa.ts`, which is the most carefully built code in the module and carries comments
naming the bug each check prevents.

---

# PART I — What the module is today

## 1.1 Surface map

| Route | File | Type |
|---|---|---|
| `/{locale}/ropa` | `app/[locale]/(app)/ropa/page.tsx` | Client component, register list |
| `/{locale}/ropa/new` | `ropa/new/page.tsx` → `RopaEditor` (no `initialData`) | Create form, General tab only |
| `/{locale}/ropa/{id}` | `ropa/[id]/page.tsx` → `RopaEditor initialData` | Nine-tab editor |
| `/{locale}/ropa/{id}?tab=<id>` | `RopaEditor.tsx:66–71` | Deep link to a tab |
| `/{locale}/ropa/{id}?tab=dpia#risk-<uuid>` | `DpiaTab.tsx:170–186` | Deep link, scroll, 3s ring highlight |

Route-level `loading.tsx` and Sentry-reporting `error.tsx` exist at all three levels.

Entry points from elsewhere: sidebar group "Records" (first item); command palette (`Cmd+K`,
searches `ropa.list` by name over the first page only); dashboard `SetupProgress`; the audit
module's gap list; the compliance gap scanner's `resolutionUrl`; the AI copilot's remediation links;
the client detail page's "Processing Activities" tab. `Cmd/Ctrl+N` on `/ropa` opens `/ropa/new`.

**Not reachable anywhere:** there is no `/dpia` route in the application, no LIA route, no transfers
register, no data-category register, no recipient register. Those objects exist only inside one
activity's tab. **[V]**

## 1.2 The register list — `/ropa`

**Header.** Title *Records of Processing Activities*; Import CSV, Export CSV, Export PDF, and a gold
**New Activity** button.

**CSV import** (`utils/ropaImport.ts`) — the best-built thing in the module. Header aliasing for
eight logical fields (`lawful basis`, `legal basis`, `article 6 basis`, `on behalf of`, `capacity`…);
enum normalisation (`Legitimate Interests` → `legitimate_interest`, plural stripping); fatal errors
for an empty file, headers with no rows, or a missing name/purpose/basis; per-row rejection with
1-indexed line numbers surfaced in a dismissible panel listing *every* failed line; refusal to
default a lawful basis, with a comment explaining why; rejection of a `processor` row with no
controller, citing Article 30(2)(a). Round-trips losslessly with the exporter for those eight fields.

Limits: only eight fields import. No data categories, subject categories, recipients, transfers,
retention, security measures, DPO or owner. No dry run, no update-by-key (re-importing the same file
duplicates the register), no template download, no XLSX, no column-mapping UI.

**CSV export** — eight columns: Name, Purpose, Lawful Basis, Role, Controller, Status, Risk Level,
Description. It exports `data?.pages.flatMap(…)`, i.e. **only the pages the browser has loaded**, and
it does not filter soft-deleted rows.

**PDF export** — `export.generatePdf({ type: 'full_audit' })` → `ropaRecord.tsx`: a cover sheet, an
inventory table (activity, purpose, basis, status, risk) and per-activity cards (purpose,
description, basis, retention, security measures, status). `type: 'client_summary'` and `clientId`
are accepted by the input schema and have no effect.

**Re-consent triggers panel** — an amber card above the grid listing flags with the activity name,
detection date, the model's reasoning, "Review Activity" and "Dismiss". Tabs for Active/Dismissed.
Flags come from three places: the Claude worker (purpose-text material change), and unconditional
`high`-confidence inserts on recipient add (`ropa.ts:520–527`) and recipient removal (`:571–578`).
`reconsent_flags.status` allows `'campaign_launched'`; nothing in the codebase writes it. **[V]**

**The grid** — `packages/ui/src/DataGrid.tsx`, eight columns: Name · Purpose (truncated, no tooltip)
· Role (gold pill for controller/joint, grey for processor, with a "for {controller}" sub-line) ·
Lawful Basis (falls back to the hardcoded, untranslated `'Unspecified'`) · Status · Data Subjects
(first two + `+N`, amber "Not recorded" when empty) · Retention (amber warning pill when null — a
deliberate and correct choice, and the only completeness signal in the product) · Risk (severity pill
plus an Art. 9 shield icon when `involvesSpecialCategories`).

Sort and search are client-side over the loaded rows only. There is no server-side search, no filter
chips, no faceted filtering, no saved views, no column chooser, no row count.

## 1.3 Create flow — `/ropa/new`

`RopaEditor` with `initialData = null`; the tab bar is hidden and only General renders.

| Control | Persisted? |
|---|---|
| Activity Name * | yes |
| Purpose of Processing * | yes |
| Description | yes |
| Status | **no — not in `ropa.create`'s input, silently dropped** |
| Risk Level | **no — silently dropped** |
| Systematic Monitoring | **no — silently dropped** |
| Client assignment | hidden on create (`!isNew` guard) |

`lawfulBasis` is not on this form — the Legal tab is gated behind `!isNew` — and `ropa.create`
accepts `lawfulBasis: z.string()` with no `.min(1)` (`ropa.ts:86–94`). **Every activity created
through the UI is created with an empty Article 6 basis.** The importer refuses to do this; the
primary create path does it by default. **[V]**

## 1.4 The editor — nine tabs

Sticky header: back arrow, name, status pill, autosave indicator (Saving… / Saved / Error saving),
and a **"Help me fill this in"** button opening the AI guidance panel. Four tabs autosave
(`general`, `legal`, `retention`, `security`); five manage their own persistence.

**1 · General.** Name, purpose, description, client assignment (a switch list of up to 100 clients
writing `client_processing_activities`), status, risk level, systematic-monitoring toggle. Plus a
regulatory-impact banner with an Acknowledge action.

**2 · Legal Basis.** Role (controller / joint controller / processor) with a hint explaining that
Art. 30(1) and 30(2) require different records — the best copy in the module. Conditional
"Controller you act for" when role = processor, citing Art. 30(2)(a). All six Art. 6(1) bases, each
labelled with its sub-article. When `legitimate_interest` is chosen, an amber panel demands an LIA
and offers a **"Start / View LIA" button with no `onClick`** (`RopaEditor.tsx:569–571`). **[V]**
No Art. 9(2) condition, no Art. 10, no Art. 6(4) compatibility test, no `lawfulBasisDetail` UI.

**3 · Data Categories.** A grid: Category Type · Source · Retention Period · Special Category ·
delete. `categoryType` and `retentionPeriod` are not columns (D5). Only Source and the checkbox
function. The checkbox is significant: ticking it sets `requiresDpia`, `involvesSpecialCategories`
and `riskLevel: 'high'` on the parent and queues a "DPIA required" notification deep-linking to
`?tab=dpia`; unticking the last one reverses all three and forces `riskLevel` back to `'medium'`,
destroying whatever the user had set (`ropa.ts:385`, `:422`). **[V]**

**4 · Recipients.** Two add paths — link an existing vendor, or add a free-text "other recipient".
Read-only columns pulled live from the vendor register: DPA Status, Vendor Risk (level + score),
Data Processing Locations (HQ country, gold "(EU)" when EU hosting). Vendor names link to
`/vendors/{id}`. On vendor link, a draft transfer is auto-created when the vendor's HQ is outside a
hardcoded 27-member `EU_COUNTRIES` array (`ropa.ts:493`) and EU hosting is false, with
`transferMechanism: 'pending_assessment'` — a value the Transfers select cannot render. **[V]**
This tab is the module's best cross-linking and the one place it beats a spreadsheet outright.

**5 · Transfers.** Destination Country (free text) · Transfer Mechanism (SCCs / Adequacy / BCRs /
Derogation Art. 49 / Other) · Supplementary Safeguards (free text) · Vendor (Data Importer) · TIA
Status · delete. Three of six columns are broken (D6, D7, D8). The two that work are the mechanism
select and delete. The mechanism column holds two vocabularies at once: English display strings from
the UI and the code `'pending_assessment'` from automation, which `regulatoryImpact.ts:61` then
matches by exact value.

**6 · Retention.** A seven-item dropdown (6 months / 1 year / 3 years / 5 years / duration of
contract / indefinite / **Custom**). Selecting Custom stores the literal string `custom` and renders
no free-text field. Values are stored as raw enum keys, so the list, the CSV and both PDFs print
`6_months` and `duration_of_contract`. Justification and Deletion Procedure are free text; Next
Review Date writes `retentionReviewDate`, which **nothing in the codebase reads**. **[V]**

**7 · Security.** Eight toggles writing string ids into a `jsonb` array, plus a free-text detail
field. No Art. 32(1)(a)–(d) mapping, no technical/organisational split, no per-measure owner,
evidence, implementation date or test date, no certification mapping.

**8 · DPIA** — `DpiaTab.tsx`, 805 lines, the largest component in the module and the only DPIA
interface in the product. The empty state offers "Create New DPIA" (titled literally
`"New DPIA for Activity"`) or links an existing one. The populated state shows a header card with a
**"View Full DPIA" button with no `onClick`**, pointing at a route that does not exist
(`DpiaTab.tsx:397–399`); a High Risk Vendor banner that can never render (D11); a read-only Initial
Risk grid whose `+` inserts `'New Risk Identified'`, L3/S3 and cannot be edited (D18); and the
**Residual Risks & Mitigations** cards, which are the one genuinely well-built surface here —
vendor-name auto-detection, risk category, an expandable vendor risk-profile card, likelihood ×
severity into a documented 3×3 matrix, mitigation owner, due date, three-state status, debounced
autosave and hash deep-linking. **[V]**

**9 · History.** A timeline of `audit_logs` filtered by `resourceId = activityId`, with a "View
Diff" chip on `ropa.update` rows. The diff never renders (D12), and child-table changes never appear
at all (D13).

## 1.5 Data model — what is reachable

`processing_activities` has 36 columns. **Fourteen have no UI control**, and eight of those are
written by nothing anywhere in the codebase: `liaId`, `specialCategories`, `involvesChildren`,
`lastReviewedAt`, `nextReviewAt`, `reviewedBy`, `previousVersionId`, `clientId`. **[V]**

| Column | Written by | Editable | Read by |
|---|---|---|---|
| `lawfulBasisDetail` | templates only | no | nothing |
| `liaId` | **nothing** | no | nothing |
| `dataSubjectCategories` | templates only | **no UI** | list column, register PDF, ZIP CSV |
| `estimatedDataSubjects` | templates only | no | nothing |
| `processingType` | templates only | no | nothing |
| `isSystematicMonitoring` | autosave (dropped on create) | yes | **nothing** — not even the DPIA trigger it exists for |
| `specialCategories` | **nothing** | no | nothing |
| `involvesChildren` | **nothing** | no | nothing |
| `retentionReviewDate` | autosave | yes | **nothing** |
| `lastReviewedAt` / `nextReviewAt` / `reviewedBy` | **nothing** | no | nothing |
| `version` / `previousVersionId` | default `1` only | no | nothing |
| `clientId` | **nothing** | no | **`auditExport.ts:146` — the entire Art. 30(2) split** |
| `deletedAt` | `ropa.delete` (no UI calls it) | no | `auditExport`, `scoring` — **not `list`** |

Two of these (`dataSubjectCategories`, `retentionReviewDate`) are shown to the user as things the
register tracks. One (`clientId`) silently decides whether the Article 30(2) section of the audit
pack is ever populated.

Client-side zod fields with **no database column at all**: `isLargeScale`,
`isAutomatedDecisionMaking`, `retentionSchedule`, `securityNotes`, `lawfulBasisNotes`
(`RopaEditor.tsx:40–57`). They are sent on every autosave and silently dropped by Drizzle. **[V]**

Child tables: `processing_data_categories` (10 columns, 2 reachable), `processing_recipients`
(`purpose` unreachable, no edit path), `processing_transfers` (`mechanismDetail`,
`supplementaryMeasures`, `tiaRequired`, `tiaDocumentId` all unreachable),
`legitimate_interest_assessments` (19 columns, **entirely unreachable**). None of the three child
tables carries `organization_id`, so every read must walk the parent to prove tenancy — correct as
built, but it also means no org-wide query over categories, recipients or transfers is possible
without a join, and there is no fast path to an organisation-wide data map.

## 1.6 Server surface — `ropa.ts`

`list` · `countActive` · `get` · `create` · `bulkCreate` · `update` · `delete` · `history.list` ·
`dataCategories.{list,create,update,delete}` · `recipients.{…}` · `transfers.{…}`.

Tenancy hygiene is genuinely good: every child procedure walks to `processing_activities` and
asserts ownership via `assertOwned`/`assertParentOwned`, with comments naming the bug each check
prevents. This is the part of the module built by someone who had been burned and learned.

Missing: `archive`, `restore`, `duplicate`, `bulkUpdate`, `bulkDelete`, `submitForApproval`,
`approve`, `markReviewed`, `search`, `completeness`, `snapshot`, `versions`, `compare`,
`assignOwner`, `comment`, `attach`, anything LIA.

## 1.7 Outputs

| Output | Content | Verdict |
|---|---|---|
| List CSV | 8 fields, loaded pages only, includes soft-deleted | Not an Art. 30 record |
| `ropa-record` PDF (this module's Export PDF) | 6 fields per activity; no controller identity, no categories, recipients or transfers | **Not an Art. 30 record** |
| `ropa-register` PDF (audit ZIP) | Controller identity + DPO, Art. 30(1) table with categories/subjects/recipients/transfers/retention, Art. 30(2) per-client sections | **Closest to correct — and unreachable from this module** |
| Audit-ZIP CSV | 10 fields including categories and recipients | Better than the module's own export |
| JSON export (`workers/dataExport.ts`) | Raw rows | Unfiltered by `deletedAt` |

The two Article 30 PDFs disagree about what an Article 30 record is, and the better one belongs to a
different module. Neither is filterable, versioned, hash-stamped or archived as a point-in-time
snapshot.

*Superseded by Sprint 3 (J93–J99). Every row of that table is gone. `ropaRecord.tsx` is
deleted, and there is one Article 30 record — built server-side by `lib/ropaArticle30.ts`
and rendered as PDF, XLSX, CSV, an EDPB-shaped JSON and four regulator template packs,
all from the same dataset, all filterable through the register's own filter schema, and
all carrying the negative assertions that make an empty column mean something. Versions
are hash-stamped (I90). The audit ZIP now appends the same document rather than a second
opinion about it. What the table's last sentence still names correctly is the archive: a
point-in-time export is a version snapshot, not an export artefact, and I91's "show me the
register as at <date>" is not built.*

## 1.8 Cross-module wiring — intended versus actual

| Intended link | Actual state |
|---|---|
| Vendors → Recipients | Works. Live DPA status, risk score, location |
| Vendors → auto-transfer creation | Works, against a wrong adequacy list (D17) |
| Vendor TIA → transfer TIA status | **Cross-tenant write** (D3) *— scoped in Sprint 0; superseded in Sprint 3 by a TIA that hangs off the transfer, so no vendor-keyed write remains* |
| Activity → DPIA | One-way link; the DPIA has no route of its own *— `/dpia` exists (F57), and a screening opens one with its risks pre-populated* |
| Activity → LIA | A button with no handler; zero procedures *— built (F55); `lia_id` is written, and the completeness scorer reads the assessment* |
| Activity → privacy policy | `policy-ropa-sync` exists, is dormant, and feeds the model only name/purpose/basis |
| Activity → DSAR fulfilment | No link. A DSAR cannot be scoped by the register |
| Activity → breach assessment | No link. A breach cannot inherit categories or subjects |
| Activity → consent records | Re-consent flags only; no consent-purpose mapping |
| Activity → clients | The join table is written; `clientId`, which the audit PDF reads, is not (D16) |
| Activity → regulatory updates | UI banner present; all `impact-assessment:*` jobs dormant |
| Activity → compliance score | 23% weight, two fields checked (D19) |
| Activity → webhooks | Three events advertised; the map file has **zero importers** (D39) |
| Activity → public API | `// Future: fastify.register(ropaRoutes…)` |

## 1.9 Automation

| Job | Dormant? | Effect |
|---|---|---|
| `evaluate-material-change` | Live | Claude-judged re-consent flags on purpose changes |
| `embed-ropa` | Live | RAG index for the copilot |
| `compliance` gap scan | Live | One ROPA rule: `missing_dpia` |
| `policy-ropa-sync` | **Dormant** | Would draft policy updates |
| `impact-assessment:*` (5 jobs) | **Dormant** | The editor's regulatory-impact banner has no data source in production |
| `dpia-mitigation-reminder-checker` | **Dormant** | Mitigation due dates remind nobody |

The re-consent debounce comment at `ropa.ts:218` describes "a Redis-based debounce trick" using
`jobId`. There is no Redis, and `translateJobOptions` does not map `jobId` — pg-boss dedupe is
`singletonKey`. The debounce does nothing. **[C]**

---

# PART II — Verified defect register

Defect IDs are inherited from the model2 audit so the two documents cross-reference; items it did
not carry are numbered from D74. Each entry gives the symptom, the location, the mechanism, and a
confidence mark. Ranked by what would end a deal fastest.

## P0 — data integrity, cross-tenant, or "the feature does not work"

**D3 · Cross-tenant TIA write. The most serious finding in this audit.** **[FIXED — `a8bef40`]** **[V]**
`tia.ts:92` and `:115`:
`update(processingTransfers).set({ tiaCompleted: true, tiaRiskLevel }).where(eq(processingTransfers.vendorId, input.vendorId))`
— no organisation predicate. `vendors` is a *shared* catalogue, so `vendorId` is not tenant-specific.
When Org A completes a TIA for AWS, every other tenant's AWS transfer row flips to
"TIA: Completed", and to "Suspended" if Org A concluded suspend. A customer's Chapter V evidence is
then fabricated from a stranger's assessment. Note that the surrounding code gets this right — the
`transferImpactAssessments` update and the `organizationVendors` update both carry
`eq(…organizationId, ctx.user!.orgId)`. Only the propagation to `processing_transfers` was left
unscoped. `check:tenancy` cannot see it because it audits client-supplied ids on reads, not
unscoped writes through a shared-catalogue foreign key.
*Fix: Scoped through the parent activity; `check:tenancy` gained a per-statement pass that reproduces this exact shape.*

**D1 · Infinite autosave write loop.** **[FIXED — `cee40c1`]** **[V]** `RopaEditor.tsx:217–237`. The effect's dependencies
are `[formData, activeTab]`, where `formData = watch()` (line 93) returns a **new object on every
render**. The effect body calls `setSaveStatus('saving')`, the save calls `setSaveStatus('saved')`
then `setSaveStatus('idle')` on a 2s timer, and `onSettled` invalidates `ropa.get` — whose refetch
replaces `initialData` and triggers another render. Every one of those renders re-arms the 500 ms
timer. An activity left open on General, Legal, Retention or Security issues an
`UPDATE processing_activities` plus an `audit_logs` `INSERT` every 0.5–2 seconds, per open tab,
indefinitely. Consequences: audit-log growth measured in rows per second; `updatedAt` churn that
re-sorts a register sorted `updatedAt desc` by who last *looked* at a record; wasted CPU on a
512 MB container that also runs Chromium; and spurious `CONFLICT` → "Error saving" whenever a save
fires with an `initialData.updatedAt` that the previous save has already superseded.
*Fix: The effect depends on the serialised values, not `watch()`'s object identity, with the baseline captured on the first render.*

**D5 · The Data Categories tab cannot record a data category.** **[FIXED — `3b80a4c`]** **[V] mechanism, [S] runtime**
`DataCategoriesTab.tsx:70` binds `accessorKey: 'categoryType'` and `:79` binds `'retentionPeriod'`;
`processing_data_categories` (`schema.ts:343–358`) has `category`, `categoryGroup`, `description`,
`source`, `sourceDetail`, `isSpecialCategory` and neither of those. Both cells therefore render
permanently blank. Editing either sends `{ categoryType: … }` as the whole `data` payload;
`ropa.ts:346` does `.set(input.data)` with **no** `updatedAt` merged in, so the set object contains
no real column, `buildUpdateSet` emits an empty SET clause, and Postgres rejects the statement.
Meanwhile `category` — the one thing Article 30(1)(c) asks for — is hardcoded to `'New Category'`
at `DataCategoriesTab.tsx:22` and is not displayed or editable anywhere in the product.
*Fix: `category` is the first column and editable; `retentionPeriod` dropped until a column exists. Child `.set()` calls gained `updatedAt`, so a payload that strips to `{}` is a no-op rather than a syntax error.*

**D6 · Transfers "Add Row" always fails.** **[FIXED — `3b80a4c`]** **[V] mechanism, [S] runtime**
`TransfersTab.tsx:28` sends `destinationCountry: 'United States'` into
`char('destination_country', { length: 2 })` (`schema.ts:377`) → Postgres `22001`, value too long.
`transfers.create`'s input is `destinationCountry: z.string()`, unbounded, so nothing catches it
first. The auto-create path is unaffected because it writes `hq.substring(0, 2)`.
*Fix: Destination country is a picker over ISO-3166 alpha-2, and the create input is bounded to `length(2)`.*

**D7 · "Supplementary Safeguards" writes nowhere and errors on edit.** **[FIXED — `3b80a4c`]** **[V]**
The column binds to `safeguards`; the table has `mechanismDetail` and `supplementaryMeasures`.
`transfers.create`'s input schema *accepts* `safeguards: z.string().optional()` (`ropa.ts:600`) and
Drizzle drops it on insert. On inline edit it is the only key in `data` → empty SET → SQL error, as
in D5. The real column, `supplementaryMeasures` (jsonb), is untouched by any UI.
*Fix: Rebound to `mechanismDetail` and relabelled. `supplementaryMeasures` stays unreachable — see H78.*

**D8 · The "Vendor (Data Importer)" dropdown is inert.** **[FIXED — `3b80a4c`]** **[V]**
`TransfersTab.tsx:104` renders `<SelectItem key={ov.vendorId} value={ov.vendorId}>`, but
`vendors.getOrgVendors` (`vendors.ts:236–250`) returns the vendor row spread (so, `id`) merged with
`orgVendorId`, `dpaStatus`, `riskLevel` … and **no `vendorId` key**. Every option's value and key are
`undefined`. Because the TIA status cell keys off `transfer.vendorId`, the entire TIA column is
unreachable for any manually created transfer.
*Fix: Keyed on `id`. This also brings back the TIA status column for hand-created transfers.*

**D9 · Every UI-created activity has an empty lawful basis.** **[FIXED — `82b34b0`]** **[V]** See §1.3. `lawful_basis` is
`NOT NULL`, and `''` satisfies it. The register then renders the untranslated string `'Unspecified'`.
*Fix: `lawfulBasis` takes `.min(1)` and the create form collects it, since the Legal tab is gated behind `!isNew`.*

**D10 · Three create-form controls are silently discarded.** **[FIXED — `82b34b0`]** **[V]** Status, Risk Level and
Systematic Monitoring render on `/ropa/new` and are absent from `ropa.create`'s input schema
(`ropa.ts:86–94`). Zod strips them without error. A user who creates an activity as Active/Critical
gets Draft/Low.
*Fix: All three added to the input schema and written on insert.*

**D11 · The High Risk Vendor banner can never render.** **[FIXED — `82b34b0`]** **[V]** `DpiaTab.tsx:277` does
`orgVendors.find(v => v.orgVendorId === r.vendorId)` — an `organization_vendors` row id compared
against a catalogue `vendors.id`. Two different id spaces. The banner, and its "Document Risk"
one-click pre-fill, are dead code.
*Fix: Compares against the catalogue `id`. `relatedVendorId` stays keyed on `orgVendorId`, which the rest of the tab uses.*

**D12 · The History diff is always empty.** **[FIXED — `82b34b0`]** **[V]** `HistoryTab.tsx:97` reads
`(log as any).newValue || (log as any).details`; the columns are `changes` and `metadata`
(`schema.ts:925–926`). Both reads are `undefined`, the render guard fails, and "View Diff" expands
an empty box. Even with the field names fixed the payload would be useless:
`calculateDiff(previousState, rawInput)` diffs a `processing_activities` row against
`{ id, updatedAt, data: {…} }`, producing `{ data: { old: null, new: <entire payload> } }` on every
save.
*Fix: Both ends: the tab reads `changes`, and the middleware diffs against `input.data` rather than the whole envelope.*

**D13 · Child-row changes are absent from the audit trail.** **[FIXED — `82b34b0`]** **[V]** `extractResourceId`
(`auditLogger.ts:142–152`) recognises `id`, `ropaId`, `vendorId`, `dsarId`, `breachId`, `policyId`,
`domainId` — not `processingActivityId`. So `ropa.dataCategories.create` logs `resourceId: null`,
and child updates and deletes log against the child row's own id. Neither appears in the activity's
History tab. Article 5(2) accountability for the majority of an activity's content is unevidenced.
Related: `ACTION_DESCRIPTIONS` defines `ropa.dataCategories.add` and `ropa.recipients.add`; the real
paths end in `.create`, so the log reads "Performed ropa → dataCategories → create".
*Fix: `processingActivityId` is recognised, ahead of `vendorId` because a recipient create carries both. `ACTION_DESCRIPTIONS` rekeyed to the real `.create` paths.*

**D4 · Soft-deleted activities stay in the register.** **[FIXED — `82b34b0`]** **[V]** `ropa.delete` sets `deletedAt`;
`ropa.list` calls `paginatedQuery` with no `deletedAt` handling and no `additionalWhere`. Deleted
activities remain in the list, the CSV export, `export.generatePdf`, the portal and the JSON export.
`auditExport` and `scoring` *do* filter, so the audit pack and the compliance score disagree with
what is on screen.
*Fix: `list` passes `isNull(deletedAt)` through `additionalWhere`.*

**D2 · Mass assignment on three mutations.** **[FIXED — `a8bef40`]** **[V]** `ropa.ts:169` accepts `data: z.record(z.any())`
and spreads it into `.set()`. Ownership of the current row is checked; the *contents* are not. A
caller with `ropa:edit` can set `organizationId` (moving a record into another tenant), `createdBy`,
`deletedAt`, `dpiaId` or `liaId` pointing at another org's assessment, `clientId`, `version`,
`requiresDpia`, or any status/risk string the UI cannot represent. Same pattern at `ropa.ts:335`
(data categories) and `:535` (transfers). The tenancy guard cannot see this class: the filter is
correct, the payload is the problem.
*Fix: Four, not three — transfers at `:613` was missed and `:535` is recipients, not transfers. All four take explicit per-field schemas; unknown keys strip rather than reject, because the editor autosaves `watch()` wholesale and `.strict()` would 400 every save. `dpiaId` proves ownership.*

**D16 · The Article 30(2) processor record is always empty.** **[V]** `auditExport.ts:146` splits
controller from processor records on `a.clientId`. **Nothing in the codebase writes
`processing_activities.clientId`** — client assignment writes `client_processing_activities`
(`clients.ts:183`, `:209`). So the audit pack tells every agency "no processing is carried out on
behalf of another controller" regardless of assignments, and regardless of `role='processor'`, which
both PDF templates ignore entirely. Agencies are Custodia's stated core segment.

**D17 · Wrong adequacy test on auto-created transfers.** **[FIXED — `82b34b0`]** **[V]** `ropa.ts:493` hardcodes the 27 EU
member states. `constants/transferDestinations.ts` in the same repository has a correct
`isAdequateDestination()` covering the EEA plus fifteen adequacy decisions, and `onboarding.ts:1020`
already uses it. Linking a vendor in NO, IS, LI, GB, CH, JP, KR, CA, NZ, IL, AR, UY, AD, FO, GG, IM
or JE fabricates a Chapter V transfer requiring SCCs.
*Fix: Uses `isAdequateDestination`, with a standalone `tsx` fixture suite wired into `npm run check`.*

**D18 · Initial DPIA risks cannot be edited.** **[FIXED — `e970ea3`]** **[V]** `DpiaTab.tsx:217–225` inserts
`description: 'New Risk Identified'`, L3, S3, and the grid is rendered with plain `accessorKey`
columns and no `onInlineEdit`. Every initial risk in the system reads "New Risk Identified / 3 / 3 /
9", and there is no other DPIA interface anywhere in the product.
*Fix: Description, likelihood and severity are editable and rows deletable; `dpia.risks.update` now recomputes `initialRiskScore`, which its own comment promised and the code never did.*

**D15 · Onboarding templates write values the editor cannot represent.** **[FIXED — `e970ea3`]** **[V]** Ten of the seeded
templates use `lawfulBasis: 'legitimate_interests'` (plural) against a UI enum of
`legitimate_interest` — the Select renders empty and the LIA prompt never appears. All of them write
prose `retentionPeriod` values ("Duration of employment + 6 years", "7 years (statutory requirement
for tax audit purposes)") that are not in the seven-item dropdown, so the control renders empty and
any interaction replaces a good answer with `5_years`.
*Fix: Templates corrected at source and the editor normalises on read, so seeded rows display and heal on their next save. The prose retention values are now representable — see D14.*

## P1 — no compliance professional would use this

**D28 · "Start / View LIA" is a dead button, and there is no LIA.** **[FIXED — `e970ea3`]** **[V]**
`legitimate_interest_assessments` carries the complete three-part test (purpose, necessity,
balancing), outcome, assessor and review date, is imported into `ropa.ts:6`, and has **zero
procedures**. `processing_activities.liaId` waits for a value nothing writes. Legitimate interests is
the second-most-used basis in commercial processing, and the module prompts for an assessment it
cannot deliver.
*Fix: Removed. The amber panel's advice is correct and stays; building the LIA is F55.*

**D29 · "View Full DPIA" is a dead button to a route that does not exist.** **[FIXED — `e970ea3`]** **[V]**
*Fix: Removed. Giving a DPIA its own route is F57.*

**D27 · Bulk actions are two dead buttons behind a selection UI that cannot select.** **[FIXED — `e970ea3`]** **[V]**
`DataGrid.tsx:130–135` renders Export and Actions with no `onClick`, and no checkbox/selection column
is defined in the ROPA columns array or injected by the grid, so `rowSelection` never populates and
the buttons never appear at all. Inert twice over.
*Fix: Removed from `DataGrid`, along with the `enableBulkActions` prop. Real bulk operations are L107/L108.*

**D25 · No delete or archive from the UI.** **[V]** `ropa.delete` exists behind a permission and is
called by nothing. The only removal path is setting `status: 'archived'`, which the list does not
filter on.

**D30 · Data subject categories are displayed and not editable.** **[V]** The register shows the
column, warns "Not recorded", and provides no control anywhere. Only onboarding templates populate
it. This is the first limb of Article 30(1)(c).

**D46 · The editor's zod validation never runs.** **[V]** `handleSubmit` is destructured at
`RopaEditor.tsx:72` and never called; react-hook-form's default mode is `onSubmit`. `errors` never
populates, `<FieldError>` never renders, and `purpose.min(10)` is never enforced. This is also why
D-class field mismatches do *not* cause client-side stripping — see the correction to model3 in
Appendix A.

**D47 · Required-field asterisks are lies.** **[V]** Purpose, Lawful Basis, Retention Period and
Retention Justification are marked `*`. None is enforced. An activity can be Active with none of
them.

**D45 · Optimistic locking is decorative and occasionally harmful.** **[FIXED — `cee40c1`]** **[V]** The lock compares
`initialData.updatedAt`, which is refreshed only by the `onSettled` invalidation of `ropa.get`. The
autosave loop can fire a save before that refetch lands, producing a `CONFLICT` and the message
"The record was updated by someone else. Please reload." on a record nobody else touched — with no
merge, no diff, and no protection for the user's typing.
*Fix: The lock compares against the `updatedAt` the save returned, not the one on the prop.*

**D19 · The ROPA pillar of the compliance score is nearly blind.** **[V]** `scoring.ts:114–128`
scores only `!lawfulBasis` and `!purpose`, over `status === 'active'` rows. 23% of the headline
number cannot detect a register with no retention periods, no data subject categories, no
recipients and no transfers documented.

**D20 · `retentionReviewDate` is write-only.** **[V]** Zero readers. No reminder, no overdue list,
no notification, no dashboard tile.

**D21 · No review cycle at all.** **[V]** `lastReviewedAt`, `nextReviewAt` and `reviewedBy` are
unwritten and unread. A register with no attestation cycle cannot answer "when was this last
confirmed accurate?" — the first question in an Article 30(4) request and in every ISO 27701 audit.

**D22 · No versioning or point-in-time snapshot.** **[V]** `version` stays 1; `previousVersionId` is
never written. You cannot show a regulator what the register said on the day of an incident.

**D23 · No approval workflow.** Anyone with `ropa:edit` changes a live Article 30 record instantly.
No maker-checker, no sign-off record, no "who approved this and when".

**D24 · No owner or accountable person per activity.** No business owner, no process owner, no
department, no legal entity, no DPO assignment. A 200-activity register with no owners cannot be
maintained; this is the single most common reason ROPA programmes die.

**D26 · Search and sort are client-side over the loaded page.** **[V]** No server-side search, and
no status/role/basis/risk/retention/owner/client filters at all. Beyond roughly fifty activities the
register becomes unusable — searching "payroll" in a 300-activity register returns nothing unless
payroll is in the first 25 rows by `updatedAt`.

**D31 · Five of nine tabs are hardcoded English.** **[V]** Data Categories, Recipients, Transfers,
DPIA and History contain no `useTranslations` call. `check:messages` validates key parity, not string
extraction, so this passes CI. German and French customers — the two locales the product ships — see
English across the majority of the module.

**D32 · The special-category tick silently overwrites a manual risk assessment.** **[V]**
`ropa.ts:314` and `:357` force `riskLevel: 'high'`; removal forces `'medium'` (`:385`, `:422`),
discarding whatever the user set. It also clears `requiresDpia`, so a DPIA required for automated
decision-making or systematic monitoring is silently un-required by editing an unrelated field.

**D33 · Re-consent flags have no dedupe and no campaign.** **[V]** Every recipient add or remove on
a consent-based activity inserts a fresh `high`-confidence flag with near-identical text. Adding
four vendors produces four flags. `status = 'campaign_launched'` exists in the schema and is written
by nothing; Dismiss is the only available action.

**D74 · The re-consent worker's scope is far narrower than material-change law.** **[C]** Only
*purpose text* changes on consent-based activities are evaluated. Changing the lawful basis to or
from consent, adding data categories, changing retention, or changing transfers — all capable of
being material under Arts. 5(1)(b), 13(3) and 14(4) — produce no evaluation at all.

**D34 · The editor's regulatory-impact banner has no data source in production.** All five
`impact-assessment:*` jobs are in `DORMANT_JOBS`, as is the regulatory scraper. The module's
headline differentiator is switched off. **[C]**

**D35 · CSV export exports only what the browser has loaded.** **[V]** No warning, no server-side
export, no "exporting 25 of 312". A DPO exporting for a regulator gets a truncated register with no
indication of it.

**D37 · The primary PDF is not an Article 30 record.** **[V]** No controller legal name, address or
contact; no DPO; no representative; no data subject categories; no data categories; no recipients;
no transfers. It is a six-column summary with a cover page that says "Article 30 GDPR".

**D36 · `export.generatePdf`'s `client_summary` type and `clientId` input do nothing.** **[V]** The
comment at `export.ts:33` says "assuming we add a where clause if needed"; no clause was added.

**D38 · Enum values are printed raw to users and regulators.** `6_months`, `duration_of_contract`,
`under_review`, `legitimate_interest` appear unformatted in the list, the CSV and both PDFs. The
list's `'Unspecified'` fallback is hardcoded English.

**D39 · Three webhook events are advertised and never fired.** **[V]** `webhooks.ts:18–20` offers
`ropa.created`, `ropa.updated` and `ropa.deleted` for subscription;
`constants/webhookEventMap.ts` maps the tRPC paths to them; and **nothing in the codebase imports
that file** — a repository-wide search for `TRPC_PATH_TO_EVENT` and for the module path returns no
importers. Customers can subscribe to events that will never arrive.

**D40 · No public API for the register.** `routes/v1/index.ts:13` — `// Future:
fastify.register(ropaRoutes…)`. Vendors have a v1 API; the register does not.

**D41 · Vendor pickers cap at 100.** `getOrgVendors({ limit: 100 })` in Recipients, Transfers and
DPIA, with no search-as-you-type. Organisations with more than 100 vendors — the exact profile that
pays for Enterprise — cannot link the 101st.

**D42 · `processing_recipients.purpose` is accepted and never shown.** **[V]** The column exists, the
create input accepts it, and no interface reads or writes it.

**D43 · The transfer mechanism column holds two vocabularies.** **[V]** English display strings from
the UI and codes from automation, in one `varchar(100)`, matched by exact value at
`regulatoryImpact.ts:61`.

**D44 · TIAs are per-vendor, not per-transfer.** One vendor used for HR data in Germany and marketing
data in the US shares a single assessment, shown as "Completed" against both.

**D14 · "Custom" retention writes the word `custom`.** **[FIXED — `e970ea3`]** **[V]** No free-text field is rendered.
*Fix: Custom renders a text field, and any value that is not one of the six presets resolves back to Custom with its text intact.*

**D48 · `enforceLimit` for `ropa` is `Infinity` on every tier including free.** `billing.ts:8–13`.
Either the register is unlimited on the free plan by design, or the limits table was never filled in.

**D49 · `bulkCreate` enqueues one embedding job per row in a serial `await` loop.** **[V]** A 500-row
import makes 500 sequential `boss.send` calls inside the request.

**D50 · Accessibility.** Rows are clickable `<tr>` elements with no `role="button"`, `tabIndex` or
keyboard activation, so the register cannot be navigated by keyboard. Tabs are `<button>`s without
`role="tab"` / `aria-selected` / arrow-key handling. Labels are not associated via `htmlFor`. Colour
is the sole carrier of meaning in the risk, status, DPA and TIA pills. Grid inline-edit inputs have
no accessible name. **[C]**

**D75 · There are no tests for this module.** `reconsent.test.ts` is a vitest file, and vitest is
installed in `apps/web` only — per this repository's own working notes it has never run here. A
standalone `tsx` fixture suite over the importer, the retention formatter, the adequacy test and the
residual-risk matrix would have caught at least eight of the defects above. **[C]**

## P2 — rough edges that erode trust

**D51** Autosave has no failure recovery; a failed save shows "Error saving" and nothing is queued
or persisted locally. · **D52** No unsaved-changes guard on the create form. · **D54**
`handleClientToggle` fires a mutation per toggle with no debounce and no error handling; a failed
call leaves the switch on. · **D55** Every DPIA is titled `"New DPIA for Activity"`, making the
"Link Existing DPIA" list unusable. · **D56** `matchVendorFromDescription` builds a `RegExp` per
vendor per keystroke per risk card. · **D57** `ropa.list` selects every column, including large
`jsonb`, for a table view that uses eight. · **D58** No index on `(organization_id, status)`,
`(organization_id, updated_at)` or `deleted_at`; the register's own sort key is unindexed. · **D59**
`processing_recipients.vendor_id` and `processing_transfers.vendor_id` have no foreign key. ·
**D60** No unique constraint on `(processing_activity_id, vendor_id)` for transfers; the auto-create
path checks in application code, which races. · **D61** `reconsent_flags` has no dedupe key and no
`(organization_id, status)` index. · **D62** The History timeline has no pagination — an activity
left open in the D1 loop for an hour renders thousands of nodes. · **D63** **[FIXED — `e970ea3`]** History action labels are
a `switch` over three strings; everything else renders its raw tRPC path. *(Fixed: the
timeline renders the server's description, which `ACTION_DESCRIPTIONS` now generates for
every child path.)* · **D64** "TOMs",
"Organizational", `pseudonymization`, `anonymization` use US spelling against the repository's
stated British-English house style. · **D65** The Legal tab nests Role and Controller *inside* the
Lawful Basis label block, so the hierarchy implies role is part of Article 6. · **D66**
`bg-white/50` on the security and monitoring toggle rows is a light-theme leftover on a dark
surface. · **D67** `text-clay-600`, `bg-ink-900`, `border-ink-900/8` sit alongside the documented
hex palette. · **D68** `text-amber-950` on `bg-amber-500/10` in the DPIA banner is near-invisible on
dark. · **D70** No breadcrumb; the back arrow always returns to `/ropa`, losing search, scroll and
loaded pages. · **D71** No deep link to a specific data category, recipient or transfer. · **D72**
No print stylesheet. · **D73** No relation between an activity and any uploaded document —
`processing_transfers.tiaDocumentId` references `documents` and is unreachable. · **D76**
`destinationEntity` is written only by the auto-create path, as `vendor.name`, and is rendered
nowhere. · **D77** The AI panel's apply callback handles `lawfulBasis` and `retention` only; for
`dataCategories` it announces "AI suggested N data categories" and discards them.
---

# PART III — Article-by-article assessment

This is the section a DPO reads first. Verdicts are written as they would appear in a
due-diligence report.

## Article 30(1) — the controller's record

| Requirement | State | Assessment |
|---|---|---|
| **(a)** controller name and contact details | ✗ | Not in the register. Org-level fields (`legalName`, `address`, `countryCode`, `dpoName`, `dpoEmail`) appear only in the audit-ZIP PDF. The module's own PDF omits them |
| **(a)** joint controller name and contact | ✗ | `role = 'joint_controller'` is selectable and captures **no counterparty at all** — no name, no contact, no Art. 26 arrangement, no allocation of responsibilities |
| **(a)** representative (Art. 27) | ✗ | No field anywhere in the product |
| **(a)** DPO contact details | ~ | Org-level only, in one of two PDFs. Not per-activity, no deputy, no external DPO firm |
| **(b)** purposes of processing | ✓ | Free text, one per activity. No taxonomy, no multiple purposes, no purpose-to-basis pairing |
| **(c)** categories of data subjects | ~ | Column exists and is displayed in the list; **no editor anywhere** (D30). Templates only |
| **(c)** categories of personal data | ✗ | The tab exists and **cannot write a category** (D5) |
| **(d)** categories of recipients, incl. third countries and international organisations | ~ | Named recipients, not categories. No IO concept. No country for non-vendor recipients. No purpose of disclosure |
| **(e)** transfers to third countries, with identification | ✗ | Tab non-functional (D6–D8); wrong adequacy list where it works (D17) |
| **(e)** documentation of Art. 46(2)(f) / 49(1)¶2 safeguards | ✗ | The safeguards field writes to a non-column |
| **(f)** envisaged time limits for erasure, by category | ~ | One enum per activity, not per category; `custom` writes `custom` |
| **(g)** general description of TOMs, per Art. 32(1) | ~ | Eight booleans plus free text. No Art. 32(1)(a)–(d) mapping, no evidence, no testing regime |

**Verdict: this register would not satisfy an Article 30(4) request from a supervisory authority.**
Four of seven sub-paragraphs are absent or unrecordable. The Irish DPC, the CNIL and the Bavarian
DPA all publish ROPA templates whose column sets exceed what this module can store.

*Superseded. Sprint 1 made (c) to (g) recordable and structured; Sprint 3 added (a) and put
all seven into one document. The verdict now: **the register can answer an Article 30(4)
request, and the CNIL, ICO, DSK and AEPD templates are produced directly from it.** Three
gaps in this table survive and are not Sprint 3 work — the joint-controller counterparty
(no name, contact or Art. 26 allocation, G66), one lawful basis per activity because
purposes are not first-class (A1), and Art. 32(1)(a)–(d) mapping with evidence behind the
security checkboxes (A13). The first is the one an auditor would raise first.*

## Article 30(2) — the processor's record

| Requirement | State |
|---|---|
| (a) each controller's name and contact, plus its representative and DPO | ~ `controllerName` string only; no contact, no representative, no DPO, no multiple controllers per activity |
| (b) categories of processing carried out on behalf of each controller | ✗ No field. `processingType` exists as a column with no UI; the register PDF substitutes `purpose` under a heading that says "Categories of processing" |
| (c) transfers, with safeguards documentation | ✗ As Art. 30(1)(e) |
| (d) general description of TOMs | ~ Shared with the controller record |

The processor record is also structurally unreachable: the audit PDF's Art. 30(2) section keys on
`clientId`, which nothing writes (D16). An agency — Custodia's stated core segment, with a dedicated
`/for-agencies` page — cannot produce the record Article 30(2) requires of it. Both PDF templates
also ignore `role` entirely, so a processor's record is printed as a controller's.

*Superseded by N114. The split now keys on declared **role** rather than on the presence of
a client link, which is a correction as well as a fix: an agency doing its own marketing to
a client's contacts is a controller record, and filing it under 30(2) would assert a
processor relationship the organisation has not claimed. Both links are consulted, the join
table the UI actually writes taking precedence over `clientId`. (a) is answered per client —
legal entity, address, contact, Art. 27 representative and that client's own DPO, which the
old templates got wrong by printing the agency's; (b) has its own field on the client
relationship, where it belongs, because it describes the relationship rather than one
activity. Still one controller per activity (N115), and the client-branded handover PDF is
N116.*

## Article 30(3)–(5)

- **(3)** written, including electronic, form — satisfied.
- **(4)** available to the supervisory authority on request — two divergent PDFs, one incomplete and
  one unreachable from the module; no snapshot, no integrity stamp, no export log. *Sprint 3:
  one document, reachable from the register, in five formats plus four regulator packs;
  versions are snapshotted and hash-stamped. **No export log** — who exported what, when and
  for whom is I92 and is not built, so the third clause of this line still stands.*
- **(5)** the sub-250-employee derogation — nowhere assessed or asserted. Nothing records that
  processing is "not occasional", involves special categories, or is likely to result in risk, which
  is exactly the assessment that decides whether the register is mandatory at all.

## Article 5 — principles

- **5(1)(a) transparency** — no link from an activity to the privacy notice that discloses it. The
  `policy-ropa-sync` job that would create one is dormant, and passes the model only name, purpose
  and basis, omitting retention, recipients, transfers and rights.
- **5(1)(b) purpose limitation** — one purpose per activity; no compatibility assessment for
  secondary use; no Art. 6(4) analysis.
- **5(1)(c) data minimisation** — no necessity justification per data category, no evidence of why a
  field is needed, no minimisation review.
- **5(1)(d) accuracy** — no field, no link to rectification.
- **5(1)(e) storage limitation** — the most-cited Article 30 audit finding, and here it is a
  seven-item dropdown with no per-category granularity, no trigger model, no statutory citation, no
  deletion evidence and a write-only review date.
- **5(1)(f) integrity and confidentiality** — eight checkboxes.
- **5(2) accountability** — the audit trail is broken in three independent ways (D12, D13, D22).
  This is the principle the whole product is sold on.

## Article 6 — lawfulness

One basis per activity. Real processing carries several purposes under different bases within one
activity — "Customer Account Management" is contract for service delivery, legal obligation for tax
records, legitimate interest for fraud prevention, and consent for marketing. Custodia forces one
choice. No `lawfulBasisDetail` UI despite the column; no consent-record link when the basis is
consent; no statutory citation field for 6(1)(c) or 6(1)(e); no LIA for 6(1)(f); no Art. 6(4)
compatibility test.

## Articles 9 and 10 — special categories and criminal data

Custodia records a per-data-category boolean and a nullable `specialCategories` jsonb that nothing
writes. **The Article 9(2) condition is never captured.** An organisation can tick "health data" with
an Article 6 basis of "contract" and the record is, on its face, unlawful — Article 9(1) prohibits
the processing unless one of the ten conditions in 9(2)(a)–(j) applies. A register showing special
category data with no Article 9(2) ground will be rejected by any EU auditor.

Also missing: which of the nine Art. 9(1) types is involved; the national-law basis required by
9(2)(b), (h), (i) and (j); the Art. 9(3) professional-secrecy safeguard; and **Article 10 criminal
conviction and offence data, which has no representation in the product at all**.

## Articles 13 and 14 — information to data subjects

No linkage. The register holds everything Art. 13(1)–(2) needs — controller identity, purposes,
bases, recipients, transfers and safeguards, retention, rights — and none of it flows to a notice.
Nor is the Art. 13 versus Art. 14 distinction derivable: the data-categories grid has a "Source"
column, it is free text with no controlled values, and the consequence of an indirect source (an
Art. 14 notice due within one month, and Art. 14(2)(f) documentation of the origin) is never derived.

Best-in-class products treat the ROPA as the single source of truth from which notices are generated
and versioned. This is the highest-leverage integration Custodia is not making.

## Article 22 — automated decision-making

No representation. No profiling flag, no description of the logic, no significance-and-consequences
field, no human-intervention safeguard, no Art. 22(2)(a)–(c) basis. Required by Arts. 13(2)(f) and
14(2)(g), and directly relevant to the Art. 35(3)(a) DPIA trigger. `isAutomatedDecisionMaking` exists
in the client-side form schema and has no column.

## Article 28 — processors

DPA status surfaced read-only from the vendor register is genuinely useful. Absent: Art. 28(3)(a)–(h)
clause coverage per activity (`dpaClauseCoverage` is *selected* in `recipients.list` and never
rendered); sub-processor chains and Art. 28(2) authorisation; Art. 28(3)(h) audit rights and audit
history; documented processor instructions, which are the heart of controller–processor evidence;
Art. 28(4) flow-down; DPA expiry surfaced in the register; and any per-activity DPA document link.

## Article 32 — security

Eight generic booleans against a requirement that asks for measures appropriate to the risk —
pseudonymisation and encryption (a); confidentiality, integrity, availability and resilience (b);
restoration (c); and **a process for regularly testing, assessing and evaluating effectiveness**
(d). There is no testing field, no evidence, no owner, no date, no risk-proportionality link, no
inheritance from vendor certifications, and no org-level baseline with per-activity deviation.

## Articles 35 and 36 — DPIA and prior consultation

`requiresDpia` is set by exactly one trigger: a special-category tick. Under Art. 35(3) and EDPB
WP248 a DPIA is expected where processing meets two or more of nine criteria:

1. evaluation or scoring, including profiling — **not captured**
2. automated decision-making with legal or significant effect — **not captured**
3. systematic monitoring — captured (`isSystematicMonitoring`) and **read by nothing**
4. sensitive data or data of a highly personal nature — captured, and the only live trigger
5. large scale — **not captured** (`isLargeScale` is a form field with no column)
6. matching or combining datasets — **not captured**
7. vulnerable data subjects, including children and employees — **not captured**
   (`involvesChildren` exists and is written by nothing)
8. innovative use of new technology, including AI — **not captured**
9. processing that prevents subjects exercising a right or using a service — **not captured**

So high-risk AI profiling, employee surveillance and large-scale biometric processing can all pass
through the module without triggering a DPIA. Also missing: national DPA blacklists (the German DSK
list, the CNIL list, the DPC list); the Art. 35(7)(a)–(d) structure; Art. 35(2) DPO advice; Art.
35(9) consultation of data subjects; Art. 35(11) re-assessment on change; any sign-off; and Art. 36
prior consultation (submission, authority, date, reference, response, conditions) — a known auditor
question with no answer box anywhere in the product. **Recording a documented "no DPIA required"
decision is itself an accountability artefact, and is currently impossible.**

*Superseded by F56 and F57, and this paragraph is the one Sprint 3 answers most directly.
All nine WP248 criteria are asked, alongside the three Art. 35(3) cases the Article settles
by itself and the national Art. 35(4) lists — applied **by jurisdiction**, because a German
Muss-Liste entry is not a statutory trigger for an Irish controller and merging them would
tell most customers a DPIA was mandatory when it was not. The last sentence is the item
that mattered: the rationale is now mandatory for every decision, "not required" included,
and re-screening supersedes rather than overwrites, so the March answer survives the June
one. 35(7)(a)–(d), 35(2), 35(9) and sign-off are the DPIA module's own structure, and 35(2)
and 35(9) both refuse silence — departing from the DPO's advice needs a reason, and so does
not seeking the views of data subjects. Art. 36 is columns and a payload rather than a
workflow (F60), and **Art. 35(11) re-assessment on material change is not built** — it
depends on P125 and is Sprint 4.*

## Articles 44–49 — transfers

The chapter is non-functional (D6–D8) and, where it functions, wrong (D17). Beyond the defects:

- **Art. 45 adequacy** — no adequacy status, and no handling of scope caveats (Canada commercial
  organisations only; the US DPF covering only certified entities). Both are already encoded in
  `transferDestinations.ts` and unused by the register.
- **EU–US Data Privacy Framework** — the most common lawful route for US transfers since July 2023
  is **not in the mechanism list at all**, and there is no certification check against the US
  Department of Commerce list, no scope check (HR versus non-HR data), and no expiry monitoring.
- **Art. 46(2) mechanisms** — "SCCs" is a display string. No 2010-versus-2021 clause set, no module
  (1–4), no annexes, no execution date, no signatories, no document. No BCR approval reference. No
  Art. 46(3) ad-hoc clauses with authorisation.
- **Art. 49 derogations** — no sub-reason picker for (a)–(g), no justification field, and no warning
  that derogations are for non-repetitive, occasional transfers. A user can assign Art. 49 to a
  routine daily data flow with no challenge.
- **Onward transfers and chaining** — a real stack is EU → US primary processor → India or the
  Philippines for support. Custodia records a single hop. The vendor registry has sub-processor
  change detection, dormant, and nothing propagates sub-processor transfers into the register.
- **Schrems II supplementary measures** — a text field bound to a non-column, against an EDPB
  Recommendations 01/2020 expectation of documented, *effective*, itemised measures.
- **Per-transfer TIA, re-assessment cadence, transfer suspension workflow, Art. 48 foreign-court
  orders, UK IDTA/Addendum and Swiss FADP equivalence** — all absent. *Sprint 3 closes the
  first three (F58): a TIA per transfer with the EDPB six-step structure, a re-evaluation
  **interval** rather than a single date — an interval survives the review being done — and a
  suspension that has to be justified and propagates onto the transfer row it stops. Art. 48,
  the UK IDTA and Swiss equivalence remain absent.*

*The Schrems II line above is also superseded. Supplementary measures come from the
Recommendations 01/2020 catalogue rather than a text field, grouped as the EDPB groups them,
and the assessment refuses to complete when it concludes the destination is not essentially
equivalent and then selects only contractual and organisational measures — § 48 is explicit
that those cannot bind a public authority whose law permits the access. That assessment reads
as complete on screen, which is why the check is in the API rather than the browser.*

## Beyond GDPR

Nothing for: ePrivacy Art. 5(3) linkage from consent to activities; NIS2 register overlap; the DORA
register of information; EU AI Act Art. 11/12 technical documentation, which enterprise buyers in
2026 expect to co-exist with the ROPA; UK GDPR divergence; Swiss FADP; LGPD or CCPA/CPRA
cross-framework mapping of the same activity; ISO 27701 control mapping; SOC 2 evidence export.

---

# PART IV — What the module should do

Grouped by what a DPO is trying to do. `[P0]`–`[P3]` is recommended priority. Items marked ★ are
where this product can win rather than merely catch up.

## A. Data model — the foundation everything else needs

1. `[P0]` **Purposes as first-class children of an activity**, each with its own lawful basis,
   retention rule and data-category set. This single change is the difference between a summary and
   a register.
2. `[P0]` **A data-element catalogue** (org-level, seeded): name, group, sensitivity,
   `isSpecialCategory`, special-category type, criminal-data flag, identifiability (direct /
   indirect / pseudonymised / anonymous), format, example — reused across activities.
3. `[P0]` **A data-subject-category catalogue** — employees, candidates, customers, prospects,
   suppliers, patients, students, children, website visitors, shareholders, contractors,
   ex-employees, next of kin, claimants, witnesses — with `isVulnerable` and `isChild` flags and an
   estimated volume band per activity. (`estimatedDataSubjects` and `involvesChildren` already exist
   as columns.)
4. `[P0]` **Per-data-category retention rules**, not one per activity.
5. `[P0]` **A recipient catalogue** distinct from vendors: internal departments, group companies,
   professional advisers, public authorities, courts, auditors, insurers, banks, couriers — each
   with type, role, country and basis for disclosure.
6. `[P0]` **Article 9(2) condition** and **Article 10 basis** at data-category level, with the
   national-law basis field that 9(2)(b), (h), (i) and (j) require.
7. `[P1]` **Systems and assets** as first-class objects linked to activities, holding location,
   hosting region, owner and criticality — the join that makes a register usable for security and
   for DSAR fulfilment.
8. `[P1]` **Legal entities** within a customer, so a group keeps one register per controller over
   shared catalogues.
9. `[P1]` **Business units and departments**, for ownership and reporting.
10. `[P1]` **Processing operations** as the Art. 4(2) controlled list (collection, recording,
    organisation, structuring, storage, adaptation, retrieval, consultation, use, disclosure,
    alignment, combination, restriction, erasure, destruction). `processingType` exists and is
    unreachable — this is also Art. 30(2)(b).
11. `[P1]` **Data sources** as a controlled list (directly from the subject / third party with name
    / publicly available / derived / inferred / observed), driving the Art. 13-versus-14 derivation.
12. `[P1]` **Article 22 fields**: profiling flag, ADM flag, logic description, significance and
    consequences, human-intervention safeguard.
13. `[P1]` **Transfer routes** as objects: exporter entity, importer entity, mechanism, mechanism
    detail, execution date, expiry, document, TIA reference, onward transfers.
14. `[P2]` **Jurisdiction and framework tagging**, so one activity carries GDPR, UK GDPR, Swiss
    FADP, LGPD and CPRA obligations with per-framework fields.
15. `[P2]` **Custom fields** with types, validation, required-per-status rules and export inclusion.
16. `[P2]` Tags with colour, and tag-based filtering and reporting.
17. `[P2]` **`organization_id` directly on the three child tables**, with compound indices, so
    org-wide queries over categories, recipients and transfers stop requiring a join to the parent.
    (Keep the `assertParentOwned` checks; this is a performance and reporting change, not a
    substitute for them.)

## B. Register operations — lifecycle, ownership, review

18. `[P0]` **Owner per activity** (business owner and privacy owner), a "my activities" view, and
    unowned-activity reporting.
19. `[P0]` **Review cycle**: cadence per activity or risk tier; `lastReviewedAt` / `nextReviewAt` /
    `reviewedBy` actually written; an "attest this record is accurate" action; an overdue queue;
    escalating reminders; an attestation history.
20. `[P0]` **Approval workflow**: draft → in review → approved → published, with reviewer
    assignment, comments, approve/reject with reason, and an immutable approval record. Nothing
    about an Article 30 register should be editable-in-place-by-anyone-instantly.
21. `[P0]` **Versioning with point-in-time retrieval**: every approved version snapshotted,
    diffable, exportable "as at" a date. The `version` and `previousVersionId` columns exist.
22. `[P0]` **Archive and delete from the UI**, with a confirmation naming dependent objects (DPIA
    links, client assignments, gaps, flags), an archive view and restore.
23. `[P0]` **Publication gate**: "active" requires name, purpose, lawful basis (and, for processors,
    the controller), data subject categories and retention — with a named, recorded exception. Draft
    versus active is currently a costume.
24. `[P1]` **Duplicate an activity** — the single most-requested feature in every ROPA rollout,
    because activities come in families.
25. `[P1]` **Completeness score per activity**, field-level, weighted by Article 30 requirement,
    shown as a ring in the list and a checklist in the editor. ★ This is what makes a register
    self-maintaining, and the amber "Not recorded" retention pill shows the instinct is already here.
26. `[P1]` **"What's missing" panel** in the editor, listing unfilled mandatory fields with the
    article that requires each.
27. `[P1]` **Change-impact prompts**: adding a recipient asks whether the notice needs updating,
    whether a DPA exists, whether a transfer record is needed.
28. `[P1]` **Bulk edit** across a filtered selection: owner, status, review date, tag, retention
    rule, recipient.
29. `[P2]` Duplicate detection on create and import, with merge.
30. `[P2]` Register-level attestation: "the DPO confirms this register is complete and accurate as
    at <date>", with signature and PDF.
31. `[P2]` Soft-delete recycle bin with retention and permanent purge.

## C. Population and discovery — the reason people abandon spreadsheets

32. `[P0]` ★ **Interview-mode intake**: a plain-language wizard aimed at a department head, not a
    DPO — "what do you do with people's information?" → a draft activity for privacy review.
33. `[P0]` ★ **Delegated data-collection requests**: send a questionnaire to a business owner, track
    responses, review and merge into the register. This is the feature that most differentiates
    OneTrust and TrustArc from a spreadsheet, and it is entirely absent.
34. `[P1]` **Discovery from the vendor register**: "you have 43 vendors; 12 are referenced by no
    processing activity" → suggested activities.
35. `[P1]` **Discovery from the consent and tracker scanner**: trackers found on the website that no
    activity accounts for.
36. `[P1]` **Discovery from SaaS connectors** (Google Workspace, M365, Okta, Slack, HubSpot, Stripe,
    AWS): app inventory → suggested activities and recipients.
37. `[P1]` ★ **AI drafting of a full activity** from a one-line description — "we use Intercom on our
    web app to provide live chat to European customers" → proposed purpose, categories, subjects,
    basis, retention, recipients matched against the vendor register, transfers and TOMs, presented
    as field-by-field suggestions the user accepts or rejects. The current panel returns a blob and
    can apply two fields.
38. `[P2]` **Industry template packs** beyond the 32 agnostic ones — SaaS, e-commerce, healthcare,
    legal, education, fintech, recruitment, manufacturing — with jurisdiction variants. Surface them
    *inside* the module; today they exist only in onboarding.
39. `[P2]` **Import from a competitor's export**: OneTrust, TrustArc, Securiti, and the CNIL / DPC /
    ICO spreadsheet templates, with column mapping. The importer's alias approach is the right base.
40. `[P2]` Discovery from database schema scans and column classification.

## D. Mapping and lineage

41. `[P1]` **A data-flow view per activity**: sources → systems → recipients → transfers, rendered,
    exportable, printable. Every buyer asks to see this in a demo.
42. `[P1]` **An org-level data map**, filterable by data category, subject category, country, vendor
    or system.
43. `[P1]` **A transfer map**: every destination country, mechanism, TIA status and volume.
44. `[P2]` **Reverse lookup** — "which activities process health data?", "which send data to the
    US?", "which involve Salesforce?" The three questions a DPO is asked most often, none of which
    this module can answer.
45. `[P2]` Vendor-centric view: one vendor → every activity that uses it, with combined data
    categories, for DPA scoping.
46. `[P3]` Field-level lineage for DSAR and erasure automation.

## E. Retention management

47. `[P0]` **Retention schedules** as reusable org-level objects: name, period, trigger event,
    statutory citation, jurisdiction, owner, review date — attached to activities and categories.
48. `[P0]` **A trigger model**: from collection / last interaction / contract end / case closure /
    employment end / statutory clock, with a computed disposal date.
49. `[P1]` **Free-text custom period** with unit selection, and a formatter so nothing ever prints
    `6_months`.
50. `[P1]` **A retention review queue** with overdue flags — `retentionReviewDate` finally read.
51. `[P1]` **A records-due-for-deletion report**, a disposal log and deletion evidence.
52. `[P1]` **Legal hold** suspending a retention rule, with reason, owner and expiry.
53. `[P2]` Retention conflict detection (a category kept seven years in one activity and one year in
    another).
54. `[P2]` A statutory retention library per jurisdiction with citations.

## F. Assessments

55. `[P0]` **The LIA.** Build the interface for the table that already exists: the three-part test,
    outcome, assessor, date, next review, evidence attachment, PDF output, a link from the activity
    via the waiting `liaId` column, the LIA outcome shown next to the basis in the register, and
    `legitimate_interest` blocked from "published" until an LIA is at least drafted.
56. `[P0]` **A DPIA screening questionnaire** covering Art. 35(3)(a)–(c) and the WP248 nine
    criteria, with national blacklists, an automatic verdict, and **a recorded rationale including
    for "no DPIA required"**.
57. `[P0]` **A DPIA module with its own route**: list, template library, Art. 35(7) structure,
    editable initial risks, risk matrix, measures, DPO opinion, data-subject consultation, sign-off,
    versioning, PDF. Today the entire DPIA capability is one tab reachable only through an activity.
58. `[P0]` **A per-transfer TIA** with the EDPB Recommendations 01/2020 six-step structure,
    destination-law assessment, supplementary-measures catalogue, residual-risk conclusion, review
    date, and a suspension decision that propagates — **org-scoped**, fixing D3.
59. `[P1]` **Art. 6(4) compatibility assessment** for secondary use.
60. `[P1]` **Art. 36 prior consultation** tracking: submission, authority, date, reference,
    response, conditions.
61. `[P1]` **An assessment library** with due dates, owners, statuses and reminders across LIA,
    DPIA and TIA.
62. `[P2]` Balancing-test templates by scenario: fraud prevention, direct marketing, employee
    monitoring, credit scoring, security.
63. `[P2]` Assessment re-trigger on material change to the underlying activity (Art. 35(11)).

## G. Recipients and the Article 28 chain

64. `[P0]` **Recipient categories** alongside named recipients, as Art. 30(1)(d) actually asks.
65. `[P0]` **A role per recipient link**: processor, joint controller, independent controller,
    sub-processor.
66. `[P1]` **Sub-processor chains** per recipient, with Art. 28(2) authorisation status and change
    notifications — the vendor module's dormant sub-processor detection already produces the signal.
67. `[P1]` **Art. 28(3)(a)–(h) clause coverage** rendered per activity. `dpaClauseCoverage` is
    already fetched by `recipients.list` and thrown away.
68. `[P1]` **DPA document link and expiry** per recipient-activity link, with an "expiring soon"
    call-out. A recipient with no signed DPA should be a loud gap, not a small grey badge.
69. `[P1]` **Purpose of disclosure** per recipient — the unused `purpose` column.
70. `[P1]` **A country per recipient** for non-catalogue recipients, driving transfer detection.
71. `[P2]` Documented processor instructions (Art. 28(3)(a)) and their change log.
72. `[P2]` Audit rights and audit history per processor.
73. `[P2]` A public-authority disclosure register (Art. 4(9) carve-out, law-enforcement requests).
74. `[P2]` **Joint-controller Art. 26 arrangement**: the document, the responsibility split, the
    contact point. Today the role label is the entire feature.

## H. Transfers

75. `[P0]` Fix D6–D8, then add a **searchable ISO-3166 country picker** writing valid `char(2)`,
    with adequacy computed from the `transferDestinations.ts` that already exists.
76. `[P0]` **Mechanism-specific fields**: SCC year, module, annexes, execution date, signatories,
    document; BCR approval reference; adequacy decision reference with its scope caveats; Art. 49
    sub-reason with justification.
77. `[P0]` **DPF as a first-class mechanism**, with certification lookup against the US Department of
    Commerce list, scope (HR versus non-HR) and expiry monitoring. ★
78. `[P1]` **Supplementary measures** from the EDPB Recommendations 01/2020 catalogue, multi-select
    with per-measure detail, written to the `supplementaryMeasures` column that already exists.
79. `[P1]` **Onward-transfer documentation** and a multi-hop route visualiser.
80. `[P1]` **Transfer suspension** workflow with notification and register annotation.
81. `[P1]` **Transfer re-assessment cadence** with reminders — the EDPB expects periodic review and
    the transfer row has no review date.
82. `[P2]` **UK and Swiss regimes**: IDTA, the UK Addendum, the Swiss annex, and per-regime adequacy
    sets. The hardcoded EU-27 list treats the UK as non-EU, which is right for EU GDPR and says
    nothing about UK GDPR scope — enterprises subject to both cannot represent reality.
83. `[P2]` Art. 48 foreign-authority-request procedure and log; transfer volume and frequency.
84. `[P3]` Automatic re-assessment triggered by a Schrems-type judgment, feeding the regulatory
    module into the transfer register. ★

## I. Evidence and audit trail

85. `[P0]` **Fix the diff** (D12): field-level before and after, human-readable field labels, user,
    timestamp, IP.
86. `[P0]` **Include child-table changes** in the activity timeline (D13) by threading a
    `parentResourceId` through `extractResourceId`.
87. `[P0]` **Stop the write loop** (D1), so the trail is signal rather than noise.
88. `[P1]` **Filter and paginate the timeline** by actor, field, date range and change type.
89. `[P1]` **Export the trail** as CSV or PDF, for one activity or the whole register.
90. `[P1]` **Snapshot on approval** with a content hash, so the register can be proven unaltered.
91. `[P2]` "Show me the register as at <date>" — the question every incident post-mortem asks.
92. `[P2]` Evidence attachments per field or per activity; an append-only hash-chained log for
    regulated buyers; a regulator-access log recording who exported what, when and for whom.

## J. Reporting and exports

93. `[P0]` **One canonical Article 30 export** — complete, with controller identity, DPO,
    representative, all seven sub-paragraphs, both records, and negative assertions. Replace the two
    divergent templates with one, and make it this module's Export PDF.
94. `[P0]` **Server-side export** of the whole register regardless of what the browser has loaded.
95. `[P0]` **XLSX export** with one sheet per object — activities, categories, subjects, recipients,
    transfers, retention. Every regulator and auditor asks for Excel, not CSV.
96. `[P1]` **Filtered export** by status, entity, client, department, owner, risk, framework and
    date range.
97. `[P1]` ★ **Regulator-specific template packs**, a cheap and extremely visible differentiator:
    the CNIL *Registre des activités de traitement* (separate responsable / sous-traitant sheets),
    the ICO controller and processor XLSX templates, the German DSK Standard-Datenschutzmodell
    matrix, the AEPD *Registro de Actividades*, and an EDPB-shaped JSON exchange format.
98. `[P1]` **DOCX export** for legal teams that redline; **JSON/API export** for archival and
    migration.
99. `[P1]` **A "regulator pack"** — one ZIP with the register, DPIAs, TIAs, LIAs, DPAs, TOMs and an
    index. `generateAuditZip` is close; wire it into this module with filters.
100. `[P2]` Scheduled exports to email, S3 or SFTP; a board summary (activities by basis, by risk, by
     department; transfer exposure; completeness trend; overdue reviews); a gap report; a delta
     report for "what changed this quarter".
101. `[P2]` **Locale-aware exports** — the register must be producible in the language of the
     supervisory authority. The PDF pipeline has locale plumbing; the module's exports do not pass it.

## K. Search, filter and views

102. `[P0]` **Server-side search** across name, purpose, description, data categories, recipients and
     countries.
103. `[P0]` **Filters**: status, role, lawful basis, risk, special category, has-transfer, transfer
     country, retention set or unset, DPIA required or complete, owner, department, client, entity,
     review overdue, completeness band, tag, created and updated ranges.
104. `[P0]` **Saved views**, shareable, with a default per role.
105. `[P1]` Server-side sort on every column; a result count and real pagination controls; a column
     chooser with persisted order and width; grouping with counts.
106. `[P2]` A compact "audit mode" showing every Article 30 field in one wide table; kanban by status
     for the review workflow.

## L. Bulk operations

107. `[P0]` Row selection that works, including select-all-matching-filter rather than the loaded
     page, and bulk export of the selection.
108. `[P1]` Bulk status change, owner assignment, review-date set, tag add and remove; bulk add or
     remove a recipient or data category; bulk archive and delete with dependency-aware confirmation.
109. `[P2]` Bulk apply a retention schedule; bulk request-for-review to owners; undo.

## M. Collaboration and workflow

110. `[P0]` **Tasks on an activity**: "complete the retention section", assignee, due date, reminder.
     The notification and queue infrastructure already exists; nothing turns register gaps into work.
111. `[P1]` **Comments** per activity and per field, with mentions and email notification. A DPO's
     job is asking "why is this retention five years?" — there is nowhere to ask it inside the record.
112. `[P1]` **Notification coverage**: review due, approval requested, DPA expiring, transfer needing
     a TIA, completeness dropped, activity changed by someone else — plus Slack and Teams delivery.
113. `[P2]` Presence and locking; scoped tokenised request-for-information forms for colleagues
     without a licence; approval delegation; a change-proposal model for approved records.

## N. Multi-entity, group and agency ★

114. `[P0]` **Article 30(2) that works**: per-client processor records driven by the assignment the
     UI actually writes (D16), carrying the client's controller identity, contact and categories of
     processing.
115. `[P1]` **Per-legal-entity registers** with shared catalogues and roll-up reporting.
116. `[P1]` **A client-facing register view** in the portal, with a client-branded Article 30(2) PDF
     the agency can hand over.
117. `[P1]` **Cross-client template propagation**: define once, deploy to forty clients, track drift.
118. `[P2]` A group dashboard; per-entity DPO and supervisory authority; copy an activity between
     organisations for agency onboarding.

## O. Integrations and API

119. `[P0]` **A REST API for activities and all child objects**, plus export. `routes/v1` already has
     the pattern from vendors.
120. `[P0]` **Fire the ROPA webhooks that are already advertised** (D39), and add `ropa.reviewed`,
     `ropa.approved`, `ropa.transfer.added`, `ropa.retention.overdue`, `ropa.completeness.changed`.
121. `[P1]` Zapier / Make / n8n; Jira, ServiceNow and Linear task sync; Google Sheets and Excel
     two-way sync, to meet customers where their register already lives and then migrate them.
122. `[P2]` Confluence or Notion publishing; SIEM streaming of register changes (the `siemEnabled`
     hook already exists in the audit middleware); an MCP server so an agent can query the register.

## P. Automation and intelligence — the actual moat

123. `[P1]` **Completeness monitoring** with a trend, and a real ROPA score that reflects Article 30,
     replacing D19.
124. `[P1]` **Gap rules beyond `missing_dpia`**: no retention; indefinite retention without
     justification; no data subject categories; no data categories; no recipients on an activity that
     has vendors; a transfer still `pending_assessment`; consent basis with no consent record;
     legitimate interest with no LIA; processor role with no controller name; special category with
     no Art. 9(2) condition; review overdue; DPA expired on a linked recipient; active status with
     mandatory fields blank.
125. `[P1]` ★ **Generalised material-change evaluation.** The re-consent worker is the best idea in
     the module and watches one field. Extend it to lawful-basis changes, data-category additions,
     retention changes, recipient changes and transfer changes, and route the verdict to three
     consequences rather than one: re-consent, privacy-notice update, DPIA re-assessment.
126. `[P1]` **Change-driven prompts**: a new vendor in the vendor register asks which activities it
     serves; a newly detected tracker asks which activity accounts for it; a DSAR asks which
     activities must be searched.
127. `[P1]` ★ **AI review of an existing activity** — not field suggestions but judgments: "this
     purpose is too vague for Art. 5(1)(b)"; "this retention period conflicts with the statutory
     period for payroll"; "consent is the wrong basis here, contract fits, and here is why".
128. `[P1]` **Regulatory change → concrete register diffs**: the impact banner already exists;
     extend it to proposed changes with one-click apply, and turn the dormant jobs on.
129. `[P2]` ★ **Ask-the-register**: natural-language Q&A over the register. The embeddings pipeline
     exists and is used only for form-filling context.
130. `[P2]` **Register-driven outputs**: auto-drafted privacy-notice sections per Art. 13/14 item
     with a diff against the published notice; auto-populated DSAR search scope; auto-populated
     breach assessment ("blast radius" — affected categories, subjects, volumes, Art. 9 presence,
     and a draft Art. 33 notification) from the affected activities.
131. `[P2]` Duplicate and near-duplicate detection; anomaly detection on recipient growth.

## Q. UX a compliance officer expects and does not find

132. `[P0]` **A single-page full-record view** — read-only, print-ready, everything on one screen.
     Nine tabs is how you enter data; it is not how you review a record or show it to a lawyer.
133. `[P0]` **Explicit save with a dirty indicator, or autosave that works.** The current hybrid —
     autosave on four tabs, immediate mutations on three, manual create — means users cannot tell
     what is saved.
134. `[P0]` **Field-level help citing the article**, with a "why we ask" expander. The Legal tab does
     this well and nowhere else does. Compliance officers learn the regulation from the tool.
135. `[P1]` **Inline validation that actually runs** (D46), with a summary of what blocks "active".
136. `[P1]` **Undo**, an unsaved-changes guard and draft recovery. The debounced save destroys the
     previous value and the History tab that would show it is broken.
137. `[P1]` **Progressive disclosure by risk** — a low-risk activity should not present the same
     sixty fields as a high-risk one; **a guided completion path** — "6 of 12 required fields
     complete, next: retention"; **keyboard-first navigation**.
138. `[P1]` **Picklists instead of free text** throughout: categories from a standard taxonomy,
     sources from an enum, retention as a composite (number + unit + trigger + citation) so it is
     machine-comparable.
139. `[P1]` **Empty states that teach** — the list empty state is good; the tab empty states say "no
     recipients documented" and offer nothing. Offer the template library from inside the module.
140. `[P2]` Side-by-side compare of two activities; recently viewed and pinned; contextual "similar
     activities" while creating; a mobile review mode for approvals.

## R. Non-functional

141. `[P0]` **Accessibility** (D50): keyboard-operable rows and tabs, proper ARIA roles, label
     association, non-colour status carriers, live-region announcements for save state and errors.
142. `[P0]` **i18n**: extract the five hardcoded-English tabs, add a check so it cannot regress, and
     format enums through the message catalogue.
143. `[P1]` **Performance**: server-side pagination, sort and filter; select only the columns the
     list needs; index `(organization_id, status)`, `(organization_id, updated_at)` and `deleted_at`.
144. `[P1]` **Referential integrity**: foreign keys on `processing_recipients.vendor_id` and
     `processing_transfers.vendor_id`; a unique constraint on `(processing_activity_id, vendor_id)`
     for transfers; a dedupe key on `reconsent_flags`.
145. `[P1]` **Replace `data: z.record(z.any())`** with explicit per-field schemas on all three ropa
     mutations (D2), and **org-scope the TIA propagation** (D3) — then extend the tenancy guard to
     catch unscoped `update`/`delete` through shared-catalogue foreign keys, which is the class it
     currently cannot see.
146. `[P1]` **A shared zod schema per entity** that both the form and the mutation validate. D5, D7,
     the phantom form fields and the create-form drops are all instances of one disease: the form
     model, the API model and the Drizzle model are three documents nobody keeps in sync.
147. `[P2]` **Tests.** Standalone `tsx` fixtures (the only style that runs in `apps/api`) over the
     importer, the retention formatter, the adequacy test, the completeness scorer and the
     residual-risk matrix would have caught at least eight defects in Part II.
148. `[P2]` Rate-limit and size-limit CSV import; move large files server-side with a job and
     progress UI.

---

# PART V — Build order

## Sprint 0 — stop the bleeding (days, not weeks) — **DONE, 17 August 2026**

Nothing here is a feature. All of it is "the thing on screen does not do what it says", and nothing
else should be built until it is gone.

`D3` cross-tenant TIA write · `D1` autosave loop · `D2` mass assignment on three mutations ·
`D5` data-category columns · `D6`–`D8` transfer columns and vendor dropdown · `D4` soft-delete
filter in `list` · `D9`/`D10` create-form fields · `D11` vendor id mismatch · `D12`/`D13` audit
diff and child-row logging · `D17` adequacy list (use the `transferDestinations.ts` that already
exists) · `D15` template value mismatches · `D18` editable initial DPIA risks · `D14` custom
retention · dead buttons: `D28`, `D29`, `D27` — wire them or remove them, because in a compliance
tool every click is a promise an auditor will check.

All of the above are fixed on `fix/ropa-sprint0-tenancy`, plus `D45`, `D63` and `D38` in the list
and CSV. The three dead buttons were removed rather than wired, for the reason the sprint gives:
the features behind them are F55, F57 and L107/L108, and a control that does nothing is worse than
no control. `npm run check` passes, and `check:tenancy` now has a second pass covering the class
that let `D3` through. See §0.1.

## Sprint 1 — make the register recordable — **DONE, 19 August 2026**

Data-element and subject-category catalogues (A2, A3) · Article 9(2) condition and Article 10
(A6) · per-category retention (A4) · Article 22 fields (A12) · country picker with computed
adequacy (H75) · mechanism-specific transfer fields including DPF (H76, H77) · recipient categories
and roles (G64, G65) · data subject categories editable at last (D30) · owner per activity (B18) ·
completeness scoring and the "what's missing" panel (B25, B26) · the publication gate (B23) · the
single-page full-record view (Q132).

All of the above are built, with `H77` short of its Department of Commerce certification lookup and
`B18` short of unowned-activity *reporting* beyond the register filter. Migration
`0046_regular_amphibian` is applied. See §0.2 for what shipped, the three decisions that departed
from this list, and what was deliberately left.

**Sprint 2 is now the next thing to build**, and nothing in it was started. Two of its items are
owed rather than merely next: `R142`, because Sprint 1 added panels to tabs that are still
hardcoded English, and `K102`–`K104`, because the register now has an owner, a completeness score
and a publication state that nothing can filter or sort on.

## Sprint 2 — make it maintainable — **DONE, 19 August 2026**

Review cycle and attestation (B19) · approval workflow and versioning (B20, B21) · archive, delete
and duplicate (B22, B24) · server-side search, filters and saved views (K102–K104) · working bulk
operations (L107, L108) · tasks and comments (M110, M111) · notification coverage (M112) ·
accessibility and i18n (R141, R142).

All fifteen are built, and so are the three items §0.3 first held back — version
restore, the organisation-level approval requirement, and the migration itself, which
is applied and verified.

`R142` also took `utils/ropaVocabularies.ts` — about a hundred and ten English labels and hints
that made every enum in the register read in English even on the translated tabs — and
`check:ropa-i18n` is the guard that stops both halves regressing. See §0.3 for the four decisions
that departed from this list, what was deliberately left, and the pagination bug the new sort
options exposed.

## Sprint 3 — make it defensible — **DONE, 21 August 2026**

One canonical Article 30 export with controller identity, both records and negative assertions
(J93) · server-side and XLSX export (J94, J95) · regulator template packs (J97) · fixed, filterable,
snapshot-able audit trail (I85–I90) · the LIA (F55) · DPIA screening with recorded outcomes (F56) ·
a DPIA module with a route (F57) · per-transfer TIA, org-scoped (F58) · Article 30(2) that works for
agencies (N114).

All fifteen are built, and `J96`, `J98`, `J99` and `F60` fell out of them. The three
divergent Article 30 documents are one, built server-side from `lib/ropaArticle30.ts`
and rendered five ways; `ropaRecord.tsx` is deleted. Migration `0048_steep_blue_shield`
is applied — see §0.4's correction, which records that this line was wrong too. See §0.4 for the six decisions that
departed from this list, what was deliberately left, and the two defects found while
building.

**Sprint 4 is now the next thing to build**, and nothing in it was started. `O120` — firing
the ROPA webhooks the product already advertises (D39) — is the one owed rather than merely
next: the events are documented, the subscriptions can be created, and nothing dispatches
them.

## Sprint 4 — make it indispensable — **DONE, 21 August 2026**

Delegated intake and data-collection requests (C32, C33) · discovery from vendors, trackers and SaaS
(C34–C36) · AI activity drafting with field-level accept (C37) · retention schedules with triggers
and disposal evidence (E47–E52) · data-flow and transfer maps (D41–D43) · REST API and live webhooks
(O119, O120) · real gap rules and a real ROPA score (P123, P124) · generalised material-change
evaluation (P125) · register-driven notice, DSAR scope and breach blast radius (P130).

All twenty are built. `D44`'s three reverse lookups fell out of the org-level data map,
and `D19`, `D20`, `D40` and `D38`'s retention half closed as consequences. `O120` turned
out to be owed twice over: the events were never emitted *and* the delivery queue name
did not match the worker's, so no webhook this product has ever offered had actually
been delivered — see §0.5 for that and the two other pre-existing bugs found beside it.

**The next thing to build is the module-to-module wiring, and it is no longer a
register problem.** `P130`'s three builders exist and are served by
`ropa.insights.outputs.*`; what is missing is the DSAR module reading its own scope and
the Breach module reading its own blast radius, on their own screens. Beside that:
`P126`–`P129` (change-driven prompts, AI review of an existing record, regulatory-change
diffs, ask-the-register), `C38`–`C40`'s remaining population routes, `F59`/`F61`'s
assessment library, `I91`/`I92`'s point-in-time register and hash-chained log, and
`J100`/`J101`'s scheduled and translated exports. None is P0.

---

# PART VI — Positioning

## Why choose this over a spreadsheet?

Today, honestly: **the vendor linkage, and nothing else.** The Recipients tab showing live DPA
status, risk score and processing location per recipient is genuinely better than a spreadsheet, and
the auto-created transfer draft is a good idea executed against the wrong country list. The CSV
importer is better than most commercial importers. Everything else a spreadsheet does better: it
lets you type a data category, record a destination country, filter, sort, bulk-edit, and see every
field at once.

To beat a spreadsheet decisively you need five things, in this order:

1. Fields you cannot forget — completeness scoring and required-for-active.
2. Fields you cannot get wrong — catalogues, pickers, computed adequacy, validated retention.
3. Work you do not have to do — delegated intake, discovery from vendors, trackers and SaaS, AI
   drafting.
4. Work you cannot forget — review cycles, approvals, reminders, overdue queues.
5. An output you can hand to a regulator without editing it — one canonical, complete, versioned
   Article 30 export.

Custodia currently has partial credit on none of the five.

*Rescored after Sprint 3. **Four of the five are now done, and the fifth is the whole of
Sprint 4.*** *Rescored again after Sprint 4: **all five.***

1. *Fields you cannot forget — **done**. Completeness scoring, the "what's missing" panel
   and a publication gate that refuses `active` without Art. 30's blockers (B23, B25, B26).*
2. *Fields you cannot get wrong — **done**. Org catalogues for elements and subject
   categories, Art. 9(2) and Art. 10 conditions, computed adequacy, mechanism-specific
   transfer evidence, per-category retention with a trigger.*
3. *Work you do not have to do — **not started**. Delegated intake, discovery from vendors,
   trackers and SaaS, and AI drafting with field-level accept are C32–C37, and they are the
   reason a forty-person company still spends the afternoon typing.*
   *— **Done after Sprint 4.** A questionnaire the person who actually knows can answer over
   a link with no account; a queue that says "twelve of your forty-three vendors are in no
   activity, this tracker is on your site and nothing explains it, Google Workspace is
   connected and no record covers it"; and a draft from one line of description where every
   field arrives with its reasoning and is accepted separately. What none of it does is
   write to the register on its own, which is the property that makes it usable at all.*
4. *Work you cannot forget — **done**. Review cadence with attestation, an approval workflow
   an organisation can make mandatory, the reminder ladder, the overdue queue, tasks and
   comments.*
5. *An output you can hand to a regulator without editing it — **done**. One canonical,
   complete, versioned, hash-stamped Article 30 export, in the format and the language the
   authority publishes its own template in.*

*Which changes the answer to the question this section asks. Today, honestly: **a register
that tells you what is wrong with it, and an output you do not have to rewrite.** A
spreadsheet cannot compute a completeness score against Article 30, refuse to publish an
incomplete record, keep a versioned trail of who approved what, or produce the CNIL's own
template in French. What it still does better is population — and that is item 3, and item 3
is the next sprint.*

*Amended after Sprint 4. Item 3 is done, so the honest answer moves again: **a register
that populates itself from what you already told the product, and tells you what is still
wrong with it.** The thing a spreadsheet cannot do is not the scoring — it is knowing that
twelve of your vendors appear in no row of it, that the disposal you promised in the
retention column came due in March, and that the recipient somebody added last week means
the privacy notice is now wrong. That is not a better spreadsheet; it is a different
object.*

## Why choose this over OneTrust?

Not on feature count — OneTrust has all of Part IV. The winnable positions are:

- **Price and time-to-value.** €99/month against a five-figure contract plus implementation. If a
  forty-person company can get a defensible register in an afternoon, that is a real product. Today
  they cannot, because the fields are unrecordable. *Recordable since Sprint 1, and defensible
  since Sprint 3 — the afternoon is now spent on data entry rather than on discovering the
  product cannot hold the answer. Closing the gap the rest of the way is C32–C37.*
- **Opinionation.** OneTrust is a configurable framework that needs a consultant. Custodia can ship
  the answer: pre-built, jurisdiction-aware, opinionated defaults, and a register that tells you what
  is wrong instead of waiting to be configured. The 32 templates and the amber "Not recorded"
  retention pill show the instinct is already there.
- **The agency wedge.** OneTrust is poor at "one operator, forty clients". Custodia has clients,
  portals and a group view — and its Article 30(2) record is structurally empty (D16). Fixing that
  and shipping a client-branded processor-record PDF is the most defensible niche in this document.
- **Integrated, not modular.** OneTrust sells ROPA, DPIA, vendor risk and consent as separate
  modules that integrate badly. Custodia already has them in one schema. The connections are mostly
  unbuilt — DSAR scope from the register, breach assessment from the register, notice generation
  from the register — and each one is a demo moment OneTrust cannot match.
- **Honest AI.** Claude judging whether a purpose change is material is a genuinely novel and
  genuinely useful feature that no competitor ships. It is buried in a panel above the grid with no
  campaign action attached. That is a headline being wasted.

**What loses the deal today, in order:** the Transfers tab erroring in the demo; the Data Categories
tab being unfillable; the Article 30 PDF lacking controller identity; no filters on the register; no
LIA; no DPIA route; an empty audit trail. And — for anyone who runs a security review before signing
— D3.

## What "enterprise-grade" means for this specific module

1. Every Article 30(1) and 30(2) sub-paragraph is recordable, required before publication, and
   present in one canonical export.
2. Purposes, data categories, subject categories, recipients, retention rules and transfer routes are
   separate objects with their own lifecycles, reusable across activities.
3. Nothing about a published record changes without an approval, a version and a diff.
4. Every record has an owner and a review date, and the system chases both.
5. The register is populated mostly by people who are not the DPO, through delegated intake, and
   mostly by machines, through discovery.
6. Retention is a schedule library with triggers and disposal evidence, not a dropdown.
7. LIA, DPIA screening, DPIA and per-transfer TIA are first-class, linked, versioned and exportable.
8. Search, filter and bulk operations work over the whole register, server-side, with saved views.
9. Everything is available over an API and emits webhooks.
10. Every export is complete, filtered, versioned, formatted for the target authority, and available
    in XLSX, PDF, DOCX and JSON.
11. The audit trail records every field change on every object, is filterable and exportable, and
    cannot be silently lost.
12. The register drives the privacy notice, the DSAR search scope and the breach assessment —
    because that is what a *record* is for.

---

# Appendix A — Source comparison and adjudications

## Which of the three source documents was best

**`data-processing-module-audit-model2.md` — clearly the strongest, and the base this document was
built on.**

| | model1 (assessment) | model2 (audit) | model3 (audit) |
|---|---|---|---|
| Defects found | 23 | **73** | 6 |
| Defects with file:line and a stated mechanism | few | **all** | some |
| Verified wrong on re-read | 1 | 0 | 3 |
| Found the cross-tenant write (D3) | no | **yes** | no |
| Found the autosave loop (D1) | symptom only | **yes, with cause** | no |
| Found the Art. 30(2) `clientId` dead end (D16) | partly | **yes** | no |
| Regulatory depth | good | **very good** | good, and best on Art. 9(2) framing |
| Actionability of the "should do" list | narrative | **148 numbered, prioritised items** | 7 thematic pillars |
| Honest about its own confidence | yes | **yes, explicitly** | no |

**model2** is best because every claim carries a file, a line and a mechanism, which is what made
this verification pass possible at all — I could confirm or falsify each one by reading the same
code. It also found, alone, the five findings that matter most: the cross-tenant TIA write, the
autosave write loop, the `clientId` dead end that empties the Article 30(2) record, the create-form
fields that are silently dropped, and the vendor dropdown whose options all carry `undefined`. Its
capability list is the only one that could be handed to a team as a backlog. Its weaknesses are
length and a handful of runtime claims that static review cannot fully settle — which it flags
itself, in a closing note.

**model1** is second, and the best-written of the three. Its judgment is sound, its prose is the most
readable, its Article 30 requirement table and phased plan are strong, and it is scrupulous about
marking inference as inference. It simply saw less: it missed D3, D10, D11, D16, D19 and the true
cause of D1.

**model3** is third. It is the most confident and the least reliable. It reads as a sales artefact —
an invented consultant byline, ASCII scorecards, and a competitor matrix scoring OneTrust "2/10" on
UI — and, more seriously, **its Part I describes broken features as working**. Its unique
contributions are real and are carried into this document: the Article 9(2)(a)–(j) gap framed as the
critical regulatory defect it is, Article 10, the WP248 nine-criteria screening table, DPF
certification verification, transfer chaining, and the named regulator export packs (CNIL, ICO,
BfDI/DSK, AEPD).

## Adjudications where the three disagreed

**1. Do the phantom form fields break the autosave?**
model1 said Drizzle throws on unknown keys, so "either the debounced autosave is failing for users
on every edit, or something else strips these keys". model2 said they are silently discarded.
**model2 is right.** In drizzle-orm 0.45.2, `PgDialect.buildUpdateSet`
(`node_modules/drizzle-orm/pg-core/dialect.cjs:102–118`) iterates the *table's* columns and keeps
only those present in the set object, so unknown keys are ignored. The four autosaving tabs do
persist their real fields. The failure mode is narrower and nastier: it bites only when the set
contains *no* real column — which is exactly what a Data Categories or Transfers inline edit sends
(D5, D7), because those child mutations call `.set(input.data)` with no `updatedAt` merged in.

**2. Does the History tab render diffs?**
model3 describes a "Visual Diff Inspector" rendering "green/red side-by-side diff blocks". **It does
not.** `HistoryTab.tsx:97` reads `newValue`/`details`; the columns are `changes`/`metadata`
(`schema.ts:925–926`). model1 and model2 both had this right. This is the clearest instance of
model3 describing intent rather than behaviour.

**3. Do the `retentionSchedule` / `securityNotes` mismatches cause silent data loss?**
model3 lists them as "silent data non-persistence on certain tabs". **Wrong mechanism, wrong
consequence.** The zod resolver never runs at all — `handleSubmit` is destructured at
`RopaEditor.tsx:72` and never called — so nothing is stripped client-side, and the retention
dropdown and security notes write `retentionPeriod` and `securityMeasuresDetail` through
`handleFieldChange`, which persist correctly. The real consequences of the mismatch are that
**validation is dead** (D46, D47) and that five declared fields have no column to land in.

**4. Are the second and subsequent autosaves always conflicts?**
model1 said the editor never advances its copy of `updatedAt`, so every save after the first is a
`CONFLICT`. **Half right.** `onSettled` invalidates `ropa.get`, whose refetch does replace
`initialData` with a fresh `updatedAt`. But the D1 render loop can fire the next save before that
refetch lands, so the conflict is intermittent rather than certain — model2's framing ("spurious
CONFLICT … on a record nobody else touched") is the accurate one. Fixing D1 removes most of it;
tracking the returned `updatedAt` in state removes the rest.

**5. Is the cross-tenant TIA write real?**
Only model2 raised it. **Confirmed** at `tia.ts:92` and `:115`. It is the most serious finding in
all three documents, and it is the reason Sprint 0 begins where it does.

**6. Is the sub-table tenancy design a flaw?**
model3 called the absence of `organization_id` on the three child tables an architecture flaw.
**Partly right, and framed misleadingly.** It is not a security flaw — `assertOwned` and
`assertParentOwned` handle isolation correctly and deliberately, and this repository's own working
notes explain why. It is a performance and reporting limitation, which is how it is carried here
(A17).

**7. Does the CSV round trip destroy the register?**
model3 says re-importing an export destroys 90% of the Article 30 record. **Overstated as
phrased** — import creates new rows rather than overwriting existing ones, so nothing is destroyed;
it duplicates. The real defects are that the export carries eight fields and only loaded pages
(D35), and that the importer has no update-by-key, so a re-import duplicates the register.

---

# Appendix B — Target field specification

The record Custodia should be able to store. **M** = mandatory before an activity may be published.

**Activity** — reference/ID `M` · name `M` · description · legal entity `M` · department or business
process `M` · business owner `M` · privacy owner `M` · status `M` · version `M` · approval, who and
when `M` · review cadence `M` · last reviewed / next review `M` · risk tier · criticality · tags ·
frameworks in scope `M` · source of record · confidentiality classification.

**Purpose** (1..n) — description `M` · lawful basis `M` · basis detail or statutory citation · LIA
reference if 6(1)(f) `M` · consent mechanism and consent-record reference if 6(1)(a) `M` · Art. 9(2)
condition and national-law basis if special category `M` · Art. 10 basis if criminal data `M` ·
Art. 6(4) compatibility assessment if secondary use · primary-purpose flag.

**Data subject categories** (1..n) `M` — category · is child · is vulnerable · estimated volume band
· jurisdictions.

**Data categories** (1..n) `M` — element or category from the catalogue · group · special-category
type · criminal-data flag · identifiability · source per Art. 14(2)(f) `M` · necessity justification
· retention rule `M` · systems where held.

**Processing operations** `M` — the Art. 4(2) verbs · automated decision-making flag with logic,
significance and consequences (Art. 22) · profiling flag · systematic monitoring flag · large-scale
flag · public-area monitoring flag · innovative-technology flag.

**Recipients** (0..n) — recipient category `M` · named recipient · role (controller / processor /
joint / sub-processor) `M` · country `M` · purpose of disclosure `M` · legal basis for disclosure ·
DPA reference, status and expiry if processor `M` · Art. 28(3) clause coverage · sub-processors ·
audit rights · onward-transfer permission.

**Transfers** (0..n) — exporter entity `M` · importer entity `M` · destination country `M` ·
adequacy status, computed `M` · mechanism `M` · mechanism detail (SCC year, module, annexes; BCR
reference; Art. 49 sub-reason) `M` · execution date · expiry · document · supplementary measures ·
TIA reference and outcome `M` · onward transfers · frequency and volume · suspension status.

**Retention** `M` — schedule reference · period · trigger event `M` · computed disposal date ·
statutory citation · justification `M` · deletion method `M` · deletion evidence · legal hold ·
review date `M`.

**Security (Art. 32)** `M` — measures mapped to 32(1)(a)–(d) `M` · technical versus organisational ·
per-measure owner, implementation date, evidence and last-tested date `M` · inherited org baseline ·
certifications relied upon · deviations with justification.

**Assessments** — DPIA screening outcome and rationale `M` · DPIA reference and status · Art. 36
consultation · LIA reference · TIA references · last assessment review date.

**Controller identity block (Art. 30(1)(a) / 30(2)(a))** `M` — controller legal name, address,
country and contact `M` · joint controllers with contacts and the Art. 26 arrangement `M` · EU
representative (Art. 27) where applicable `M` · DPO name, contact and appointment date `M` · for
processor records, each controller's identity, contact, representative and DPO `M`.

**Register level** — supervisory authority · lead authority (Art. 56) · Art. 30(5) derogation
assessment · register attestation (who, when, signature) · negative assertions ("no Art. 10 data is
processed", "no transfers outside the EEA occur").

---

*Consolidated from three independent audits and re-verified by static review of the source at commit
`9d28953` (drizzle-orm 0.45.2). No running instance or database was exercised. Every **[V]** finding
cites a file and states its mechanism, so each can be confirmed or falsified by reading the same
code; **[S]** findings describing runtime failures should be reproduced against a live instance
before they are scheduled.*

*Amended 17 August 2026 with the Sprint 0 remediation (§0.1). The findings are unchanged from the
audit; only **FIXED** markers, per-defect fix notes and §0.1 were added, so the two can still be
read against each other. Line and file references in the findings point at the code **as audited**
and several have since moved. The **[S]** caveat above still stands: the fixes were verified by
`npm run check`, by re-reading the same code, and — for D3 — by reintroducing the defect to confirm
the new guard fires. No running instance or database was exercised for them either.*

*Amended 19 August 2026 with the Sprint 1 build (§0.2), a rescored scorecard, and the Part V build
order marked. Part I, Part II and Parts III–VI are otherwise unchanged and describe the module as
audited — Part I in particular now documents behaviour that no longer exists, and is kept because
the audit and the work done against it have to remain readable side by side.*

*What was and was not exercised for Sprint 1, stated as plainly as the caveat above. **Verified:**
`npm run check` at 0 type errors in both workspaces with every guard green; 95 assertions across
`ropaCompleteness.test.ts` and `ropaVocabularies.test.ts`, covering the publication gate, the
Article 9(2) national-law rule, the Article 10 separation, per-category retention with its
activity-level fallback, the repealed 2010 clauses, DPF scope, and both `transfer_mechanism`
vocabularies; and migration `0046` applied to the Supabase instance and then checked column by
column — 68 columns and 3 unique constraints present, row counts unchanged. **Not exercised:** no
part of the new interface was opened in a browser. The tRPC procedures, the seeding path, the
subject-category backfill and every screen listed in §0.2 are unrun. They typecheck, the tenancy
guard passes over them, and that is a different claim from working.*

---

*Amended 21 August 2026 with the Sprint 3 build (§0.4), a rescored scorecard, superseding notes
against the Part I and Part III passages Sprint 3 answers, a rescored Part VI, and the Part V build
order marked. The findings in Part II are still unchanged. Part I still describes the module as
audited and now documents rather more behaviour that no longer exists — the outputs table in §1.7
in particular describes an export surface that has been deleted — and is kept for the same reason
as before.*

*What was and was not exercised for Sprint 3, stated as plainly as the two caveats above.*

***Verified:*** *`npm run check` at 0 type errors in both workspaces with every guard green,
including `check:tenancy` over 176 procedures and 115 write statements and `check:ropa-i18n` over
30 files. 495 assertions across seven fixture suites, two of them new: `assessments.test.ts` (109)
covers the screening verdict order — Art. 35(3) settling the question before the nine criteria get
to downgrade it — the jurisdiction-scoped blacklists, unanswered-versus-“no”, the LIA’s conditional
blockers, the TIA’s three self-contradictions, the risk matrix and its unmitigated-risk fallback,
and the content hash’s stability under key reordering and Date-versus-string round trips.
`ropaExportFormats.test.ts` (50) reads every generated workbook back out of its own buffer and
asserts on the cells: that “None” is printed rather than a blank, that a missing Art. 10 basis says
so, that an empty regulator sheet still carries its headers, and that the processor record names
the client rather than the agency. `check:schema` confirms `schema.ts` and `drizzle/` agree.*

***Not exercised, and this is a longer list than Sprint 1’s:*** *migration `0048` is **generated
and committed but not applied** — unlike 0046 and 0047, nothing in Sprint 3 has been run against a
live database, so every claim about the schema is a claim about the migration file.* [**Corrected
21 August 2026: 0048 was already applied when this was written. See §0.4.**] * No part of the
new interface was opened in a browser: the LIA panel, the screening panel, the TIA panel, the
`/dpia` route and its editor, the export menu and the rebuilt History tab are unrun. **No PDF has
been rendered** — `ropaRegister.tsx` was rewritten against a payload shape the fixtures verify the
server produces, but `@react-pdf/renderer` was never invoked on it, so the sixty-page detail cap,
the section numbering and the layout are reasoned rather than observed. The four regulator packs
were checked as workbooks, not against an authority’s published template side by side. They
typecheck, the guards pass over them, the fixtures cover the logic underneath them, and that is
still a different claim from working.*

---

*Amended 21 August 2026 with the Sprint 4 build (§0.5), a rescored scorecard carrying a new
Retention management row, a rescored Part VI, and the Part V build order marked with what
comes next. Part II's findings are still unchanged, and Part I still describes the module as
audited.*

*What was and was not exercised for Sprint 4, stated as plainly as the three caveats above.*

***Verified:*** *`npm run check` at 0 type errors in both workspaces with every guard green,
including `check:tenancy` over 207 procedures and 143 write statements, `check:relations` over
49 relations blocks, `check:messages` over 3,190 keys in three locales and `check:ropa-i18n`
over 42 files. 644 assertions across nine fixture suites, two of them new.
`retention.test.ts` (71) covers the calendar arithmetic — 31 January plus one month lands on
28 February, 29 February plus a year clamps — the three disposal-date outcomes, the refusal to
parse "reviewed annually" into a date, indefinite retention being lawful *with* a justification
and a finding without one, hold expiry evaluated rather than trusted, and the transfer map
counting `pending_assessment` as no mechanism. `ropaIntelligence.test.ts` (78) covers the
consequence split between a consent activity and a contract one, a narrowing not obliging a
DPIA, the model's inability to clear a verdict the rules found decisive, a transfer with no
mechanism being reported as a notice gap rather than described, an invented lawful basis never
reaching the register, and "I am not sure" producing no merge candidate. `drizzle-kit generate`
run a second time reports no changes, so `schema.ts` and `drizzle/` agree.*

*And, added after the fact: **migration `0049` was applied on 21 August 2026 at 12:07 UTC**
and then checked against `information_schema` rather than taken on trust — nine tables, four
added columns, thirty-nine foreign keys, twenty-two indexes, six unique constraints, and no
two constraint names in the schema colliding despite four being truncated at 63 characters.
That is a structural check, not a behavioural one: it says the objects exist and says nothing
about whether a disposal row is ever written into them.*

*One thing was verified here that the three previous sprints did not do: **`next build`
completes**, and all six new routes appear in the route table — `/ropa/retention`,
`/ropa/discovery`, `/ropa/intake`, `/ropa/insights` and `/intake/[token]`, plus the rebuilt
`/ropa/new`. That is not the same as the pages working, but it does rule out the class of
failure `tsc` cannot see on its own: a server/client boundary violation, a bad import in a
route segment, or a page that cannot be compiled at all. The sitemap's vendor lookup fails
during the build for want of a database and falls back to static routes, which is
pre-existing and is what `check:sitemap` asserts against.*

***Not exercised:*** *no part of the new interface
was opened in a browser: the retention workbench, the discovery queue, the intake console, the
public questionnaire, the insights page with its four tabs, the draft panel and the activity
flow are unrun. **No model was called** — `ropa.draft.generate` and the material-change
narrative judgement are covered by fixtures over `validateProposal` and `applyNarrativeVerdict`
respectively, but no Anthropic request has been made through either path, so the prompts are
reasoned rather than observed. **No webhook was delivered.** The queue-name fix is a
one-character-class change that `tsc` cannot verify and no test exercises; it is correct by
inspection against `createWorker`'s own argument, and that is the whole strength of the claim.
**No email was sent**, so the intake token round trip — the one flow in Sprint 4 that depends on
a message reaching somebody outside the organisation — is unproven end to end. The three
dispatchers are in `DORMANT_JOBS` and have therefore never executed, including against the
author's own data. They typecheck, the guards pass over them, the fixtures cover the logic
underneath them, and that is still a different claim from working.*
