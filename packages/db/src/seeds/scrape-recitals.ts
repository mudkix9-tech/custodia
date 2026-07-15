import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function fetchWithRetry(url: string, retries = 3): Promise<string> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.text();
    } catch (err) {
      if (i === retries - 1) throw err;
      console.log(`Failed to fetch ${url}, retrying (${i + 1}/${retries})...`);
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
  throw new Error("Failed to fetch");
}

function cleanHtml(html: string): string {
  // Strip disclaimer, pagination, overview, and feedback
  let text = html
    .replace(/<div class="title-disclaimer">[\s\S]*?<\/div>/gi, '')
    .replace(/<div class="page-navigation">[\s\S]*?<\/div>/gi, '')
    .replace(/<span class="link-to-overview">[\s\S]*?<\/span>/gi, '')
    .replace(/<div class="feedback[^"]*">[\s\S]*?<\/div>/gi, '');

  // Convert sup to sentence markers (e.g. (1) )
  text = text.replace(/<sup>(\d+)<\/sup>/gi, '($1) ');

  // Remove OL tags
  text = text.replace(/<ol[^>]*>/gi, '').replace(/<\/ol>/gi, '');
  // Convert LI to markdown list items
  text = text.replace(/<li[^>]*>/gi, '\n- ').replace(/<\/li>/gi, '');
  // Remove other general html tags
  text = text.replace(/<[^>]+>/g, '');
  // Clean whitespace and line endings
  text = text.replace(/\n\s*\n/g, '\n').trim();
  return text;
}

async function scrapeRecitals() {
  console.log("Scraping GDPR Recitals 1 through 173...");
  const corpus: any[] = [];
  
  // Parallel fetch limit to avoid overwhelming the server
  const concurrencyLimit = 20;
  const recitals = Array.from({ length: 173 }, (_, i) => i + 1);
  
  for (let i = 0; i < recitals.length; i += concurrencyLimit) {
    const chunk = recitals.slice(i, i + concurrencyLimit);
    console.log(`Fetching recitals ${chunk[0]} to ${chunk[chunk.length - 1]}...`);
    
    await Promise.all(chunk.map(async (recNum) => {
      const url = `https://gdpr-info.eu/recitals/no-${recNum}/`;
      try {
        const html = await fetchWithRetry(url);
        
        // Extract Title
        const titleMatch = html.match(/<span class="dsgvo-title">([^<]+)<\/span>/);
        const title = (titleMatch && titleMatch[1]) ? titleMatch[1].trim() : `Recital ${recNum}`;
        
        // Extract Entry Content
        const contentBlockMatch = html.match(/<div class="entry-content">([\s\S]*?)<\/div>/);
        if (!contentBlockMatch || !contentBlockMatch[1]) {
          console.warn(`No content block found for Recital ${recNum}`);
          return;
        }
        
        const cleanContent = cleanHtml(contentBlockMatch[1]);
        
        corpus.push({
          sourceType: 'gdpr_recital',
          sourceReference: `Recital ${recNum}`,
          sourceUrl: url,
          content: `Recital ${recNum} - ${title}\n\n${cleanContent}`,
          metadata: {
            recitalNumber: recNum,
            title: title
          }
        });
        
        console.log(`Successfully scraped Recital ${recNum}: ${title}`);
      } catch (err) {
        console.error(`Failed to scrape Recital ${recNum}:`, err);
      }
    }));
    
    // Tiny delay between chunks
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Sort corpus by recital number
  corpus.sort((a, b) => a.metadata.recitalNumber - b.metadata.recitalNumber);
  
  // Ensure corpus folder exists
  const corpusDir = path.join(__dirname, '../../corpus');
  await fs.mkdir(corpusDir, { recursive: true });
  
  // Write gdpr-recitals-corpus.json
  const corpusPath = path.join(corpusDir, 'gdpr-recitals-corpus.json');
  await fs.writeFile(corpusPath, JSON.stringify(corpus, null, 2));
  console.log(`\nGDPR Recitals scraping complete! Saved ${corpus.length} recitals to ${corpusPath}`);
}

scrapeRecitals().catch(err => {
  console.error("Scraper failed:", err);
  process.exit(1);
});
