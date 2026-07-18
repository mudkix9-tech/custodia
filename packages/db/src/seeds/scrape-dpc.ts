import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import * as cheerio from 'cheerio';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../../../.env') });

// Bypass SSL certificate verification for DPC Ireland's incomplete trust chain in local node environments
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const BASE_URL = 'https://www.dataprotection.ie';
const START_URLS = [
  'https://www.dataprotection.ie/en/dpc-guidance/decisions',
  'https://www.dataprotection.ie/en/organisations/international-transfers/transfers-personal-data-third-countries-or-international-organisations'
];
const CONCURRENCY_LIMIT = 3;
const MAX_PAGES = 100;

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
    originalLanguage: string;
  };
}

async function fetchWithRetry(url: string, retries = 3): Promise<string> {
  for (let i = 0; i < retries; i++) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 15000); // 15s timeout
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9'
        }
      });
      clearTimeout(id);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.text();
    } catch (err) {
      clearTimeout(id);
      if (i === retries - 1) throw err;
      console.log(`Failed to fetch ${url}, retrying (${i + 1}/${retries})...`);
      await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1)));
    }
  }
  throw new Error("Failed to fetch");
}

function cleanText(text: string): string {
  const sanitized = text
    .replace(/[\u00a0\u200b\u200e\u200f\u202f\ufeff]/g, ' ')
    .replace(/[\u2018\u2019\u201b\u2039\u203a`\u201a]/g, "'")
    .replace(/[\u201c\u201d\u201e\u201f\u00ab\u00bb]/g, '"')
    .replace(/[\u2013\u2014\u2015]/g, '-');

  return sanitized
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map(line => line.trim())
    .filter(line => {
      if (!line) return false;
      // Remove generic buttons/nav text
      if (line === 'Print' || line === 'Share' || line === 'Search' || line === 'FAQs' || line === 'Contact us') return false;
      return true;
    })
    .join('\n');
}

function chunkText(text: string, chunkSize = 1500, overlap = 200): string[] {
  const cleanTextStr = text.replace(/\s+/g, ' ').trim();
  const chunks: string[] = [];
  let startIndex = 0;

  while (startIndex < cleanTextStr.length) {
    let endIndex = startIndex + chunkSize;
    if (endIndex < cleanTextStr.length) {
      const lastSentence = cleanTextStr.lastIndexOf('. ', endIndex);
      if (lastSentence > startIndex + chunkSize / 2) {
        endIndex = lastSentence + 1;
      } else {
        const lastSpace = cleanTextStr.lastIndexOf(' ', endIndex);
        if (lastSpace > startIndex + chunkSize / 2) {
          endIndex = lastSpace;
        }
      }
    }

    chunks.push(cleanTextStr.substring(startIndex, endIndex).trim());
    startIndex = endIndex - overlap;
    if (startIndex >= cleanTextStr.length || endIndex >= cleanTextStr.length) {
      break;
    }
  }
  return chunks.filter(c => c.length > 50);
}

function shouldCrawl(cleanUrl: string): boolean {
  if (!cleanUrl.startsWith('https://www.dataprotection.ie/en/')) return false;
  const pathPart = cleanUrl.replace('https://www.dataprotection.ie/en/', '');
  const lowerPath = pathPart.toLowerCase();
  
  // Scrape DPC decisions and international transfers pages
  return lowerPath.includes('dpc-guidance/decisions') || 
         lowerPath.includes('organisations/international-transfers');
}

async function scrapeDpc() {
  console.log("Starting Irish DPC Decisions & Transfers Guidance scraper...");
  const corpusDir = path.join(__dirname, '../../corpus');
  await fs.mkdir(corpusDir, { recursive: true });
  const corpusPath = path.join(corpusDir, 'dpc-corpus.json');

  const visitedUrls = new Set<string>();
  const queue: string[] = [...START_URLS];
  const allChunks: ScrapedChunk[] = [];
  let pageCount = 0;

  while (queue.length > 0 && pageCount < MAX_PAGES) {
    const batch = queue.splice(0, CONCURRENCY_LIMIT);
    const promises = batch.map(async (url) => {
      if (visitedUrls.has(url)) return;
      visitedUrls.add(url);
      pageCount++;

      console.log(`[${pageCount}] Scraping: ${url}`);
      try {
        const html = await fetchWithRetry(url);
        const $ = cheerio.load(html);

        const cleanTitle = $('title').text()
          .replace('| Data Protection Commission', '')
          .replace('| Data Protection Commissioner', '')
          .trim() || $('h1').first().text().trim();
        
        // Detect hub/directory list pages (like the decisions listing list or main transfers landing list)
        const isHubPage = url.endsWith('/en/dpc-guidance/decisions') || 
                           $('.views-element-container').length > 0 || 
                           $('.view-filters').length > 0;

        console.log(`Title: "${cleanTitle}" (Hub: ${isHubPage})`);

        // Extract links first
        const links: string[] = [];
        $('a[href]').each((_, el) => {
          const href = $(el).attr('href');
          if (href) links.push(href);
        });

        if (!isHubPage) {
          // Clone DOM and strip boilerplate
          const contentDom = $.root().clone();
          contentDom.find('aside, nav, footer, #download-panel, form, script, style, .social, .page--tools, header, .header, #navBreadcrumbs, .nav-side, .organisation-footer').remove();

          const bodyContainer = contentDom.find('.field--name-body').first();
          const bodyText = bodyContainer.length > 0 ? bodyContainer.text().trim() : contentDom.find('#content .content').text().trim();
          const fullText = cleanText(bodyText);

          if (fullText.length > 100) {
            const textChunks = chunkText(fullText);
            textChunks.forEach((chunkContent, idx) => {
              allChunks.push({
                sourceType: 'dpc_guidance',
                sourceReference: `DPC Ireland - ${cleanTitle} (Part ${idx + 1})`,
                sourceUrl: url,
                content: `DPC Ireland - ${cleanTitle}\n\n${chunkContent}`,
                metadata: {
                  title: cleanTitle,
                  documentType: 'Guidance',
                  date: new Date().toISOString().split('T')[0] || '',
                  chunkIndex: idx,
                  detailUrl: url,
                  originalLanguage: 'en'
                }
              });
            });
            console.log(`Generated ${textChunks.length} chunks.`);
          }
        }

        // Add discovered links to queue
        const baseHref = $('base').attr('href') || url;
        for (const rawHref of links) {
          if (!rawHref) continue;

          let resolvedUrl = rawHref;
          if (rawHref.startsWith('/')) {
            resolvedUrl = `${BASE_URL}${rawHref}`;
          } else if (!rawHref.startsWith('http')) {
            resolvedUrl = new URL(rawHref, baseHref).href;
          }

          const urlObj = new URL(resolvedUrl);
          urlObj.hash = '';
          urlObj.search = '';
          const cleanUrl = urlObj.href;

          const isStaticFile = /\.(pdf|zip|docx|xlsx|png|jpg|jpeg|svg)$/i.test(cleanUrl);
          const isExternal = !cleanUrl.startsWith(BASE_URL);

          if (shouldCrawl(cleanUrl) && !isStaticFile && !isExternal && !visitedUrls.has(cleanUrl) && !queue.includes(cleanUrl)) {
            queue.push(cleanUrl);
          }
        }
      } catch (err) {
        console.error(`Failed to scrape ${url}:`, err);
      }
    });

    await Promise.all(promises);
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  console.log(`\nDPC Scraping complete. Total pages visited: ${visitedUrls.size}. Chunks generated: ${allChunks.length}`);
  await fs.writeFile(corpusPath, JSON.stringify(allChunks, null, 2), 'utf-8');
  console.log(`Saved output to ${corpusPath}.`);
}

scrapeDpc().catch(console.error);
