/**
 * Fails when a sourced catalogue column is written without provenance beside it.
 *
 *   npm run check:vendor-provenance --workspace=apps/api
 *
 * Why this exists: the sourcing programme's central claim is that the zero-model
 * policy "is enforced by the type system, not by prose" — a model-sourced value
 * has nowhere to be stored because `ai_grounded` left `VENDOR_SOURCE_TYPES`.
 * That is true of the *provenance* table and only of it. Nothing whatever
 * stopped a write straight into `vendors.headquarters_country` with no
 * `vendor_field_provenance` row at all, which is the same defect one door down:
 * a Chapter V field the product asserts and cannot say where it got.
 *
 * The only thing that ever checked the invariant was `seed:catalogue --verify`,
 * a query that runs when somebody runs the seed. This is the CI half. Nine guard
 * scripts existed for exactly this class of invariant and the programme's own
 * headline claim had none of them.
 *
 * It is a **text scan**, not a parse, and it is noisy in the safe direction: it
 * asks whether a statement writing a sourced column sits in a function that also
 * writes provenance, or calls one of the mappers that does. That is weaker than
 * proving a row is written for *that* field, and it is enough to stop the
 * failure that matters — a new write path that never considered provenance at
 * all. Genuine exceptions go in ALLOWED with a reason, and a stale entry fails
 * too, for the same reason `check:tenancy`'s allowlist does.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.resolve(fileURLToPath(new URL('.', import.meta.url)));
const SCAN_ROOT = path.resolve(HERE, '..');

/**
 * The columns whose value is a claim about the outside world.
 *
 * Identity — name, slug, website, category — is deliberately absent, and that is
 * the same line `seed:catalogue --verify` draws: the seed *asserts* those, and a
 * provenance row claiming they were sourced from somewhere would misdescribe
 * where they came from.
 */
const SOURCED_COLUMNS = [
  'legalEntityName',
  'headquartersCountry',
  'transferMechanisms',
  'securityCertifications',
  'dataProcessingLocations',
  'dpaUrl',
  'privacyPolicyUrl',
  'subProcessorListUrl',
];

/** Anything that writes, or delegates writing, a provenance row. */
const PROVENANCE_MARKERS = [
  'vendorFieldProvenance',
  'writeProvenance',
  'buildCatalogueWrites',
  'submitFieldCorrection',
];

/**
 * `file::symbol` -> why this write needs no provenance row.
 *
 * Empty, and it should stay that way for as long as possible. The one exception
 * the codebase genuinely has — a tenant's own private vendor row — is recognised
 * structurally by `isTenantPrivateWrite` below rather than named here, because a
 * rule about what the payload *is* cannot go stale the way a rule about where it
 * lives can. An entry here should have to argue that it is neither a catalogue
 * assertion nor a tenant-private row.
 */
const ALLOWED: Record<string, string> = {};

/**
 * A row the organisation is writing about its own supplier, not a catalogue
 * assertion about a third party.
 *
 * `isGlobal: false` with an `organizationId` beside it is the shape of a custom
 * vendor: typed into the add-vendor form or imported from the tenant's own CSV,
 * never read by another tenant, and never a claim Custodia is making. Asking for
 * a provenance row there would be asking the customer to cite a source for a
 * fact about their own supplier — which is what the `customer` tier means and
 * what `selectAuthoritativeProvenance` deliberately keeps out of the catalogue.
 */
function isTenantPrivateWrite(payload: string): boolean {
  return /isGlobal\s*:\s*false/.test(payload) && mentionsColumn(payload, 'organizationId');
}

/**
 * Does `payload` name this column as a whole word?
 *
 * An index walk rather than a regex on purpose. The word boundary is the one
 * character in this file that has to survive being edited through a shell, and
 * an escape that silently becomes a backspace turns the whole guard into a scan
 * that matches nothing and passes — which is what the first version of this
 * script did. See the floor at the bottom.
 */
function mentionsColumn(payload: string, column: string): boolean {
  const isWord = (ch: string) => /[A-Za-z0-9_$]/.test(ch);
  let i = payload.indexOf(column);
  while (i !== -1) {
    const before = i === 0 ? ' ' : payload[i - 1]!;
    const following = payload[i + column.length] ?? ' ';
    if (!isWord(before) && !isWord(following)) return true;
    i = payload.indexOf(column, i + 1);
  }
  return false;
}

/**
 * Does this payload set a column chosen at runtime — `.set({ [field]: value })`?
 *
 * The one shape a name-matching scan cannot see, and the most dangerous one it
 * could miss: a write whose target column is a string the caller supplied
 * touches *any* sourced column, so it needs provenance in scope more than a
 * literal write does, not less. `applyCorrectionToColumn` is the current
 * example, and it went uncounted until this was added — the guard reported a
 * clean pass over a codebase containing the broadest catalogue write in it.
 *
 * A computed key is treated as naming every sourced column, which is what it
 * might be. Narrowing it to what an allowlist elsewhere permits would be trusting
 * the thing under inspection.
 */
function hasComputedKey(payload: string): boolean {
  return /\[\s*[A-Za-z_$][\w$.]*\s*\]\s*:/.test(payload);
}

interface Problem {
  file: string;
  line: number;
  symbol: string;
  columns: string[];
}

const problems: Problem[] = [];
const seenAllowed = new Set<string>();
/** Every `vendors` write whose payload this script could parse at all. */
let payloadsSeen = 0;
/** Of those, the ones asserting a sourced column about a third party. */
let writesChecked = 0;
/** And the ones exempted structurally, reported so the number is not invisible. */
let tenantPrivate = 0;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'fixtures') continue;
      walk(full, out);
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
      out.push(full);
    }
  }
  return out;
}

/** Index of the `)` closing the `(` at `open`, or -1 if it is unbalanced. */
function matchParen(text: string, open: number): number {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === '(') depth++;
    else if (text[i] === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * The nearest enclosing named function or exported const — the unit the
 * allowlist is keyed on, and the scope a provenance marker is looked for in.
 */
function enclosingSymbol(src: string, index: number): { name: string; start: number; end: number } {
  const declaration = /(?:export\s+)?(?:async\s+)?function\s+(\w+)|(?:export\s+)?const\s+(\w+)\s*[:=]/g;
  const head = src.slice(0, index);
  let best: { name: string; start: number } | null = null;
  let m: RegExpExecArray | null;
  while ((m = declaration.exec(head))) best = { name: m[1] ?? m[2] ?? '?', start: m.index };
  if (!best) return { name: '(top level)', start: 0, end: src.length };

  declaration.lastIndex = index;
  const next = declaration.exec(src);
  return { name: best.name, start: best.start, end: next ? next.index : src.length };
}

for (const file of walk(SCAN_ROOT)) {
  const src = fs.readFileSync(file, 'utf8');
  if (!src.includes('vendors')) continue;

  const writeRe = /\.(?:update|insert)\(\s*vendors\s*\)/g;
  let w: RegExpExecArray | null;
  while ((w = writeRe.exec(src))) {
    // The payload is whatever `.set(...)` or `.values(...)` follows.
    const after = src.slice(w.index, w.index + 4000);
    const payloadStart = after.search(/\.(?:set|values)\s*\(/);
    if (payloadStart === -1) continue;
    const openParen = after.indexOf('(', payloadStart);
    const close = matchParen(after, openParen);
    const payload = close === -1 ? after.slice(openParen) : after.slice(openParen, close);
    payloadsSeen++;

    const computed = hasComputedKey(payload);
    const columns = computed
      ? [...SOURCED_COLUMNS]
      : SOURCED_COLUMNS.filter((c) => mentionsColumn(payload, c));
    if (columns.length === 0) continue;
    if (isTenantPrivateWrite(payload)) {
      tenantPrivate++;
      continue;
    }

    writesChecked++;
    const symbol = enclosingSymbol(src, w.index);
    const scope = src.slice(symbol.start, symbol.end);
    const key = `${path.relative(SCAN_ROOT, file).split(path.sep).join('/')}::${symbol.name}`;

    if (key in ALLOWED) {
      seenAllowed.add(key);
      continue;
    }
    if (PROVENANCE_MARKERS.some((marker) => scope.includes(marker))) continue;

    problems.push({
      file,
      line: src.slice(0, w.index).split('\n').length,
      symbol: symbol.name,
      columns,
    });
  }
}

const rel = (f: string) => path.relative(path.resolve(HERE, '../../../..'), f).split(path.sep).join('/');

/**
 * A scan that matches nothing passes, and a guard that passes for the wrong
 * reason is worse than no guard at all.
 *
 * The first version of this script had exactly that bug: its word boundary was
 * an escape that JavaScript reads as a backspace character, so every column
 * regex matched nothing and it reported a clean codebase in a repo with four
 * unguarded writes in one file. The floor below is the fix, and it is the shape
 * every guard whose evidence is "I found nothing" should carry.
 */
if (payloadsSeen === 0) {
  console.error('');
  console.error('This guard matched no writes to sourced catalogue columns at all.');
  console.error('There are writes to `vendors` in this repo, so the detector is broken');
  console.error('rather than the codebase clean. Fix the scan before trusting it.');
  console.error('');
  process.exit(1);
}

const stale = Object.keys(ALLOWED).filter((k) => !seenAllowed.has(k));
if (stale.length > 0) {
  console.error('');
  console.error('ALLOWED entries that no longer match a write:');
  for (const k of stale) console.error(`  ${k}`);
  console.error('');
  console.error('Remove them. A stale exemption is an exemption nobody reviewed.');
  console.error('');
  process.exit(1);
}

if (problems.length > 0) {
  console.error('');
  console.error(`${problems.length} write(s) set a sourced catalogue column with no provenance beside them:`);
  console.error('');
  for (const p of problems) {
    console.error(`  ${rel(p.file)}:${p.line}  ${p.symbol}`);
    console.error(`    sets ${p.columns.join(', ')}, and nothing in scope writes vendor_field_provenance`);
    console.error('');
  }
  console.error('Each of these is a claim about a third party that the product cannot source.');
  console.error('Write the provenance row, or add the symbol to ALLOWED with a reason.');
  console.error('');
  process.exit(1);
}

console.log(
  `Parsed ${payloadsSeen} write(s) to \`vendors\`: ${writesChecked} assert a sourced ` +
  `catalogue column, ${tenantPrivate} are tenant-private rows.`,
);
console.log('OK — every catalogue assertion writes provenance, or is exempted with a reason.');
