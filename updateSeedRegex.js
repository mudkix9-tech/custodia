const fs = require('fs');
const crypto = require('crypto');
const path = 'c:/Users/nisar/Desktop/GDPR/packages/db/src/seed-assessment.ts';
let code = fs.readFileSync(path, 'utf8');

const replacementFunc = `function getDeterministicId(slug: string) {
  if (!slug) throw new Error('Slug is required for deterministic UUIDs');
  const hash = crypto.createHash('sha1').update(slug).digest('hex');
  return \`\${hash.slice(0,8)}-\${hash.slice(8,12)}-4\${hash.slice(13,16)}-a\${hash.slice(17,20)}-\${hash.slice(20,32)}\`;
}

async function seed() {`;

code = code.replace(/async function seed\(\) \{/, replacementFunc);

const idReplacement = `values.id = getDeterministicId((q as any).slug);`;

code = code.replace(/if \(\(q as any\)\.id\) \{[\s\S]*?\}\s*await db\.insert/g, idReplacement + "\n    await db.insert");

fs.writeFileSync(path, code);
console.log('Done');
