const fs = require('fs');
const path = require('path');

const routersDir = path.join(__dirname, 'src', 'routers');

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  let original = content;

  // Fix async () => { ... ctx.db ... }
  // to async ({ ctx }) => { ... ctx.db ... }
  content = content.replace(/\.query\(\s*async\s*\(\s*\)\s*=>\s*\{/g, '.query(async ({ ctx }) => {');
  content = content.replace(/\.mutation\(\s*async\s*\(\s*\)\s*=>\s*\{/g, '.mutation(async ({ ctx }) => {');
  
  // Fix async ({ input }) => { ... ctx.db ... }
  content = content.replace(/\.query\(\s*async\s*\(\{\s*input\s*\}\)\s*=>\s*\{/g, '.query(async ({ ctx, input }) => {');
  content = content.replace(/\.mutation\(\s*async\s*\(\{\s*input\s*\}\)\s*=>\s*\{/g, '.mutation(async ({ ctx, input }) => {');

  // Fix implicit any in maps and filters, e.g. .map(a => ... ) to .map((a: any) => ... )
  // We'll just do some common ones.
  content = content.replace(/\.map\(\s*([a-zA-Z_]+)\s*=>/g, '.map(($1: any) =>');
  content = content.replace(/\.filter\(\s*([a-zA-Z_]+)\s*=>/g, '.filter(($1: any) =>');
  content = content.replace(/\.forEach\(\s*([a-zA-Z_]+)\s*=>/g, '.forEach(($1: any) =>');
  content = content.replace(/\.reduce\(\s*\(\s*([a-zA-Z_]+)\s*,\s*([a-zA-Z_]+)\s*\)\s*=>/g, '.reduce(($1: any, $2: any) =>');

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log('Fixed', filePath);
  }
}

const files = fs.readdirSync(routersDir);
for (const file of files) {
  if (file.endsWith('.ts')) {
    fixFile(path.join(routersDir, file));
  }
}
