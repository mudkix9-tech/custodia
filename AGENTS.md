# Custodia — agent instructions

GDPR compliance platform. npm-workspaces monorepo.

This file is the always-loaded context layer: the stack, the non-negotiables, and
where to find depth. **The detailed workflows live in `.agents/skills/` and are loaded
on demand** — consult the relevant one before starting, rather than working from
memory of how a framework usually behaves. Several here do not behave usually.

| Doing this | Read this skill first |
|---|---|
| Anything, when unfamiliar with the area | `custodia-map` |
| Committing, or a check failed | `verify-and-ship` |
| Editing `apps/api/src/routers/` | `trpc-procedure` |
| Editing `apps/api/src/workers/` | `background-job` |
| Editing `packages/db/src/schema.ts` | `db-schema-change` |
| Editing `apps/web/src/app` or `components` | `web-page` |
| Adding any user-visible string | `i18n-namespace` |
| Writing a test | `api-test` |

## Stack

| Workspace | What |
|---|---|
| `apps/api` | Fastify 5 + tRPC 11, TypeScript ESM, `tsx` at runtime. 30 routers. Also hosts the pg-boss workers. |
| `apps/web` | Next.js 16 (App Router), React 19, next-intl, Tailwind v4, TanStack Query via tRPC. |
| `packages/db` | Drizzle ORM + Postgres. One schema file. Imported everywhere as `db`. |
| `packages/ui`, `packages/emails` | Shared components; react-email templates. No build scripts of their own. |

Node 20. Zod for input validation (v3 in `apps/api`, v4 at the root — do not
"upgrade" one to match the other). Auth.js sessions. pg-boss for jobs. Puppeteer for
scanning, on the worker service only.

## Verification — the only thing that gates anything

```bash
npm run check
```

Run from the repo root before every commit. Both workspaces are at **0 type errors**;
keep them there.

- **A bare `npx tsc --noEmit` at the root checks nothing** — there is no root
  `tsconfig.json`, so it exits 0 having read no files. `.github/workflows/deploy.yml`
  does exactly this and is not a gate.
- **`npx eslint` cannot run at all** (plugin incompatibility on ESLint 9.39.4). **No
  code in this repo has ever been lint-checked**, so `tsc` plus the seven custom
  guards are the entire static safety net. Read your own diff for what a linter would
  have caught.
- `npm run check:schema --workspace=packages/db` is **not** in `npm run check`. Run it
  yourself after any schema edit.

Full breakdown of the nine steps and how to diagnose each: `verify-and-ship`.

## Non-negotiables

These are the failure modes that have actually reached production-shaped code here.
Every one of them was invisible to `tsc`.

1. **Tenant isolation is manual.** `requirePermission()` checks *what a user may do*,
   never *whose data*. Every client-supplied id — including foreign keys like
   `input.breachId` — needs an explicit ownership proof in the procedure body. An
   audit found 47 procedures without one. Use `lib/tenancy.ts`. → `trpc-procedure`

2. **`params` is a Promise in Next 16.** A page typed `{ params: { id: string } }`
   reads `undefined` at runtime and `tsc` cannot object. `await params`. → `web-page`

3. **`with:` in a Drizzle relational query is not typechecked.** A key with no
   `relations()` block throws while *building* the query, so the endpoint fails on
   every call. → `db-schema-change`

4. **next-intl does not fall back.** A key missing from `de` or `fr` renders as the
   raw dotted path in a live UI. Add every string to all three locales.
   → `i18n-namespace`

5. **It is pg-boss, not BullMQ**, and `WORKERS_ENABLED_JOBS` *inverts* the default
   when set — enabling one job silently disables all the others. → `background-job`

6. **Only one of the three test styles in `apps/api` runs.** vitest and jest files
   there typecheck and never execute. → `api-test`

7. **Never add `@ts-nocheck`.** It is guarded in `apps/api` with no allowlist, and
   banned by convention in `apps/web`. Use `@ts-expect-error` on the specific line.

## Safety guardrails

Confirm with the user before:

- running `migrate` or `push` against anything that is not a scratch database;
- probing **mutations** — `npm run probe` covers queries only, deliberately: 160
  mutations write real rows, send real email and notify real regulators;
- removing a job from `DORMANT_JOBS`. Dormancy is a product decision; those jobs
  email or notify customers;
- editing an entry in the `ALLOWED` map of `check-tenant-scoping.ts`, or `EXCLUDED`
  in `check-sitemap.mjs`. Both are reviewed exception lists, not workarounds;
- anything that deletes tenant data or alters `audit_logs`. This is a compliance
  product; the ledger is evidence.

Never commit `.env`. Never weaken a guard script to make a check pass — the guard is
usually right and has a header comment explaining the incident that produced it.

## Style

Match the file you are in. Comments explain *why* a non-obvious choice was made, not
what the line does; the existing code is heavily commented in that register and thin,
uncommented additions read as foreign. **British spelling** in prose and comments
("organisation", "normalise", "behaviour").

Web styling is Tailwind v4 with hard-coded hex for the dark surfaces — `#0D0F11`
panel, `#08090A` recessed, `#F4F5F6` / `#9BA1A6` / `#6E747A` text, `#C9A227` gold
accent, `border-white/10`, `rounded-2xl`. The brand is **black and gold**; any
teal/sage/bone in an older brief is stale. Match the neighbouring file rather than
introducing theme tokens.

## Git

`type(scope): lowercase sentence describing the effect`

Types: `feat`, `fix`, `i18n`, `docs`. Scopes: `api`, `web`, `db`, or a feature name
(`audit`, `dsar`, `ropa`, `ai`). Describe what changed for a user or an operator, not
which files moved — e.g. `fix(dsar): make the board writable, and stop updateStatus
500ing cross-tenant`.

Branch from `main`. Commit or push only when asked.

## Documentation map

**Authoritative:** `CLAUDE.md` (the same working notes, for Claude Code),
`known-concerns.md` (15 open defects and risks — read before adding a procedure),
`apps/web/AGENTS.md` (Next 16 differs from training data; `node_modules/next/dist/docs/`
is the authority), `consent-reconciliation-ops.md` (§3 on the job allowlist).

**Context, not reference:** `custodia-complete-memory(1).md` (product rationale),
`custodia-final-architecture.md` (design-time), `seo-audit.md`,
`integration-feature-brainstorm.md`, `interface-audit-status.md` (closed out).

**Stale — do not act on:** `future-roadmap.md` (says BullMQ), `render.yaml` (nothing
runs on Render; hosting is Northflank), `.github/workflows/deploy.yml` (no-op
typecheck, wrong migrate script name, AWS ECS deploy).
