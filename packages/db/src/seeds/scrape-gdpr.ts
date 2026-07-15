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
  // Remove OL tags
  let text = html.replace(/<ol[^>]*>/gi, '').replace(/<\/ol>/gi, '');
  // Convert LI to markdown list items
  text = text.replace(/<li[^>]*>/gi, '\n- ').replace(/<\/li>/gi, '');
  // Remove other general html tags
  text = text.replace(/<[^>]+>/g, '');
  // Clean whitespace and line endings
  text = text.replace(/\n\s*\n/g, '\n').trim();
  return text;
}

async function scrapeGdpr() {
  console.log("Scraping GDPR Articles 1 through 99...");
  const corpus: any[] = [];
  
  // Parallel fetch limit to avoid overwhelming the server
  const concurrencyLimit = 10;
  const articles = Array.from({ length: 99 }, (_, i) => i + 1);
  
  for (let i = 0; i < articles.length; i += concurrencyLimit) {
    const chunk = articles.slice(i, i + concurrencyLimit);
    console.log(`Fetching articles ${chunk[0]} to ${chunk[chunk.length - 1]}...`);
    
    await Promise.all(chunk.map(async (artNum) => {
      const url = `https://gdpr-info.eu/art-${artNum}-gdpr/`;
      try {
        const html = await fetchWithRetry(url);
        
        // Extract Title
        const titleMatch = html.match(/<span class="dsgvo-title">([^<]+)<\/span>/);
        const title = (titleMatch && titleMatch[1]) ? titleMatch[1].trim() : `Article ${artNum}`;
        
        // Extract Entry Content
        const contentBlockMatch = html.match(/<div class="entry-content">([\s\S]*?)<\/div>/);
        if (!contentBlockMatch || !contentBlockMatch[1]) {
          console.warn(`No content block found for Article ${artNum}`);
          return;
        }
        
        const cleanContent = cleanHtml(contentBlockMatch[1]);
        
        corpus.push({
          sourceType: 'gdpr_article',
          sourceReference: `Article ${artNum}`,
          sourceUrl: url,
          content: `Article ${artNum} - ${title}\n\n${cleanContent}`,
          metadata: {
            articleNumber: artNum,
            title: title
          }
        });
        
        console.log(`Successfully scraped Article ${artNum}: ${title}`);
      } catch (err) {
        console.error(`Failed to scrape Article ${artNum}:`, err);
      }
    }));
    
    // Tiny delay between chunks
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Sort corpus by article number
  corpus.sort((a, b) => a.metadata.articleNumber - b.metadata.articleNumber);
  
  // Ensure corpus folder exists
  const corpusDir = path.join(__dirname, '../../corpus');
  await fs.mkdir(corpusDir, { recursive: true });
  
  // Write gdpr-corpus.json
  const corpusPath = path.join(corpusDir, 'gdpr-corpus.json');
  await fs.writeFile(corpusPath, JSON.stringify(corpus, null, 2));
  console.log(`\nGDPR scraping complete! Saved ${corpus.length} articles to ${corpusPath}`);
}

scrapeGdpr().catch(err => {
  console.error("Scraper failed:", err);
  process.exit(1);
});
