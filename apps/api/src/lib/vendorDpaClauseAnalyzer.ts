/**
 * Deep Article 28(3) DPA Clause Analyser — audit P-9 & D54.
 *
 * Evaluates legal documents (DPAs, Terms of Service, Privacy Addenda) against
 * the eight mandatory statutory obligations of GDPR Article 28(3)(a)–(h):
 *
 *   1. documentedInstructions    — Art. 28(3)(a): Processing solely on documented controller instructions
 *   2. confidentiality           — Art. 28(3)(b): Personnel committed to confidentiality or statutory duty
 *   3. securityMeasures          — Art. 28(3)(c): Implementation of Art. 32 security measures
 *   4. subProcessorRestrictions  — Art. 28(3)(d): Prior written authorization, notice of changes, pass-through terms
 *   5. dataSubjectRights         — Art. 28(3)(e): Assistance with Chapter III data subject requests
 *   6. securityBreachDpia        — Art. 28(3)(f): Assistance with Art. 33-34 breach notifications & Art. 35-36 DPIAs
 *   7. deletionOnTermination     — Art. 28(3)(g): Deletion or return of all personal data at end of processing
 *   8. auditRights               — Art. 28(3)(h): Audits, inspections and compliance evidence availability
 *
 * Key Design Principles:
 *   - Tri-state evaluation: 'present' (compliant), 'weak' (conditional/limited/fee-gated), 'missing'.
 *   - Exact-substring quote verification: Every excerpt must match the source text (after whitespace
 *     normalization) to eliminate LLM hallucinations (closing audit D54).
 *   - Pure in-memory core: Usable in CLI tools, background workers, and standalone unit fixtures.
 */

export const ARTICLE_28_CLAUSE_KEYS = [
  'documentedInstructions',
  'confidentiality',
  'securityMeasures',
  'subProcessorRestrictions',
  'dataSubjectRights',
  'securityBreachDpia',
  'deletionOnTermination',
  'auditRights',
] as const;

export type Article28ClauseKey = (typeof ARTICLE_28_CLAUSE_KEYS)[number];

export interface ClauseAnalysisResult {
  status: 'present' | 'weak' | 'missing';
  confidence: number; // 0 - 100
  excerpt?: string;
  citation?: string;
  notes?: string;
}

export interface DpaAnalysisOutput {
  analysedAt: string;
  sourceUrl: string;
  overallScore: number; // 0 - 100
  overallVerdict: 'compliant' | 'partially_compliant' | 'non_compliant';
  clauses: Record<Article28ClauseKey, ClauseAnalysisResult>;
  weaknesses: string[];
  missingClauses: string[];
}

/** Clause pattern definitions with strong signals, weak indicators, and statutory references. */
interface ClauseDefinition {
  key: Article28ClauseKey;
  articleRef: string;
  strongPatterns: RegExp[];
  weakPatterns: RegExp[];
  negativePatterns?: RegExp[];
}

export const ARTICLE_28_DEFINITIONS: Record<Article28ClauseKey, ClauseDefinition> = {
  documentedInstructions: {
    key: 'documentedInstructions',
    articleRef: 'Art. 28(3)(a)',
    strongPatterns: [
      /process(?:es|ing)?\s+(?:personal\s+data\s+)?(?:only|solely|exclusively)\s+(?:on|in\s+accordance\s+with|upon)\s+(?:the\s+)?(?:documented|written)\s+instructions/i,
      /acting\s+only\s+on\s+(?:the\s+)?instructions\s+of\s+the\s+controller/i,
      /unless\s+required\s+to\s+do\s+so\s+by\s+(?:union|member\s+state)\s+law/i,
    ],
    weakPatterns: [
      /process(?:es|ing)?\s+data\s+as\s+(?:necessary|reasonably\s+required)\s+to\s+provide\s+the\s+services/i,
      /reasonable\s+instructions/i,
      /subject\s+to\s+additional\s+charges\s+for\s+custom\s+instructions/i,
    ],
  },
  confidentiality: {
    key: 'confidentiality',
    articleRef: 'Art. 28(3)(b)',
    strongPatterns: [
      /persons?\s+authori[sz]ed\s+to\s+process\s+(?:the\s+)?personal\s+data\s+(?:have\s+committed\s+themselves\s+to|are\s+under\s+an\s+appropriate\s+obligation\s+of)\s+confidentiality/i,
      /ensure\s+that\s+personnel\s+(?:processing\s+personal\s+data\s+)?are\s+subject\s+to\s+(?:a\s+duty\s+of\s+confidentiality|statutory\s+obligation\s+of\s+confidentiality)/i,
      /committed\s+themselves\s+to\s+confidentiality/i,
      /confidentiality\s+undertaking\s+or\s+statutory\s+duty/i,
    ],
    weakPatterns: [
      /customary\s+confidentiality/i,
      /commercial\s+efforts\s+to\s+maintain\s+confidentiality/i,
    ],
  },
  securityMeasures: {
    key: 'securityMeasures',
    articleRef: 'Art. 28(3)(c) / Art. 32',
    strongPatterns: [
      /implement(?:s|ing)?\s+appropriate\s+technical\s+and\s+organi[sz]ational\s+measures/i,
      /measures\s+required\s+pursuant\s+to\s+article\s+32/i,
      /encryption\s+of\s+personal\s+data.*ability\s+to\s+ensure\s+the\s+ongoing\s+confidentiality,\s+integrity/i,
      /technical\s+and\s+organi[sz]ational\s+security\s+measures.*schedule|annex|appendix/i,
    ],
    weakPatterns: [
      /reasonable\s+commercial\s+security\s+measures/i,
      /industry\s+standard\s+security\s+without\s+liability/i,
    ],
  },
  subProcessorRestrictions: {
    key: 'subProcessorRestrictions',
    articleRef: 'Art. 28(3)(d)',
    strongPatterns: [
      /(?:prior\s+specific\s+or\s+general\s+written\s+authori[sz]ation|prior\s+written\s+consent)\s+(?:of|from)\s+the\s+controller/i,
      /(?:not\s+engage|shall\s+not\s+engage)\s+another\s+processor\s+without\s+prior/i,
      /inform\s+the\s+controller\s+of\s+any\s+intended\s+changes\s+concerning\s+the\s+addition\s+or\s+replacement\s+of\s+(?:other\s+)?processors/i,
      /same\s+data\s+protection\s+obligations\s+as\s+set\s+out\s+in\s+this\s+(?:agreement|contract|dpa)\s+shall\s+be\s+imposed\s+on\s+that\s+other\s+processor/i,
    ],
    weakPatterns: [
      /controller\s+authori[sz]es\s+engagement\s+of\s+sub-?processors\s+without\s+notice/i,
      /notice\s+via\s+website\s+update\s+only\s+with\s+no\s+right\s+to\s+object/i,
      /objection\s+requires\s+immediate\s+contract\s+termination\s+with\s+penalty/i,
    ],
  },
  dataSubjectRights: {
    key: 'dataSubjectRights',
    articleRef: 'Art. 28(3)(e)',
    strongPatterns: [
      /assist(?:s|ing)?\s+the\s+controller\s+by\s+appropriate\s+technical\s+and\s+organi[sz]ational\s+measures.*obligation\s+to\s+respond\s+to\s+requests\s+for\s+exercising\s+the\s+data\s+subject['’]s\s+rights/i,
      /assist(?:s|ing)?\s+the\s+controller.*responding\s+to\s+data\s+subjects\s+exercising\s+their\s+rights/i,
      /assistance\s+with\s+data\s+subject\s+requests\s+under\s+chapter\s+iii/i,
      /promptly\s+notify\s+controller\s+if\s+it\s+receives\s+a\s+request\s+from\s+a\s+data\s+subject/i,
    ],
    weakPatterns: [
      /assist\s+with\s+data\s+subject\s+requests\s+subject\s+to\s+hourly\s+billing/i,
      /forward\s+requests\s+without\s+assistance\s+capability/i,
      /reasonable\s+efforts\s+only/i,
    ],
  },
  securityBreachDpia: {
    key: 'securityBreachDpia',
    articleRef: 'Art. 28(3)(f)',
    strongPatterns: [
      /assist(?:s|ing)?\s+the\s+controller\s+in\s+ensuring\s+compliance\s+with\s+the\s+obligations\s+pursuant\s+to\s+articles\s+32\s+to\s+36/i,
      /ensuring\s+compliance\s+with\s+article\s+33\s+and\s+article\s+34/i,
      /notify\s+the\s+controller\s+without\s+undue\s+delay\s+(?:after|upon)\s+becoming\s+aware\s+of\s+a\s+personal\s+data\s+breach/i,
      /assistance\s+with\s+data\s+protection\s+impact\s+assessments\s+and\s+prior\s+consultation/i,
    ],
    weakPatterns: [
      /notify\s+breach\s+within\s+(?:30|60|90)\s+days/i,
      /notify\s+only\s+if\s+confirmed\s+material\s+harm/i,
      /dpia\s+assistance\s+at\s+customer['’]s\s+sole\s+expense/i,
    ],
  },
  deletionOnTermination: {
    key: 'deletionOnTermination',
    articleRef: 'Art. 28(3)(g)',
    strongPatterns: [
      /(?:at\s+the\s+choice\s+of\s+the\s+controller,\s+)?delete(?:s)?\s+or\s+return(?:s)?\s+all\s+(?:the\s+)?personal\s+data\s+to\s+the\s+controller\s+after\s+the\s+end\s+of\s+the\s+provision\s+of\s+services/i,
      /delete\s+existing\s+copies\s+unless\s+(?:union\s+or\s+member\s+state\s+)?law\s+requires\s+storage/i,
      /return\s+or\s+deletion\s+upon\s+termination\s+or\s+expiry\s+of\s+(?:this\s+agreement|the\s+services)/i,
    ],
    weakPatterns: [
      /delete\s+data\s+in\s+accordance\s+with\s+standard\s+backup\s+cycles\s+(?:after\s+\d+\s+years)?/i,
      /charge\s+disposal\s+or\s+export\s+fee\s+prior\s+to\s+deletion/i,
      /anonymi[sz]e\s+and\s+retain\s+for\s+internal\s+analytics\s+without\s+deletion\s+option/i,
    ],
  },
  auditRights: {
    key: 'auditRights',
    articleRef: 'Art. 28(3)(h)',
    strongPatterns: [
      /make(?:s)?\s+available\s+to\s+the\s+controller\s+all\s+information\s+necessary\s+to\s+demonstrate\s+compliance/i,
      /allow(?:s)?\s+for\s+(?:and\s+contribute\s+to\s+)?audits,\s+including\s+inspections/i,
      /allows?\s+for\s+audits\s+and\s+inspections/i,
      /immediately\s+inform\s+the\s+controller\s+if,\s+in\s+its\s+opinion,\s+an\s+instruction\s+infringes\s+this\s+regulation/i,
    ],
    weakPatterns: [
      /audits\s+limited\s+to\s+review\s+of\s+existing\s+third-?party\s+certifications\s+only/i,
      /no\s+on-site\s+inspections\s+permitted\s+under\s+any\s+circumstances/i,
      /audit\s+permitted\s+only\s+once\s+every\s+(?:2|3|5)\s+years\s+with\s+\$?\d+k\s+audit\s+fee/i,
    ],
  },
};

/** Normalise whitespace for robust substring comparison. */
export function normalizeTextForMatching(text: string): string {
  return text
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Validates that an excerpt is an exact (or normalized) substring of the source text.
 * Prevents LLM hallucinations from being recorded as factual legal quotes (audit D54).
 */
export function verifyClauseExcerpt(sourceText: string, excerpt?: string): boolean {
  if (!excerpt || typeof excerpt !== 'string' || excerpt.trim().length === 0) {
    return false;
  }
  const cleanSource = normalizeTextForMatching(sourceText).toLowerCase();
  const cleanExcerpt = normalizeTextForMatching(excerpt).toLowerCase();
  return cleanSource.includes(cleanExcerpt);
}

/** Extract surrounding sentence/context when a pattern matches. */
function extractContextSentence(text: string, matchIndex: number, matchLength: number): string {
  const windowStart = Math.max(0, matchIndex - 120);
  const windowEnd = Math.min(text.length, matchIndex + matchLength + 120);
  const snippet = text.slice(windowStart, windowEnd);
  const clean = normalizeTextForMatching(snippet);
  return clean.length > 200 ? clean.slice(0, 197) + '...' : clean;
}

/**
 * Analyses DPA text against all 8 statutory Article 28(3) clauses.
 * Deterministic, explainable, and verified against the raw text.
 */
export function analyseDpaText(
  sourceText: string,
  sourceUrl: string = ''
): DpaAnalysisOutput {
  const normText = normalizeTextForMatching(sourceText);
  const clauses = {} as Record<Article28ClauseKey, ClauseAnalysisResult>;
  const weaknesses: string[] = [];
  const missingClauses: string[] = [];

  let totalScorePoints = 0;
  const MAX_POINTS = ARTICLE_28_CLAUSE_KEYS.length * 10; // 80 points total

  for (const key of ARTICLE_28_CLAUSE_KEYS) {
    const def = ARTICLE_28_DEFINITIONS[key];
    let matchedStrong: RegExpMatchArray | null = null;
    let matchedWeak: RegExpMatchArray | null = null;

    // Check strong patterns
    for (const pat of def.strongPatterns) {
      const m = normText.match(pat);
      if (m && m.index !== undefined) {
        matchedStrong = m;
        break;
      }
    }

    // Check weak patterns
    for (const pat of def.weakPatterns) {
      const m = normText.match(pat);
      if (m && m.index !== undefined) {
        matchedWeak = m;
        break;
      }
    }

    if (matchedStrong) {
      const snippet = extractContextSentence(
        normText,
        matchedStrong.index!,
        matchedStrong[0].length
      );
      clauses[key] = {
        status: 'present',
        confidence: 90,
        citation: def.articleRef,
        excerpt: snippet,
        notes: `Compliant with ${def.articleRef}`,
      };
      totalScorePoints += 10;
    } else if (matchedWeak) {
      const snippet = extractContextSentence(
        normText,
        matchedWeak.index!,
        matchedWeak[0].length
      );
      clauses[key] = {
        status: 'weak',
        confidence: 70,
        citation: def.articleRef,
        excerpt: snippet,
        notes: `Potentially restrictive or non-standard term regarding ${def.articleRef}`,
      };
      weaknesses.push(`${def.articleRef} (${key}): Restricted or conditioned obligation.`);
      totalScorePoints += 4;
    } else {
      clauses[key] = {
        status: 'missing',
        confidence: 85,
        citation: def.articleRef,
        notes: `No explicit clause satisfying ${def.articleRef} identified in text.`,
      };
      missingClauses.push(`${def.articleRef} (${key})`);
    }
  }

  const overallScore = Math.round((totalScorePoints / MAX_POINTS) * 100);
  let overallVerdict: 'compliant' | 'partially_compliant' | 'non_compliant' = 'non_compliant';
  if (overallScore >= 85 && missingClauses.length === 0) {
    overallVerdict = 'compliant';
  } else if (overallScore >= 50) {
    overallVerdict = 'partially_compliant';
  }

  return {
    analysedAt: new Date().toISOString(),
    sourceUrl,
    overallScore,
    overallVerdict,
    clauses,
    weaknesses,
    missingClauses,
  };
}

/**
 * Sanitises an analysis output from an external source or LLM, ensuring
 * that all excerpts genuinely exist in sourceText. If an excerpt fails
 * substring verification, it is stripped and confidence is downgraded.
 */
export function verifyAndSanitizeDpaAnalysis(
  analysis: DpaAnalysisOutput,
  sourceText: string
): DpaAnalysisOutput {
  const sanitizedClauses = { ...analysis.clauses };

  for (const key of ARTICLE_28_CLAUSE_KEYS) {
    const clause = sanitizedClauses[key];
    if (clause && clause.excerpt) {
      const isValid = verifyClauseExcerpt(sourceText, clause.excerpt);
      if (!isValid) {
        // Hallucinated quote detected! Strip excerpt and cap confidence.
        sanitizedClauses[key] = {
          ...clause,
          excerpt: undefined,
          confidence: Math.min(clause.confidence, 40),
          notes: `${clause.notes || ''} (Note: unverified quotation removed)`.trim(),
        };
      }
    }
  }

  return {
    ...analysis,
    clauses: sanitizedClauses,
  };
}
