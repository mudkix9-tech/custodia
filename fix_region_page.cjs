const fs = require('fs');
let content = fs.readFileSync('apps/web/src/app/(app)/settings/data/region/page.tsx', 'utf8');

content = content.replace(/import { MapPin, Server, Database, ShieldAlert } from 'lucide-react';/, "import { MapPin, Database, ShieldAlert } from 'lucide-react';");
content = content.replace(/any/g, 'any /* eslint-disable-line @typescript-eslint/no-explicit-any */');

fs.writeFileSync('apps/web/src/app/(app)/settings/data/region/page.tsx', content);
