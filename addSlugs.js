const fs = require('fs');
const path = 'c:/Users/nisar/Desktop/GDPR/packages/db/src/seed-assessment.ts';
let code = fs.readFileSync(path, 'utf8');

let qCounts = {};
code = code.replace(/category:\s*'([^']+)',/g, (m, cat) => {
  const slugBase = cat.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  qCounts[slugBase] = (qCounts[slugBase] || 0) + 1;
  const slug = slugBase + '-q' + qCounts[slugBase];
  return `slug: '${slug}',\n    ${m}`;
});

fs.writeFileSync(path, code);
console.log('Successfully added slugs to', path);
