import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface Suggestion {
  trigger: string;
  matchedText: string;
  context: string;
}

/**
 * Searches the text for candidate legal clauses of interest (e.g. notify/breach windows, sub-processor objections)
 * and returns advisory suggestions for the review queue.
 */
export function runCandidateExtractorOnText(text: string): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const lowerText = text.toLowerCase();

  // Pattern 1: numbers near notify/breach windows
  // Trigger words: notify, notification, breach, security incident
  const breachPattern = /(\d+)\s*(calendar |business )?(hours|days)/gi;
  let match;

  while ((match = breachPattern.exec(text)) !== null) {
    const startIdx = Math.max(0, match.index - 100);
    const endIdx = Math.min(text.length, match.index + match[0].length + 100);
    const contextSnippet = text.slice(startIdx, endIdx);

    const contextLower = contextSnippet.toLowerCase();
    if (contextLower.includes('notify') || contextLower.includes('breach') || contextLower.includes('incident')) {
      suggestions.push({
        trigger: 'breach_notification',
        matchedText: match[0],
        context: contextSnippet.trim().replace(/\s+/g, ' ')
      });
    }
  }

  // Pattern 2: numbers near objection / sub-processor notification windows
  // Trigger words: object, objection, subprocessor, sub-processor
  const objectionPattern = /(\d+)\s*(calendar |business )?(hours|days)/gi;
  objectionPattern.lastIndex = 0; // reset index

  while ((match = objectionPattern.exec(text)) !== null) {
    const startIdx = Math.max(0, match.index - 100);
    const endIdx = Math.min(text.length, match.index + match[0].length + 100);
    const contextSnippet = text.slice(startIdx, endIdx);

    const contextLower = contextSnippet.toLowerCase();
    if (contextLower.includes('object') || contextLower.includes('sub-processor') || contextLower.includes('subprocessor')) {
      // Avoid duplicate trigger matches on same span
      if (!suggestions.some(s => s.matchedText === match![0] && s.trigger === 'subprocessor_objection')) {
        suggestions.push({
          trigger: 'subprocessor_objection',
          matchedText: match[0],
          context: contextSnippet.trim().replace(/\s+/g, ' ')
        });
      }
    }
  }

  return suggestions;
}

async function runCandidateExtractor() {
  console.log('--- CANDIDATE EXTRACTOR RUNNING ---');
  const vendorsDir = path.resolve(__dirname, '../../vendors');
  const files = fs.readdirSync(vendorsDir);

  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    const vendorPath = path.join(vendorsDir, file);
    const vendor = JSON.parse(fs.readFileSync(vendorPath, 'utf-8'));

    if (vendor.lastDpaText) {
      const suggestions = runCandidateExtractorOnText(vendor.lastDpaText);
      if (suggestions.length > 0) {
        console.log(`\nSuggestions for ${vendor.name}:`);
        console.log(JSON.stringify(suggestions, null, 2));
      }
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runCandidateExtractor().catch(err => console.error(err));
}
