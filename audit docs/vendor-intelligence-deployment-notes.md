# Vendor Intelligence — deployment notes and open items

Companion to `vendor-intelligence-module-audit-final.md` §0.6/§0.7. This file
records what has actually been applied to the live database, how it was
verified, and the corrections made along the way.

---

## 1. Applied to Supabase — 25 August 2026

Target: `aws-0-eu-north-1.pooler.supabase.com:6543`, project `vmoyeepqfcufqolsiztb`.

### Migrations 0051 and 0052

Both applied via `npm run migrate --workspace=packages/db`, verified present
afterwards.

| Migration | Contents | Recorded hash |
|---|---|---|
| `0051_neat_cerebro` | Six columns on `organization_vendors`: `business_owner`, `contact_email`, `criticality`, `processing_role`, `offboarded_at`, `deletion_certificate_ref` | `4b7a6a9e7c2f…` |
| `0052_unusual_giant_man` | Three register indexes: `idx_ov_org_status`, `idx_ov_org_risk`, `idx_ov_org_review` | `d3db7091fd52…` |

State before the run: last applied was `0050_sticky_anthem`
(`created_at` = 2026-08-24T14:34:10.791Z), and neither 0051's nor 0052's hash was
in `drizzle.__drizzle_migrations`. Both journal entries carry a later `when`, so
the migrator selected exactly these two and nothing else. Verified after: all six
columns present, all three indexes present, both hashes recorded (ids 53 and 54).

**Worth knowing for next time:** the `id` column in `drizzle.__drizzle_migrations`
is a serial, **not** the migration index. When this run started the table held 48
rows with ids up to 52, which reads at a glance as "0052 is already applied" and
is not what it means. The only reliable checks are the file's SHA-256 against
`hash`, and `max(created_at)` against the journal's `when`.

### `prepare: false` in `packages/db/src/migrate.ts`

`DATABASE_URL` is Supabase's **transaction** pooler (port 6543). PgBouncer in
transaction mode hands each statement to whichever backend is free, so a prepared
statement named on one connection is not there on the next. postgres-js prepares
by default, so the migration would have died partway through with
`prepared statement "s1" does not exist`.

This had never surfaced because `apps/api/src/db.ts` uses **node-postgres**,
which does not prepare unless asked — `migrate.ts` is the only postgres-js client
in the repo, and nothing exercises it except a real migration against a real
database. Fixed at the source rather than worked around per-run.

### Risk recalculation

```
npm run recalc:vendor-risk --workspace=apps/api -- --apply
```

Recomputed 5 catalogue vendors across 5 register rows. **Every score was
unchanged**, which is the correct result for this database and not evidence the
run was unnecessary:

| Vendor | Score before | Score after |
|---|---|---|
| Dropbox | 60 (high) | 60 (high) |
| Postmark | 30 (medium) | 30 (medium) |
| Slack | 25 (low) | 25 (low) |
| WXA | 60 (high) | 60 (high) |
| Zendesk | 60 (high) | 60 (high) |

Two formula changes shipped in the Sprint 1 remediation, and neither had any
input to act on here:

- **The D6 review gate** only suppresses the modifier of a questionnaire that is
  completed but not yet reviewed. This database has `0` completed assessments.
- **The Art. 9 vocabulary** only changes how `data_categories_shared` is read.
  That column was never writable before Sprint 1 (D2), so it is `[]` on all five
  rows.

On any database that *has* completed questionnaires or populated data categories
this run moves scores, so it stays a required post-deploy step. `--apply` is also
what stamps `last_risk_assessment`, which is how you can tell it ran.

---

## 2. `ON DELETE SET NULL` on `transfer_impact_assessments` — migration 0053

> **Correction, same day.** An earlier version of this section said the change
> could not be made without renaming the constraint first, because drizzle-kit
> would emit a `DROP CONSTRAINT` naming 68 characters against a constraint
> Postgres had stored truncated at 63. **That was wrong**, and the rename
> procedure it described was unnecessary. Postgres truncates identifiers at
> *parse* time as well as at creation time, so the 68-character `DROP` is
> shortened to the same 63 characters and finds its target. Confirmed by probe
> against the live database — creating a foreign key with the full 68-character
> name on a temp table, then dropping it by that same name, inside a transaction
> that was rolled back. It succeeded, with a `42622` NOTICE on both statements.
>
> The lesson worth keeping is the one about *checking*: the original claim was
> deduced from the documented 63-character limit and never tested, and it was
> confident enough to have a whole remediation procedure built on top of it.

**Wanted:** `transfer_impact_assessments.org_vendor_id` should be
`ON DELETE SET NULL`.

**Why:** four children of `organization_vendors` declare `ON DELETE CASCADE` —
`vendor_assessments`, `vendor_questionnaires`, `vendor_sub_processor_changes`,
`organization_vendor_incident_alerts` — so removing a link destroys them. A
Chapter V transfer impact assessment must not be in that group. It is a document
about a transfer to a third country, it was true when it was written, and
`organization_id` and `vendor_id` still say whose it is and what it covers after
the join row is gone. Until 0053 it carried **no** `ON DELETE` clause at all,
which is the third and worst option: the delete failed with a foreign-key
violation the caller saw as an unexplained 500.

**Why it was deferred, and why that was a mistake:** drizzle-kit composes
foreign-key names as `<table>_<column>_<reftable>_<refcolumn>_fk`, which here is

```
transfer_impact_assessments_org_vendor_id_organization_vendors_id_fk
```

— **68 characters**, so Postgres stored it truncated to 63:
`transfer_impact_assessments_org_vendor_id_organization_vendors_`. This is
cosmetic. The generated migration names all 68 in its `DROP CONSTRAINT`, the
parser truncates that to the same 63, and it resolves.

**What was done:** `onDelete: 'set null'` added to `schema.ts` and
`drizzle-kit generate` run, producing `0053_third_ma_gnuci.sql`:

```sql
ALTER TABLE "transfer_impact_assessments" DROP CONSTRAINT "transfer_impact_assessments_org_vendor_id_organization_vendors_id_fk";
--> statement-breakpoint
ALTER TABLE "transfer_impact_assessments" ADD CONSTRAINT "transfer_impact_assessments_org_vendor_id_organization_vendors_id_fk" FOREIGN KEY ("org_vendor_id") REFERENCES "public"."organization_vendors"("id") ON DELETE set null ON UPDATE no action;
```

No rename, no explicit constraint name, no hand-edited SQL.

**Status: applied to Supabase, 25 August 2026.** Verified afterwards —
`pg_constraint.confdeltype` on
`transfer_impact_assessments_org_vendor_id_organization_vendors_` is now `n`
(SET NULL), where it was `a` (NO ACTION). The migration ran clean, emitting the
expected `42622` truncation NOTICE on both statements and nothing else.

`vendors.unlinkVendor` still clears `org_vendor_id` itself before deleting, and
that stays now that 0053 has landed. It is the only thing that works on a
database where 0053 has not run — a fresh rebuild mid-migration, or an
environment nobody has migrated yet — it costs one statement, and it makes the
intent legible where
the deletion happens: the assessment survives the unlink deliberately, because it
is a document about a transfer that took place. The procedure also refuses
outright when the relationship carries evidence unless the caller confirms, and
`vendors.unlinkImpact` reports what would be lost so the dialog can name it.

---

## 3. Everything applied, and what was not

All three migrations — `0051`, `0052`, `0053` — are applied to Supabase and
recorded in `drizzle.__drizzle_migrations` (ids 53, 54, 55), and the risk
recalculation has been run. Committed and pushed to `main`.

The verification query for the `0053` constraint, worth keeping because the name
in `pg_constraint` is not the name in the `.sql`:

```sql
SELECT conname, confdeltype FROM pg_constraint
WHERE conrelid = 'transfer_impact_assessments'::regclass
  AND contype = 'f' AND conname LIKE '%org_vendor%';
-- confdeltype: 'n' = SET NULL, 'a' = NO ACTION, 'c' = CASCADE
```

Not done:

- **No seed was re-run.** `npm run seed:vendors --workspace=packages/db` was not
  needed: all 2 US vendors in this catalogue already carry
  `data_privacy_framework`.

## 4. Provenance note

`vendor-intelligence-sprint-0-remediation.md` gained a §6 ("What could be done
better / Latent risks and remaining debt", 39 lines) during the same working
session as the Sprint 1 review, from a different author. It is unrelated to the
remediation recorded in §0.7 of the main audit and has been left as found. Its
first item — the `dpa-expiry-checker` terminating in `console.log` rather than
`queueNotification` — is still open and is **not** covered by the Sprint 1
remediation.
