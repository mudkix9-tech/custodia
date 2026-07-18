import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import * as cheerio from 'cheerio';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
// @ts-ignore
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../../../.env') });
process.env.GOOGLE_CLOUD_QUOTA_PROJECT = process.env.GCP_PROJECT_ID || 'privaro';
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const BASE_URL = 'https://www.autoriteitpersoonsgegevens.nl';
const START_URLS = [
  'https://www.autoriteitpersoonsgegevens.nl/themas/internet-slimme-apparaten/cookies/tracking-cookies',
  'https://www.autoriteitpersoonsgegevens.nl/actueel/websites-moeten-toegankelijk-blijven-bij-weigeren-tracking-cookies',
  'https://www.autoriteitpersoonsgegevens.nl/themas/basis-avg/avg-algemeen/grondslagen-avg-uitgelegd'
];
const CONCURRENCY_LIMIT = 2;
const MAX_PAGES = 100;

const ai = new GoogleGenAI({
  vertexai: true,
  project: process.env.GCP_PROJECT_ID || 'privaro',
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
          'Accept-Language': 'nl-NL,nl;q=0.9,en;q=0.8'
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
      if (line === 'Afdrukken' || line === 'Delen' || line === 'Abonneren' || line === 'Zoeken' || line === 'Menu' || line === 'Sluit menu') return false;
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
      contents: `Translate the following Dutch text from the Dutch Data Protection Authority (Autoriteit Persoonsgegevens - AP) into clear, professional English. Do not add any conversational text, explanations, or introductory notes. Output ONLY the English translation of the provided text directly:\n\n${trimmed}`,
    });
    return response.text?.trim() || '';
  } catch (err) {
    console.error(`Gemini Translation failed for ${purpose}:`, err);
    return trimmed; // fallback to original text if API fails
  }
}

function shouldCrawl(cleanUrl: string): boolean {
  if (!cleanUrl.startsWith('https://www.autoriteitpersoonsgegevens.nl/')) return false;
  const pathPart = cleanUrl.replace('https://www.autoriteitpersoonsgegevens.nl/', '');
  const lowerPath = pathPart.toLowerCase();
  
  if (lowerPath.includes('cookies')) return true;
  if (lowerPath.includes('actueel/websites-moeten-toegankelijk-blijven')) return true;
  if (lowerPath.includes('grondslagen') || lowerPath.includes('gerechtvaardigd-belang')) return true;
  if (lowerPath.includes('themas/basis-avg/avg-algemeen')) return true;
  
  return false;
}

async function scrapeAp() {
  console.log("Starting Dutch AP Netherlands Scraper & Translator...");
  const corpusDir = path.join(__dirname, '../../corpus');
  await fs.mkdir(corpusDir, { recursive: true });
  const corpusPath = path.join(corpusDir, 'ap-corpus.json');

  let allChunks: ScrapedChunk[] = [];
  try {
    const existingData = await fs.readFile(corpusPath, 'utf-8');
    allChunks = JSON.parse(existingData);
    console.log(`Loaded ${allChunks.length} existing translated chunks from cache.`);
  } catch {}

  const visitedUrls = new Set<string>();
  for (const chunk of allChunks) {
    visitedUrls.add(chunk.sourceUrl);
  }

  const queue: string[] = START_URLS.filter(url => !visitedUrls.has(url));
  let pageCount = visitedUrls.size;

  while (queue.length > 0 && pageCount < MAX_PAGES) {
    const batch = queue.splice(0, CONCURRENCY_LIMIT);
    console.log(`Processing batch of size ${batch.length}:`, batch);
    const promises = batch.map(async (url) => {
      if (visitedUrls.has(url)) return;
      visitedUrls.add(url);
      pageCount++;

      console.log(`[${pageCount}] Scraping & Translating: ${url}`);
      try {
        const html = await fetchWithRetry(url);
        console.log(`Successfully fetched HTML for ${url}. Length: ${html.length}`);
        const $ = cheerio.load(html);

        console.log(`Before removal: Title="${$('title').text().trim()}", Article length=${$('article').length}, Article text len=${$('article').text().trim().length}`);

        // Remove page utility elements
        $('aside, nav, footer, #download-panel, form, script, style, .social, .page--tools, header, .header, #navBreadcrumbs, .nav-side, .page__footer, .page__header, .node-content-page-full__feedback-wrapper, .node-content-page-full__secondary-content, .page-header, .page-footer').remove();

        console.log(`After removal: Title="${$('title').text().trim()}", Article length=${$('article').length}, Article text len=${$('article').text().trim().length}`);

        const rawTitle = $('title').text().replace('| Autoriteit Persoonsgegevens', '').trim() || $('h1').first().text().trim();
        const articleElement = $('article').first();
        const rawContentText = articleElement.length > 0 ? articleElement.text().trim() : $('main').text().trim();
        
        const cleanedText = cleanText(rawContentText);
        console.log(`Extracted rawTitle: "${rawTitle}". Raw text len: ${rawContentText.length}. Cleaned text len: ${cleanedText.length}`);

        if (cleanedText.length > 100) {
          console.log(`Translating: "${rawTitle}" (${cleanedText.length} chars of Dutch text)`);
          const englishTitle = await translateText(rawTitle, `title: ${rawTitle}`);
          const englishContent = await translateText(cleanedText, `content of ${rawTitle}`);

          if (englishContent) {
            const textChunks = chunkText(englishContent);
            textChunks.forEach((chunkContent, idx) => {
              allChunks.push({
                sourceType: 'ap_guidance',
                sourceReference: `AP Netherlands - ${englishTitle} (Part ${idx + 1})`,
                sourceUrl: url,
                content: `AP Netherlands - ${englishTitle}\n\n${chunkContent}`,
                metadata: {
                  title: englishTitle,
                  documentType: 'Guidance',
                  date: new Date().toISOString().split('T')[0] || '',
                  chunkIndex: idx,
                  detailUrl: url,
                  originalLanguage: 'nl'
                }
              });
            });

            console.log(`Generated ${textChunks.length} translated chunks.`);
            await fs.writeFile(corpusPath, JSON.stringify(allChunks, null, 2), 'utf-8');
          }
        }

        // Gather links for crawling
        const links: string[] = [];
        $('a[href]').each((_, el) => {
          const href = $(el).attr('href');
          if (href) links.push(href);
        });

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

  console.log(`\nAP Netherlands Scraping complete. Total pages processed/visited: ${visitedUrls.size}. Chunks generated: ${allChunks.length}`);
  await fs.writeFile(corpusPath, JSON.stringify(allChunks, null, 2), 'utf-8');
  console.log(`Saved output to ${corpusPath}.`);
}

scrapeAp().catch(console.error);
