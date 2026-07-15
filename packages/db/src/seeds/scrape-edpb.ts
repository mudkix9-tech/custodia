import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import * as cheerio from 'cheerio';
import { PDFParse } from 'pdf-parse';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = 'https://www.edpb.europa.eu';

interface ScrapedChunk {
  sourceType: string;
  sourceReference: string;
  sourceUrl: string;
  content: string;
  metadata: {
    title: string;
    documentType: string;
    date: string;
    chunkIndex: number;
    detailUrl: string;
  };
}

async function fetchWithRetry(url: string, retries = 3): Promise<string | Buffer> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/pdf')) {
        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
      }
      return await response.text();
    } catch (err) {
      if (i === retries - 1) throw err;
      console.log(`Failed to fetch ${url}, retrying (${i + 1}/${retries})...`);
      await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1)));
    }
  }
  throw new Error("Failed to fetch");
}

function cleanPdfText(text: string): string {
  const lines = text.split('\n');
  const cleanLines = lines
    .map(line => line.trim())
    .filter(line => {
      // 1. Remove table of contents lines (lines with 4 or more consecutive periods)
      if (/\.{4,}/.test(line)) return false;
      
      // 2. Remove page numbers: e.g., "-- 5 of 27 --"
      if (/^--\s*\d+\s*of\s*\d+\s*--$/i.test(line)) return false;
      
      // 3. Remove header/footer markers: e.g., "5 | Adopted"
      if (/^\d+\s*\|\s*Adopted$/i.test(line)) return false;
      
      // 4. Remove empty lines
      if (!line) return false;
      
      return true;
    });
  return cleanLines.join('\n');
}


function chunkText(text: string, chunkSize = 1500, overlap = 200): string[] {
  const cleanText = text.replace(/\s+/g, ' ').trim();
  const chunks: string[] = [];
  let startIndex = 0;

  while (startIndex < cleanText.length) {
    let endIndex = startIndex + chunkSize;
    
    // Adjust to nearest sentence or word boundary if not at end
    if (endIndex < cleanText.length) {
      const lastSentence = cleanText.lastIndexOf('. ', endIndex);
      if (lastSentence > startIndex + chunkSize / 2) {
        endIndex = lastSentence + 1;
      } else {
        const lastSpace = cleanText.lastIndexOf(' ', endIndex);
        if (lastSpace > startIndex + chunkSize / 2) {
          endIndex = lastSpace;
        }
      }
    }

    chunks.push(cleanText.substring(startIndex, endIndex).trim());
    startIndex = endIndex - overlap;
    
    // Safety check to prevent infinite loop
    if (startIndex >= cleanText.length || endIndex >= cleanText.length) {
      break;
    }
  }

  return chunks.filter(c => c.length > 50);
}

async function scrapeEdpb() {
  console.log("Starting EDPB Guidelines scraper...");
  const corpusDir = path.join(__dirname, '../../corpus');
  await fs.mkdir(corpusDir, { recursive: true });
  const corpusPath = path.join(corpusDir, 'edpb-corpus.json');

  // Load existing corpus for resuming progress
  let chunks: ScrapedChunk[] = [];
  const processedUrls = new Set<string>();

  try {
    const existingData = await fs.readFile(corpusPath, 'utf-8');
    chunks = JSON.parse(existingData);
    for (const chunk of chunks) {
      processedUrls.add(chunk.metadata.detailUrl);
    }
    console.log(`Loaded ${chunks.length} existing chunks. Found ${processedUrls.size} already processed documents. Resuming...`);
  } catch {
    console.log("No existing edpb-corpus.json found. Starting fresh.");
  }

  let page = 0;
  let hasMore = true;

  while (hasMore) {
    console.log(`\nCrawling documents directory page ${page}...`);
    const pageUrl = `${BASE_URL}/documents_en?page=${page}`;
    let html: string;
    
    try {
      const response = await fetchWithRetry(pageUrl);
      if (typeof response !== 'string') {
        throw new Error('Expected HTML string but got Buffer');
      }
      html = response;
    } catch (err) {
      console.error(`Failed to fetch page ${page}:`, err);
      break;
    }

    const $ = cheerio.load(html);
    const cards = $('.document-card');

    if (cards.length === 0) {
      console.log("No more document cards found. Scraping complete.");
      hasMore = false;
      break;
    }

    console.log(`Found ${cards.length} documents on page ${page}. Processing...`);

    for (let i = 0; i < cards.length; i++) {
      const card = $(cards[i]);
      
      const relativeLink = card.find('a.document-card__link').attr('href') || '';
      const detailUrl = relativeLink.startsWith('http') ? relativeLink : `${BASE_URL}${relativeLink}`;
      
      const title = card.find('h3').first().text().replace(/\s+/g, ' ').trim();
      const documentType = card.find('.document-card__document-type').text().replace(/\s+/g, ' ').trim();
      const date = (card.find('.document-card__date time').text() || card.find('.document-card__date').text()).replace(/\s+/g, ' ').trim();

      // Only parse core regulatory documents (Guidelines, Recommendations, Opinions)
      const allowedTypes = ['Guidelines', 'Recommendations', 'Opinions', 'Opinion', 'Guideline', 'Recommendation'];
      const isAllowed = allowedTypes.some(t => documentType.toLowerCase().includes(t.toLowerCase()));

      if (!isAllowed) {
        console.log(`Skipping: [${documentType}] ${title} (Not a core guidance type)`);
        continue;
      }

      if (processedUrls.has(detailUrl)) {
        console.log(`Skipping: ${title} (Already processed)`);
        continue;
      }

      console.log(`\nProcessing detail page: ${title}`);
      console.log(`URL: ${detailUrl}`);

      try {
        // Fetch detail page
        const detailHtml = await fetchWithRetry(detailUrl);
        if (typeof detailHtml !== 'string') throw new Error('Expected HTML string');
        
        const $detail = cheerio.load(detailHtml);
        
        // Find PDF file link
        const relativePdfLink = $detail('.document-full__files a[href$=".pdf"]').attr('href') || '';
        if (!relativePdfLink) {
          console.warn(`No PDF link found on detail page for ${title}`);
          continue;
        }

        const pdfUrl = relativePdfLink.startsWith('http') ? relativePdfLink : `${BASE_URL}${relativePdfLink}`;
        console.log(`Downloading PDF: ${pdfUrl}`);

        // Fetch PDF
        const pdfBuffer = await fetchWithRetry(pdfUrl);
        if (!Buffer.isBuffer(pdfBuffer)) throw new Error('Expected PDF Buffer');

        // Parse PDF to text
        console.log("Parsing PDF text...");
        const parser = new PDFParse({ data: pdfBuffer });
        const pdfData = await parser.getText();
        const pdfText = cleanPdfText(pdfData.text || '');
        await parser.destroy().catch(() => {});

        // Chunk text
        const textChunks = chunkText(pdfText);
        console.log(`Generated ${textChunks.length} chunks from PDF.`);

        // Append chunks
        textChunks.forEach((chunkTextContent, idx) => {
          chunks.push({
            sourceType: 'edpb_document',
            sourceReference: `EDPB ${documentType} - ${title} (Part ${idx + 1})`,
            sourceUrl: pdfUrl,
            content: `EDPB ${documentType} - ${title}\n\n${chunkTextContent}`,
            metadata: {
              title,
              documentType,
              date,
              chunkIndex: idx,
              detailUrl
            }
          });
        });

        processedUrls.add(detailUrl);

        // Save progress immediately
        await fs.writeFile(corpusPath, JSON.stringify(chunks, null, 2));
        console.log(`Saved progress. Total chunks in corpus: ${chunks.length}`);

      } catch (err) {
        console.error(`Failed to process document ${title}:`, err);
      }

      // Respectful sleep
      await new Promise(resolve => setTimeout(resolve, 800));
    }

    page++;
    
    // Safety safeguard: let's limit to 10 pages (~100 documents) to keep DB sizes reasonable and complete in a few minutes,
    // or let the user decide if we want to scrape all 53 pages.
    // Let's crawl 10 pages by default to fetch the last 1-2 years of guidelines, which covers all key GDPR guidelines.
    if (page >= 10) {
      console.log("Reached safety page limit of 10. Stopping crawler.");
      break;
    }
  }

  console.log(`\nEDPB scraping complete! Scraped ${processedUrls.size} documents, yielding ${chunks.length} total chunks.`);
}

scrapeEdpb().catch(err => {
  console.error("Scraper failed:", err);
  process.exit(1);
});
