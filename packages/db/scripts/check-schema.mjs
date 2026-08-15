/**
 * Fails when schema.ts and drizzle/ have drifted apart.
 *
 *   npm run check:schema --workspace=packages/db
 *
 * Runs `drizzle-kit generate` and then asks git whether it produced anything.
 * If it did, someone edited schema.ts without generating the migration — or
 * hand-wrote a migration that does not match the schema.
 *
 * Why this is a script rather than the one-liner it used to be: the old form
 * was `drizzle-kit generate && if [ -n "$(git status --porcelain drizzle/)" ]`,
 * which npm hands to cmd.exe on Windows. cmd cannot parse it — it exits with
 * "-n was unexpected at this time" and a non-zero code, *whether or not* the
 * schema has drifted. So on Windows this guard failed identically in both
 * states, which makes it worse than no guard: the one run that matters looks
 * exactly like the one that does not.
 *
 * Staged changes count. `git status --porcelain` reports them, and a migration
 * that is staged but uncommitted is still drift as far as the next person to
 * clone is concerned.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGE_DIR = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..');

function run(command, args) {
  return execFileSync(command, args, {
    cwd: PACKAGE_DIR,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });
}

/**
 * The CLI is invoked as its own JS entry point under the current node, not
 * through the node_modules/.bin shim. The shim is a .cmd file on Windows, which
 * Node has refused to execFile since the 2024 command-injection fix, and
 * routing it back through cmd.exe reintroduces the quoting problem this script
 * exists to escape.
 */
function resolveDrizzleKit() {
  const roots = [PACKAGE_DIR, path.resolve(PACKAGE_DIR, '../..')];
  for (const root of roots) {
    const manifest = path.join(root, 'node_modules', 'drizzle-kit', 'package.json');
    if (!existsSync(manifest)) continue;
    const { bin } = JSON.parse(readFileSync(manifest, 'utf8'));
    const entry = typeof bin === 'string' ? bin : bin?.['drizzle-kit'];
    if (entry) return path.join(root, 'node_modules', 'drizzle-kit', entry);
  }
  return null;
}

const drizzleKit = resolveDrizzleKit();

if (!drizzleKit) {
  console.error('drizzle-kit is not installed — run `npm install` first.');
  process.exit(1);
}

run(process.execPath, [drizzleKit, 'generate']);

const changed = run('git', ['status', '--porcelain', '--', 'drizzle/']).trim();

if (changed) {
  console.error('\nSchema drift detected — `drizzle-kit generate` produced changes:\n');
  for (const line of changed.split('\n')) console.error(`  ${line.trim()}`);
  console.error(
    '\nEdit packages/db/src/schema.ts and run `npm run generate --workspace=packages/db`,\n' +
    'then commit the generated file. Never hand-write a migration — this check\n' +
    'fails on the difference.\n',
  );
  process.exit(1);
}

console.log('OK — schema.ts and drizzle/ agree.');
