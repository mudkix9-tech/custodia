const fs = require('fs');
const path = require('path');

const routersDir = 'apps/api/src/routers';
const files = fs.readdirSync(routersDir).filter(f => f.endsWith('.ts'));

for (const file of files) {
  const filePath = path.join(routersDir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  // Replace direct db queries with ctx.db queries
  // Needs to handle db.query, db.insert, db.update, db.delete, db.select, db.transaction, db.execute

  // However, `import { db } from '../db.js'` will cause issues if we remove it completely
  // we will replace instances inside the route handlers where `ctx` is available.
  // Actually, standard `db.` should be replaced with `ctx.db.` everywhere inside mutation/query functions.

  // Quick hack: simply rename imported `db` to something else like `__db`,
  // and do a string replacement of ` db.` with ` ctx.db.` for most standard query patterns.
  // A safer programmatic way is needed.

  // Let's do a simple regex for most cases. It's risky.
  // We'll replace it specifically.
  const regex = /\b(?<!\.)db\.(select|insert|update|delete|query|transaction|execute)\b/g;
  content = content.replace(regex, 'ctx.db.$1');

  fs.writeFileSync(filePath, content);
}
console.log('Finished updating routers to use ctx.db');
