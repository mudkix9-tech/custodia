import fs from 'fs';
import path from 'path';

export function getTranslations(locale: string, namespace: string) {
  try {
    const basePath = path.join(process.cwd(), 'src/messages');
    const filePath = path.join(basePath, locale, `${namespace}.json`);
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch (e) {
    console.warn(`Failed to load translations for ${locale}/${namespace}`, e);
  }
  return null;
}
