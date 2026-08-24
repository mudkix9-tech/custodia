/**
 * Fails when a module grows a hardcoded English string, or references a message
 * key that does not exist.
 *
 *   node scripts/check-module-i18n.mjs ropa       # npm run check:ropa-i18n
 *   node scripts/check-module-i18n.mjs vendors    # npm run check:vendor-i18n
 *
 * Why this exists: R142. The ROPA register's five child tabs were hardcoded
 * English for a year while the four around them were translated, and nothing
 * could tell — `check:messages` compares the three catalogues against each
 * other, so a string that never reached a catalogue at all is invisible to it.
 * `tsc` sees a string literal. ESLint cannot run in this repo at all.
 *
 * The two halves fail in opposite directions, and both matter:
 *
 *   1. A literal in a translated position — JSX text, `placeholder`, `title`,
 *      `aria-label`, `header:`, `emptyStateMessage`, `confirmText` — is English
 *      that a German reader will see verbatim.
 *   2. A `t('…')` whose key is absent from the catalogue renders as its own
 *      dotted path, in every locale including English. next-intl does not throw
 *      and does not fall back; `ropa.transfers.col_country` simply appears on
 *      the page.
 *
 * It is a text scan, not a parse. It is deliberately noisy in the safe direction
 * — anything it cannot prove, it reports — and genuine exceptions go in ALLOWED
 * with a reason. A stale entry there fails too, because a reviewed exception that
 * no longer matches anything is how a real finding gets waved through later.
 *
 * It was ROPA-only until August 2026, which is exactly why the vendor module's
 * eight components could sit at zero `useTranslations` without any gate noticing
 * (vendor audit D14). A module outside this list is a module with no i18n check.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd(), 'src');

/**
 * Each module names the catalogue its `t()` calls resolve against and the files
 * that make it up.
 */
const MODULES = {
  ropa: {
    label: 'ROPA',
    namespace: 'ropa',
    catalogue: 'messages/en/ropa.json',
    targets: [
      'components/ropa',
      'app/[locale]/(app)/ropa',
      // F57 gave the DPIA its own route and components. They render the same objects
      // the register's DPIA tab does, out of the same `ropa` catalogue, so they are
      // held to the same standard — a new surface outside the guard is how the next
      // year of hardcoded English gets in.
      'components/dpia',
      'app/[locale]/(app)/dpia',
      // C32/C33. The delegated-intake questionnaire sits outside the (app) group
      // because its reader has no account, but its chrome is register copy and comes
      // out of the same catalogue. A new surface outside this guard is how the next
      // year of hardcoded English gets in.
      //
      // The *questions* it renders are English whatever the reader's locale, and that
      // is deliberate rather than an omission: they are served by the API and frozen
      // onto the request when it was sent, so the merge screen can show a reviewer
      // what was actually put to the respondent. Same call J93 made about the negative
      // assertions — translating the set belongs with translating the record.
      'app/[locale]/intake',
      'utils/ropaVocabularies.ts',
      'utils/ropaFormat.ts',
    ],
    allowed: {},
  },
  vendors: {
    label: 'Vendor Intelligence',
    namespace: 'vendors',
    catalogue: 'messages/en/vendors.json',
    targets: [
      'components/vendors',
      'app/[locale]/(app)/vendors',
    ],
    allowed: {},
  },
};

const which = process.argv[2];
if (!which || !MODULES[which]) {
  console.error(`Usage: check-module-i18n.mjs <${Object.keys(MODULES).join('|')}>`);
  process.exit(2);
}
const MODULE = MODULES[which];

/**
 * Literals that are not prose: symbols, single words that are the same in all
 * three locales, and formatting scaffolding. Matched whole.
 */
const NOT_PROSE = new Set([
  '-', '—', '·', '+', '✓', '⚠', '', ' ', 'none', 'all', 'mine', 'unowned',
  'EU', 'EEA', 'DPF', 'SCC', 'BCR', 'TIA', 'DPIA', 'ROPA', 'CSV', 'PDF',
  'DPA', 'SOC 2', 'ISO 27001', 'GDPR', 'AI', 'URL', 'DNS', 'API',
]);

const ALLOWED = MODULE.allowed;

const errors = [];
const seenAllowed = new Set();

/** Every leaf key in the catalogue as a dotted path. */
function flatten(value, prefix = '', out = new Set()) {
  for (const [key, child] of Object.entries(value)) {
    const dotted = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === 'object' && !Array.isArray(child)) flatten(child, dotted, out);
    else out.add(dotted);
  }
  return out;
}

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    // error.tsx and loading.tsx are the same boilerplate in all 34 route segments of
    // this app, hardcoded English in every one. Translating one module's three would
    // leave it inconsistent with the other thirty-one; that sweep is its own piece
    // of work.
    else if (
      /\.tsx?$/.test(entry.name)
      && !/^(error|loading|not-found)\.tsx$/.test(entry.name)
      && !entry.name.endsWith('.test.tsx')
    ) files.push(full);
  }
  return files;
}

const files = MODULE.targets.flatMap((target) => {
  const full = path.resolve(ROOT, target);
  if (!fs.existsSync(full)) return [];
  return fs.statSync(full).isDirectory() ? walk(full) : [full];
});

const keys = flatten(JSON.parse(fs.readFileSync(path.resolve(ROOT, MODULE.catalogue), 'utf8')));

/**
 * Which `useTranslations` namespace a `t(...)` call in this file resolves against.
 * A file may hold several — `const t = useTranslations('ropa.dpia')` alongside
 * `const tRopa = useTranslations('ropa')` — so the variable name is the key.
 */
function namespacesOf(text) {
  const map = new Map();
  for (const m of text.matchAll(/const\s+(\w+)\s*=\s*useTranslations\(\s*'([^']+)'\s*\)/g)) {
    map.set(m[1], m[2]);
  }
  return map;
}

/** Strip comments and imports so their prose is not read as UI copy. */
function stripNoise(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/^\s*import[\s\S]*?from\s+'[^']*';$/gm, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
}

/** Two or more words, or one word of four-plus letters — i.e. something to read. */
function looksLikeProse(value) {
  const trimmed = value.trim();
  if (!trimmed || NOT_PROSE.has(trimmed)) return false;
  if (/^[\d\s.,:%+#()/-]*$/.test(trimmed)) return false;
  // Class names, ids, urls, keys, format tokens.
  if (/^[a-z0-9_-]+$/.test(trimmed)) return false;
  if (/^[#/.]/.test(trimmed) || trimmed.includes('://')) return false;
  if (!/[A-Za-z]/.test(trimmed)) return false;
  return /\s/.test(trimmed) ? true : trimmed.length >= 4 && /^[A-Z]/.test(trimmed);
}

for (const file of files) {
  const raw = fs.readFileSync(file, 'utf8');
  const rel = path.relative(process.cwd(), file).replace(/\\/g, '/');
  const text = stripNoise(raw);
  const ns = namespacesOf(raw);

  // --- 1. keys that do not exist -------------------------------------------
  for (const m of text.matchAll(/\b(\w+)\(\s*'([^'{}]+)'/g)) {
    const namespace = ns.get(m[1]);
    if (!namespace || !namespace.startsWith(MODULE.namespace)) continue;
    const dotted = `${namespace}.${m[2]}`.replace(new RegExp(`^${MODULE.namespace}\\.`), '');
    if (!keys.has(dotted)) {
      errors.push(`${rel}: message key "${MODULE.namespace}.${dotted}" is not in ${MODULE.catalogue} — it will render as its own path.`);
    }
  }

  // --- 2. hardcoded English -------------------------------------------------
  const literals = [];

  // Props whose value is user-visible text.
  for (const m of text.matchAll(/\b(placeholder|title|aria-label|emptyStateMessage|confirmText|cancelText|label|header|description)\s*[=:]\s*(?:\{\s*)?'([^']+)'/g)) {
    literals.push(m[2]);
  }
  // JSX text nodes: >Some words<. Anything carrying an operator is the tail of a
  // JSX expression rather than a text node — `f.points === 0) && (` reads as prose
  // to a regex and is not.
  for (const m of text.matchAll(/>\s*([A-Za-z][^<>{}\n]{3,})\s*</g)) {
    if (/[=;()&|]/.test(m[1])) continue;
    literals.push(m[1]);
  }

  // Calls whose first argument is shown to a user. Toasts and announcements are as
  // visible as anything on the page and were the last English left in the register
  // after the tabs were extracted — a literal here is not caught by any prop or
  // text-node rule.
  for (const m of text.matchAll(/\b(toast|announce|confirm)\(\s*'([^']+)'/g)) {
    literals.push(m[2]);
  }

  for (const value of literals) {
    if (!looksLikeProse(value)) continue;
    const key = `${rel}::${value.trim()}`;
    if (ALLOWED[key]) { seenAllowed.add(key); continue; }
    errors.push(`${rel}: hardcoded English "${value.trim().slice(0, 70)}" — extract it into src/messages/{en,de,fr}/${MODULE.namespace}.json.`);
  }
}

const stale = Object.keys(ALLOWED).filter((k) => !seenAllowed.has(k));
for (const key of stale) {
  errors.push(`Stale exception in check-module-i18n.mjs (${which}): ${key} no longer matches anything. Remove it.`);
}

if (errors.length > 0) {
  console.log(`\n${MODULE.label} i18n: ${errors.length} problem${errors.length === 1 ? '' : 's'}.\n`);
  for (const error of errors) console.log(`  ${error}`);
  console.log(`
next-intl renders a missing key as its own dotted path, in every locale, and a
hardcoded string reaches German and French readers in English. Neither is visible
to tsc or to check:messages, which is why R142 asked for this check.
`);
  process.exit(1);
}

console.log(`Checked ${files.length} ${MODULE.label} files against ${keys.size} message keys.`);
console.log('OK — no hardcoded English and no missing keys.');
