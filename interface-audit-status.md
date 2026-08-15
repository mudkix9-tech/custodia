# Interface audit — status

Tracking sheet for the August 2026 product UI/UX audit
([artifact](https://claude.ai/code/artifact/2eb5dfed-0599-47fc-83ef-401e31abd650)), which read
all 47 product routes and filed 40 findings: 11 critical, 17 high, 11 medium, 1 low.

Every finding below was re-verified against the code before being actioned or listed as open —
a few turned out to be wrong or understated (see *Corrections*). Ordering within each section
is the audit's own severity, not effort.

`npm run check` is green at each commit; both workspaces remain at 0 type errors.

**All 40 findings are closed.** The last five — localisation, Copilot streaming, the ROPA
controller/processor split, the audit readiness apparatus and a writable DSAR board — were
argued against once and then done anyway when the request was reaffirmed. The reasoning
against each is preserved below, because two of the concerns turned out to be right about the
work even though they were wrong about whether to do it.

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

### `1868671` — the ROPA register split by role

Article 30 is two registers, not one: 30(1) for a controller, 30(2) for a processor, with
different mandatory columns. `processing_activities` had no `role` column at all, so the
product could only express one of them.

`role` defaults to `controller` because every row written before this change was written on
that assumption — a default of anything else would have silently relabelled the existing
register. `controllerName` is required when the role is processor and the importer rejects a
processor row without one, citing Art. 30(2)(a), rather than accepting it and producing a
register that fails on inspection.

### `b5194e0` — a writable DSAR board

Native HTML5 drag-and-drop rather than `@dnd-kit`: ~30kB of dependency for a column-to-column
move is not a trade worth making. HTML5 drag is mouse-only, so every card also carries a
status `<select>` — a board you can only operate with a mouse is not finished.

`dsar.updateStatus` also threw a 500 rather than `NOT_FOUND` when no row matched, which is
what a cross-tenant id produces.

### `a11c5bb` — Copilot streaming, and every AI call in the product

The streaming itself is a tRPC async-generator mutation over `httpBatchStreamLink`, not the
SSE subscription the earlier note assumed. Subscriptions are GET, which would have put the
whole conversation history in the query string.

**The larger find: every AI call site was pinned to `claude-3-5-sonnet-20240620`, retired on
28 October 2025.** Nine of them — Copilot, DPA analysis, vendor questionnaires, policy
generation, impact assessments, re-consent. All had been 404ing for nine months and falling
into catch blocks; the Copilot's said "This is a mock response because the Anthropic API
failed or is not configured", which reads like a local-dev notice rather than a production
outage. Moved to `claude-sonnet-5` behind one constant, and two `temperature` parameters
dropped because current models reject them.

### `0838175` — the audit readiness apparatus

An evidence library keyed to the 23 controller obligations an auditor actually walks through
(`lib/gdprArticles.ts`), with per-article coverage. An article counts as covered only while
attached evidence is still in date — reporting six-month-expired evidence as coverage is the
exact failure this module exists to prevent.

Audit *scheduling* and findings-tracking from previous external audits are not built. They are
a separate module and need a product decision about whether Custodia tracks external audits at
all; the finding's own stated fix was the control-to-evidence linkage, which is done.

### `6cb8cb4` … `6d618f7` — localisation, and a guard so the next pass need not be

All 29 remaining product pages, plus the components this work added, now read their strings
from the catalogue in en, de and fr. 1,735 keys across 20 namespaces.

The argument against doing it was that `next-intl` renders a missing key as its raw path, so a
partial extraction is worse than none — which makes it all-or-nothing, and "all" means
translating GDPR terms of art into a compliance product. Both halves of that were true. The
second is why every string was translated deliberately rather than swept, keeping the existing
`_review_notes` convention for terms worth a native reviewer's eye.

The first half is now false by construction: **`check:messages`** enforces file existence
across all three locales, registration in `i18n/request.ts`, key parity, and ICU placeholder
parity, so the next pass *can* be incremental. Its placeholder check needs a real brace parser
rather than a regex — inside a plural's branches a `{` opens a sub-message, not an argument,
so `other {bleiben # Tage}` otherwise reads as an argument named `bleiben` and every localised
plural in the catalogue reports as a mismatch.

---

## Found while localising

None of these are audit findings. They are what turned up in the 29 pages nobody had read
closely enough to extract strings from.

- **`integrations.listConnections` read any organisation's data.** It took `organizationId`
  from the request and filtered on it, with a comment where the check should have been saying
  "In a real app, verify ctx.user has access to organizationId". `disconnect`, in the same
  file, was scoped correctly. **`check:tenancy` was treating any `eq(x.organizationId, …)` as
  proof of ownership**, which is what let it through — the predicate was org-scoped, just to
  whichever org the caller named. The guard now requires the org to come from something other
  than `input.`; re-run over all 123 procedures, nothing else is of that shape.
- **`vendors/[id]` crashed on every first visit.** `useEffect` sat below two early returns, so
  the loading render called one fewer hook than the loaded render and React threw the moment
  the query resolved.
- **The training learn page showed the wrong module.** The route parameter is a *completion*
  id; the page read it as a module id, so `isCompleted` was unreachable and it rendered a
  hard-coded "Data Privacy Fundamentals" lesson for every module in the catalogue. Its "Mark
  as Complete" button called `startModule`, which sets `in_progress`.
- **`mutation.isLoading` in two files.** Not a tRPC v11 field — the flag is `isPending`. Both
  read undefined, so neither button ever disabled or showed a pending label. Both files carry
  `@ts-nocheck`.
- **The printable assessment record was unreadable.** A light document — neutral-50 cards,
  neutral-900 text — whose three page backgrounds the dark sweep had rewritten to `#0D0F11`.
- **`Frankfurt (Germany /* eslint-disable-line @typescript-eslint/no-explicit-any */)`.** A
  pragma pasted inside a display string, rendering verbatim in the region picker.
- **`packages/db`'s `check:schema` could never pass on Windows.** `drizzle-kit generate && if
  [ -n "$(git status --porcelain drizzle/)" ]` is handed to cmd.exe by npm, which exits
  "-n was unexpected at this time" — identically whether or not the schema had drifted, which
  makes it worse than no guard. Now `scripts/check-schema.mjs`, verified to fail on a real
  drift and pass without one.
- **`consent/analytics` had light-theme leftovers after all.** Two tooltips hard-coded to
  `#fff`, two more on Recharts' white default, an `#f3f4f6` hover cursor, stone-300 select
  borders — in the last three figures, which the earlier sweep of that page had not reached.
  Its domain and withdrawal series were also drawn in `#9ca3af`, `#10b981` and `#ef4444`,
  three colours from no palette in this product.
- Smaller: raw enums rendered to screen in five places (`in_progress`, `Ropa`, `Dsar`);
  `bg-set-ok/120`, which is not a valid Tailwind opacity; `window.confirm` in two components
  that already imported and mounted the styled dialog; a hard-coded "+4% this month" on the
  analytics header that was never computed from anything; "Case created … by User", where
  "User" was a literal.

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

**Nothing from the audit's 40 findings.** Everything below was found while working through
them and is out of scope for a UI repair — recorded here because the next person should not
have to rediscover it. Each was verified against the code on 2026-08-15, not inferred.

### Procedures with no interface

The API implements these and nothing in `apps/web` calls them, so the feature exists only to
someone writing requests by hand.

- **The whole training quiz.** `submitQuiz` and `trackProgress` have zero callers. Passing the
  quiz is the only thing that sets a completion to `passed`, so **a module cannot be completed
  through the UI at all** — which makes the completion rate and "staff certified" figures on
  the training admin dashboard structurally zero unless rows are seeded directly. The learn
  page says as much rather than implying otherwise, but the honest fix is the quiz.
- **Module authoring.** `createModule`, `updateModule` and `publishModule` likewise have no
  callers; the admin page's "Create Module" button is one of the dead controls below.
- **SSO connection setup.** No API exists. The page says so plainly and routes to a human,
  which was the right repair, but it is a stopgap for a missing feature.
- **The integrations OAuth flow.** `/api/integrations/[provider]/authorize` does not exist as
  a route anywhere in either workspace, so the Connect button on both integrations pages links
  to a 404.

### Surfaces that are still placeholder

- **`group/[orgId]`** renders "[Normal Dashboard Components scoped to {orgId} will render
  here]" — literally, and now in three languages. Scoping the dashboard to a child org needs
  the dashboard queries to take an org parameter.
- **`clients/[id]` → Vendors tab** displays the concept of a resolved vendor graph rather than
  one; "Quick Stats" omits the vendor count for the same reason.
- **`support`** is mock throughout: a named account manager, three invented tickets, and SLA
  figures that are constants rather than measurements. The page reads as a live status board.
- **`settings/organization`** logo upload is not wired to storage.
- **`group/vendors` → View Profile** sets a `targetOrgId` cookie and navigates, hoping the
  server honours it; there is no context switcher behind it.

### Dead controls still in the tree

The earlier passes fixed 17 of these; these nine were not reached. All render as enabled and
do nothing on click.

| File | Control |
|---|---|
| `training/admin/page.tsx:45` | Create Module |
| `training/admin/page.tsx:193` | View Details |
| `clients/[id]/page.tsx:189` | Upload Document |
| `group/page.tsx:44` | Export Consolidated Report |
| `settings/integrations/page.tsx:127` | Request |
| `updates/page.tsx:43` | Filter |
| `(marketing)/legal/dpa/page.tsx:27` | Download PDF |
| `components/breaches/BreachNotificationDraft.tsx:64` | Edit Draft |
| `components/policies/PolicyEditorClient.tsx:133` | version-history entries |

`components/developers/WebhookDeliveryLog.tsx:50` is a tenth of a different kind:
`setExpandedRow` is declared and never called, so the row carries `cursor-pointer` and a
View/Hide label for an expansion that cannot happen. The detail `<tr>` beneath it is
unreachable code.

Find them again with:

```bash
python - <<'PY'
import io, re, os
for root, _, files in os.walk('src'):
    for f in (x for x in files if x.endswith('.tsx')):
        p = os.path.join(root, f); s = io.open(p, encoding='utf-8').read()
        for m in re.finditer(r'<button\b((?:[^>]|\n)*?)>', s):
            if any(k in m.group(1) for k in ('onClick', 'type="submit"', 'form=')): continue
            print('%s:%d' % (p, s[:m.start()].count('\n') + 1))
PY
```

### Scoped out of a finding, deliberately

- **Audit scheduling and external-audit findings tracking.** The readiness finding's stated
  fix was the control-to-evidence linkage, which is built. Tracking *external* audits — when
  one is due, what it found, whether the findings were remediated — is a second module and
  needs a product decision about whether Custodia is the system of record for that at all.
- **`dashboard/integrations` duplicates `settings/integrations`** and nothing links to it.
  Both were repaired rather than one deleted; removing a route is a product call.

### Infrastructure

- **`npx eslint` is now unblocked and working.** Fixed ESLint 9 flat config in
  `apps/web/eslint.config.mjs` by switching to `tailwind.configs.recommended` (which exports
  a config object rather than a `flat/recommended` array in `eslint-plugin-tailwindcss` v4)
  and configuring `cssConfigPath: "src/app/globals.css"` so the plugin resolves the Tailwind
  entrypoint. Added `--if-present` to root `package.json` `lint` script.
- **Two of `apps/api`'s three test styles do not execute** (vitest is installed in `apps/web`
  only; `billing.test.ts` wants jest, which is not installed anywhere). They typecheck, which
  is what makes it easy to believe the suite covers more than it does. Documented in
  `CLAUDE.md`; unchanged by this work.

---

## Notes for whoever picks this up

- **`tsc` plus the repo's guard scripts are the only static gate**, because eslint cannot run
  at all — see *Left → Infrastructure* for why that is the highest-leverage thing on this page.
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
- **`npm run check` now includes `check:messages`.** Add a key to all three of
  `src/messages/{en,de,fr}/` in the same change or it fails. `packages/db`'s `check:schema`
  stays separate, as before, because it runs `drizzle-kit generate`.
- **The shared pieces now exist; use them rather than adding a sixth.** `utils/severity.ts`
  (risk), `utils/score.ts` (compliance scores), `utils/status.ts` (completion states),
  `utils/chartTheme.ts` (all Recharts figures), `utils/csv.ts` (quoting, both directions),
  `components/ui/Toast.tsx`, `components/ui/EmptyState.tsx`, `components/layout/PageShell.tsx`,
  and `components/layout/navigation.ts`, which is the single source for nav, page titles and
  breadcrumbs.
