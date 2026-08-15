---
name: db-schema-change
description: How to change the Drizzle schema in packages/db — generate rather than hand-write migrations, the check:schema drift gate that is deliberately outside npm run check, why `with:` keys are not typechecked and when a relations() block is required, the unique-constraint reconciliation idiom used by consent_findings, and the NOT NULL rule that makes it work. Use when editing packages/db/src/schema.ts, adding a table or column, adding a relation, or when a query throws "Cannot read properties of undefined (reading 'referencedTable')".
---

# Changing the database

Schema is **one file**: `packages/db/src/schema.ts` (~2,200 lines, 23 `relations()`
blocks). The package is imported as `db` — `import { consentFindings } from 'db'` —
and exports tables, relations and the Drizzle instance's schema in one namespace.
49 migrations in `packages/db/drizzle/`.

## The workflow

```bash
# 1. edit packages/db/src/schema.ts
npm run generate --workspace=packages/db      # drizzle-kit generate -> drizzle/NNNN_*.sql
# 2. read the generated SQL. Actually read it.
npm run migrate  --workspace=packages/db      # apply
npm run check:schema --workspace=packages/db  # confirm no drift
npm run check                                  # from the root, as always
```

**Never hand-write a migration file.** `check:schema` re-runs `generate` and fails if
anything appears in `git status --porcelain drizzle/`, so a hand-edit shows up as
drift on the next run — usually in someone else's branch.

**`check:schema` is not part of `npm run check`.** It shells out to `drizzle-kit` and
writes files, so it stays opt-in. That means schema drift passes the main gate
silently. Run it yourself after every `schema.ts` edit; nothing else will.

`npm run push --workspace=packages/db` exists (`drizzle-kit push`) and skips the
migration file entirely. Use it only against a scratch database. Anything that
reaches a shared branch needs a generated migration.

## Relations are not a schema change

`relations()` is TS-only metadata. Adding one changes no SQL, so `check:schema` stays
clean — but it is the fix for the loudest runtime failure in this repo.

**`with:` in a relational query is not typechecked.** For a table with no
`relations()` block, Drizzle widens the `with` key type and `tsc` accepts any name.
At runtime the dialect looks the key up, gets `undefined`, and throws

```
Cannot read properties of undefined (reading 'referencedTable')
```

while *building* the query. The caller therefore fails on **every** invocation, not on
some unlucky row. Fourteen call sites across nine files were in that state until
August 2026, including the nightly `gap-scanner` and every webhook delivery.

The same throw covers a `many()` whose target declares no `one()` back — that is what
Drizzle infers the join from. Both directions or neither:

```ts
export const dpiasRelations = relations(dpias, ({ many }) => ({
  risks: many(dpiaRisks),
}));

export const dpiaRisksRelations = relations(dpiaRisks, ({ one, many }) => ({
  dpia: one(dpias, { fields: [dpiaRisks.dpiaId], references: [dpias.id] }),
  measures: many(dpiaMeasures),
}));
```

Then:

```bash
npm run check:relations --workspace=apps/api
```

It resolves every `with` key in `apps/api/src` **and** `apps/web/src` against
`schema.ts`. It is a text scan and only understands `with` written as an object
literal directly in the query options, which is how every call site here writes it.

## Unique constraints carry logic here

The pattern used by `consent_findings`, and specced for `integration_signals`:

> A `UNIQUE` on the natural key means an upsert bumps `last_seen_at`, and anything a
> completed run did **not** touch flips to `resolved`.

That single constraint buys idempotent re-runs, disappearance detection, and dated
remediation evidence with no extra code. Reach for it whenever a scanner or
reconciliation job produces rows.

**Every column in such a key must be `NOT NULL`.** Postgres treats NULLs in a unique
constraint as distinct, so a nullable member lets rows duplicate on every run. This
is why `observed_host` defaults to `''` rather than being nullable — an empty string
collides, a NULL does not.

A related bug already caught: eleven findings persisted as one row because the key
was too *narrow*. Get the natural key right before generating.

The `gap-scanner` uses the application-level cousin of this: a fingerprint string
`entityType:entityId:gapType` matched with a `findFirst`. Prefer the database
constraint in new work.

## Query style, and why it constrains you

Where the surrounding file uses `db.query.<table>.findMany()`, keep to it. That is
what the standalone tests mock; a `db.select()` call silently escapes the mock and
tries to open a real connection. See `api-test`.

`DATABASE_URL` must be **set** for anything importing `db.js` — the module throws on
import — but it is never dialled if every query is mocked.

## Typechecking blind spot

`packages/db` has **no `typecheck` script**, so `npm run typecheck --workspaces
--if-present` skips it. `schema.ts` is only checked transitively, via `apps/api` and
`apps/web` importing it. A mistake nothing imports yet is unchecked by anything.

## Before you commit

1. Read the generated SQL. A `DROP COLUMN` or a `NOT NULL` on a populated table is a
   data decision, not a schema decision — surface it rather than shipping it.
2. `npm run check:schema --workspace=packages/db` — clean.
3. `npm run check:relations --workspace=apps/api` — clean, if you added `with:`
   anywhere or a new table that will be joined.
4. `npm run check` from the root.
5. Backfills go in their own migration, after the structural one.

## Related

`verify-and-ship` · `trpc-procedure` · `api-test` · `background-job`
