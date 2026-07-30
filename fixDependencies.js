const fs = require('fs');
const path = 'c:/Users/nisar/Desktop/GDPR/packages/db/src/seed-assessment.ts';
let code = fs.readFileSync(path, 'utf8');

// 1. Remove getDeterministicId from the bottom
code = code.replace(/function getDeterministicId[\s\S]*?\}\n\n/, '');

// 2. Put it at the top, just after the imports
const importsRegex = /(import [^\n]+;\n)+(import [^\n]+;\n)/;
const replacement = `$&\nfunction getDeterministicId(slug: string) {
  if (!slug) throw new Error('Slug is required for deterministic UUIDs');
  const crypto = require('crypto');
  const hash = crypto.createHash('sha1').update(slug).digest('hex');
  return \`\${hash.slice(0,8)}-\${hash.slice(8,12)}-4\${hash.slice(13,16)}-a\${hash.slice(17,20)}-\${hash.slice(20,32)}\`;
}\n`;
code = code.replace(importsRegex, replacement);

// 3. Update healthQId and paymentQId
code = code.replace(/const healthQId = '11111111-1111-4111-a111-111111111111';/, "const healthQId = getDeterministicId('client-compliance-q1');");
code = code.replace(/const paymentQId = '22222222-2222-4222-a222-222222222222';/, "const paymentQId = getDeterministicId('client-compliance-q4');");

fs.writeFileSync(path, code);
console.log('Fixed dependencies');
