---
name: trpc-procedure
description: How to add or modify a tRPC procedure in apps/api without opening a cross-tenant hole — the ownership proof required for every client-supplied id, the assertOwned/assertParentOwned patterns for child tables, permission middleware, cursor pagination, plan limits, audit logging, and wiring the procedure to the web client. Use whenever writing, editing or reviewing anything in apps/api/src/routers/, or when npm run check:tenancy fails.
---

# Adding a tRPC procedure

Read `known-concerns.md` §1 before starting. This is the sharpest edge in the
codebase and it has drawn blood twice.

## The rule

`requirePermission('resource', 'action')` checks **what the user may do**. It does
**not** scope anything to an organisation. Neither does `checkOrgContext`, which only
asserts the user has an org id at all. Org filtering is manual, per query, in every
procedure.

An audit in August 2026 found **47 procedures** with no ownership check — including
ones that let any authenticated user rewrite and approve another organisation's
regulator breach notification. All are fixed. Do not add the 48th.

It reported **22** the first time. The difference was foreign keys: the first pass
only checked `input.id`, and missed procedures keyed on `input.breachId`,
`input.dsarId`, `input.domainId`. **Every** client-supplied id needs a proof, not
just the one naming the row being edited.

## Skeleton

```ts
myProcedure: protectedProcedure
  .use(requirePermission('ropa', 'edit'))
  .input(z.object({
    id: z.string().uuid(),
    data: z.record(z.any()),
  }))
  .mutation(async ({ ctx, input }) => {
    checkOrgContext(ctx.user);

    // ownership proof goes here — see the three cases below

    const [updated] = await ctx.db.update(dpias)
      .set({ ...input.data, updatedAt: new Date() })
      .where(and(
        eq(dpias.id, input.id),
        eq(dpias.organizationId, ctx.user!.orgId),
      ))
      .returning();

    return updated;
  }),
```

Then export the router from `apps/api/src/router.ts` if it is new.

`checkOrgContext` is defined locally at the top of most router files. Copy the local
one; it is not a shared import.

## Case 1 — the table carries `organization_id`

Put the predicate in the same `and()` as the id. One query, no race.

```ts
const [row] = await ctx.db.select().from(consentDomains)
  .where(and(
    eq(consentDomains.id, input.id),
    eq(consentDomains.organizationId, ctx.user!.orgId),
  ));
if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: 'Domain not found' });
```

For an update or delete, the same `and()` in the `where` is the proof — no separate
select needed.

## Case 2 — a child table that does not (most of them)

Use `src/lib/tenancy.ts`. It walks the chain to whatever holds `organization_id`.

```ts
import { assertOwned } from '../lib/tenancy.js';

await assertOwned(ctx.db, {
  table: dpiaMeasures,
  id: input.id,
  orgId: ctx.user!.orgId,
  label: 'Measure',
  via: [
    { table: dpiaRisks, on: eq(dpiaMeasures.dpiaRiskId, dpiaRisks.id) },
    { table: dpias,     on: eq(dpiaRisks.dpiaId, dpias.id) },
  ],
});
```

`via` hops are listed **from the child outwards**; the organisation predicate is
applied to the last one. Options: `table`, `id`, `orgId`, `label`, `via`, and
`idColumn` when the primary key is not `table.id`. It returns the row, so you can use
it instead of a separate fetch.

If the final table has no `organizationId`, `assertOwned` throws a plain `Error`
naming the wiring mistake rather than a `TRPCError` — that is a bug in your `via`
chain, not a user error.

## Case 3 — a client-supplied *foreign* key used as a filter

`list({ breachId })`, `create({ dsarId, … })`. Prove the parent, then query freely.

```ts
import { assertParentOwned } from '../lib/tenancy.js';

await assertParentOwned(ctx.db, breaches, input.breachId, ctx.user!.orgId, 'Breach');
```

This is the case the first audit missed. If the client can name it, prove it.

## Always NOT_FOUND, never FORBIDDEN

`assertOwned` throws `NOT_FOUND` deliberately. "This exists but is not yours"
confirms the id is real, which is the one thing a caller probing other tenants' ids
does not already know. Match that in hand-written checks.

## Impersonation is already handled

`ctx.user.orgId` is the *effective* org after impersonation — `trpc.ts` resolves
`effectiveOrgId` before the procedure runs. Never reach for a raw org id from the
token, and never accept an org id from `input`. Admin and support paths are safe
using `ctx.user!.orgId` exactly as above.

Cross-entity group reads are a separate, audited path
(`verifyGroupScopeAndLog` in `trpc.ts`): reads only, direct children only, every
access written to `audit_logs`. Cross-entity **writes** are forbidden outright.

## Pagination

```ts
import { paginatedQuery } from '../utils/pagination.js';

return paginatedQuery(breaches, ctx.user!.orgId, input, 'createdAt', 'desc');
```

It filters on `table.organizationId` and caps `limit` at 100 (default 25). Cursors
are base64url `{sortValue, id}` pairs; the response is
`{ data, pagination: { has_more, next_cursor, previous_cursor } }`.

**Pass `null` — never an org id — for a table with no `organization_id`,** and prove
ownership through the parent first. Passing an org id to such a table throws a named
error rather than building `eq(undefined, …)`, which is what two DSAR endpoints were
silently doing.

## Permissions

`requirePermission(resource, action)` resolves in this order: custom-role permissions
if `customRoleId` is set, then `ROLE_PERMISSION_DEFAULTS` for the built-in role, then
explicit grants on the user. **An explicit deny (`-resource:action`) always wins.**

Built-in roles, lowest to highest: `viewer`, `member`, `admin`, `owner`. `owner` is
`*:*`. Existing resource:action pairs include `ropa:view|edit|delete`,
`vendors:view|edit|delete`, `dsar:view|manage|respond`,
`breach:view|report|manage`, `training:view|assign|manage`, `users:invite|manage`.

Reuse an existing pair wherever the semantics fit. Inventing a new one means no role
grants it by default, so only `owner` can call the procedure until
`ROLE_PERMISSION_DEFAULTS` is updated too.

`requireRole('admin')` exists for coarse gates. Prefer `requirePermission`.

## Side effects that most mutations want

```ts
// Re-embed the entity for the Copilot's retrieval
await orgEmbeddingsQueue.add('embed-dpia', {
  orgId: ctx.user!.orgId, entityType: 'dpia', entityId: updated.id, action: 'upsert',
});

// Re-derive compliance gaps hanging off this entity
await syncDpiaGaps(updated.id);

// Enforce the plan's ceiling before creating a billable row
await enforceLimit(ctx.user!.orgId, 'vendors');
```

Audit logging is **automatic** — a middleware in `trpc.ts` writes to `audit_logs` for
mutations, sanitising the payload and diffing against the prior state. You do not
call it by hand. It does mean a mutation name is user-visible in the ledger, so name
procedures for what they do to the domain.

## Reads: `db.query` versus `db.select`

Where the surrounding file uses `ctx.db.query.<table>.findMany()`, keep using it —
that is what the standalone tests can mock. A `db.select()` call silently escapes the
mock and tries to open a real connection. See `api-test`.

If you use `with: { … }` in a relational query, **the key is not typechecked**. Add
the `relations()` block in `schema.ts` or it throws on every call. See
`db-schema-change` and run `npm run check:relations --workspace=apps/api`.

## Wiring to the web client

No codegen. `apps/web/src/utils/trpc.ts` is `createTRPCReact<AppRouter>()`, so a new
procedure is available the moment `tsc` sees the router type:

```tsx
const { data, isLoading } = trpc.breaches.list.useQuery({ limit: 25 });

// paginatedQuery-backed procedures pair with useInfiniteQuery
const { data, fetchNextPage, hasNextPage } = trpc.breaches.list.useInfiniteQuery(
  { limit: 25 },
  { getNextPageParam: (lastPage: any) => lastPage.pagination?.next_cursor },
);
const rows = data?.pages.flatMap((p: any) => p.data) ?? [];
```

## Before you commit

1. `npm run check` — `check:tenancy` is step 2 and will catch a missing proof on
   `input.*Id`, but only where it can see the pattern. It is a text scan.
2. Re-read your own procedure asking: *for every id the client supplied, what line
   proves it is theirs?* The guard cannot see an id you passed through a helper.
3. If the guard fires and the procedure is genuinely cross-tenant by design, add it
   to `ALLOWED` in `check-tenant-scoping.ts` **with a reason** — the two legitimate
   shapes are user-scoped rows and shared reference data (vendor/regulatory
   catalogues, the public assessment flow). A stale entry fails too.
4. `npm run probe --workspace=apps/api` against a running service if the procedure is
   a query — it catches build-time throws no test will.

## Related

`verify-and-ship` · `db-schema-change` · `api-test` · `custodia-map`
