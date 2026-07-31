import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import * as cheerio from 'cheerio';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../../../.env') });
process.env.GOOGLE_CLOUD_QUOTA_PROJECT = process.env.GCP_PROJECT_ID || 'custodia';

const BASE_URL = 'https://www.bfdi.bund.de';
const START_URLS = [
  'https://www.bfdi.bund.de/DE/Buerger/Basiswissen/Beschaeftigte/Beschaeftigte_node.html',
  'https://www.bfdi.bund.de/DE/Fachthemen/Datenschutzpraxis/datenschutzpraxis_node.html'
];
const CONCURRENCY_LIMIT = 2; // Controlled concurrency for translation calls
const MAX_PAGES = 5;

const ai = new GoogleGenAI({
  vertexai: true,
  project: process.env.GCP_PROJECT_ID || 'custodia',
  location: process.env.GCP_LOCATION || 'us-central1',
});

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
    language?: string;
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
          'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7'
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
      // Remove page utility and navigation elements
      if (line === 'Drucken' || line === 'Teilen' || line === 'Abonnieren' || line === 'Empfehlen') return false;
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

async function translateText(text: string, purpose: string): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed) return '';
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Translate the following German text from the German Federal Commissioner for Data Protection and Freedom of Information (BfDI) into clear, professional English. Do not add any conversational text, explanations, or introductory notes. Output ONLY the English translation of the provided text directly:\n\n${trimmed}`,
    });
    return response.text?.trim() || '';
  } catch (err) {
    console.error(`Gemini Translation failed for ${purpose}:`, err);
    return trimmed; // fallback to original text if API fails
  }
}

function shouldCrawl(cleanUrl: string): boolean {
  if (!cleanUrl.startsWith('https://www.bfdi.bund.de/DE/')) return false;
  const pathPart = cleanUrl.replace('https://www.bfdi.bund.de/DE/', '');
  const lowerPath = pathPart.toLowerCase();
  
  // Specific targets: Employee Data and Technical Measures
  return lowerPath.includes('beschaeftigte') || 
         lowerPath.includes('datenschutzpraxis') || 
         lowerPath.includes('datenverarbeitung') || 
         lowerPath.includes('technische-anwendungen') ||
         lowerPath.includes('sicherheit/praxis-wissen') ||
         lowerPath.includes('sicherheit/wissenswertes');
}

async function scrapeBfdi() {
  console.log("Starting German BfDI Guidance scraper and translator...");
  const corpusDir = path.join(__dirname, '../../corpus');
  await fs.mkdir(corpusDir, { recursive: true });
  const corpusPath = path.join(corpusDir, 'bfdi-corpus.json');

  // Load existing chunks to build translation cache
  const cachedChunksByUrl = new Map<string, ScrapedChunk[]>();
  try {
    const existingData = await fs.readFile(corpusPath, 'utf-8');
    const existingChunks: ScrapedChunk[] = JSON.parse(existingData);
    for (const chunk of existingChunks) {
      if (!cachedChunksByUrl.has(chunk.sourceUrl)) {
        cachedChunksByUrl.set(chunk.sourceUrl, []);
      }
      cachedChunksByUrl.get(chunk.sourceUrl)!.push(chunk);
    }
    console.log(`Loaded ${cachedChunksByUrl.size} URLs from translation cache.`);
  } catch {
    console.log("No existing BfDI corpus file found. Starting fresh.");
  }

  const visitedUrls = new Set<string>();
  const queue: string[] = [...START_URLS];
  let pageCount = 0;

  while (queue.length > 0 && pageCount < MAX_PAGES) {
    const batch = queue.splice(0, CONCURRENCY_LIMIT);
    const promises = batch.map(async (url) => {
      if (visitedUrls.has(url)) return;
      visitedUrls.add(url);
      pageCount++;

      console.log(`\n[${pageCount}] Scraping: ${url}`);
      try {
        const html = await fetchWithRetry(url);
        const $ = cheerio.load(html);

        const germanTitle = $('title').text().replace('| BfDI', '').replace('BfDI - ', '').trim() || $('h1').first().text().trim();
        
        // Detect hub/directory/table-of-contents pages
        const isHubPage = $('.c-teaser-list').length > 0 || 
                           $('.c-teaser-grid').length > 0 || 
                           $('.teaser').length > 5 ||
                           url.endsWith('datenschutzpraxis_node.html');

        console.log(`Title (German): "${germanTitle}" (Hub: ${isHubPage})`);

        // Extract sub-links first
        const links: string[] = [];
        $('a[href]').each((_, el) => {
          const href = $(el).attr('href');
          if (href) links.push(href);
        });

        if (!isHubPage) {
          // If we have a cache hit, reuse the existing translation
          if (cachedChunksByUrl.has(url)) {
            console.log(`[Cache Hit] Reusing translated chunks for: ${url}`);
          } else {
            // Clone DOM and strip boilerplate
            const contentDom = $.root().clone();
            contentDom.find('aside, nav, footer, #download-panel, form, script, style, .social, .page--tools, .header, #wrapperDivisions header, #navBreadcrumbs').remove();

            const abstractText = contentDom.find('.abstract').text().trim();
            const bodyContainer = contentDom.find('.content').first();
            
            // Remove navigation items inside the content container if any
            bodyContainer.find('.navBreadcrumbs, .abstract').remove();
            
            const bodyText = bodyContainer.text().trim();
            const fullText = cleanText(abstractText + '\n\n' + bodyText);

            if (fullText.length > 100) {
              console.log(`Translating "${germanTitle}" to English...`);
              const translatedTitle = await translateText(germanTitle, 'title');
              const translatedBody = await translateText(fullText, 'body content');

              console.log(`Translated Title: "${translatedTitle}"`);

              const newChunks: ScrapedChunk[] = [];
              
              // 1. Generate English translation chunks
              const textChunks = chunkText(translatedBody);
              textChunks.forEach((chunkContent, idx) => {
                newChunks.push({
                  sourceType: 'bfdi_guidance',
                  sourceReference: `BfDI Guidance - ${translatedTitle} (Part ${idx + 1})`,
                  sourceUrl: url,
                  content: `BfDI Guidance - ${translatedTitle}\n\n${chunkContent}`,
                  metadata: {
                    title: translatedTitle,
                    documentType: 'Guidance',
                    date: new Date().toISOString().split('T')[0] || '',
                    chunkIndex: idx,
                    detailUrl: url,
                    originalLanguage: 'de',
                    language: 'en'
                  }
                });
              });

              // 2. Generate German original chunks
              const germanChunks = chunkText(fullText);
              germanChunks.forEach((chunkContent, idx) => {
                newChunks.push({
                  sourceType: 'bfdi_guidance',
                  sourceReference: `BfDI Richtlinien - ${germanTitle} (Part ${idx + 1})`,
                  sourceUrl: url,
                  content: `BfDI Richtlinien - ${germanTitle}\n\n${chunkContent}`,
                  metadata: {
                    title: germanTitle,
                    documentType: 'Guidance',
                    date: new Date().toISOString().split('T')[0] || '',
                    chunkIndex: idx,
                    detailUrl: url,
                    originalLanguage: 'de',
                    language: 'de'
                  }
                });
              });
              
              cachedChunksByUrl.set(url, newChunks);
              console.log(`Generated ${textChunks.length} English and ${germanChunks.length} German chunks.`);

              // Incremental cache save
              const allCurrentChunks = Array.from(cachedChunksByUrl.values()).flat();
              await fs.writeFile(corpusPath, JSON.stringify(allCurrentChunks, null, 2), 'utf-8');
            }
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
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log(`\nBfDI Scraping & Translation complete. Total pages: ${visitedUrls.size}.`);
  
  // Prune any stale cached items not visited in this run
  const finalChunks: ScrapedChunk[] = [];
  for (const visitedUrl of visitedUrls) {
    if (cachedChunksByUrl.has(visitedUrl)) {
      finalChunks.push(...cachedChunksByUrl.get(visitedUrl)!);
    }
  }
  await fs.writeFile(corpusPath, JSON.stringify(finalChunks, null, 2), 'utf-8');
  console.log(`Saved final output of ${finalChunks.length} chunks to ${corpusPath}.`);
}

scrapeBfdi().catch(console.error);
