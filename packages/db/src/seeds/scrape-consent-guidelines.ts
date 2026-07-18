import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { PDFParse } from 'pdf-parse';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const corpusDir = path.join(__dirname, '../../corpus');
const edpbCorpusPath = path.join(corpusDir, 'edpb-corpus.json');

const PDF_URL = 'https://www.edpb.europa.eu/system/files/documents/files/file1/edpb_guidelines_202005_consent_en.pdf';
const DETAIL_URL = 'https://edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-052020-consent-under-regulation-2016679_en';

interface NewDocument {
  authority: string;
  documentType: string;
  sourceReference: string;
  sourceUrl?: string;
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

function cleanPdfText(text: string): string {
  const lines = text.split('\n');
  const cleanLines = lines
    .map(line => line.trim())
    .filter(line => {
      if (/\.{4,}/.test(line)) return false;
      if (/^--\s*\d+\s*of\s*\d+\s*--$/i.test(line)) return false;
      if (/^\d+\s*\|\s*Adopted$/i.test(line)) return false;
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

async function run() {
  console.log(`Downloading Guidelines 05/2020 PDF: ${PDF_URL}`);
  const response = await fetch(PDF_URL);
  if (!response.ok) throw new Error(`Failed to fetch PDF: ${response.status}`);
  const arrayBuffer = await response.arrayBuffer();
  const pdfBuffer = Buffer.from(arrayBuffer);

  console.log("Parsing PDF text...");
  const parser = new PDFParse({ data: pdfBuffer });
  const pdfData = await parser.getText();
  const pdfText = cleanPdfText(pdfData.text || '');
  await parser.destroy().catch(() => {});

  const textChunks = chunkText(pdfText);
  console.log(`Generated ${textChunks.length} chunks from Guidelines 05/2020.`);

  // Load existing edpb-corpus.json
  const existingData = await fs.readFile(edpbCorpusPath, 'utf-8');
  const edpbDocs: NewDocument[] = JSON.parse(existingData);

  const title = "Guidelines 05/2020 on consent under Regulation 2016/679";
  const date = "2020-05-04";
  const category = "consent";
  const articles = [4, 6, 7, 8, 9, 49];

  textChunks.forEach((chunkContent, idx) => {
    edpbDocs.push({
      authority: "edpb",
      documentType: "guideline",
      sourceReference: `Guidelines 05/2020 on consent under Regulation 2016/679 (Part ${idx + 1})`,
      sourceUrl: PDF_URL,
      content: `EDPB Guideline - Guidelines 05/2020 on consent under Regulation 2016/679\n\n${chunkContent}`,
      metadata: {
        document_id: "edpb-guideline-guidelines-05-2020-on-consent",
        source: "edpb",
        authority: "edpb",
        title,
        section: title,
        category,
        articles,
        date,
        language: "en",
        chunk_index: idx,
        total_chunks: textChunks.length,
        url: DETAIL_URL
      }
    });
  });

  await fs.writeFile(edpbCorpusPath, JSON.stringify(edpbDocs, null, 2));
  console.log(`Appended Guidelines 05/2020. Total chunks in EDPB corpus: ${edpbDocs.length}`);
}

run().catch(console.error);
