import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import * as cheerio from 'cheerio';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = 'https://ico.org.uk';
const START_URL = 'https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/';
const CONCURRENCY_LIMIT = 3;
const MAX_PAGES = 100; // Safety guard to limit crawl scope

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

async function fetchWithRetry(url: string, retries = 3): Promise<string> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.text();
    } catch (err) {
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
      // Remove page utilities, print options, ratings, and duplicate headings
      if (!line) return false;
      if (line === 'Download options' || line === 'All pages' || line === 'PDF') return false;
      if (line === 'Was this page helpful?' || line === 'Yes' || line === 'No' || line === 'Send') return false;
      if (line.startsWith('Help us improve our website')) return false;
      if (line.startsWith('Please tell us more about your experience')) return false;
      return true;
    })
    .join('\n');
}

function chunkText(text: string, chunkSize = 1500, overlap = 200): string[] {
  const cleanText = text.replace(/\s+/g, ' ').trim();
  const chunks: string[] = [];
  let startIndex = 0;

  while (startIndex < cleanText.length) {
    let endIndex = startIndex + chunkSize;
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
    if (startIndex >= cleanText.length || endIndex >= cleanText.length) {
      break;
    }
  }
  return chunks.filter(c => c.length > 50);
}

async function scrapeIco() {
  console.log("Starting UK ICO GDPR Guidance scraper...");
  const corpusDir = path.join(__dirname, '../../corpus');
  await fs.mkdir(corpusDir, { recursive: true });
  const corpusPath = path.join(corpusDir, 'ico-corpus.json');

  const visitedUrls = new Set<string>();
  const queue: string[] = [START_URL];
  const allChunks: ScrapedChunk[] = [];
  let pageCount = 0;

  while (queue.length > 0 && pageCount < MAX_PAGES) {
    // Process in batches to support concurrency
    const batch = queue.splice(0, CONCURRENCY_LIMIT);
    const promises = batch.map(async (url) => {
      if (visitedUrls.has(url)) return;
      visitedUrls.add(url);
      pageCount++;

      console.log(`\n[${pageCount}] Scraping: ${url}`);
      try {
        const html = await fetchWithRetry(url);
        const $ = cheerio.load(html);

        const title = $('title').text().replace('| ICO', '').trim() || $('h1').first().text().trim();
        console.log(`Title: "${title}"`);

        // Extract sub-links first before modifying the DOM for text extraction
        const links: string[] = [];

        // 1. icon-navigation custom tags
        $('icon-navigation').each((_, el) => {
          const href = $(el).attr('x-href');
          if (href) links.push(href);
        });

        // 2. further-reading custom tags
        $('further-reading').each((_, el) => {
          const href = $(el).attr('x-href');
          if (href) links.push(href);
        });

        // 3. standard links
        $('a[href]').each((_, el) => {
          const href = $(el).attr('href');
          if (href) links.push(href);
        });

        // Now perform DOM cleanup on a clone for text extraction
        const isHubPage = $('icon-navigation').length > 0;
        const contentDom = $.root().clone();

        contentDom.find('aside, nav, footer, #download-panel, form, script, style, .prose-white').remove();

        let bodyText = '';
        if (!isHubPage) {
          contentDom.find('div.rich-text, div.prose').each((_, el) => {
            // Check if this element is already nested inside another matched container to prevent duplication
            const hasMatchedParent = $(el).parents('div.rich-text, div.prose').length > 0;
            if (!hasMatchedParent) {
              bodyText += $(el).text() + '\n\n';
            }
          });

          // Fallback if rich-text/prose divs are not present or empty
          if (!bodyText.trim()) {
            const main = contentDom.find('#main-content');
            bodyText = main.text();
          }
        }

        const cleanedBodyText = cleanText(bodyText);
        
        // Chunk and store
        if (cleanedBodyText.length > 100) {
          const textChunks = chunkText(cleanedBodyText);
          console.log(`Generated ${textChunks.length} chunks.`);

          textChunks.forEach((chunkContent, idx) => {
            allChunks.push({
              sourceType: 'ico_guidance',
              sourceReference: `UK ICO Guidance - ${title} (Part ${idx + 1})`,
              sourceUrl: url,
              content: `UK ICO Guidance - ${title}\n\n${chunkContent}`,
              metadata: {
                title,
                documentType: 'Guidance',
                date: new Date().toISOString().split('T')[0] || '',
                chunkIndex: idx,
                detailUrl: url
              }
            });
          });
        }

        // Clean and filter links
        for (const rawHref of links) {
          if (!rawHref) continue;
          
          // Resolve relative URLs
          let resolvedUrl = rawHref;
          if (rawHref.startsWith('/')) {
            resolvedUrl = `${BASE_URL}${rawHref}`;
          } else if (!rawHref.startsWith('http')) {
            resolvedUrl = new URL(rawHref, url).href;
          }

          // Strip hash fragments
          const urlObj = new URL(resolvedUrl);
          urlObj.hash = '';
          const cleanUrl = urlObj.href;

          // Scope constraints:
          // Must be under the UK GDPR guidance section
          // Must not be a binary/media file
          const isGdprGuidance = cleanUrl.includes('/for-organisations/uk-gdpr-guidance-and-resources/') ||
                                 cleanUrl.includes('/for-organisations/guide-to-data-protection/');
          const isStaticFile = /\.(pdf|zip|docx|xlsx|png|jpg|jpeg|svg)$/i.test(cleanUrl);
          const isExternal = !cleanUrl.startsWith(BASE_URL);

          if (isGdprGuidance && !isStaticFile && !isExternal && !visitedUrls.has(cleanUrl) && !queue.includes(cleanUrl)) {
            queue.push(cleanUrl);
          }
        }
      } catch (err) {
        console.error(`Failed to scrape ${url}:`, err);
      }
    });

    await Promise.all(promises);
    // Add small delay to respect rate limit
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log(`\nScraping complete. Total pages crawled: ${visitedUrls.size}. Chunks generated: ${allChunks.length}`);
  await fs.writeFile(corpusPath, JSON.stringify(allChunks, null, 2), 'utf-8');
  console.log(`Saved output to ${corpusPath}.`);
}

scrapeIco().catch(console.error);
