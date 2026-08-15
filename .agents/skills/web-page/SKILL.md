---
name: web-page
description: How to add or change a page or component in apps/web — the Next 16 async params rule that tsc cannot catch, the route-group layout, the hard-coded dark palette and PageShell container, tRPC client patterns including infinite queries, loading and empty states, the shared score/severity/status/chart ramps, and the @ts-nocheck rule. Use when touching anything under apps/web/src/app or apps/web/src/components, or when npm run check:params or check:sitemap fails.
---

# Working in apps/web

**Read `apps/web/AGENTS.md` first.** Next 16 differs from training data and the
bundled docs at `node_modules/next/dist/docs/` are the authority — not your memory of
Next.js, and not a blog post.

## The one that bites hardest: async `params`

Synchronous `params` access was **removed** in Next 16. A page typed
`{ params: { id: string } }` reads `params.id` as `undefined` at runtime. The page
renders, the data query gets no id, and **`tsc` does not catch it** — the page
declares the sync type itself, so there is nothing to disagree with. Four pages were
broken this way.

```tsx
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  ...
}
```

Same for `searchParams`. `npm run check:params --workspace=apps/web` fails on any
route file declaring either as a plain object. It **skips client components**, which
correctly receive an already-awaited object as a prop.

## Where pages go

```
app/[locale]/(app)/<area>/page.tsx          authenticated product
app/[locale]/(marketing)/<page>/page.tsx    public site — must be in the sitemap
app/[locale]/(public)/…                     unauthenticated, non-marketing
app/[locale]/(onboarding)/onboarding/…      post-signup wizard
app/[locale]/portal/[token]/…               tokenised DSAR data-subject portal
```

Components mirror the route groups: `components/<area>/`, plus `components/ui/`,
`components/layout/`, `components/skeletons/`.

Adding a page under `(marketing)` means updating `src/app/sitemap.ts`, or adding it
to `EXCLUDED` in `scripts/check-sitemap.mjs` with a reason. `check:sitemap` fails both
on routes that do not exist and on marketing pages that are neither listed nor
excluded — and on stale `EXCLUDED` entries.

## Page shape

```tsx
'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { trpc } from '@/utils/trpc';
import { PageShell } from '@/components/layout/PageShell';

export default function AuditPage() {
  const t = useTranslations('audit');
  const { data, isLoading } = trpc.audit.getDashboardMetrics.useQuery();

  if (isLoading) return <GenericListSkeleton />;

  return (
    <PageShell className="space-y-8 fade-up">
      <div className="flex items-end justify-between border-b border-white/10 pb-4">
        <div>
          <h1 className="text-3xl font-serif text-[#F4F5F6] tracking-tight">{t('title')}</h1>
          <p className="text-sm text-[#9BA1A6] mt-1">{t('subtitle')}</p>
        </div>
      </div>
    </PageShell>
  );
}
```

`PageShell` is the single page container — it takes `width="wide"` for board and
table layouts. Six competing containers were collapsed into it in `5c4e628`; do not
introduce a seventh.

## Styling

Tailwind v4 with **hard-coded hex** for the dark surfaces. Match the neighbouring
file rather than introducing theme tokens.

| Token | Hex | Use |
|---|---|---|
| Panel | `#0D0F11` | Card and panel background |
| Recessed | `#08090A` | Inset wells, table headers |
| Primary text | `#F4F5F6` | Headings, values |
| Secondary text | `#9BA1A6` | Subtitles, labels |
| Tertiary text | `#6E747A` | Hints, disabled, empty states |
| Accent | `#C9A227` | Gold. The brand accent. |

Plus `border-white/10`, `rounded-2xl`, `shadow-panel-elevated`, `fade-up`.

The palette is **black and gold**. Any teal, sage or bone in an older brief is stale —
the site is correct, the brief is not. Light-theme leftovers were swept in `a3f5439`
and `2aa5096`; do not reintroduce them.

Never invent a palette class. 90 dead ones were defined-or-replaced in `0b81847`
precisely because they had been invented and never existed in the stylesheet.

## Shared ramps — use them, do not re-derive

| Module | For |
|---|---|
| `@/utils/score` | `formatScore`, `scoreChipClasses` |
| `@/utils/severity` | Severity colour ramp |
| `@/utils/status` | Status pills |
| `@/utils/chartTheme` | `SERIES`, `SERIES_MUTED`, `axisProps`, `gridProps`, `tooltipProps`, `LEGEND_STYLE` |
| `@/utils/cn` | Class merging |

Charts are Recharts. One chart theme, applied via `chartTheme` — `bd9aed9` unified
them. A chart with its own colours will look wrong next to every other chart.

## Data

No codegen. `@/utils/trpc` is `createTRPCReact<AppRouter>()`, so procedures appear as
soon as `tsc` sees the router type.

```tsx
const { data, isLoading } = trpc.audit.getDashboardMetrics.useQuery();

const mutation = trpc.export.generateExecutiveReport.useMutation({
  onSuccess: (data) => { /* … */ },
  onError: () => toast(t('export_failed'), { tone: 'error' }),
});

// paginatedQuery-backed procedures
const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
  trpc.breaches.list.useInfiniteQuery(
    { limit: 25 },
    { getNextPageParam: (lastPage: any) => lastPage.pagination?.next_cursor },
  );
const rows = data?.pages.flatMap((p: any) => p.data) ?? [];
```

### `??`, not `||`

A genuine score of `0` is falsy. The audit dial used to render 0 as 100 because of
`||`. And a missing report is `null` rather than a number, so the dial can honestly
say "not yet assessed" instead of claiming a posture the account has not earned.

```tsx
const score = metrics?.latestReport?.scoreTotal ?? null;
```

`known-concerns.md` §10 — "never scanned" scoring the same as "clean" — is the general
form of this. Distinguish absent from zero everywhere.

## Loading and empty states

Every list needs both. `components/skeletons/PageSkeleton` exports
`GenericListSkeleton` and friends. An empty state is real UI with a sentence and an
action, not a blank div — `bd9aed9` added the missing ones.

Every control must do something. Dead buttons were removed or wired in `bc36d07` and
`bd9aed9`; do not ship a new one.

## Strings

Every user-visible string goes through `useTranslations('<namespace>')` and into all
three locales. Missing keys render as the raw dotted path in a live UI. See
`i18n-namespace`.

## `@ts-nocheck`

Several older client components carry it — `(app)/analytics/page.tsx` among them.
**Do not add it to new files.** The web workspace is at 0 errors and new code should
be genuinely typechecked. `check:nocheck` only guards `apps/api`, so nothing will stop
you here except this instruction.

If you touch a file that has it, removing the pragma and fixing what it hid is
welcome — that is how `9c03bdd` found a service that could not boot.

## Before you commit

1. `npm run check` — `check:params`, `check:sitemap` and `check:messages` all run.
2. `npm run test --workspace=apps/web` if you touched `hooks/`, `utils/ropaImport`,
   or the Copilot markdown renderer (vitest, 4 files).
3. Client component? Confirm `'use client'` is present and `params` is a prop, not a
   promise.
4. Server component? Confirm `await params`.
5. Remember `npx eslint` cannot run in this repo — nothing is lint-checked, so read
   your own diff for the things a linter would have caught.

## Related

`i18n-namespace` · `verify-and-ship` · `trpc-procedure` · `custodia-map`
