/**
 * Fails when a Drizzle relational query asks for a relation the schema does not
 * define.
 *
 *   npm run check:relations --workspace=apps/api
 *
 * Why this exists: `db.query.<table>.findMany({ with: { foo: true } })` is not
 * typechecked. For a table with no `relations()` block at all, Drizzle widens the
 * `with` key type and `tsc` accepts any name; at runtime the dialect looks the key
 * up in `tableConfig.relations`, gets `undefined`, and throws
 * `Cannot read properties of undefined (reading 'referencedTable')` while *building*
 * the query — so the endpoint or worker fails on every single call, not on some
 * unlucky row. Fourteen call sites across nine files were in that state in August
 * 2026, including the nightly `gap-scanner` and every webhook delivery.
 *
 * It also catches the subtler half of the same failure: a `many()` whose target
 * table declares no `one()` back, which leaves Drizzle with no fields/references to
 * infer the join from and throws in the same place.
 *
 * This is a text scan of `schema.ts` and the call sites, not a type-aware analysis.
 * It only understands `with` written as an object literal directly in the query
 * options, which is how every call site in this repo writes it.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.resolve(fileURLToPath(new URL('.', import.meta.url)));
const SCHEMA = path.resolve(HERE, '../../../../packages/db/src/schema.ts');
const SCAN_ROOTS = [path.resolve(HERE, '..'), path.resolve(HERE, '../../../web/src')];

type Relation = { kind: 'one' | 'many'; target: string };
type Problem = { file: string; line: number; label: string; reason: string };

/** Returns the index of the `}` closing the `{` at `openIdx`. */
function matchBrace(src: string, openIdx: number): number {
  let depth = 0;
  for (let i = openIdx; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return i;
  }
  return -1;
}

/**
 * tableVar -> { relationKey -> relation }. Keyed by the *exported variable* name,
 * which is also the key Drizzle exposes on `db.query`.
 */
function readSchemaRelations(): Map<string, Record<string, Relation>> {
  const src = fs.readFileSync(SCHEMA, 'utf8');
  const map = new Map<string, Record<string, Relation>>();
  const blockRe = /export const \w+ = relations\((\w+),\s*\(\{[^}]*\}\)\s*=>\s*\(\{/g;
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(src))) {
    const body = src.slice(blockRe.lastIndex, matchBrace(src, blockRe.lastIndex - 1));
    const entries: Record<string, Relation> = {};
    const keyRe = /(\w+):\s*(one|many)\((\w+)/g;
    let k: RegExpExecArray | null;
    while ((k = keyRe.exec(body))) entries[k[1]!] = { kind: k[2] as 'one' | 'many', target: k[3]! };
    map.set(m[1]!, entries);
  }
  return map;
}

/** Bodies of every `with: { … }` sitting at the top level of `body`. */
function topLevelWithBodies(body: string): string[] {
  const out: string[] = [];
  const re = /\bwith:\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    const open = m.index + m[0].length - 1;
    let depth = 0;
    for (let i = 0; i < m.index; i++) {
      if (body[i] === '{') depth++;
      else if (body[i] === '}') depth--;
    }
    if (depth !== 0) continue; // nested — reached through recursion instead
    out.push(body.slice(open + 1, matchBrace(body, open)));
  }
  return out;
}

/** `key: true` and `key: { … }` entries of a `with` body. */
function withEntries(body: string): Array<{ key: string; nested: string | null }> {
  const out: Array<{ key: string; nested: string | null }> = [];
  let i = 0;
  while (i < body.length) {
    const km = body.slice(i).match(/^\s*(\w+)\s*:\s*/);
    if (!km) { i++; continue; }
    const valStart = i + km[0].length;
    if (body[valStart] === '{') {
      const close = matchBrace(body, valStart);
      out.push({ key: km[1]!, nested: body.slice(valStart + 1, close) });
      i = close + 1;
    } else {
      const comma = body.indexOf(',', valStart);
      out.push({ key: km[1]!, nested: null });
      i = comma === -1 ? body.length : comma + 1;
    }
  }
  return out;
}

const relations = readSchemaRelations();
const problems: Problem[] = [];

function check(file: string, line: number, table: string, withBody: string, label: string): void {
  const rels = relations.get(table);
  for (const { key, nested } of withEntries(withBody)) {
    const here = `${label}.${key}`;
    if (!rels) {
      problems.push({ file, line, label: here, reason: `table "${table}" has no relations() block` });
      continue;
    }
    const rel = rels[key];
    if (!rel) {
      const known = Object.keys(rels).join(', ') || 'none';
      problems.push({ file, line, label: here, reason: `"${table}" has no relation "${key}" (defined: ${known})` });
      continue;
    }
    // A many() carries no fields/references of its own; Drizzle infers the join
    // from the one() pointing back, and throws if there isn't one.
    if (rel.kind === 'many') {
      const target = relations.get(rel.target);
      const hasReverse = target && Object.values(target).some((r) => r.kind === 'one' && r.target === table);
      if (!hasReverse) {
        problems.push({ file, line, label: here, reason: `many(${rel.target}) has no one() back to "${table}", so the join cannot be inferred` });
      }
    }
    if (nested) for (const nb of topLevelWithBodies(nested)) check(file, line, rel.target, nb, here);
  }
}

function walk(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p, out); }
    else if (e.name.endsWith('.ts') || e.name.endsWith('.tsx')) out.push(p);
  }
  return out;
}

let queriesChecked = 0;
for (const file of SCAN_ROOTS.flatMap((r) => walk(r))) {
  const src = fs.readFileSync(file, 'utf8');
  if (!src.includes('with:')) continue;
  const queryRe = /(?:\bdb|ctx\.db|tx)\.query\.(\w+)\.(?:findMany|findFirst)\(\s*\{/g;
  let q: RegExpExecArray | null;
  while ((q = queryRe.exec(src))) {
    const open = q.index + q[0].length - 1;
    const body = src.slice(open + 1, matchBrace(src, open));
    const line = src.slice(0, q.index).split('\n').length;
    for (const wb of topLevelWithBodies(body)) {
      queriesChecked++;
      check(file, line, q[1]!, wb, q[1]!);
    }
  }
}

const rel = (f: string) => path.relative(path.resolve(HERE, '../../../..'), f).split(path.sep).join('/');

if (problems.length > 0) {
  const n = problems.length;
  console.error(`\n${n} relational quer${n === 1 ? 'y references' : 'ies reference'} a relation the schema does not define:\n`);
  for (const p of problems) console.error(`  ${rel(p.file)}:${p.line}\n    ${p.label} — ${p.reason}\n`);
  console.error('Each of these throws at query-build time on every call. Add the missing');
  console.error('relations() to packages/db/src/schema.ts, or drop the `with` key.\n');
  process.exit(1);
}

console.log(`Checked ${queriesChecked} relational queries against ${relations.size} relations() blocks.`);
console.log('OK — every `with` key resolves to a defined relation.');
