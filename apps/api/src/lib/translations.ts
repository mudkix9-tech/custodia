import fs from 'fs';
import path from 'path';

export function getTranslations(locale: string, namespace: string) {
  try {
    // Attempt to resolve the path relative to apps/api, assuming monorepo structure
    let basePath = path.join(process.cwd(), '../web/src/messages');
    let filePath = path.join(basePath, locale, `${namespace}.json`);
    
    // Fallback if not found (e.g. running from root or compiled output)
    if (!fs.existsSync(filePath)) {
      basePath = path.resolve(__dirname, '../../../../web/src/messages');
      filePath = path.join(basePath, locale, `${namespace}.json`);
    }

    if (!fs.existsSync(filePath)) {
       // Another fallback just in case
       basePath = path.resolve(process.cwd(), 'apps/web/src/messages');
       filePath = path.join(basePath, locale, `${namespace}.json`);
    }

    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch (e) {
    console.warn(`Failed to load translations for ${locale}/${namespace} in api`, e);
  }
  return null;
}
