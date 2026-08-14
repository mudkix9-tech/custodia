# Interface audit — status

Tracking sheet for the August 2026 product UI/UX audit
([artifact](https://claude.ai/code/artifact/2eb5dfed-0599-47fc-83ef-401e31abd650)), which read
all 47 product routes and filed 40 findings: 11 critical, 17 high, 11 medium, 1 low.

Every finding below was re-verified against the code before being actioned or listed as open —
a few turned out to be wrong or understated (see *Corrections*). Ordering within each section
is the audit's own severity, not effort.

`npm run check` is green at each commit; both workspaces remain at 0 type errors.

**All 40 findings are closed except localisation**, which is open by decision rather than by
oversight — see *Left*.

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

### `3aea585` — the last four criticals

**Audit scoring defaulted to 100.** `scoreTotal || 100` plus nine `categoryScores?.x || 100`
fallbacks meant an account that had never run an assessment read "100 — Excellent posture.
Audit ready." across all nine pillars, and because `0` is falsy a genuine zero rendered as 100
too. Now `??` against a real `null` band. One score ramp (`utils/score.ts`) shared by the dial
and the pillar cards, which previously used different scales for the same number and rendered
the best possible result — exactly 100 — on an undefined `sage-800`. This closes the audit's
separate *score visualisation* finding as well.

**ROPA CSV import corrupted data silently.** `row.split(',')` against an exporter that quotes
every field: a purpose containing a comma shifted every later column, so lawful basis landed in
status. Missing values defaulted `lawfulBasis` to `legitimate_interest` — writing an Article 6
basis the customer never chose — and it reported success regardless. Replaced with an RFC 4180
reader (`utils/csv.ts`), header-mapped columns, and per-row validation that rejects rather than
guesses a lawful basis. Rejected rows are listed with line numbers instead of an `alert()`.

**The Article 33 countdown did not count down.** The banner's `remainingHours` was a `useMemo`
keyed on the deadline, so the 72-hour regulator clock froze at page load while the dial beside
it ticked. Both now share `useDeadlineCountdown`, which shows minutes, names the absolute
deadline with its timezone, and ticks per second only inside the final hour. Fixed a related
bug the audit did not catch: the dial tested `status === 'notified'`, which nothing sets — the
workspace writes `notified_authority` — so it kept counting after the authority had been
notified.

**Onboarding step 6 did not render.** 25 light-theme classes on the dark card that steps 1–5
already use, so the handoff into the paid product was a blank panel. Repainted, along with
step 4 (same defect, 8 classes) and the shell around them. Its hardcoded "Initial Compliance
Score: 35%" is now a setup-progress figure derived from the summary — the account has no score
yet. The **onboarding progress bar** (Tailwind `blue-600`, the first branded moment of the
product) went gold and gained step names and a time estimate.

Also in this commit: ROPA's dark-green primary CTA, the register's missing Art. 30(1)(c) and
(f) columns, and the app-wide toast provider that only Settings had.

### `8120a1a` — Copilot function

**Citations.** The router had always retrieved sources, assembled a numbered reference block,
and rewritten the model's `[Source N: …]` markers into markdown links. None of it reached the
screen. It now returns the citation list structurally and each answer renders a Sources list.

**Markdown.** Answers rendered as plain text in a `whitespace-pre-wrap` div, so headings, bold
and citation links arrived as literal `**` and `[EDPB Guidelines 05/2020](https://…)`. A small
renderer covers exactly the subset the prompt asks for, builds React elements rather than HTML,
and drops any link whose protocol is not http(s).

**Memory.** The conversation lived in `useState`, so a refresh deleted it. Now persisted to
localStorage, capped, with a "New conversation" control.

**Context.** The subtitle claims "context-aware" while the mutation sent only `{ question }`.
The router already accepted `history` and `locale`; both are now sent.

### `0b81847` — the 90 dead palette classes

`ink-50` (25 uses), `ink-100` (18), `sage-800` (15), `ink-200` (11), `ink-950` (10),
`sage-900`, `sage-400`, `sage-200`, `sage-950`, `clay-700`, `clay-400`, `clay-200` are all
referenced but absent from `@theme`, so those elements rendered with no background, border or
colour at all. Replaced per surface rather than by deleting the `@theme` block: 51 of the 52
affected files are dark-surface, and the one that is not — the public legal page, genuinely
`bg-bone-50` — keeps the light palette.

The green-to-gold sweep in `5fd874a` also turned out to be half-applied: it repainted text and
left the ground behind it, so `bg-sage-100 text-sage-800` became gold-on-mint, and four
surfaces ended up gold text on a heavy gold wash. **26 primary buttons were still dark green**
across Vendors, Clients, Consent, Policies, Support, DSAR and the AI panel — the audit flagged
ROPA's; it was the same button everywhere — as were ~20 active-tab underlines.

### `bc36d07` — the dead controls, the nav, the header

**Vendors could not be searched.** The search box had no `value` and no `onChange`, and
`DataGrid` was mounted without `globalFilter`. "Export Register" and "Add Custom Vendor" now
work; the latter opens onto `vendors.createCustom`, a procedure that existed with no caller.

**~20 `alert()` calls** migrated to the toast provider. The public assessment page keeps its
`alert()` deliberately — it renders outside the provider, where a toast would be a silent
no-op. **Raw `confirm()` guards** on portal-token regeneration, data-region migration, role
deletion and webhook redelivery now use the existing `useConfirm` dialog.

**Four modules had no nav entry at all** — Copilot, Regulatory Updates, Analytics and Support.
Ten flat items became five groups. **The header** now names the page and shows a breadcrumb on
detail routes, from one route registry shared with the sidebar; the bell shows a count rather
than a bare dot; "View all notifications" points somewhere; and the mobile hamburger is gone
(the sidebar owns that control, and below 768px both were on screen while only one worked).

### `bd9aed9` — charts and empty states

**Five charts, six unrelated palettes, Recharts light defaults.** The primary "Historical
Score" line was `#294036` on `#0F1113`, and every chart drew `#e7e5e4` gridlines across a
near-black panel. `utils/chartTheme.ts` now holds the grid, axis, tooltip and series tokens;
the three categorical slots are validated as a set against the chart surface over all pairs —
worst CVD ΔE 11.8, worst normal-vision ΔE 21.2, every slot inside the dark lightness band and
above 3:1. Slot 1 is `#B38D1C`, not the UI's `#C9A227`: the brand step sits above the dark band.

**`EmptyState`** carries what is missing, why it matters, and the action; `DataGrid` takes it
through a new `emptyState` slot. Wired into ROPA and Vendors, in all three locales.

### `25283eb` — DSAR metrics, SSO, loading states

**`dsar.boardStats`** counts server-side deliberately: `list` is cursor-paginated at 25, so
deriving the numbers on the client would report the page rather than the register, with an
overdue request on page two counted not at all.

**The SSO page was a mock that admitted it.** "Configure Connection" called
`updateOrgSettings({})` and then said "SSO Settings saved (mock)" in an `alert()`; the Enforce
toggle had an empty handler and no `checked` prop. An enterprise buyer would have concluded SSO
worked and left password login open. It now says connections are set up with us and shows the
fields disabled.

**No route had a `loading.tsx`** — all 47 — so navigation left the previous page on screen.
Added one per module route. **`TopBar.tsx` deleted** (no importers), and `--font-plex-sans` /
`--font-plex-mono`, referenced by 24 marketing files and never defined, are aliased onto the
stacks actually loaded. **Command palette** now matches every module by name and shows the
right modifier key per platform.

### `2aa5096`, `5c4e628`, `a3f5439`, `fd4fb1f` — the long tail

A second set of light-default charts on `consent/analytics` that the audit did not count; its
four-slice donut became a horizontal bar, because no four-hue set clears the CVD floors on this
surface and a donut encodes identity by colour alone. Six more files still entirely on the
light theme. `btn-primary` on Training's "Mark as Complete" — DaisyUI, which is not installed,
so the button rendered as unstyled browser chrome. Indigo CTAs to gold. **One page container**
(`PageShell`) instead of six. **One status ramp** for Training's four treatments of one state,
plus the same light colour steps across 26 more files. The **language switcher** restored and
mounted rather than deleted.

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
- **The Article 33 dial had a second bug.** Beyond the frozen banner, the dial's "notified"
  state was unreachable: it tested `status === 'notified'` while the workspace writes
  `notified_authority`, so it counted down in red after the obligation was discharged.
- **Onboarding step 6 was not the only light-theme step.** Step 4 had the same defect, and the
  onboarding shell and header were still light around dark cards.
- **`consent/analytics` has five more light-default charts.** The audit's chart finding covered
  the Analytics page only.
- **The dead-button count is 17, not 14** — and two of them (`TopBar`'s hamburger, DataGrid's
  bulk-action pair) sat in components the audit had listed separately.

---

## Left

### Localisation — open by decision

29 of 47 product pages have no i18n, carrying roughly 280 user-visible string literals, and
that count excludes strings inside the components those pages render.

This is not being bulk-translated. `next-intl` renders a missing key as its raw key path, so a
partial extraction is *worse* than none for DE and FR — the page breaks rather than degrades.
That makes it all-or-nothing, and "all" means machine-translating GDPR terminology
(*Verarbeitungstätigkeit*, *responsable du traitement*, *berechtigtes Interesse*) into a
compliance product where a mistranslated term of art is a liability, not a cosmetic bug. It
wants a translator, or at least a reviewer, not a sweep.

The in-product language switcher the same finding asked for **is** done — it was the half that
could be finished correctly.

Every key added during this work was written into all three locales by hand.

### Deliberately not attempted

- **Copilot streaming.** Needs the tRPC mutation to become an SSE subscription. An architecture
  change, not a UI repair; the other four parts of that finding are done.
- **ROPA controller/processor split.** The register has no `role` column. Adding one is a schema
  migration plus a product decision about what existing rows default to.
- **Audit "readiness apparatus".** The finding asks for evidence collection and reviewer
  sign-off that do not exist yet — a module, not a defect.
- **A writable DSAR kanban.** Drag-to-transition needs a DnD dependency and a status-transition
  policy. The board's metrics, deadline accuracy and empty-data bug are fixed.

---

## Notes for whoever picks this up

- **`npx eslint` still cannot run** (`apps/web/eslint.config.mjs` throws on ESLint 9), so `tsc`
  plus the repo's guard scripts remain the only static gate. Most of what this audit found —
  dead classes, undefined tokens, invalid utilities — is exactly what a working linter would
  have caught. Unblocking it is the durable fix for a whole class of these.
- **Do not sweep Tailwind classes with a plain substring replace.** `border-sage-500` is a
  prefix of `border-sage-500/20`; that mistake produced four dead classes in `5fd874a` and
  caught me three more times in `0b81847` (`border-clay-200/50` → `border-red-500/30/50`).
  Match on a trailing boundary, and re-grep for `/\d+/\d+` afterwards — it is a one-line check
  and it catches the whole class:

  ```bash
  grep -rnoP '(bg|text|border|ring|divide)-[^"\s]*\/\d+\/\d+' src --include=*.tsx
  ```

- **A regex sweep will rewrite your comments too.** One pass in `0b81847` edited a doc comment
  in `severity.ts` that documented the old value, destroying the explanation it existed to
  give. Check the diff for prose, not just classes.
- The public request page (`RequestSearchForm.tsx`), the public legal page, the assessment
  print view, the PDF templates and marketing are genuinely light-themed and internally
  coherent. Leave them out of dark-surface sweeps — every script in this work carries that
  exclusion list.
- **The shared pieces now exist; use them rather than adding a sixth.** `utils/severity.ts`
  (risk), `utils/score.ts` (compliance scores), `utils/status.ts` (completion states),
  `utils/chartTheme.ts` (all Recharts figures), `utils/csv.ts` (quoting, both directions),
  `components/ui/Toast.tsx`, `components/ui/EmptyState.tsx`, `components/layout/PageShell.tsx`,
  and `components/layout/navigation.ts`, which is the single source for nav, page titles and
  breadcrumbs.
