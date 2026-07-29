import https from 'https';
import fs from 'fs';
import path from 'path';

const fonts = [
  { url: 'https://github.com/rsms/inter/raw/master/docs/font-files/Inter-Regular.ttf', name: 'Inter-Regular.ttf' },
  { url: 'https://github.com/rsms/inter/raw/master/docs/font-files/Inter-SemiBold.ttf', name: 'Inter-SemiBold.ttf' },
  { url: 'https://github.com/rsms/inter/raw/master/docs/font-files/Inter-Bold.ttf', name: 'Inter-Bold.ttf' },
];

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dest = path.join(__dirname, '..', 'assets', 'fonts');

if (!fs.existsSync(dest)) {
  fs.mkdirSync(dest, { recursive: true });
}

fonts.forEach(font => {
  const destPath = path.join(dest, font.name);
  const file = fs.createWriteStream(destPath);
  https.get(font.url, response => {
    // Handle redirects
    if (response.statusCode === 302 || response.statusCode === 301) {
      https.get(response.headers.location, redirectResponse => {
        redirectResponse.pipe(file);
      });
    } else {
      response.pipe(file);
    }
  });
});
console.log('Downloading fonts...');
