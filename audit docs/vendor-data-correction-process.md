# Vendor catalogue — correction process

**Sprint 10, VD-20.** Custodia publishes assertions about named third parties: where a
company is established, what transfer mechanism it offers, whether its Data Privacy
Framework certification is current. Those assertions are shown to that company's
customers and end up in an Article 28 dossier a customer may hand a regulator.

Until this sprint there was no procedure for *"your record of us is wrong"* and no rule
for what should win when a person recorded an answer by hand. A registry row that was
wrong about a company was, literally, uncorrectable by anything the product offered.

> **§4 is the part that is a commitment rather than a mechanism.** The route and the
> intervals below are now settled and can be published; what is deliberately *not*
> written here is an individual's name, because a published process names a role and an
> internal rota names the person. Attach the person to the role in the operations
> runbook, and revisit the intervals once there is enough volume to know whether they
> are honest.

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

## 4. Receiving a request

A vendor or a customer who believes a record is wrong needs somewhere to send that, and a
commitment about what happens next.

| | |
|---|---|
| Where a correction request arrives | `support@custodia.io`, subject line beginning `Vendor record correction` |
| Who owns triage | The **Data Protection Officer**, as Custodia's own data-quality owner |
| Acknowledgement | 5 working days |
| Resolution, or a reasoned decision not to change the record | 20 working days |
| If the requester disagrees with the decision | The disputed field is **suppressed** — its provenance row is deleted, so the field renders as "not yet verified" — while the DPO reviews. A record we cannot stand behind is not published in the meantime. |

Three notes on the choices, because each was a decision rather than a default.

**The address is the one that already exists.** `support@custodia.io` is the address the
product publishes on its own support and SSO pages, so it is monitored and a correction
request will reach a person today. A dedicated alias is a better long-term answer and can
replace this line without any other change; inventing one now would have published a route
that bounced.

**The owner is a role, not a person.** A published process that names an individual is
wrong the first time somebody changes job, and a vendor reading it cannot tell whether the
name is current. The DPO is a role this product already models. Attach the person to the
role in the internal rota, and treat the rota as the thing that keeps this honest.

**The intervals are administrative, not legal, and are described as such.** A correction
request about business-level facts — where a company is established, what its DPA says —
is **not** an Article 16 rectification request and must not be answered as though it were.
Where a request *is* about personal data, it is a data-subject request, it goes through the
DSAR path, and it runs on that clock instead: one month under Article 12(3), extendable by
two. Answering a genuine Article 16 request on the 20-day administrative track would be a
breach dressed up as a service level.

**Suppression is a real mechanism, not a promise.** Deleting the provenance row for a
disputed field returns it to the absent tier, which the surface already renders as "not yet
verified" with a hint saying it is a statement about us rather than a finding about the
vendor. That is the correct interim state for a claim under dispute, and it is why absent
had to render without embarrassment (VD-21) before this process could commit to using it.

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
