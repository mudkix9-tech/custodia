import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function scrapeEPrivacy() {
  console.log("Launching headless browser for ePrivacy Directive...");
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  
  const corpus: any[] = [];
  
  // 1. Scrape Consolidated Articles
  const articlesUrl = 'https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:02002L0058-20091219';
  console.log(`Navigating to consolidated articles: ${articlesUrl}...`);
  try {
    await page.goto(articlesUrl, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(resolve => setTimeout(resolve, 5000)); // wait for security redirect / challenge
    
    const bodyText = await page.evaluate(() => document.body.innerText);
    
    // Split by "Article \d+[a-z]?"
    const parts = bodyText.split(/(?=\nArticle\s+\d+[a-z]?)/gi);
    console.log(`Parsed ${parts.length} text parts from consolidated Articles page.`);
    
    parts.forEach(part => {
      const match = part.trim().match(/^Article\s+(\d+[a-z]?)\s*\n([\s\S]+)$/i);
      if (match && match[1] && match[2]) {
        const artNum = match[1];
        let content = match[2].trim().replace(/\u00a0/g, ' ');
        
        // Clean up any trailing text (e.g. EU header junk at the end of the last article)
        if (artNum === '17') {
          const endIdx = content.indexOf('Done at Brussels');
          if (endIdx !== -1) {
            content = content.substring(0, endIdx).trim();
          }
        }
        
        // Get title (first line of the content, e.g. "Scope and aim")
        const lines = content.split('\n');
        const title = (lines[0] || '').trim().replace(/\u00a0/g, ' ');
        
        corpus.push({
          sourceType: 'eprivacy_article',
          sourceReference: `ePrivacy Article ${artNum}`,
          sourceUrl: articlesUrl,
          content: `ePrivacy Article ${artNum} - ${title}\n\n${content}`,
          metadata: {
            articleNumber: artNum,
            title: title
          }
        });
        console.log(`Successfully parsed Article ${artNum}: ${title}`);
      }
    });
  } catch (err) {
    console.error("Failed to scrape ePrivacy articles:", err);
  }
  
  // 2. Scrape Original Recitals
  const recitalsUrl = 'https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32002L0058';
  console.log(`Navigating to original directive for recitals: ${recitalsUrl}...`);
  try {
    await page.goto(recitalsUrl, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(resolve => setTimeout(resolve, 5000)); // wait for challenge
    
    const bodyText = await page.evaluate(() => document.body.innerText);
    
    // Extract preamble block between "Whereas:" and "HAVE ADOPTED THIS DIRECTIVE:"
    const preambleMatch = bodyText.match(/Whereas:\s*\n([\s\S]+?)\n\s*HAVE ADOPTED THIS DIRECTIVE:/i);
    if (preambleMatch && preambleMatch[1]) {
      const preambleText = preambleMatch[1];
      // Split into individual recitals: each starts with a numbered block like "(1)"
      const recitalParts = preambleText.split(/(?=\n\(\d+\))/g);
      console.log(`Parsed ${recitalParts.length} recitals parts from original Directive page.`);
      
      recitalParts.forEach(part => {
        const match = part.trim().match(/^\((\d+)\)\s*([\s\S]+)$/);
        if (match && match[1] && match[2]) {
          const recNum = parseInt(match[1], 10);
          const content = match[2].trim().replace(/\u00a0/g, ' ');
          
          corpus.push({
            sourceType: 'eprivacy_recital',
            sourceReference: `ePrivacy Recital ${recNum}`,
            sourceUrl: recitalsUrl,
            content: `ePrivacy Recital ${recNum}\n\n(${recNum}) ${content}`,
            metadata: {
              recitalNumber: recNum
            }
          });
          console.log(`Successfully parsed Recital ${recNum}`);
        }
      });
    } else {
      console.warn("Could not find preamble section in original Directive text.");
    }
  } catch (err) {
    console.error("Failed to scrape ePrivacy recitals:", err);
  }
  
  await browser.close();
  
  // Ensure corpus folder exists
  const corpusDir = path.join(__dirname, '../../corpus');
  await fs.mkdir(corpusDir, { recursive: true });
  
  // Write eprivacy-corpus.json
  const corpusPath = path.join(corpusDir, 'eprivacy-corpus.json');
  await fs.writeFile(corpusPath, JSON.stringify(corpus, null, 2));
  console.log(`\nePrivacy Directive scraping complete! Saved ${corpus.length} items to ${corpusPath}`);
}

scrapeEPrivacy().catch(err => {
  console.error("Scraper failed:", err);
  process.exit(1);
});
