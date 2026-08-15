---
name: custodia-map
description: Orientation for the Custodia GDPR monorepo — where every layer lives, what the two deployed services actually do, the request path from a React component to a row, the domain vocabulary (ROPA, DSAR, DPIA, TIA, CMP, sub-processor), and which root-level .md files are authoritative versus stale. Read this when starting a task in an unfamiliar corner of the repo, when hunting for where something lives, or before trusting a root-level design document.
---

# Custodia — the map

GDPR compliance SaaS. npm-workspaces monorepo. Everything below is verified against
the tree rather than inferred from the docs — several root `.md` files are stale and
are listed as such at the bottom.

## Layout

```
apps/api/          Fastify + tRPC. Also hosts the worker entrypoint.
apps/web/          Next.js 16, App Router, next-intl, Tailwind v4.
packages/db/       Drizzle schema + migrations. Imported everywhere as `db`.
packages/ui/       Shared components. No scripts at all — not independently built.
packages/emails/   react-email templates. Only script is `dev` (preview server).
vendor-pipeline/   Offline vendor-catalogue tooling. Not part of the running app.
template/          Scratch/reference material, not wired into the build.
```

`packages/*` have **no `typecheck` script**, so `npm run typecheck --workspaces
--if-present` silently skips all three. `schema.ts` is only typechecked
*transitively*, through `apps/api` and `apps/web` importing it. A type error that
only a package's own file would surface has nothing looking at it.

### `apps/api/src`

| Path | What lives there |
|---|---|
| `index.ts` | Fastify boot, plugin registration, tRPC adapter mount |
| `trpc.ts` | Context, `isAuthed`, `requireRole`, `requirePermission`, audit-log middleware, impersonation to `effectiveOrgId` |
| `router.ts` | Root router; 30 sub-routers are mounted here |
| `routers/*.ts` | One file per domain area (30 of them) |
| `workers/*.ts` | pg-boss workers, plus `index.ts` barrel and `main.ts` entrypoint |
| `lib/*.ts` | Domain logic: `tenancy`, `queue`, `scoring`, `billing`, `consentEvaluator`, `browserPool`, `s3`, `encryption`, and friends |
| `utils/*.ts` | `pagination.ts` (cursor pagination), `auditLogger.ts` |
| `middleware/` | `apiKeyAuth.ts`, `tierGating.ts` — for REST routes, not tRPC |
| `routes/`, `webhooks/` | Plain Fastify REST: public API, Paddle/Stripe/WorkOS webhooks |
| `scripts/*.ts` | The guards (`check-*`) and operational tools (`probe-procedures`, `mint-probe-token`, `live-consent-scan`) |
| `integrations/` | Third-party connectors |

### `apps/web/src`

```
app/[locale]/(app)/          Authenticated product — 17 route groups
app/[locale]/(marketing)/    Public site, SEO-bearing, in the sitemap
app/[locale]/(public)/       Unauthenticated but non-marketing: assessment flow,
                             public DSAR request form, per-org privacy pages
app/[locale]/(onboarding)/   Post-signup wizard
app/[locale]/portal/[token]/ Tokenised DSAR data-subject portal
app/api/                     Next route handlers (auth, PDF, webhook proxying)
components/<area>/           Mirrors the route groups, plus ui/ skeletons/ layout/
messages/{en,de,fr}/*.json   21 namespaces across 3 locales
i18n/request.ts              Namespace registry — every namespace must be listed
utils/trpc.ts                createTRPCReact<AppRouter> — the only client entry
utils/{chartTheme,score,severity,status,cn}.ts   Shared presentation ramps
```

## The two services

One image, two roles, distinguished only by environment:

| Service | Command | `WORKER_ROLE` | Runs jobs? |
|---|---|---|---|
| `custodia-api` | `npm run start --workspace=apps/api` | `web` | No — `createWorker()` is a no-op |
| `custodia-workers` | `npm run start:workers --workspace=apps/api` | unset | Yes, everything |

The API process still *imports* the worker barrel (it needs `scheduleGlobalJobs`),
which registers every worker at module scope. `WORKER_ROLE=web` is the only thing
stopping the API container from running Puppeteer scans. See `background-job`.

## Request path

```
React component
  trpc.<router>.<procedure>.useQuery()          apps/web/src/utils/trpc.ts
    HTTP -> Fastify -> tRPC adapter             apps/api/src/index.ts
      createContext: { req, res, db, primaryDb }
        isAuthed — decodes the Auth.js JWT, resolves effectiveOrgId
          requirePermission(resource, action)   <- what you may DO
            procedure body                      <- WHOSE data is YOUR job here
              ctx.db (Drizzle) -> Postgres
```

The gap between the last two lines is the single most expensive thing in this
codebase. `requirePermission` and `checkOrgContext` do **not** scope to an
organisation. See `trpc-procedure`.

`ctx.db` is org-routed (`lib/dbRouter.ts`, for data residency); `ctx.primaryDb` is
the primary. Use `ctx.db` unless you are deliberately writing to the primary.

## Domain vocabulary

| Term | Meaning |
|---|---|
| **ROPA** | Record of Processing Activities (Art. 30). Split by controller versus processor role. |
| **DSAR** | Data Subject Access Request. Has a statutory clock and a tokenised public portal. |
| **DPIA** | Data Protection Impact Assessment. `dpias -> dpiaRisks -> dpiaMeasures` — a three-level chain, and the canonical `assertOwned` `via:` example. |
| **TIA** | Transfer Impact Assessment (post-Schrems II, for third-country transfers). |
| **CMP** | Consent Management Platform. Custodia both *ships* one and *scans* for others. |
| **Sub-processor** | A vendor's own vendors. Records live on the **shared** vendor row rather than per tenant — a known data-model defect. |
| **Gap** | A machine-detected compliance deficiency, fingerprinted `entityType:entityId:gapType`, produced by the nightly `gap-scanner`. |
| **Finding** | A consent-reconciliation result: a tracker observed firing that consent does not cover. |
| **Evidence** | An artefact attached to a GDPR article for audit readiness. |
| **Reconsent** | Re-collecting consent after a purpose or vendor changes. |

## Which root docs to trust

| File | Status |
|---|---|
| `CLAUDE.md` | **Authoritative.** The non-obvious things that have cost time. |
| `known-concerns.md` | **Authoritative.** Open defects, 15 numbered concerns. Read before adding a procedure. |
| `apps/web/AGENTS.md` | **Authoritative** and short: Next 16 is not the Next.js in your training data; `node_modules/next/dist/docs/` is the source of truth. |
| `consent-reconciliation-ops.md` | Authoritative for consent and job operations. Section 3 covers `WORKERS_ENABLED_JOBS`. |
| `custodia-complete-memory(1).md` | Product context, 114 KB. Useful for *why a feature exists*; not a code reference. |
| `custodia-final-architecture.md` | Design-time document. Verify anything before acting on it. |
| `interface-audit-status.md` | Tracking sheet for the UI audit; closed out in `23d4758`. Historical. |
| `future-roadmap.md` | **Stale.** Says BullMQ throughout. It is pg-boss. |
| `render.yaml` | **Stale.** Nothing runs on Render. Hosting is Northflank. |
| `.github/workflows/deploy.yml` | **Stale and wrong.** It typechecks with a bare root `npx tsc --noEmit` (checks nothing — there is no root tsconfig), calls `npm run db:migrate --workspace=packages/db` (the script is `migrate`), and deploys to AWS ECS/ECR. Do not treat it as the gate. `verify-and-ship` is the gate. |
| `seo-audit.md`, `integration-feature-brainstorm.md` | Point-in-time analyses. |

## Environment

`.env.example` documents 44 variables across both apps. The ones that change
behaviour rather than merely supplying credentials:

| Variable | Effect |
|---|---|
| `DATABASE_URL` | Must be **set** for anything importing `db.js` — it throws on import. Never actually dialled if every query is mocked. |
| `NODE_ENV=test` | `createQueue`/`createWorker` become no-ops, `getBoss()` returns null. |
| `WORKER_ROLE=web` | `createWorker()` no-op. Splits API from workers. |
| `WORKERS_ENABLED_JOBS` | Allowlist that **inverts the default** when set. See `background-job`. |

## Commit convention

`type(scope): lowercase sentence, often with an em-dash clause`

Types in use: `feat`, `fix`, `i18n`, `docs`. Scopes: `api`, `web`, `db`, plus
feature names (`audit`, `dsar`, `ropa`, `ai`). Messages describe the *effect*
rather than the diff — for example `fix(dsar): make the board writable, and stop
updateStatus 500ing cross-tenant`.

## Related skills

`verify-and-ship` · `trpc-procedure` · `background-job` · `db-schema-change` ·
`web-page` · `i18n-namespace` · `api-test`
