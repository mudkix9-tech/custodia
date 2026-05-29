const fs = require('fs');
let content = fs.readFileSync('apps/web/src/app/(app)/settings/data/region/page.tsx', 'utf8');

content = content.replace(/import { MapPin, Database, ShieldAlert } from 'lucide-react';/, "import { MapPin, Database, ShieldAlert } from 'lucide-react';\nimport React from 'react';");

fs.writeFileSync('apps/web/src/app/(app)/settings/data/region/page.tsx', content);
