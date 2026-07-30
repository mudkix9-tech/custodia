const fs = require('fs');
const path = 'c:/Users/nisar/Desktop/GDPR/packages/db/src/seed-assessment.ts';
let code = fs.readFileSync(path, 'utf8');

const targetStr = `  console.log(\`Seeding \${questions.length} GDPR Gap Assessment Questions...\`);
  for (const q of questions) {
    const maxRiskWeight = Math.max(...q.options.map((o: any) => o.riskWeight));
    const values: any = {
      questionText: q.questionText,
      category: q.category,
      options: q.options,
      dependsOn: q.dependsOn,
      maxRiskWeight: maxRiskWeight,
      gdprArticles: q.gdprArticles,
    };
    if ((q as any).id) {
      values.id = (q as any).id;
    }
    
    await db.insert(assessmentTemplates).values(values);
  }`;

const replacementStr = `function getDeterministicId(slug: string) {
  if (!slug) throw new Error("Slug is required for deterministic UUIDs");
  const hash = crypto.createHash('sha1').update(slug).digest('hex');
  // Format as valid UUID (8-4-4-4-12)
  return \`\${hash.slice(0,8)}-\${hash.slice(8,12)}-4\${hash.slice(13,16)}-a\${hash.slice(17,20)}-\${hash.slice(20,32)}\`;
}

  console.log(\`Seeding \${questions.length} GDPR Gap Assessment Questions...\`);
  for (const q of questions) {
    const maxRiskWeight = Math.max(...q.options.map((o: any) => o.riskWeight));
    const values: any = {
      id: getDeterministicId((q as any).slug),
      questionText: q.questionText,
      category: q.category,
      options: q.options,
      dependsOn: q.dependsOn,
      maxRiskWeight: maxRiskWeight,
      gdprArticles: q.gdprArticles,
    };
    
    await db.insert(assessmentTemplates).values(values);
  }`;

if (code.includes(targetStr)) {
  code = code.replace(targetStr, replacementStr);
  fs.writeFileSync(path, code);
  console.log('Successfully updated seed script');
} else {
  console.error('Target string not found in file');
}
