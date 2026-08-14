/**
 * Fails when the en/de/fr message catalogues have drifted apart.
 *
 *   npm run check:messages --workspace=apps/web
 *
 * Why this exists: next-intl does not fall back to the default locale for a
 * missing key — it renders the raw dotted path. So `dashboard.metrics.gaps`
 * appears verbatim on the page, in a live UI, for every German and French
 * reader. A namespace extracted into `en` alone is worse than one never
 * extracted at all, and `tsc` sees none of it: the keys are string literals.
 *
 * That is exactly how the August 2026 localisation pass had to be done in one
 * go rather than page by page. This guard is what makes the next one safe to do
 * incrementally.
 *
 * Four checks run:
 *   1. every namespace exists as a file in all three locales
 *   2. every namespace registered in i18n/request.ts has a file, and vice versa
 *   3. key parity — de and fr carry exactly the keys en carries
 *   4. ICU placeholder parity — a translation may not drop or invent a `{name}`
 *
 * Keys beginning with `_` are translator annotations (`_review_notes`) rather
 * than message keys, and are skipped throughout.
 */
import fs from 'node:fs';
import path from 'node:path';

const MESSAGES_DIR = path.resolve(process.cwd(), 'src/messages');
const REQUEST_FILE = path.resolve(process.cwd(), 'src/i18n/request.ts');
const LOCALES = ['en', 'de', 'fr'];
const SOURCE = 'en';

const errors = [];

/** Every leaf key as a dotted path, annotations excluded. */
function flatten(value, prefix = '', out = new Map()) {
  for (const [key, child] of Object.entries(value)) {
    if (key.startsWith('_')) continue;
    const dotted = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === 'object' && !Array.isArray(child)) {
      flatten(child, dotted, out);
    } else {
      out.set(dotted, String(child));
    }
  }
  return out;
}

/** Index of the `}` closing the `{` at `open`, or -1 if it is unbalanced. */
function matchBrace(text, open) {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}' && --depth === 0) return i;
  }
  return -1;
}

/**
 * The argument names an ICU message interpolates.
 *
 * A regex is not enough here. Inside a message a `{` opens an argument, but
 * inside an argument's style — the branches of a plural or select — a `{` opens
 * a nested sub-message, which is a message again. Without tracking which of the
 * two you are in, the German plural branch `other {bleiben # Tage}` reads as an
 * argument named `bleiben`, and every localised plural in the catalogue is
 * reported as a mismatch.
 */
function placeholders(message) {
  const found = new Set();

  const scan = (text) => {
    for (let i = 0; i < text.length; i++) {
      if (text[i] !== '{') continue;
      const end = matchBrace(text, i);
      if (end === -1) return;

      const body = text.slice(i + 1, end);
      const comma = body.indexOf(',');
      const name = (comma === -1 ? body : body.slice(0, comma)).trim();
      if (/^[a-zA-Z0-9_]+$/.test(name)) found.add(name);

      if (comma !== -1) {
        const style = body.slice(comma + 1);
        for (let j = 0; j < style.length; j++) {
          if (style[j] !== '{') continue;
          const subEnd = matchBrace(style, j);
          if (subEnd === -1) break;
          scan(style.slice(j + 1, subEnd));
          j = subEnd;
        }
      }
      i = end;
    }
  };

  scan(message);
  return found;
}

// --- 1. the files themselves ------------------------------------------------

const namespaces = fs
  .readdirSync(path.join(MESSAGES_DIR, SOURCE))
  .filter((f) => f.endsWith('.json'))
  .map((f) => f.replace(/\.json$/, ''))
  .sort();

const catalogues = {};
for (const locale of LOCALES) {
  catalogues[locale] = {};
  for (const ns of namespaces) {
    const file = path.join(MESSAGES_DIR, locale, `${ns}.json`);
    if (!fs.existsSync(file)) {
      errors.push(`${locale}/${ns}.json does not exist — every namespace must exist in all three locales`);
      continue;
    }
    try {
      catalogues[locale][ns] = flatten(JSON.parse(fs.readFileSync(file, 'utf8')));
    } catch (err) {
      errors.push(`${locale}/${ns}.json is not valid JSON: ${err.message}`);
    }
  }

  // A namespace that exists only in a translated locale is dead weight: nothing
  // can reference it, because the `en` catalogue is what the code is written
  // against.
  for (const file of fs.readdirSync(path.join(MESSAGES_DIR, locale))) {
    if (!file.endsWith('.json')) continue;
    const ns = file.replace(/\.json$/, '');
    if (!namespaces.includes(ns)) {
      errors.push(`${locale}/${file} has no counterpart in ${SOURCE}/ — remove it or add the ${SOURCE} catalogue`);
    }
  }
}

// --- 2. registration --------------------------------------------------------

const requestSource = fs.readFileSync(REQUEST_FILE, 'utf8');
const registered = new Set(
  [...requestSource.matchAll(/^\s*([a-zA-Z0-9_]+):\s*\(await import\(/gm)].map((m) => m[1]),
);

for (const ns of namespaces) {
  if (!registered.has(ns)) {
    errors.push(`${ns}.json is never loaded — add it to the messages map in src/i18n/request.ts`);
  }
}
for (const ns of registered) {
  if (!namespaces.includes(ns)) {
    errors.push(`src/i18n/request.ts loads "${ns}", which has no ${SOURCE}/${ns}.json`);
  }
}

// --- 3 & 4. key and placeholder parity --------------------------------------

for (const ns of namespaces) {
  const source = catalogues[SOURCE][ns];
  if (!source) continue;

  for (const locale of LOCALES) {
    if (locale === SOURCE) continue;
    const target = catalogues[locale][ns];
    if (!target) continue;

    for (const key of source.keys()) {
      if (!target.has(key)) {
        errors.push(`${locale}/${ns}.json is missing "${key}" — it would render as the raw key path`);
      }
    }
    for (const key of target.keys()) {
      if (!source.has(key)) {
        errors.push(`${locale}/${ns}.json defines "${key}", which ${SOURCE} does not — nothing reads it`);
      }
    }
    for (const [key, message] of source) {
      const translated = target.get(key);
      if (translated === undefined) continue;
      const wanted = placeholders(message);
      const got = placeholders(translated);
      for (const name of wanted) {
        if (!got.has(name)) {
          errors.push(`${locale}/${ns}.json "${key}" drops the {${name}} placeholder`);
        }
      }
      for (const name of got) {
        if (!wanted.has(name)) {
          errors.push(`${locale}/${ns}.json "${key}" introduces {${name}}, which is never passed`);
        }
      }
    }
  }
}

// --- report -----------------------------------------------------------------

const keyCount = namespaces.reduce((n, ns) => n + (catalogues[SOURCE][ns]?.size ?? 0), 0);
console.log(
  `Checked ${keyCount} keys across ${namespaces.length} namespaces in ${LOCALES.length} locales.`,
);

if (errors.length > 0) {
  console.error(`\n${errors.length} message catalogue problem(s):\n`);
  for (const e of errors) console.error(`  - ${e}`);
  console.error(
    '\nAdd the key to all three of src/messages/{en,de,fr}/ in the same change.\n' +
    'A key present in en alone renders as its dotted path to every other reader.\n',
  );
  process.exit(1);
}

console.log('OK — en, de and fr agree.');
