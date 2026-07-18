import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const corpusDir = path.join(__dirname, '../../corpus');

interface OldDocument {
  authority?: string;
  documentType?: string;
  sourceType?: string;
  sourceReference: string;
  sourceUrl?: string | undefined;
  content: string;
  metadata?: Record<string, any>;
}

interface NewDocument {
  authority: string;
  documentType: string;
  sourceReference: string;
  sourceUrl?: string | undefined;
  content: string;
  metadata: {
    document_id: string;
    source: string;
    authority: string;
    title: string;
    section: string;
    category: string;
    articles: number[];
    date: string;
    language: string;
    chunk_index: number;
    total_chunks: number;
    url: string;
    [key: string]: any;
  };
}

function parseDateToISO(dateStr?: string): string {
  if (!dateStr) return new Date().toISOString().split('T')[0] || '';
  const clean = dateStr.replace(/\s+/g, ' ').trim();
  
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
  
  const parsed = Date.parse(clean);
  if (!isNaN(parsed)) {
    return new Date(parsed).toISOString().split('T')[0] || '';
  }
  
  const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  const parts = clean.toLowerCase().split(/[\s,.-]+/);
  let day = 1;
  let month = 0;
  let year = new Date().getFullYear();
  
  for (const part of parts) {
    if (/^\d+$/.test(part)) {
      const num = parseInt(part, 10);
      if (num > 31) {
        year = num;
      } else {
        day = num;
      }
    } else if (months.includes(part)) {
      month = months.indexOf(part);
    } else {
      const shortMonths = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
      const sub = part.substring(0, 3);
      if (shortMonths.includes(sub)) {
        month = shortMonths.indexOf(sub);
      }
    }
  }
  
  const d = new Date(Date.UTC(year, month, day));
  return d.toISOString().split('T')[0] || '';
}

function normalizeLanguage(lang?: string): string {
  if (!lang) return 'en';
  const clean = lang.trim().toLowerCase();
  if (clean === 'english' || clean === 'en') return 'en';
  if (clean === 'french' || clean === 'fr') return 'fr';
  if (clean === 'german' || clean === 'de') return 'de';
  if (clean === 'dutch' || clean === 'nl') return 'nl';
  if (clean === 'spanish' || clean === 'es') return 'es';
  return 'en';
}

function extractArticles(content: string, authority: string, documentType: string, reference: string): number[] {
  const articlesSet = new Set<number>();
  
  // If it's a GDPR article document, extract its direct article number
  if (authority === 'gdpr' && documentType === 'article') {
    const match = reference.match(/Article\s+(\d+)/i);
    if (match && match[1]) {
      articlesSet.add(parseInt(match[1], 10));
    }
  }
  
  // Also look for Chapter V references and add Chapter V transfer articles
  if (/Chapter\s+V\b/i.test(content) || /Chapter\s+5\b/i.test(content)) {
    [44, 45, 46, 47, 48, 49].forEach(art => articlesSet.add(art));
  }

  // Scan content for any article references like "Article 45", "Articles 44, 45 and 46", "Articles 44 to 49"
  const articleBlockRegex = /(?:articles?|arts?\.?|artikel?)\s*(\d+(?:[\s,;]+(?:and|or|to|und|oder|bis)?[\s,;]*\d+)*)/gi;
  let blockMatch;
  while ((blockMatch = articleBlockRegex.exec(content)) !== null) {
    const blockText = blockMatch[1] || '';
    const numbers = blockText.match(/\d+/g) || [];
    
    if (/\s+(?:to|bis)\s+/i.test(blockText) && numbers.length >= 2) {
      const start = parseInt(numbers[0] || '', 10);
      const end = parseInt(numbers[numbers.length - 1] || '', 10);
      if (start > 0 && end > start && end <= 99) {
        for (let i = start; i <= end; i++) {
          articlesSet.add(i);
        }
      }
    } else {
      for (const numStr of numbers) {
        const val = parseInt(numStr, 10);
        if (val > 0 && val <= 99) {
          articlesSet.add(val);
        }
      }
    }
  }

  const singularRegex = /(?:article|art\.|artikel)\s*(\d+)/gi;
  let singMatch;
  while ((singMatch = singularRegex.exec(content)) !== null) {
    if (singMatch[1]) {
      const val = parseInt(singMatch[1], 10);
      if (val > 0 && val <= 99) articlesSet.add(val);
    }
  }

  return Array.from(articlesSet).sort((a, b) => a - b);
}

function classifyCategory(title: string, content: string): string {
  const text = `${title} ${content}`.toLowerCase();
  
  if (text.includes('consent') || text.includes('cookie') || text.includes('opt-in') || text.includes('opt-out') || text.includes('banner') || text.includes('cookie wall')) {
    return 'consent';
  }
  if (text.includes('blockchain') || text.includes('technology') || text.includes('technologies') || text.includes('artificial intelligence') || text.includes(' ai ') || text.includes('algorithm') || text.includes('automated')) {
    return 'technology';
  }
  if (text.includes('transfer') || text.includes('scc') || text.includes('schrems') || text.includes('adequacy') || text.includes('third country') || text.includes('transborder') || text.includes('cross-border')) {
    return 'transfers';
  }
  if (text.includes('dpia') || text.includes('assessment') || text.includes('impact assessment') || text.includes('risk') || text.includes('evalua-riesgo') || text.includes('mitigation')) {
    return 'assessment';
  }
  if (text.includes('security') || text.includes('breach') || text.includes('incident') || text.includes('encryption') || text.includes('technical and organisational')) {
    return 'security';
  }
  if (text.includes('employee') || text.includes('employment') || text.includes('hr ') || text.includes('workplace') || text.includes('monitoring')) {
    return 'employment';
  }
  if (text.includes('access') || text.includes('dsar') || text.includes('erasure') || text.includes('right to be forgotten') || text.includes('rectification') || text.includes('portability') || text.includes('right of')) {
    return 'rights';
  }
  if (text.includes('fine') || text.includes('penalty') || text.includes('enforcement') || text.includes('sanction') || text.includes('administrative fine')) {
    return 'enforcement';
  }
  
  return 'general';
}

function mapAuthorityAndDocType(sourceType: string): { authority: string; documentType: string } {
  switch (sourceType) {
    case 'gdpr_article':
      return { authority: 'gdpr', documentType: 'article' };
    case 'gdpr_recital':
      return { authority: 'gdpr', documentType: 'recital' };
    case 'edpb_document':
      return { authority: 'edpb', documentType: 'guideline' };
    case 'charter_article':
      return { authority: 'charter', documentType: 'article' };
    case 'charter_explanation':
      return { authority: 'charter', documentType: 'explanation' };
    case 'eprivacy_article':
      return { authority: 'eprivacy', documentType: 'article' };
    case 'eprivacy_recital':
      return { authority: 'eprivacy', documentType: 'recital' };
    case 'ico_guidance':
      return { authority: 'ico', documentType: 'guidance' };
    case 'cnil_guidance':
      return { authority: 'cnil', documentType: 'guidance' };
    case 'bfdi_guidance':
      return { authority: 'bfdi', documentType: 'guidance' };
    case 'dpc_guidance':
      return { authority: 'dpc', documentType: 'guidance' };
    case 'ap_guidance':
      return { authority: 'ap', documentType: 'guidance' };
    case 'aepd_guidance':
      return { authority: 'aepd', documentType: 'guidance' };
    case 'cjeu_ruling':
      return { authority: 'cjeu', documentType: 'ruling' };
    case 'edpb_fine':
      return { authority: 'edpb', documentType: 'fine' };
    case 'gdprhub_decision':
      return { authority: 'gdprhub', documentType: 'decision' };
    default:
      return { authority: 'unknown', documentType: 'document' };
  }
}

function getSectionPath(authority: string, documentType: string, reference: string): string {
  if (authority === 'gdpr' && documentType === 'article') {
    const match = reference.match(/Article\s+(\d+)/i);
    if (match && match[1]) {
      const num = parseInt(match[1], 10);
      let chapter = '';
      if (num >= 1 && num <= 4) chapter = 'Chapter I';
      else if (num >= 5 && num <= 11) chapter = 'Chapter II';
      else if (num >= 12 && num <= 23) chapter = 'Chapter III';
      else if (num >= 24 && num <= 43) chapter = 'Chapter IV';
      else if (num >= 44 && num <= 50) chapter = 'Chapter V';
      else if (num >= 51 && num <= 59) chapter = 'Chapter VI';
      else if (num >= 60 && num <= 76) chapter = 'Chapter VII';
      else if (num >= 77 && num <= 84) chapter = 'Chapter VIII';
      else if (num >= 85 && num <= 91) chapter = 'Chapter IX';
      else if (num >= 92 && num <= 98) chapter = 'Chapter X';
      else if (num === 99) chapter = 'Chapter XI';
      return `${chapter} > ${reference}`;
    }
  }
  return reference;
}

function mapSourceAndAuthority(auth: string): { source: string; authority: string } {
  const source = auth;
  let authority = auth;
  if (['gdpr', 'cjeu', 'charter', 'eprivacy'].includes(auth)) {
    authority = 'eu';
  }
  return { source, authority };
}

async function convertFile(filename: string) {
  const filePath = path.join(corpusDir, filename);
  console.log(`Converting ${filename}...`);
  
  const data = await fs.readFile(filePath, 'utf-8');
  const docs: OldDocument[] = JSON.parse(data);
  
  // Group by document title/sourceReference (without part suffix) to compute totalChunks
  const docGroups = new Map<string, OldDocument[]>();
  
  for (const doc of docs) {
    const title = doc.metadata?.title || doc.sourceReference;
    const baseKey = title.replace(/\s*\(Part\s+\d+\)\s*$/i, '').trim();
    if (!docGroups.has(baseKey)) {
      docGroups.set(baseKey, []);
    }
    docGroups.get(baseKey)!.push(doc);
  }
  
  const convertedDocs: NewDocument[] = [];
  
  for (const [baseKey, group] of docGroups.entries()) {
    const totalChunks = group.length;
    
    // Sort group by original chunkIndex if available, or sequence of appearance
    const sortedGroup = [...group].sort((a, b) => {
      const idxA = a.metadata?.chunkIndex ?? 0;
      const idxB = b.metadata?.chunkIndex ?? 0;
      return idxA - idxB;
    });
    
    sortedGroup.forEach((doc, indexInGroup) => {
      const rawAuthority = doc.authority || mapAuthorityAndDocType(doc.sourceType || '').authority;
      const rawDocType = doc.documentType || mapAuthorityAndDocType(doc.sourceType || '').documentType;
      const title = doc.metadata?.title || baseKey;
      const dateISO = parseDateToISO(doc.metadata?.date || '2018-05-25');
      const category = classifyCategory(title, doc.content);
      const articles = extractArticles(doc.content, rawAuthority, rawDocType, doc.sourceReference);
      const language = normalizeLanguage(doc.metadata?.language || doc.metadata?.originalLanguage || 'en');
      
      const { source, authority } = mapSourceAndAuthority(rawAuthority);
      const section = getSectionPath(rawAuthority, rawDocType, doc.sourceReference);
      const url = doc.sourceUrl || doc.metadata?.detailUrl || doc.metadata?.url || '';
      const document_id = doc.metadata?.document_id || `${rawAuthority}-${rawDocType}-${baseKey.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
      
      convertedDocs.push({
        authority: rawAuthority,
        documentType: rawDocType,
        sourceReference: doc.sourceReference,
        sourceUrl: doc.sourceUrl,
        content: doc.content,
        metadata: {
          document_id,
          source,
          authority,
          title,
          section,
          category,
          articles,
          date: dateISO,
          language,
          chunk_index: indexInGroup,
          total_chunks: totalChunks,
          url
        }
      });
    });
  }
  
  await fs.writeFile(filePath, JSON.stringify(convertedDocs, null, 2));
  console.log(`Successfully converted ${filename} - ${convertedDocs.length} chunks saved.`);
}

async function run() {
  try {
    const files = await fs.readdir(corpusDir);
    const jsonFiles = files.filter(f => f.endsWith('.json'));
    
    for (const file of jsonFiles) {
      await convertFile(file);
    }
    console.log("All corpus files converted successfully!");
  } catch (err) {
    console.error("Conversion failed:", err);
  }
}

run();
