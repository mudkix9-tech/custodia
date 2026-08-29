# Vendor catalogue corrections — who holds the role

**Internal. Not published, not vendor-facing.**
The vendor-facing document is [`vendor-data-correction-process.md`](./vendor-data-correction-process.md);
it names a *role* because a document a third party reads goes stale the first time
somebody changes job and the reader has no way to tell. This file is the other half: it
names the *person*, and it is the only place that should.

---

## 1. The rule that makes this file safe to be out of date

> **Until the table in §2 names someone else, the role is held by the owner of the
> product.**

That default is the point of this file rather than a caveat on it. A rota with an empty
holder is the failure the audit describes — a process with no named owner is a process
that does not exist — so this one cannot be empty. It always resolves to somebody, and
delegating is an act of writing a row rather than a precondition for the process working
at all.

What it does *not* do is excuse leaving it. A single owner holding every role is a
statement about the size of the company, and it stops being true quietly.

## 2. Holder

| From | Holder | Cover | Note |
|---|---|---|---|
| Sprint 10 (August 2026) | Product owner, by the default in §1 | — | Delegate by adding a row; do not edit this one. |

Add a row when the role moves. Keep the old rows: "who was answerable in March" is a
question an auditor can ask, and the answer should not require reading git history.

## 3. What the holder is answerable for

Four things, and only these — the mechanics are in the process document and in code.

1. **The inbox is watched.** `support@custodia.io` receives correction requests with a
   subject beginning `Vendor record correction`. If nobody is reading it, the published
   five-day acknowledgement is a claim we are not meeting.
2. **The two clocks are met**, or the requester is told why not: 5 working days to
   acknowledge, 20 to resolve or to give a reasoned decision not to change the record.
3. **Suppression is used when it should be.** Where a disputed claim cannot be resolved
   inside the window, the field's provenance row is deleted so it returns to the absent
   tier and renders as "not yet verified". Leaving a contested assertion published while
   deciding is the thing to avoid; suppression costs nothing and is reversible.
4. **The distinction between a correction and a rectification request is held.** A request
   about business-level facts runs on the administrative clock above. A request about
   **personal data** is an Art. 16 request, goes down the DSAR path, and runs on Art.
   12(3) — one month, extendable by two. Answering one of those on the correction track
   would be a breach wearing a service level as a disguise, and the person triaging the
   inbox is the only one positioned to tell them apart.

## 4. Handover

When the role moves, the outgoing holder:

- adds the row in §2 with the date;
- hands over anything open in the inbox, by request rather than in bulk — an open
  correction has a clock running on it and the new holder needs to know which;
- lists any field currently **suppressed** under item 3 above, because a suppressed field
  is an unfinished piece of work that is invisible in the product by design: it looks
  exactly like a field nobody has got to yet;
- confirms that every `analyst` provenance row with a `review_by` in the next 90 days is
  either re-verified or reassigned. Those are findings that a person undertook to read
  again, and the undertaking travels with the role rather than with the individual.

## 5. Reviewing the commitments themselves

The 5- and 20-working-day intervals were set with no volume behind them. They are
defensible as ordinary administrative practice and they are not derived from anything
legal, so they are a promise we chose and can revise.

Revisit them once there is enough traffic to know whether they are honest — and if they
are not being met, change the published document rather than quietly missing them. A
service level nobody meets is worse than a slower one that holds, because the first is a
statement to a third party about how seriously their correction is taken.
