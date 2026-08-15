---
name: verify-and-ship
description: The verification workflow for Custodia — exactly what `npm run check` runs, how to diagnose each of the seven guards when it fails, what is deliberately outside the gate (check:schema, web vitest, Playwright, the live probe), and which commands look like they verify something but do not. Use before committing, when a check fails, when asked whether work is ready to ship, or when tempted to run a bare `tsc`.
---

# Verifying work in Custodia

## The one command

```bash
npm run check
```

Run it from the repo root. That is the gate. Nothing else is.

It expands to nine steps, in order, short-circuiting on the first failure:

| # | Step | Workspace | Needs env? |
|---|---|---|---|
| 1 | `typecheck` (`tsc --noEmit`) | apps/api, apps/web | no |
| 2 | `check:tenancy` | apps/api | no |
| 3 | `check:relations` | apps/api | no |
| 4 | `check:nocheck` | apps/api | no |
| 5 | `check:params` | apps/web | no |
| 6 | `check:sitemap` | apps/web | no |
| 7 | `check:messages` | apps/web | no |
| 8 | `test:fixtures` | apps/api | no |
| 9 | `test:consent-cookies` | apps/api | no |

Both workspaces are at **0 type errors**. Keep them there. `apps/api` carried a
37-error "baseline" until August 2026, caused by `"types": []` in its `tsconfig.json`
suppressing the already-installed `@types/jest`. All 37 were in test files and two
were real bugs hiding in the noise. Any error you see now is one you introduced.

## Things that look like verification and are not

| Command | Reality |
|---|---|
| `npx tsc --noEmit` at the root | **There is no root `tsconfig.json`.** It checks nothing and exits 0. The GitHub workflow does exactly this. |
| `npx eslint` / `npm run lint` | **Cannot run at all.** `apps/web/eslint.config.mjs` throws `TypeError: tailwind.configs.flat/recommended is not iterable` on ESLint 9.39.4. No code in this repo has ever been lint-checked. |
| `npm test --workspace=apps/api` | No such script. Three test styles exist there; see `api-test`. |
| A green `tsc` | Every bug that has reached production-shaped code in this repo was invisible to `tsc`. That is why the guards exist. |

## Diagnosing each guard

### `check:tenancy` — apps/api/src/scripts/check-tenant-scoping.ts

**What it asserts:** no tRPC procedure filters on a client-supplied id
(`eq(table.col, input.somethingId)`) without proving the row belongs to the caller's
organisation.

**Proofs it accepts:** `eq(x.organizationId, …)`, `assertOwned(`,
`assertParentOwned(`, `assertDomainInOrg(`.

**When it fires:** add the missing ownership check. Full patterns in
`trpc-procedure`. Do **not** reach for the allowlist first.

**The allowlist:** `ALLOWED` in that script, keyed `file.ts::procedureName`, each
entry carrying a prose reason. Two shapes legitimately belong there — rows scoped to
a *user* rather than an org (stricter, so fine), and genuinely shared reference data
(the vendor and regulatory catalogues, the public assessment flow). A **stale entry
also fails**, so the list cannot rot quietly. Adding to it is meant to feel like a
decision; write the reason as though someone will audit it, because they will.

### `check:relations` — apps/api/src/scripts/check-relations.ts

**What it asserts:** every `with: { … }` key in a Drizzle relational query resolves
to a relation defined in `packages/db/src/schema.ts`. Scans both `apps/api/src` and
`apps/web/src`.

**Why:** `with:` is **not typechecked**. For a table with no `relations()` block,
Drizzle widens the key type and `tsc` accepts any name. At runtime it throws
`Cannot read properties of undefined (reading 'referencedTable')` while *building*
the query — so the endpoint fails on every call, not on some unlucky row. Fourteen
call sites across nine files were in that state until August 2026, including the
nightly `gap-scanner` and every webhook delivery.

**Fix:** add the `relations()` block to `schema.ts`. Relations are TS-only metadata —
this is **not** a schema change and `check:schema` stays clean. The guard also
catches a `many()` whose target declares no `one()` back, because that is what
Drizzle infers the join from.

### `check:nocheck` — apps/api/src/scripts/check-ts-nocheck.ts

**What it asserts:** no file in `apps/api` carries `@ts-nocheck`. **No allowlist, by
design.**

**Why:** the pragma is worse than a broad `any` because it is invisible — nothing in
the output of `npm run check` mentions the file at all. Ten files carried it until
August 2026; removing it surfaced eighteen errors, three of which were a service that
could not boot and a tRPC context missing `db` that broke every `publicProcedure`.

**Fix:** type the file. If a specific line genuinely cannot be typed, use
`@ts-expect-error` on that line — it stays visible and fails once the underlying
problem is fixed.

Note the asymmetry: this guard covers `apps/api` only. Several older `apps/web`
client components still carry `@ts-nocheck` (`(app)/analytics/page.tsx` among them).
Do not add it to new web files; the web workspace is at 0 errors.

### `check:params` — apps/web/scripts/check-async-params.mjs

**What it asserts:** no route file declares `params` or `searchParams` as a plain
object.

**Why:** synchronous `params` access was removed in Next 16. A page typed
`{ params: { id: string } }` reads `params.id` as `undefined` at runtime — the page
renders, the query gets no id, and `tsc` cannot object because the page declared that
type itself. Four pages were broken this way.

**Fix:**

```tsx
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
}
```

The guard skips client components, which correctly receive an already-awaited object
as a prop.

### `check:sitemap` — apps/web/scripts/check-sitemap.mjs

**What it asserts:** (1) every route listed in `src/app/sitemap.ts` resolves to a real
page file; (2) every marketing page is either listed or named in the script's
`EXCLUDED` map with a reason.

**Why:** the sitemap hardcodes its route lists and by August 2026 had drifted in both
directions — advertising four URLs that 404'd and omitting twelve of fifteen GDPR
guides plus every other page with real ranking potential.

**Fix:** add the route to `sitemap.ts`, or add it to `EXCLUDED` with a reason. Stale
`EXCLUDED` entries fail too. Only relevant when you touch `(marketing)`.

### `check:messages` — apps/web/scripts/check-messages.mjs

**What it asserts,** four ways: every namespace exists in all three locales; the
namespace list in `i18n/request.ts` matches the files on disk in both directions;
`de` and `fr` carry exactly the keys `en` carries; and ICU placeholders match — a
translation may not drop or invent a `{name}`.

**Why:** next-intl does **not** fall back to the default locale. A missing key renders
the raw dotted path — `dashboard.metrics.gaps` verbatim, in a live UI, for every
German and French reader.

**Fix:** see `i18n-namespace`. Keys beginning with `_` are translator annotations and
are skipped.

### `test:fixtures` and `test:consent-cookies`

Standalone `tsx` scripts, pure, no environment needed. `test:fixtures` runs the
consent evaluator against `lib/__fixtures__`; `test:consent-cookies` covers cookie
classification in the consent scanner. If either fails you have changed evaluator
behaviour — decide whether the fixture or the code is wrong before editing either.

## Outside the gate — run these when relevant

| Command | When |
|---|---|
| `npm run check:schema --workspace=packages/db` | **Always, after any `schema.ts` edit.** Not in `npm run check`. Fails if `schema.ts` and `drizzle/` have drifted. See `db-schema-change`. |
| `npm run test --workspace=apps/web` | Vitest, 4 files. Run when touching `hooks/`, `utils/ropaImport`, or the Copilot markdown renderer. |
| `npm run test:e2e --workspace=apps/web` | Playwright. Needs a running app. |
| `npm run test:scoring --workspace=apps/api` | Needs `DATABASE_URL` **set** (never dialled). |
| `npm run probe --workspace=apps/api` | Calls every tRPC **query** over real HTTP against a running service. Catches the two failure modes that fail on *every* invocation: bad `with:` keys, and context wiring. Mutations are enumerated and skipped — 160 of them write real rows, send real email and notify real regulators. |
| `npm run mint-token --workspace=apps/api` | Mints a session JWT so the probe can reach protected procedures. |

The probe deliberately sends ids matching nothing: a `NOT_FOUND` means the procedure
*ran*, which is what is being tested. Only `INTERNAL_SERVER_ERROR` is a failure.

## Pre-commit checklist

1. `npm run check` — green.
2. Touched `packages/db/src/schema.ts`? `npm run check:schema --workspace=packages/db`.
3. Added or edited a tRPC procedure? Re-read `trpc-procedure` and confirm ownership is
   proved for **every** client-supplied id, foreign keys included.
4. Added a user-visible string? All three locales (`i18n-namespace`).
5. Added a recurring job? Decide `DORMANT_JOBS` membership (`background-job`).
6. Never commit `@ts-nocheck` in `apps/api`, and do not add it in `apps/web`.
7. Commit message: `type(scope): what changed, in effect terms`. See `custodia-map`.

## Reporting results

Say what actually ran. If `npm run check` was not run, say so rather than implying it
passed. If a step fails for a pre-existing reason, name the step and the reason —
"both workspaces at 0 errors" is a claim someone will check.
