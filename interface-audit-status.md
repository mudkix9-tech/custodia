# Interface audit — status

Tracking sheet for the August 2026 product UI/UX audit
([artifact](https://claude.ai/code/artifact/2eb5dfed-0599-47fc-83ef-401e31abd650)), which read
all 47 product routes and filed 40 findings: 11 critical, 17 high, 11 medium, 1 low.

Every finding below was re-verified against the code before being actioned or listed as open —
a few turned out to be wrong or understated (see *Corrections*). Ordering within each section
is the audit's own severity, not effort.

`npm run check` is green at each commit; both workspaces remain at 0 type errors.

---

## Done

### `08236c8` — the four headline criticals, plus the dead `dark:` variants

**Dashboard hero metrics were hardcoded.** Compliance Score, Active Processing and Pending
DSARs were string literals, so a ten-minute-old account read "85% / 12 / 2". The sidebar's
`badge: 1` told the same lie. All four now read real data. This needed two new procedures —
`ropa.countActive` and `dsar.countPending` — because both list endpoints are cursor-paginated
and counting their rows would have capped at the page size. `countPending` treats a NULL
status as pending: the column is nullable and a bare `NOT IN` drops NULL rows silently.
Compliance score renders an em dash when no snapshot exists, since `0%` would be a different
lie than `85%`.

**The DSAR board and table were always empty.** Both render paths read `.data` off an
already-flat `flatMap` result, behind `as any` casts that stopped `tsc` seeing it. On the one
module whose value proposition is not missing a 30-day statutory deadline.

**Global text colour was the retired light theme's `#1F1B16`.** Every uncoloured text node in
the app rendered dark brown on near-black. Fixed by anchoring the `(app)` tree, deliberately
*not* globally: marketing sets its own tokens and onboarding is genuinely light-themed.

**`DataGrid` was skinned for the light theme** — a cream slab under ROPA, Vendors, Trust
Portals and four ROPA sub-tabs, with ROPA's near-white cell renderers on top of it. Re-skinned
onto the black+gold surfaces; a `bare` prop lets the one caller that draws its own card
(Vendors) nest it without stacking two borders.

**All 115 `dark:` variants were dead.** No `darkMode` config and nothing ever sets a `dark`
class, so the light half of every pair always won. Confined to the Breaches module (9 files);
each pair collapsed to its dark value. Copilot was light-themed outright rather than paired
and was repainted at the same time.

### `5fd874a` — shell, severity, and the classes that emit nothing

**The sidebar never highlighted anything in DE or FR.** `usePathname` came from
`next/navigation`, which returns the locale-prefixed path; with `localePrefix: 'as-needed'` a
German user at `/de/vendors` never matched `startsWith('/vendors')`. Now uses the `next-intl`
wrappers.

**The sidebar active state was invisible** — `bg-[#0D0F11]/10` over a `#08090A` ground, along
with five sibling hover states. Repainted on the gold left rail the Settings sub-nav already
uses.

**The organisation name appeared nowhere in the product.** `OrgSwitcher` returned `null`
unless the account had child orgs, so the single-org majority saw no identity at all. Identity
now always renders; only the switcher affordance is conditional. `@ts-nocheck` dropped from
the file, which typechecks clean.

**One severity ramp** (`apps/web/src/utils/severity.ts`), adopted by ROPA risk, vendor risk and
breach likelihood. Two of the three ran backwards: ROPA rendered CRITICAL as a pale
`bg-clay-50` chip whose `text-clay-700` was never defined, while LOW got the brand gold.
Saturation now decreases monotonically with severity.

**58 double opacity modifiers** (`bg-red-500/100/20` and friends) emitted no CSS at all —
elements rendering with no background or border. Collapsed to the trailing value, which is the
one the author wrote. Four of these were self-inflicted: a substring replace in the previous
commit turned `border-sage-500/20` into `border-[#C9A227]/50/20`.

**Four theme tokens referenced by `components/ui` were never defined.** Every `Button` lost its
focus ring, and `Switch` rendered track, thumb *and* ring transparent — an invisible toggle on
nine screens including SSO and SIEM settings. Also removed the undefined `font-display` from
two Training headings.

**40 green focus rings** (`ring-sage-500/*`) swept to gold across 23 files, plus two
selected-states pairing a green ring with an undefined `text-sage-800`.

**`.hairline` was ink-on-bone** at all 24 of its call sites, every one a dark panel. Redefined
against white at low alpha to match the neighbouring `border-white/10`.

---

## Corrections to the audit

- **The Settings sub-nav is not affected by the locale bug.** The audit reported it alongside
  the sidebar, but it matches with `.includes()`, which is locale-agnostic.
- **`Switch` is worse than reported.** The audit noted the missing Button focus ring; the same
  undefined-token root cause also left `bg-primary`, `bg-input` and `bg-background` empty, so
  the entire control was invisible, not just its focus state.
- **The headline count does not reconcile.** The masthead claims 58 findings; the page renders
  40 cards. The critical count (11) does match.
- **Double opacity modifiers were far more widespread** than the four examples cited — 54
  pre-existed.

---

## Left

### Critical

| Finding | Why it matters |
|---|---|
| **Audit → scoring defaults** | `scoreTotal \|\| 100` plus nine `categoryScores?.x \|\| 100` fallbacks. An empty account reads "100 — Excellent posture. Audit ready." across all nine pillars, and because `0` is falsy a genuine zero also renders as 100. Fix is `??` plus a "not yet assessed" state — trivial effort, and the most sales-damaging finding in the report. |
| **ROPA → CSV import** | `row.split(',')` with no quote handling, against an exporter that quotes. A purpose containing a comma shifts every subsequent column, so lawful basis lands in status. Missing values silently default `lawfulBasis` to `legitimate_interest` — assigning a basis the customer never chose. Reports success afterwards. |
| **Breaches → Article 33 countdown** | `remainingHours` is a `useMemo` with no timer, so the 72-hour regulator clock is frozen at page load. Hours-only: no minutes, no absolute deadline, no timezone. |
| **Onboarding → step 6** | "Your compliance workspace is set up" is `text-gray-900` on a `#0D0F11` card — the handoff into the paid product does not render. 25 light-theme classes, the highest count in any one file. |
| **Copilot → function** | The visual half is done. Still open: no source citations on any answer, conversation lives in `useState` so a refresh deletes it, no markdown rendering, no streaming, and the subtitle claims "context-aware" while the mutation sends only `{ question }`. |

### High

- **~90 undefined palette classes.** `ink-50` (25 uses), `sage-800` (17), `ink-100` (18),
  `ink-200`, `ink-950`, `clay-700` and others are used but absent from `@theme`, so they emit
  nothing. The audit's fix — delete the `bone/ink/sage/clay` block so they fail at build —
  needs care: the public request page and onboarding legitimately use the light palette.
- **~20 `alert()` calls** carry success and failure across the product (17 remain in `.tsx`).
  A working toast provider exists and is mounted only by the Settings layout. Several
  `confirm()` guards on destructive actions too, including portal-token regeneration.
- **14 dead buttons**, including the "Upgrade to Enterprise" CTA and Vendors' "Export Register"
  and "Add Custom Vendor".
- **No empty-state component.** Fifteen list views, not one offering a CTA to create the first
  item — precisely where a €99/mo tool has to teach.
- **Vendors list view.** The search box has no `value` and no `onChange`, and `DataGrid` is
  mounted without `globalFilter`, so vendors cannot be searched at all.
- **Analytics — five charts on Recharts light defaults.** The primary "Historical Score" line
  is `#294036` on `#0F1113`, roughly 1.5:1. Six unrelated palettes across five charts, none of
  them brand gold. Wants a shared chart theme module.
- **Header.** An empty bar with two icons pushed right — no title, no breadcrumbs. The direct
  cause of the five different page-title treatments below it. Bell shows a bare dot, "View all
  notifications" has no handler and no route, and the mobile hamburger duplicates the
  sidebar's between 768–1024px.
- **Sidebar navigation model.** Copilot, Regulatory Updates, Analytics and Support have no nav
  entry at all. Ten flat ungrouped items.
- **Dashboard composition**, **onboarding progress bar** (Tailwind blue, the first branded
  moment of the product), **ROPA Art. 30 column coverage**, **ROPA toolbar and its green
  `sage-700` CTA**, **DSAR board and deadlines**, **Settings enterprise gating**.

### Medium / low

Loading states (four treatments, no `loading.tsx` on any of the 47 routes); command palette
scope and chrome; six page-container conventions wanting one `<PageShell>`; localisation (29
of 47 pages have no i18n, and `LanguageSelector.tsx` is imported nowhere); ROPA re-consent
panel; audit score visualisation and scope; vendors chrome; training course list; dead code
(`TopBar.tsx`, `LanguageSelector.tsx`, and `--font-plex-sans` / `--font-plex-mono` referenced
but never defined).

---

## Notes for whoever picks this up

- **`npx eslint` still cannot run** (`apps/web/eslint.config.mjs` throws on ESLint 9), so `tsc`
  plus the repo's guard scripts remain the only static gate. Most of what this audit found —
  dead classes, undefined tokens, invalid utilities — is exactly what a working linter would
  have caught. Unblocking it is the durable fix for a whole class of these.
- **Do not sweep Tailwind classes with a plain substring replace.** `border-sage-500` is a
  prefix of `border-sage-500/20`; that mistake produced four dead classes here. Match on a
  trailing boundary.
- The public request page (`RequestSearchForm.tsx`) and onboarding are genuinely light-themed
  and internally coherent. Leave them out of dark-surface sweeps.
