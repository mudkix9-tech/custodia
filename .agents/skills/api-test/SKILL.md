---
name: api-test
description: How testing actually works in Custodia — apps/api has three test styles and only one of them runs, so write standalone tsx scripts that mock db.query and restore in a finally. Covers the NODE_ENV/DATABASE_URL rules, why db.select escapes the mocks, what the web vitest and Playwright suites cover, and the live probe. Use before writing any test, when a test file appears not to run, or when deciding how to verify new apps/api code.
---

# Testing

## The trap

**`apps/api` has three test styles and only one of them runs.**

| Style | Files | Status |
|---|---|---|
| Standalone `tsx` scripts | `*.test.ts` run via an npm script | **Runs.** Write these. |
| vitest | several `*.test.ts` in `lib/` and `workers/` | Never runs — vitest is installed in `apps/web` only |
| jest | `lib/billing.test.ts` | Never runs — jest is not installed at all |

All three **typecheck**, which is exactly what makes it easy to believe the suite
exists. There is no `npm test` in `apps/api`; a file only runs if a script names it.

The two wired into `npm run check`:

```bash
npm run test:fixtures       --workspace=apps/api   # consent evaluator, pure
npm run test:consent-cookies --workspace=apps/api  # cookie classification, pure
npm run test:scoring        --workspace=apps/api   # needs DATABASE_URL set
```

Adding a test means **adding its npm script too**, and adding it to the root `check`
chain if it is pure. A test file with no script is decoration.

## The standalone style

Mock `db.query.*`, assert, restore in a `finally`. No framework, no globals — just a
script that throws on failure and exits non-zero.

```ts
import { db } from '../db.js';
import { computeSomething } from './something.js';

const original = db.query.consentFindings.findMany;

try {
  (db.query.consentFindings as any).findMany = async () => [
    { id: 'f1', status: 'open', lastSeenAt: new Date('2026-08-01') },
  ];

  const result = await computeSomething('org-1');

  if (result.open !== 1) {
    throw new Error(`expected 1 open finding, got ${result.open}`);
  }
  console.log('ok: computeSomething counts open findings');
} finally {
  (db.query.consentFindings as any).findMany = original;
}
```

The `finally` matters: these scripts share one module instance, so an unrestored mock
leaks into every later assertion in the same file.

Then wire it up:

```json
"test:something": "tsx src/lib/something.test.ts"
```

## `db.query`, not `db.select`

This is the constraint that shapes production code, not just tests.

> If you add a function that reads the database, use `db.query.<table>.findMany()`
> rather than `db.select().from()` wherever the surrounding file already does.

`db.query` is what the mocks above can replace. A `db.select()` call **silently
escapes the mock** and tries to open a real connection — the test hangs or fails with
a connection error that looks nothing like the thing you were testing.

Ownership checks are the deliberate exception: `assertOwned` and the hand-written
`and(eq(id), eq(organizationId))` predicates use `db.select()` because they are
proving a join. Mock at a level above them.

## Environment

| Variable | Rule |
|---|---|
| `DATABASE_URL` | Must be **set** for anything importing `db.js` — it throws on import. Never actually dialled if every query is mocked. Any syntactically valid URL will do. |
| `NODE_ENV=test` | `createQueue`/`createWorker` become no-ops and `getBoss()` returns null, so a function under test can enqueue freely. |

Set both when running a test by hand:

```bash
NODE_ENV=test DATABASE_URL=postgres://x@localhost/x npx tsx src/lib/thing.test.ts
```

`test:fixtures` and `test:consent-cookies` are pure and need neither — that is why
they are safe in the root gate. Keep new pure tests pure so they can join it.

## Fixtures

`apps/api/src/lib/__fixtures__/` holds the consent-evaluator cases. If
`test:fixtures` fails after a change, decide deliberately whether the fixture or the
code is wrong before editing either — the fixtures encode agreed evaluator
behaviour, and several were written *from* production incidents.

## apps/web

Vitest, properly installed, 4 files:

```
src/components/copilot/__tests__/Markdown.test.tsx
src/hooks/__tests__/assessmentsScoring.test.ts
src/hooks/__tests__/scoringEngine.test.ts
src/utils/__tests__/ropaImport.test.ts
```

```bash
npm run test     --workspace=apps/web   # vitest, happy-dom
npm run test:e2e --workspace=apps/web   # playwright, needs a running app
```

Not part of `npm run check`. Run vitest when touching hooks, `ropaImport`, or the
Copilot renderer.

## The probe — the highest-value check in the repo

```bash
npm run probe --workspace=apps/api                       # localhost:4000
npm run probe --workspace=apps/api -- --url https://…    # a deployed service
npm run mint-token --workspace=apps/api                  # session JWT for protected procedures
```

It calls **every tRPC query over real HTTP** and reports the ones that throw. It
exists because the two sharpest failure modes here fail on *every* invocation rather
than on unlucky data:

- a `with:` key with no `relations()` block throws while Drizzle *builds* the query,
  before any row is read;
- a context missing `db` throws on first property access — which broke every
  `publicProcedure` until August 2026.

Neither needs valid data to surface, so the probe deliberately sends ids matching
nothing. **A `NOT_FOUND` means the procedure ran, which is what is being tested.**
Only `INTERNAL_SERVER_ERROR` is a failure.

It goes over HTTP rather than `createCaller()` on purpose: an in-process caller
builds its own context and would have sailed straight past the missing-`db` bug,
which lived in how the Fastify plugin was wired.

Mutations are enumerated and reported as **skipped** — 160 of them write real rows,
send real email and notify real regulators. Probing those needs a canary organisation
and side-effect suppression, which is a separate decision rather than a flag.

## What to reach for

| Verifying | Use |
|---|---|
| Pure logic (scoring, evaluators, formatters) | Standalone `tsx` test + npm script + add to root `check` |
| A procedure runs at all | `npm run probe` |
| Tenant scoping | `npm run check:tenancy` — then read the procedure yourself; it is a text scan |
| A `with:` key | `npm run check:relations` |
| Web hooks and parsers | vitest in `apps/web` |
| A user journey | Playwright (`test:e2e`), against a running app |

## Related

`verify-and-ship` · `trpc-procedure` · `db-schema-change` · `custodia-map`
