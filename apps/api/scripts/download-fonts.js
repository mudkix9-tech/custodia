import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fonts = [
  { url: 'https://github.com/google/fonts/raw/main/ofl/inter/static/Inter-Regular.ttf', name: 'Inter-Regular.ttf' },
  { url: 'https://github.com/google/fonts/raw/main/ofl/inter/static/Inter-SemiBold.ttf', name: 'Inter-SemiBold.ttf' },
  { url: 'https://github.com/google/fonts/raw/main/ofl/inter/static/Inter-Bold.ttf', name: 'Inter-Bold.ttf' },
];

const dest = path.join(__dirname, '..', 'assets', 'fonts');

async function download() {
  await fs.mkdir(dest, { recursive: true });

  for (const font of fonts) {
    console.log(`Downloading ${font.name}...`);
    const res = await fetch(font.url);
    if (!res.ok) throw new Error(`Failed to fetch ${font.name}: ${res.statusText}`);
    const buffer = await res.arrayBuffer();
    await fs.writeFile(path.join(dest, font.name), Buffer.from(buffer));
    console.log(`Saved ${font.name} (${buffer.byteLength} bytes)`);
  }
}

download().catch(console.error);
