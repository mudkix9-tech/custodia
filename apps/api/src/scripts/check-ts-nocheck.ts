/**
 * Fails when any file in apps/api carries `@ts-nocheck`.
 *
 *   npm run check:nocheck --workspace=apps/api
 *
 * Why this exists: ten files carried the pragma until August 2026, and removing it
 * surfaced eighteen errors — of which the three in `index.ts` were not style noise
 * but a service that could not boot (two imports of worker modules that have never
 * existed) and a tRPC context missing `db`, which broke every publicProcedure.
 *
 * The pragma is worse than a broad `any` because it is invisible: nothing in the
 * output of `npm run check` mentions the file at all, so a whole entry point can
 * rot without the gate ever going amber. `tsc` is the only static gate this repo
 * has — eslint cannot run — so a file that opts out of it is unchecked by anything.
 *
 * There is deliberately no allowlist. A file that genuinely cannot be typed should
 * carry `@ts-expect-error` on the specific lines, which stays visible and fails once
 * the underlying problem is fixed.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..');

const PRAGMA = /^\s*\/\/\s*@ts-nocheck\b/;

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.isFile() && full.endsWith('.ts') ? [full] : [];
  });
}

const offenders: Array<{ file: string; line: number }> = [];

for (const file of walk(SRC)) {
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  // The pragma only suppresses the file when it precedes the first statement, so a
  // scan of the leading comment block is enough and avoids matching it in prose.
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    if (PRAGMA.test(lines[i] ?? '')) {
      offenders.push({ file: path.relative(SRC, file), line: i + 1 });
      break;
    }
  }
}

if (offenders.length > 0) {
  console.error(`\n${offenders.length} file(s) opt out of typechecking with @ts-nocheck:\n`);
  for (const { file, line } of offenders) {
    console.error(`  src/${file.replace(/\\/g, '/')}:${line}`);
  }
  console.error(
    '\nRemove the pragma and fix what it was hiding. If a specific line genuinely\n' +
    'cannot be typed, use @ts-expect-error on that line instead so it stays visible.\n'
  );
  process.exit(1);
}

console.log('check:nocheck — no @ts-nocheck in apps/api');
