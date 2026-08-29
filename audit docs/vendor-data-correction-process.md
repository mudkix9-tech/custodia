# Vendor catalogue — correction process

**Sprint 10, VD-20.** Custodia publishes assertions about named third parties: where a
company is established, what transfer mechanism it offers, whether its Data Privacy
Framework certification is current. Those assertions are shown to that company's
customers and end up in an Article 28 dossier a customer may hand a regulator.

Until this sprint there was no procedure for *"your record of us is wrong"* and no rule
for what should win when a person recorded an answer by hand. A registry row that was
wrong about a company was, literally, uncorrectable by anything the product offered.

> **This document has one unresolved field: the named owner and the response times in
> §4.** They are marked `TO BE CONFIRMED` and they are the only part of this process
> that cannot be decided in code. A data-quality process with no named owner is a
> process that does not exist.

---

## 1. What can be corrected, and by whom

| | |
|---|---|
| **The shared catalogue** | Facts about the vendor, visible to every tenant. Corrected by a Custodia operator with the `vendors:manage` permission, via `vendors.submitFieldCorrection`. |
| **One tenant's view** | Facts from that tenant's own executed contract. Recorded as a `customer` provenance row, never propagated, and excluded from catalogue resolution entirely. |

The distinction is enforced in `selectAuthoritativeProvenance` (`lib/vendorProvenance.ts`),
which drops `customer` rows when resolving the shared catalogue rather than ranking them
last. Ranking would leave a private contract one deletion away from becoming a public
assertion about the vendor.

## 2. What a correction must carry

`validateAnalystCorrection` refuses anything short of all five:

- **the field** being corrected;
- **the value** — to remove a field, delete its provenance row instead;
- **a named author**, taken from the session and never from the request body, because an
  attribution the caller supplies is one the caller can forge;
- **a source URL and an excerpt of at least 20 characters** — the sentence in the document
  that says so;
- **a review date**, because a finding that never falls due never gets re-read.

The strictness is proportionate to what the row does. An `analyst` row **supersedes the
official register** for its field (`PROVENANCE_PRECEDENCE`), so the row that beats the US
Department of Commerce has to be at least as inspectable as the thing it beats.

## 3. What happens to the value

A correction writes a provenance row. It does **not** write the vendor column.

That separation is deliberate: the provenance row is the record of what somebody
established, and folding it into `vendors` is a separate, reversible step. Doing both at
once would make an override indistinguishable from the thing it overrode, which is the
condition this whole programme exists to prevent.

The correction is audit-logged (`vendors.submitFieldCorrection` is in
`ACTION_TYPE_OVERRIDES`, `RESOURCE_TABLE_MAP` and `ACTION_DESCRIPTIONS`), so it appears in
the vendor's History tab with the author, the timestamp and the URL cited.

## 4. Receiving a request — TO BE CONFIRMED

A vendor or a customer who believes a record is wrong needs somewhere to send that, and a
commitment about what happens next. **These are placeholders and must be filled before
this document is published anywhere a vendor can read it.**

| | |
|---|---|
| Where a correction request arrives | `TO BE CONFIRMED` — a monitored address, not an individual's inbox |
| Who owns triage | `TO BE CONFIRMED` — a named role |
| Acknowledgement | `TO BE CONFIRMED` — proposed: 5 working days |
| Resolution or a reasoned decision | `TO BE CONFIRMED` — proposed: 20 working days |
| Escalation if the requester disagrees | `TO BE CONFIRMED` |

The proposed intervals are a starting point drawn from what is administratively ordinary,
not from a legal requirement — a correction request about business-contact-level facts is
not an Article 16 rectification request, and should not be described as one. Where a
request *is* about personal data, it is a data-subject request and goes through the DSAR
path instead, on that clock.

## 5. Freshness, which is not correction but is adjacent

`provenanceAge()` decays confidence at read time from `retrieved_at`, never writing it
back. A field at its floor renders as "last verified {date}" rather than as a number,
because at that point the honest claim is about when we looked rather than about the
vendor.

| Tier | Half-life | Floor | Why |
|---|---|---|---|
| `registry` | 1825 days | 60 | The weekly sync re-confirms it; an old row is one the sync stopped reaching. |
| `http_probe` | 180 days | 30 | A published DPA is a live document on a URL that moves. |
| `trust_centre` | 180 days | 20 | Same cadence, lower ceiling — a badge evidences the portal, not the report. |
| `analyst` | — | 40 | Decays on its `review_by` date in one step, not on a curve. |
| `customer` | — | 95 | An executed contract does not get less true; its expiry is a date on the contract. |

An analyst row with no `review_by` never ages on its own. That is deliberate: the date is
required at write time, and ageing an undated row quietly would let the omission pass as
a decision.
