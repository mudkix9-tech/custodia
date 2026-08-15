---
name: i18n-namespace
description: How translations work in apps/web and how to add a key or a whole namespace — next-intl with no locale fallback, the en/de/fr three-file rule, registering a namespace in i18n/request.ts, ICU placeholder parity, translator annotation keys, and reading a check:messages failure. Use when adding any user-visible string, creating a namespace, or when npm run check:messages fails.
---

# Translations

`next-intl`, per-namespace JSON in `apps/web/src/messages/{en,de,fr}/`. **21
namespaces, 3 locales, 63 files.** `en` is the source.

## The rule

**next-intl does not fall back to the default locale.** A key present in `en` and
missing in `de` renders the raw dotted path — `dashboard.metrics.gaps`, verbatim, in
a live UI, for every German reader.

So a namespace extracted into `en` alone is *worse* than one never extracted at all.
That is why the August 2026 localisation pass had to be done in one go rather than
page by page, and why `check:messages` now exists — it is what makes the next pass
safe to do incrementally.

## Adding a key to an existing namespace

Add it to **all three** files. Same path, same shape:

```
src/messages/en/audit.json
src/messages/de/audit.json
src/messages/fr/audit.json
```

Then use it:

```tsx
const t = useTranslations('audit');
<h1>{t('title')}</h1>
<p>{t('evidence.empty.description')}</p>
```

If you do not have a real German or French translation, write the best one you can
and mark it — see annotations below. Do **not** leave the key out, and do not copy
the English string in silently.

## Adding a whole namespace

Three files plus a registration. `check:messages` enforces both directions: a file
with no registration fails, and a registration with no file fails.

1. Create `src/messages/{en,de,fr}/<name>.json`.
2. Register it in `src/i18n/request.ts`, in the `messages` object:

   ```ts
   <name>: (await import(`../messages/${locale}/<name>.json`)).default,
   ```

3. `npm run check:messages --workspace=apps/web`.

Current namespaces: `analytics`, `audit`, `breaches`, `clients`, `common`, `consent`,
`copilot`, `dashboard`, `dsar`, `group`, `marketing`, `onboarding`, `policies`,
`ropa`, `settings`, `shared`, `support`, `training`, `updates`, `vendors`.
(`shared` and `common` both exist — `common` is chrome and generic actions, `shared`
is cross-feature domain vocabulary. Check both before adding a third home for a
string.)

## ICU placeholders must match

A translation may not drop or invent a placeholder. `check:messages` compares the
argument names, not just the count.

```json
// en
"deadline_in": "{days} days remaining"
// de  — correct
"deadline_in": "Noch {days} Tage"
// de  — FAILS: placeholder dropped
"deadline_in": "Noch einige Tage"
// de  — FAILS: placeholder invented
"deadline_in": "Noch {anzahl} Tage"
```

Plurals and selects are ICU too — keep the whole `{count, plural, …}` structure
intact across locales, even where the target language needs different categories
inside it.

## Translator annotations

Keys beginning with `_` are annotations rather than messages. `check:messages`
skips them entirely, in every check. Use them to flag work:

```json
{
  "title": "Nachweisbibliothek",
  "_review_notes": "Machine-translated from en, needs native review"
}
```

This is the honest way to ship an incomplete locale: the key exists so nothing
renders as a raw path, and the annotation records that it is provisional.

## What `check:messages` asserts

Four checks, in `apps/web/scripts/check-messages.mjs`:

1. Every namespace exists as a file in all three locales.
2. Every namespace registered in `i18n/request.ts` has a file, **and vice versa**.
3. Key parity — `de` and `fr` carry exactly the keys `en` carries. Extra keys fail
   too, so a renamed key cannot leave a stale one behind.
4. ICU placeholder parity.

It runs as step 7 of `npm run check`.

## Reading a failure

| Message shape | Cause |
|---|---|
| missing namespace file | Created one or two of the three JSON files |
| registered but no file / file but not registered | `i18n/request.ts` out of sync |
| missing key in `de`/`fr` | Added to `en` only |
| extra key in `de`/`fr` | Renamed or deleted in `en` only |
| placeholder mismatch | Dropped or invented an ICU argument |

All five are fixed in the message files, never by loosening the script.

## Locale routing

Routing config is `src/i18n/routing.ts`; the request config resolves an unknown or
missing locale to the default. Pages live under `app/[locale]/`, so every internal
link must be locale-aware — use the navigation helpers from the routing module
rather than a bare `<a href="/dashboard">`. A sidebar locale bug from a hand-written
link was fixed in `5fd874a`.

## Related

`web-page` · `verify-and-ship` · `custodia-map`
