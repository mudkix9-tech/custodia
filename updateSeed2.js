const fs = require('fs');
const crypto = require('crypto');
const path = 'c:/Users/nisar/Desktop/GDPR/packages/db/src/seed-assessment.ts';
let code = fs.readFileSync(path, 'utf8');

const targetStr = `async function seed() {
  console.log('Clearing existing assessment data to prevent FK violations...');`;

const replacementStr = `function getDeterministicId(slug: string) {
  if (!slug) throw new Error('Slug is required for deterministic UUIDs');
  const hash = crypto.createHash('sha1').update(slug).digest('hex');
  return \`\${hash.slice(0,8)}-\${hash.slice(8,12)}-4\${hash.slice(13,16)}-a\${hash.slice(17,20)}-\${hash.slice(20,32)}\`;
}

async function seed() {
  console.log('Clearing existing assessment data to prevent FK violations...');`;

if (code.includes(targetStr)) {
  code = code.replace(targetStr, replacementStr);
  
  const idTargetStr = `if ((q as any).id) {
      values.id = (q as any).id;
    }`;
  
  const idReplacementStr = `values.id = getDeterministicId((q as any).slug);`;
  
  code = code.replace(idTargetStr, idReplacementStr);
  
  fs.writeFileSync(path, code);
  console.log('Done');
} else {
  console.error("Target string not found.");
}
