import { router, protectedProcedure, publicProcedure } from '../trpc.js';
import { z } from 'zod';
import { 
  processingActivities, 
  organizations,
  documentEmbeddings,
  vendors,
  organizationVendors,
  breaches,
  dsarRequests,
  consentDomains,
  consentCookies,
  complianceGaps,
  aiGuidanceLogs,
  vendorQuestionnaires,
  dpias
} from 'db';
import { eq, and, sql, desc } from 'drizzle-orm';
import { GoogleGenAI } from '@google/genai';
import { Anthropic } from '@anthropic-ai/sdk';
import { TRPCError } from '@trpc/server';
import { PDFParse } from 'pdf-parse';
import crypto from 'crypto';
import { calculateVendorRisk } from './vendors.js';
import { trackAiUsage } from '../lib/billing.js';

const ai = new GoogleGenAI({
  vertexai: true,
  project: process.env.GCP_PROJECT_ID || 'privaro',
  location: process.env.GCP_LOCATION || 'us-central1',
});

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || 'dummy_key',
});

async function generateEmbedding(text: string) {
  const response = await ai.models.embedContent({
    model: 'gemini-embedding-001',
    contents: text,
  });

  const firstEmbedding = response.embeddings?.[0];
  if (!firstEmbedding || !firstEmbedding.values) {
    throw new Error('No embeddings returned from Gemini/Vertex AI');
  }

  const values = firstEmbedding.values;
  if (values.length !== 3072) {
    throw new Error(`Expected 3072 dimensions, got ${values.length}`);
  }

  return values;
}

type Intent = 'regulatory' | 'guidance' | 'organization_specific' | 'comparison';

function classifyIntent(query: string): Intent {
  const q = query.toLowerCase();
  
  if (
    q.includes('we') || q.includes('our') || q.includes('us') || 
    q.includes('privaro') || q.includes('my organization') || 
    q.includes('are we') || q.includes('do we') || q.includes('our policy') ||
    q.includes('compliance status') || q.includes('our compliance')
  ) {
    return 'organization_specific';
  }
  
  if (
    q.includes('compare') || q.includes('difference between') || 
    q.includes(' vs ') || q.includes('versus') || q.includes('comparison')
  ) {
    return 'comparison';
  }
  
  if (
    q.includes('article') || q.includes('recital') || q.includes('regulation') ||
    q.includes('law') || q.includes('section') || q.includes('clause') ||
    q.includes('chapter') || q.startsWith('what does article')
  ) {
    return 'regulatory';
  }
  
  return 'guidance';
}

function expandQuery(query: string): string {
  let expanded = query;
  const q = query.toLowerCase();
  
  if (q.includes('dsar')) {
    expanded += ' "data subject access request" "Article 15"';
  }
  if (q.includes('dpo')) {
    expanded += ' "data protection officer" "Article 37" "Article 38" "Article 39"';
  }
  if (q.includes('cookies') || q.includes('cookie')) {
    expanded += ' "cookies" "ePrivacy" "consent" "tracking"';
  }
  if (q.includes('transfers') || q.includes('transfer')) {
    expanded += ' "international transfers" "third country" "Chapter V"';
  }
  
  return expanded;
}

function mapIntentToCategory(query: string): string | null {
  const q = query.toLowerCase();
  if (q.includes('consent') || q.includes('cookie') || q.includes('opt-in') || q.includes('opt-out')) return 'consent';
  if (q.includes('transfer') || q.includes('third country') || q.includes('scc') || q.includes('bcr')) return 'transfers';
  if (q.includes('breach') || q.includes('notification') || q.includes('incident') || q.includes('leak')) return 'breach';
  if (q.includes('dsar') || q.includes('access request') || q.includes('erasure') || q.includes('forgotten') || q.includes('rectification')) return 'dsar';
  if (q.includes('dpo') || q.includes('officer') || q.includes('dpa')) return 'dpo';
  if (q.includes('fine') || q.includes('penalty') || q.includes('enforcement') || q.includes('sanction')) return 'enforcement';
  return null;
}

interface RetrievalResult {
  id: string;
  documentId: string;
  source: string;
  authority: string;
  title: string;
  section: string | null;
  category: string;
  articles: number[];
  content: string;
  chunkIndex: number;
  totalChunks: number;
  sourceUrl: string | null;
  language: string | null;
  similarity: number;
  type: 'global' | 'category' | 'organization';
  rerankScore?: number;
  metadata?: any;
  isCurrent?: boolean;
  supersededBy?: string | null;
}

async function translateQueryToEnglish(query: string, locale: string): Promise<string> {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Translate the following query into English for regulatory document retrieval. Do not add any conversational text, explanations, or introductory notes. Output ONLY the English translation directly:\n\n${query}`,
    });
    return response.text?.trim() || query;
  } catch (err) {
    console.error('Gemini query translation failed, using fallback:', err);
    return query; // Fallback to original query if translation fails
  }
}

async function retrieveContext(ctx: any, query: string, orgId?: string, locale?: string): Promise<RetrievalResult[]> {
  const isEnglish = !locale || locale === 'en';
  let englishQuery = query;
  if (!isEnglish) {
    englishQuery = await translateQueryToEnglish(query, locale!);
  }

  const includeHistorical = /historical|previous|superseded|archive|old\s+version/i.test(query);

  const expandedEnglish = expandQuery(englishQuery);
  const englishEmbedding = await generateEmbedding(expandedEnglish);
  const englishEmbeddingArray = `[${englishEmbedding.join(',')}]`;

  let originalEmbeddingArray = englishEmbeddingArray;
  if (!isEnglish && englishQuery !== query) {
    try {
      const expandedOriginal = expandQuery(query);
      const originalEmbedding = await generateEmbedding(expandedOriginal);
      originalEmbeddingArray = `[${originalEmbedding.join(',')}]`;
    } catch (e) {
      console.error('Failed to embed original query, falling back to English embedding:', e);
    }
  }

  const intent = classifyIntent(query);
  const category = mapIntentToCategory(query);

  const mergedMap = new Map<string, RetrievalResult>();

  // Fetch org country code for boosting
  let orgCountry: string | null = null;
  if (orgId) {
    try {
      const org = await ctx.db.query.organizations.findFirst({
        where: eq(organizations.id, orgId),
        columns: { countryCode: true }
      });
      if (org) orgCountry = org.countryCode;
    } catch (e) {
      console.error('Failed to fetch organization country code:', e);
    }
  }

  // 1. Semantic search on global corpus (checking both English and local-language chunks)
  const globalResults = await ctx.db.execute(sql`
    SELECT id, document_id, source, authority, title, section, category, articles, content, chunk_index, total_chunks, source_url, language, metadata, is_current, superseded_by,
           CASE 
             WHEN language = 'en' THEN 1 - (embedding <=> ${englishEmbeddingArray}::vector)
             ELSE 1 - (embedding <=> ${originalEmbeddingArray}::vector)
           END as similarity
    FROM document_embeddings
    WHERE (
      (language = 'en' AND 1 - (embedding <=> ${englishEmbeddingArray}::vector) > 0.7) OR
      (language = ${locale || 'en'} AND 1 - (embedding <=> ${originalEmbeddingArray}::vector) > 0.7)
    )
    ${includeHistorical ? sql`` : sql`AND is_current = true`}
    ORDER BY similarity DESC
    LIMIT 15
  `);
  
  const globalRows = (globalResults.rows || []) as any[];
  globalRows.forEach(row => {
    mergedMap.set(row.id, {
      id: row.id,
      documentId: row.document_id,
      source: row.source,
      authority: row.authority,
      title: row.title,
      section: row.section,
      category: row.category,
      articles: row.articles || [],
      content: row.content,
      chunkIndex: row.chunk_index,
      totalChunks: row.total_chunks,
      sourceUrl: row.source_url,
      language: row.language,
      similarity: Number(row.similarity),
      type: 'global',
      metadata: row.metadata,
      isCurrent: row.is_current,
      supersededBy: row.superseded_by
    });
  });

  // 2. Category-boosted results (checking both English and local-language chunks)
  if (category) {
    const categoryResults = await ctx.db.execute(sql`
      SELECT id, document_id, source, authority, title, section, category, articles, content, chunk_index, total_chunks, source_url, language, metadata, is_current, superseded_by,
             CASE 
               WHEN language = 'en' THEN 1 - (embedding <=> ${englishEmbeddingArray}::vector)
               ELSE 1 - (embedding <=> ${originalEmbeddingArray}::vector)
             END as similarity
      FROM document_embeddings
      WHERE category = ${category}
        AND (
          (language = 'en' AND 1 - (embedding <=> ${englishEmbeddingArray}::vector) > 0.6) OR
          (language = ${locale || 'en'} AND 1 - (embedding <=> ${originalEmbeddingArray}::vector) > 0.6)
        )
        ${includeHistorical ? sql`` : sql`AND is_current = true`}
      ORDER BY similarity DESC
      LIMIT 5
    `);
    const categoryRows = (categoryResults.rows || []) as any[];
    categoryRows.forEach(row => {
      const existing = mergedMap.get(row.id);
      const similarity = Number(row.similarity);
      if (!existing || similarity > existing.similarity) {
        mergedMap.set(row.id, {
          id: row.id,
          documentId: row.document_id,
          source: row.source,
          authority: row.authority,
          title: row.title,
          section: row.section,
          category: row.category,
          articles: row.articles || [],
          content: row.content,
          chunkIndex: row.chunk_index,
          totalChunks: row.total_chunks,
          sourceUrl: row.source_url,
          language: row.language,
          similarity,
          type: 'category',
          metadata: row.metadata,
          isCurrent: row.is_current,
          supersededBy: row.superseded_by
        });
      }
    });
  }

  // 3. Organization-specific context
  if (orgId && intent === 'organization_specific') {
    const orgResults = await ctx.db.execute(sql`
      SELECT id, content, metadata,
             1 - (embedding <=> ${originalEmbeddingArray}::vector) as similarity
      FROM organization_embeddings
      WHERE organization_id = ${orgId}
        AND 1 - (embedding <=> ${originalEmbeddingArray}::vector) > 0.6
      ORDER BY similarity DESC
      LIMIT 5
    `);
    const orgRows = (orgResults.rows || []) as any[];
    orgRows.forEach(row => {
      const meta = row.metadata || {};
      mergedMap.set(row.id, {
        id: row.id,
        documentId: row.id,
        source: 'organization',
        authority: 'organization',
        title: meta.title || 'Organization Policy',
        section: meta.title || 'Organization Policy',
        category: 'general',
        articles: [],
        content: row.content,
        chunkIndex: 0,
        totalChunks: 1,
        sourceUrl: null,
        language: locale || 'en',
        similarity: Number(row.similarity),
        type: 'organization'
      });
    });
  }

  // 4. Authority, Recency, Article Match, Jurisdiction Boost, Category Coherence, and Diversity Reranking
  const weights = {
    gdpr_regulation: 1.0,
    edpb: 0.9,
    cjeu: 0.85,
    national_dpa: 0.75,
    organization: 0.7
  };

  const getAuthorityWeightKey = (row: RetrievalResult): keyof typeof weights => {
    if (row.type === 'organization') return 'organization';
    if (row.authority === 'eu') return 'gdpr_regulation';
    if (row.authority === 'edpb') return 'edpb';
    if (row.authority === 'cjeu') return 'cjeu';
    return 'national_dpa';
  };

  // Extract article numbers from query (e.g., "Article 6" -> 6)
  const queryArticles: number[] = [];
  const articleMatches = query.match(/(?:article|art\.?)\s*(\d+)/ig);
  if (articleMatches) {
    articleMatches.forEach(m => {
      const numMatch = m.match(/\d+/);
      if (numMatch) {
        queryArticles.push(parseInt(numMatch[0], 10));
      }
    });
  }

  // Pre-calculate initial score incorporating authority, recency, article match, and local DPA jurisdiction boost
  const scoredList = Array.from(mergedMap.values()).map(row => {
    const key = getAuthorityWeightKey(row);
    const authWeight = weights[key];
    let score = row.similarity * authWeight;

    // Versioning Penalty: Apply 20% decay to superseded/non-current chunks
    if (row.isCurrent === false) {
      score *= 0.8;
    }

    // Local DPA Jurisdiction Boost (1.2x boost for matched DPAs)
    if (orgCountry) {
      const countryUpper = orgCountry.toUpperCase();
      if (countryUpper === 'FR' && row.authority === 'cnil') {
        score *= 1.2;
      } else if (countryUpper === 'DE' && row.authority === 'bfdi') {
        score *= 1.2;
      }
    }

    // Recency boost/decay (1.5% penalty per year of age since 2026)
    if (row.metadata?.date) {
      const docYear = new Date(row.metadata.date).getFullYear();
      const currentYear = 2026;
      const age = Math.max(0, currentYear - docYear);
      const recencyFactor = Math.max(0.85, 1.0 - (age * 0.015));
      score *= recencyFactor;
    }

    // Article matching boost
    if (queryArticles.length > 0 && row.articles && row.articles.length > 0) {
      const hasMatch = row.articles.some(art => queryArticles.includes(art));
      if (hasMatch) {
        score *= 1.25; // 25% boost for exact article matches
      }
    }

    return { ...row, initialScore: score };
  });

  // Sort by initial score to find the dominant category in the top 3
  scoredList.sort((a, b) => b.initialScore - a.initialScore);
  const top3 = scoredList.slice(0, 3);
  
  const categoryCounts: Record<string, number> = {};
  top3.forEach(row => {
    categoryCounts[row.category] = (categoryCounts[row.category] || 0) + 1;
  });
  
  let dominantCategory: string | null = null;
  let maxCount = 0;
  for (const cat in categoryCounts) {
    if (categoryCounts[cat]! > maxCount) {
      maxCount = categoryCounts[cat]!;
      dominantCategory = cat;
    }
  }

  // Apply Category Coherence and Diversity penalties sequentially
  const docCounts = new Map<string, number>();
  const finalReranked: RetrievalResult[] = [];

  scoredList.forEach(row => {
    let score = row.initialScore;

    // Category coherence penalty
    if (dominantCategory && row.category !== dominantCategory && maxCount >= 2) {
      score *= 0.9; // 10% penalty for category outlier
    }

    // Diversity penalty based on chunks already chosen from this document
    const docCount = docCounts.get(row.documentId) || 0;
    if (docCount > 0) {
      score *= Math.pow(0.8, docCount); // 20% penalty compounded per extra chunk from same doc
    }
    
    // Update doc counts
    docCounts.set(row.documentId, docCount + 1);

    finalReranked.push({ ...row, rerankScore: score });
  });

  // Final sort by rerankScore
  const reranked = finalReranked.sort((a, b) => (b.rerankScore || 0) - (a.rerankScore || 0));

  // 5. Fetch adjacent chunks for top 3 global/category results
  const topResults = reranked.slice(0, 3);
  const adjacentChunks: RetrievalResult[] = [];

  for (const doc of topResults) {
    if (doc.type !== 'organization' && doc.totalChunks > 1) {
      const prevIdx = doc.chunkIndex - 1;
      const nextIdx = doc.chunkIndex + 1;
      const targets = [];
      if (prevIdx >= 0) targets.push(prevIdx);
      if (nextIdx < doc.totalChunks) targets.push(nextIdx);

      if (targets.length > 0) {
        const adjacentResults = await ctx.db.execute(sql`
          SELECT id, document_id, source, authority, title, section, category, articles, content, chunk_index, total_chunks, source_url, language, metadata
          FROM document_embeddings
          WHERE document_id = ${doc.documentId}
            AND authority = ${doc.authority}
            AND chunk_index IN (${sql.raw(targets.join(','))})
        `);
        const adjRows = (adjacentResults.rows || []) as any[];
        adjRows.forEach(row => {
          adjacentChunks.push({
            id: row.id,
            documentId: row.document_id,
            source: row.source,
            authority: row.authority,
            title: row.title,
            section: row.section,
            category: row.category,
            articles: row.articles || [],
            content: row.content,
            chunkIndex: row.chunk_index,
            totalChunks: row.total_chunks,
            sourceUrl: row.source_url,
            language: row.language,
            similarity: doc.similarity,
            type: doc.type,
            rerankScore: doc.rerankScore,
            metadata: row.metadata
          });
        });
      }
    }
  }

  // Add adjacent chunks to the list, deduplicating them
  adjacentChunks.forEach(row => {
    const existing = mergedMap.get(row.id);
    if (!existing) {
      mergedMap.set(row.id, row);
    }
  });

  const topResultIds = new Set(topResults.map(r => r.id));
  const finalResults: RetrievalResult[] = [...topResults];

  adjacentChunks.forEach(adj => {
    if (!topResultIds.has(adj.id)) {
      finalResults.push(adj);
      topResultIds.add(adj.id);
    }
  });

  reranked.forEach(row => {
    if (!topResultIds.has(row.id)) {
      finalResults.push(row);
    }
  });

  // 6. Token budgeting (Limit to 12,000 tokens / 48,000 characters)
  const MAX_CHAR_BUDGET = 48000;
  let accumulatedChars = 0;
  const budgetedResults: RetrievalResult[] = [];

  for (const row of finalResults) {
    const length = row.content.length;
    if (accumulatedChars + length <= MAX_CHAR_BUDGET) {
      budgetedResults.push(row);
      accumulatedChars += length;
    } else {
      break;
    }
  }

  return budgetedResults;
}

export const aiRouter = router({
  askCopilot: protectedProcedure
    .input(z.object({
      question: z.string().min(1),
      history: z.array(z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string()
      })).optional(),
      moduleContext: z.enum(['ropa', 'vendors', 'breaches', 'dsar', 'consent', 'compliance_scoring']).optional(),
      entityId: z.string().uuid().optional(),
      locale: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.user!.orgId;
      const { locale } = input;
      
      
      // 1. Rate Limiting Check
      await trackAiUsage(orgId, 1);
 
      // 2. Topic Shift & Context Retrieval
      let RAGQuery = input.question;
      
      if (input.history && input.history.length > 0) {
        const prevUserMessages = input.history.filter(h => h.role === 'user');
        if (prevUserMessages.length > 0) {
          const lastUserMsg = prevUserMessages[prevUserMessages.length - 1];
          const lastQuestion = lastUserMsg?.content || '';
          const currentCategory = mapIntentToCategory(input.question);
          const previousCategory = mapIntentToCategory(lastQuestion);
          
          const currentIntent = classifyIntent(input.question);
          const previousIntent = classifyIntent(lastQuestion);
          
          if (currentCategory === previousCategory && currentIntent === previousIntent) {
            // No topic shift: combine queries for query expansion
            RAGQuery = `${lastQuestion} ${input.question}`;
          }
        }
      }
 
      // If a specific module focus was provided, prepend it to RAG search
      if (input.moduleContext) {
        RAGQuery = `[Context: ${input.moduleContext}] ${RAGQuery}`;
      }
 
      const retrieved = await retrieveContext(ctx, RAGQuery, orgId, locale);
 
      // Check if we retrieved any database chunks above the similarity threshold
      const hasGroundedContext = retrieved.some(r => r.similarity > 0.6);
 
      // 3. Retrieve ROPA Context and Vendor counts for Context Window & Insights
      const activities = await ctx.db.query.processingActivities.findMany({
        where: and(
          eq(processingActivities.organizationId, orgId),
          eq(processingActivities.status, 'active'),
        ),
        with: { dataCategories: true, recipients: true },
      });
 
      const vendorsCountResult = await ctx.db.execute(sql`
        SELECT COUNT(*) as count FROM vendors WHERE organization_id = ${orgId}
      `);
      const vendorCount = Number(vendorsCountResult.rows?.[0]?.count || 0);
 
      const org = await ctx.db.query.organizations.findFirst({
        where: eq(organizations.id, orgId)
      });
      if (!org) throw new TRPCError({ code: 'NOT_FOUND' });

      const orgContext = {
        orgName: org.name,
        industry: org.industry || 'general',
        country: org.countryCode || 'IE',
        hasDpo: org.hasDpo ? 'Yes' : 'No',
        vendorCount,
        activityCount: activities.length
      };
 
      // 4. Assemble LLM Prompt
      let systemPrompt = `You are a GDPR compliance expert assistant for ${orgContext.orgName || 'a European organization'}.
 
Answer the following question using ONLY the provided reference materials. If the answer cannot be determined from the provided materials, say so clearly. Do not speculate or provide information not grounded in the sources.
 
Always cite your sources using the exact format "[Source N: Document Title, Section]" (where N is the source index number, e.g. "[Source 1: Chapter II > Article 6]", "[Source 2: Guidelines 05/2020 on consent]"). When referencing specific GDPR articles, quote the relevant text.
 
${orgContext ? `
Organization context:
- Industry: ${orgContext.industry}
- Country: ${orgContext.country}
- Has DPO: ${orgContext.hasDpo}
- Vendor count: ${orgContext.vendorCount}
- Processing activities: ${orgContext.activityCount}
` : ''}
`;
 
      // Instruct Claude to respond in the requested language
      const targetLanguageName = locale === 'de' ? 'German' : locale === 'fr' ? 'French' : 'English';
      systemPrompt += `\n\nCRITICAL LANGUAGE REQUIREMENT: You MUST generate your entire response in ${targetLanguageName} (matching the requested locale '${locale || 'en'}'). Translate all compliance terms and explanations accurately into ${targetLanguageName}, but keep the source citation bracket labels exactly as "[Source N: ...]".`;
 
      if (!hasGroundedContext) {
        systemPrompt += `
 
CRITICAL INSTRUCTION FOR FALLBACK:
No specific matching regulatory or organization database context was found for this query.
Please answer the user's question using your general compliance and GDPR knowledge.
You MUST begin your response with the following exact disclaimer:
"Disclaimer: No direct matching sources were found in the database. The following is general compliance guidance based on standard data protection knowledge."
`;
      }

      let contextStr = `\nReference materials:\n`;
      const citationsList: { title: string; url: string }[] = [];
      let citationIndex = 1;

      retrieved.forEach((c) => {
        const sourceName = c.section || c.title;
        const sourceUrl = c.sourceUrl || '';
        
        contextStr += `--- Source ${citationIndex}: ${c.title} (${c.source}) ---\nSection: ${sourceName}\n${c.content}\n---\n\n`;
        citationsList.push({
          title: sourceName,
          url: sourceUrl
        });
        citationIndex++;
      });

      if (activities.length > 0) {
        contextStr += `\n--- ORGANIZATION ROPA CONTEXT ---\n`;
        activities.forEach((a: any) => {
          contextStr += `- Active Processing Activity: "${a.name}". Lawful basis: ${a.lawfulBasis}. Categories: ${a.dataCategories.map((dc: any) => dc.category).join(', ')}.\n`;
        });
      }

      systemPrompt += contextStr;

      try {
        const messages: any[] = [];
        if (input.history && input.history.length > 0) {
          input.history.forEach((h) => {
            messages.push({ role: h.role, content: h.content });
          });
        }
        messages.push({ role: 'user', content: input.question });

        const msg = await anthropic.messages.create({
          model: 'claude-3-5-sonnet-20240620',
          max_tokens: 1024,
          system: systemPrompt,
          messages: messages
        });

        // The correct way to handle text blocks from Anthropic SDK
        const responseText = msg.content.filter((block: any) => block.type === 'text').map((block: any) => block.text).join('\n');
        
        // 5. Robust citation parsing and replacement
        // Handles formats like [Source 1], [Source 1, 2], [Sources 1-3], [Source 1: Section], etc.
        const bracketRegex = /\[Sources?\s*([^\]]+)\]/ig;
        let processedAnswer = responseText.replace(bracketRegex, (match, content) => {
          const numbers: number[] = [];
          const parts = content.split(/,|\band\b|&/i);
          
          for (let part of parts) {
            part = part.trim().toLowerCase();
            part = part.replace(/sources?/g, '').trim();
            
            // Check for range e.g. "1-3" or "1 to 3"
            const rangeMatch = part.match(/(\d+)\s*(?:-|to)\s*(\d+)/);
            if (rangeMatch) {
              const start = parseInt(rangeMatch[1], 10);
              const end = parseInt(rangeMatch[2], 10);
              if (!isNaN(start) && !isNaN(end) && start <= end) {
                for (let i = start; i <= end; i++) {
                  numbers.push(i);
                }
                continue;
              }
            }
            
            // Extract single numbers
            const singleMatches = part.match(/\d+/g);
            if (singleMatches) {
              singleMatches.forEach((numStr: string) => {
                numbers.push(parseInt(numStr, 10));
              });
            }
          }

          if (numbers.length === 0) {
            return match;
          }

          const markdownLinks = numbers.map(num => {
            const idx = num - 1;
            if (idx >= 0 && idx < citationsList.length) {
              const cit = citationsList[idx]!;
              const linkUrl = cit.url || '#';
              return `[${cit.title}](${linkUrl})`;
            }
            return `[Source ${num}]`;
          });

          return `[${markdownLinks.join(', ')}]`;
        });

        // 6. Append RAG Confidence and Organization Compliance Insights Card
        let highestAuthority = 'general';
        retrieved.forEach(c => {
          if (c.similarity > 0.6) {
            if (c.authority === 'eu' || c.authority === 'edpb') {
              if (highestAuthority !== 'eu' && highestAuthority !== 'edpb') {
                highestAuthority = 'eu';
              }
            } else if (c.authority === 'cjeu' || c.authority === 'ico' || c.authority === 'cnil' || c.authority === 'bfdi' || c.authority === 'dpc' || c.authority === 'ap' || c.authority === 'aepd') {
              if (highestAuthority !== 'eu' && highestAuthority !== 'edpb') {
                highestAuthority = 'national';
              }
            }
          }
        });

        let confidence = 'Advisory';
        let confidenceDescription = 'Answer synthesized from multiple indirect compliance sources.';
        if (highestAuthority === 'eu') {
          confidence = 'High confidence';
          confidenceDescription = 'Answer grounded directly in primary GDPR text or official EDPB guidelines.';
        } else if (highestAuthority === 'national') {
          confidence = 'Medium confidence';
          confidenceDescription = 'Answer grounded in interpretive national Data Protection Authority (DPA) guidance.';
        }

        const insights: string[] = [];
        const qLower = input.question.toLowerCase();
        const intent = classifyIntent(input.question);

        if (intent === 'organization_specific') {
          if (qLower.includes('dpo') || qLower.includes('data protection officer')) {
            if (!org.hasDpo) {
              insights.push(`⚠️ **DPO Config**: You asked about your DPO status, but currently do not have a Data Protection Officer configured in Privaro. Consider verifying if Article 37 requirements apply to your processing activities.`);
            }
          }
          if (qLower.includes('ropa') || qLower.includes('processing') || qLower.includes('activity') || qLower.includes('activities') || qLower.includes('record')) {
            if (activities.length === 0) {
              insights.push(`⚠️ **ROPA Config**: You asked about processing activities, but have 0 active Processing Activities registered in your Privaro account. Article 30 requires keeping a ROPA if you have >250 employees or process high-risk data.`);
            }
          }
          if (qLower.includes('vendor') || qLower.includes('processor') || qLower.includes('third party') || qLower.includes('dpa')) {
            if (vendorCount === 0) {
              insights.push(`⚠️ **Vendor Config**: You asked about vendors, but have 0 vendors configured in your settings. Ensure you register all processors and sign required Article 28 DPAs.`);
            }
          }
        }

        // Format Copilot Insights Card
        let insightBlock = `\n\n---\n### Copilot Insights\n- **Confidence**: **${confidence}** — *${confidenceDescription}*`;
        if (insights.length > 0) {
          insightBlock += `\n- **Organization Cross-Reference**:\n  ` + insights.join('\n  ');
        }

        return { answer: processedAnswer + insightBlock };
      } catch (err: any) {
        // Fallback for missing API keys in local development
        console.warn('Anthropic API error:', err);
        
        let processedFallback = `This is a mock response because the Anthropic API failed or is not configured.`;
        if (!hasGroundedContext) {
          processedFallback = `Disclaimer: No direct matching sources were found in the database. The following is general compliance guidance based on standard data protection knowledge.\n\n` + processedFallback;
        } else {
          processedFallback += `\n\nContext matched from:`;
          citationsList.forEach((cit) => {
            processedFallback += `\n- [${cit.title}](${cit.url || '#'})`;
          });
        }
        return { 
          answer: processedFallback 
        };
      }
    }),

  analyzeDpa: protectedProcedure
    .input(z.object({
      fileBase64: z.string(),
      orgVendorId: z.string().uuid().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.user!.orgId;
      
      const org = await ctx.db.query.organizations.findFirst({
        where: eq(organizations.id, orgId)
      });
      if (!org) throw new TRPCError({ code: 'NOT_FOUND' });
      
      let limit = 5;
      if (org.subscriptionTier === 'agency') limit = 20;
      
      if ((org.aiDpasAnalyzed || 0) >= limit) {
        throw new TRPCError({ 
          code: 'TOO_MANY_REQUESTS', 
          message: `Monthly DPA analysis limit reached (${limit}/${limit}). Please upgrade your plan.`
        });
      }
 
      await ctx.db.update(organizations)
        .set({ aiDpasAnalyzed: (org.aiDpasAnalyzed || 0) + 1 })
        .where(eq(organizations.id, orgId));
 
      try {
        const buffer = Buffer.from(input.fileBase64, 'base64');
        const parser = new PDFParse({ data: buffer });
        const pdfData = await parser.getText();
        const dpaText = pdfData.text || '';
        await parser.destroy().catch(() => {});
 
        const systemPrompt = `You are a GDPR expert AI. Analyze the provided Data Processing Agreement (DPA) against Article 28 requirements.
 
Return a structured JSON analysis. Do NOT return markdown formatting around the JSON, just the raw JSON object.
Ensure that every excerpt you pull is an EXACT substring match from the provided document. Do NOT paraphrase or alter the wording of the excerpt.
 
Use this EXACT JSON schema:
{
  "overall_score": number, // 0 to 100
  "potential_special_category": boolean, // check for contextual clues (e.g. food allergies, biometrics)
  "special_category_rationale": string | null, // explain rationale if potential_special_category is true
  "checklist": {
    "documentedInstructions": {
      "status": "present" | "missing" | "weak",
      "excerpt": string | null, // MUST be an exact substring from the text
      "notes": string | null
    },
    "confidentiality": {
      "status": "present" | "missing" | "weak",
      "excerpt": string | null, // MUST be an exact substring from the text
      "notes": string | null
    },
    "securityMeasures": {
      "status": "present" | "missing" | "weak",
      "excerpt": string | null, // MUST be an exact substring from the text
      "notes": string | null
    },
    "subProcessorRestrictions": {
      "status": "present" | "missing" | "weak",
      "excerpt": string | null, // MUST be an exact substring from the text
      "notes": string | null
    },
    "dataSubjectRights": {
      "status": "present" | "missing" | "weak",
      "excerpt": string | null, // MUST be an exact substring from the text
      "notes": string | null
    },
    "securityBreachDpia": {
      "status": "present" | "missing" | "weak",
      "excerpt": string | null, // MUST be an exact substring from the text
      "notes": string | null
    },
    "deletionOnTermination": {
      "status": "present" | "missing" | "weak",
      "excerpt": string | null, // MUST be an exact substring from the text
      "notes": string | null
    },
    "auditRights": {
      "status": "present" | "missing" | "weak",
      "excerpt": string | null, // MUST be an exact substring from the text
      "notes": string | null
    }
  },
  "problematic_language": [
    {
      "clauseType": "sub_processors" | "indemnification" | "liability_cap" | "other",
      "severity": "high" | "medium",
      "excerpt": string, // MUST be an exact substring from the text
      "notes": string // explain why it is problematic (e.g. broad indemnification, unilateral subprocessor rights)
    }
  ]
}`;
 
        const msg = await anthropic.messages.create({
          model: 'claude-3-5-sonnet-20240620',
          max_tokens: 4096,
          system: systemPrompt,
          messages: [
            { role: 'user', content: dpaText }
          ]
        });
 
        const responseText = msg.content.filter((block: any) => block.type === 'text').map((block: any) => block.text).join('\n');
        
        let jsonResponse;
        try {
          const cleanedText = responseText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
          jsonResponse = JSON.parse(cleanedText);
        } catch (e) {
          throw new Error('Failed to parse AI response as JSON');
        }
 
        if (input.orgVendorId) {
          await ctx.db.update(organizationVendors)
            .set({
              dpaAiAnalysis: jsonResponse,
              dpaAnalysisStatus: 'pending_review'
            })
            .where(eq(organizationVendors.id, input.orgVendorId));
        }
 
        return jsonResponse;
      } catch (err: any) {
        console.error('DPA Analysis Error:', err);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: err.message || 'Failed to analyze DPA',
        });
      }
    }),
 
  generateVendorQuestionnaire: protectedProcedure
    .input(z.object({
      orgVendorId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.user!.orgId;
 
      // Query the organization vendor details
      const orgVendorDetails = await ctx.db.select({
        orgVendor: organizationVendors,
        vendor: vendors
      })
      .from(organizationVendors)
      .leftJoin(vendors, eq(organizationVendors.vendorId, vendors.id))
      .where(and(
        eq(organizationVendors.id, input.orgVendorId),
        eq(organizationVendors.organizationId, orgId)
      ));
 
      const record = orgVendorDetails[0];
      if (!record) throw new TRPCError({ code: 'NOT_FOUND', message: 'Vendor link not found' });
 
      const { orgVendor, vendor } = record;
 
      const headquarters = vendor?.headquartersCountry || 'unknown';
      const sharedCategories = (orgVendor.dataCategoriesShared as string[]) || [];
      const certs = (orgVendor.certifications as string[]) || [];
      const dpaClauseCoverage = (orgVendor.dpaClauseCoverage as Record<string, boolean>) || {};
 
      const systemPrompt = `You are a vendor risk assessment expert. Based on the provided vendor profile, you need to generate a tailored security and privacy questionnaire (10-15 questions).
Focus on specific risks:
- If the vendor is in a non-adequate country (e.g. US) and does not host in the EU: ask about international transfer safeguards (FISA Section 702, EO 14086, encryption key location, government surveillance requests).
- If the vendor processes sensitive/special category data: ask about access controls, data minimization, and audit logs.
- If the vendor holds security certifications (e.g. SOC 2, ISO 27001): do NOT ask general questions like "do you have SOC 2?", instead ask about the audit scope, exception reporting, and evidence of controls.
- Check which Article 28 DPA clauses are already covered. If some are missing/weak (e.g. audit rights), ask for contractual assurances or clarification.
 
Return a JSON array of questions. Do NOT return markdown formatting around the JSON, just the raw JSON object.
Use this EXACT JSON schema:
[
  {
    "id": "string", // unique slug, e.g. "fisa_702_safeguards"
    "text": "string", // the question text to be answered by the vendor
    "category": "string", // e.g. "Security", "Privacy", "International Transfers", "Access Control"
    "rationale": "string" // why this question is asked based on their profile
  }
]`;
 
      const contextText = `Vendor: ${vendor?.name || 'Unknown'}
Headquarters Country: ${headquarters}
Data Categories Shared: ${sharedCategories.join(', ') || 'none specified'}
Security Certifications: ${certs.join(', ') || 'none specified'}
Existing DPA Clause Coverage: ${JSON.stringify(dpaClauseCoverage)}`;
 
      const msg = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20240620',
        max_tokens: 4096,
        system: systemPrompt,
        messages: [
          { role: 'user', content: contextText }
        ]
      });
 
      const responseText = msg.content.filter((block: any) => block.type === 'text').map((block: any) => block.text).join('\n');
      
      try {
        const cleanedText = responseText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        return JSON.parse(cleanedText);
      } catch (e) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to generate questionnaire JSON',
        });
      }
    }),
 
  parseVendorAnswers: publicProcedure
    .input(z.object({
      token: z.string().uuid().optional(),
      questionnaireId: z.string().uuid().optional(),
      rawAnswersText: z.string().optional(),
      fileBase64: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      let questionnaire;
      
      if (input.token) {
        const [q] = await ctx.db.select()
          .from(vendorQuestionnaires)
          .where(eq(vendorQuestionnaires.token, input.token));
        questionnaire = q;
      } else if (input.questionnaireId && ctx.user?.orgId) {
        const [q] = await ctx.db.select()
          .from(vendorQuestionnaires)
          .where(and(
            eq(vendorQuestionnaires.id, input.questionnaireId),
            eq(vendorQuestionnaires.organizationId, ctx.user.orgId)
          ));
        questionnaire = q;
      }
 
      if (!questionnaire) throw new TRPCError({ code: 'NOT_FOUND', message: 'Questionnaire not found' });
 
      let answersText = input.rawAnswersText || '';
 
      if (input.fileBase64) {
        try {
          const buffer = Buffer.from(input.fileBase64, 'base64');
          const parser = new PDFParse({ data: buffer });
          const pdfData = await parser.getText();
          answersText += '\n' + (pdfData.text || '');
          await parser.destroy().catch(() => {});
        } catch (e: any) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: `Failed to parse PDF answers: ${e.message}` });
        }
      }
 
      if (!answersText.trim()) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No answers text or PDF provided' });
      }
 
      const systemPrompt = `You are a vendor risk assessment expert. Evaluate the provided questionnaire answers against security and privacy best practices under the GDPR.
For each question, evaluate:
- The score (0 to 100).
- The status ("satisfactory" | "weak" | "unsatisfactory").
- Analysis / explanation of their answer.
- Confidence ("high" | "insufficient_detail"). If the response is vague, evasive, or lacks concrete detail/evidence, set confidence to "insufficient_detail".
- Gaps identified: string explaining the exact gap, or null.
 
Also calculate:
- The overall AI score (0 to 100).
- The overall risk score modifier (must be an integer from -10 to 25):
  - Excellent practices / verified safeguards: -10 points.
  - Standard compliance / moderate risks: 0 points.
  - Severe gaps / missing key information / refusal to answer: up to +25 points.
- Tier 2 Special Category Check: Scan for contextual possibilities of processing special category data (e.g., medical terms, health data, racial/ethnic terms, political, religious). If detected, set "potential_special_category" to true with a "special_category_rationale".
 
Return a structured JSON object. Do NOT return markdown formatting, just the raw JSON object.
Use this EXACT JSON schema:
{
  "aiScore": number,
  "scoreModifier": number, // between -10 and 25
  "potential_special_category": boolean,
  "special_category_rationale": string | null,
  "answersReview": [
    {
      "questionId": "string",
      "score": number,
      "status": "satisfactory" | "weak" | "unsatisfactory",
      "analysis": "string",
      "confidence": "high" | "insufficient_detail",
      "gapIdentified": "string" | null
    }
  ]
}`;
 
      const contextText = `Questions generated:
${JSON.stringify(questionnaire.questions)}
 
Provided answers / document text:
${answersText}`;
 
      const msg = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20240620',
        max_tokens: 4096,
        system: systemPrompt,
        messages: [
          { role: 'user', content: contextText }
        ]
      });
 
      const responseText = msg.content.filter((block: any) => block.type === 'text').map((block: any) => block.text).join('\n');
      
      try {
        const cleanedText = responseText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        const jsonResponse = JSON.parse(cleanedText);
 
        // Save raw parsed data into draft state
        await ctx.db.update(vendorQuestionnaires)
          .set({
            aiScore: jsonResponse.aiScore,
            aiAnalysis: jsonResponse.answersReview,
            scoreModifier: jsonResponse.scoreModifier,
            status: 'submitted',
            isAiAssisted: true,
            updatedAt: new Date()
          })
          .where(eq(vendorQuestionnaires.id, questionnaire.id));
 
        return jsonResponse;
      } catch (e) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to evaluate answers JSON',
        });
      }
    }),

  getContextualSuggestions: protectedProcedure
    .input(z.object({
      module: z.enum(['ropa', 'vendors', 'breaches', 'dsar', 'consent', 'compliance_scoring']),
      entityId: z.string().uuid().optional(),
      formData: z.any().optional(),
      locale: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.user!.orgId;
      const { module, entityId, formData, locale } = input;

      const payloadString = JSON.stringify({ module, entityId, formData, locale });
      const cacheKey = crypto.createHash('sha256').update(payloadString).digest('hex');

      // 1. Check database cache (aiGuidanceLogs with query = cacheKey) within 24 hours
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const cachedLog = await ctx.db.query.aiGuidanceLogs.findFirst({
        where: and(
          eq(aiGuidanceLogs.organizationId, orgId),
          eq(aiGuidanceLogs.module, module),
          eq(aiGuidanceLogs.query, cacheKey),
          sql`created_at >= ${oneDayAgo}`
        )
      });

      if (cachedLog) {
        try {
          return {
            logId: cachedLog.id,
            suggestions: JSON.parse(cachedLog.response),
            confidence: cachedLog.confidence,
            sources: cachedLog.sources || [],
            cached: true,
          };
        } catch (e) {
          // If parse fails, ignore and regenerate
        }
      }

      // 2. Compile RAG query and fetch entity data from DB
      let RAGQuery = '';
      let contextDataString = '';
      let entityName = '';

      if (module === 'ropa') {
        RAGQuery = 'GDPR Article 6 lawful basis data categories retention storage limitation Article 30 ROPA EDPB guidelines';
        const ropaInput = formData || (entityId ? await ctx.db.query.processingActivities.findFirst({ where: eq(processingActivities.id, entityId) }) : null);
        if (ropaInput) {
          entityName = ropaInput.name || 'New Activity';
          contextDataString = `Processing Activity: "${ropaInput.name || 'Unnamed'}"
Purpose: "${ropaInput.purpose || ''}"
Description: "${ropaInput.description || ''}"
Selected Tools: ${ropaInput.selectedTools ? ropaInput.selectedTools.join(', ') : 'None'}`;
        }
      } else if (module === 'vendors') {
        RAGQuery = 'GDPR third country transfers Standard Contractual Clauses SCCs Article 28 DPA adequacy decision Chapter V';
        const vData = formData || {};
        let vendorObj = null;
        if (entityId) {
          const vendorRecord = await ctx.db.query.vendors.findFirst({ where: eq(vendors.id, entityId) });
          const orgVendorRecord = await ctx.db.query.organizationVendors.findFirst({
            where: and(eq(organizationVendors.vendorId, entityId), eq(organizationVendors.organizationId, orgId))
          });
          if (vendorRecord) {
            vendorObj = { vendor: vendorRecord, orgVendor: orgVendorRecord };
          }
        }
        
        const finalVendor = vendorObj?.vendor || vData;
        const finalOrgVendor = vendorObj?.orgVendor || vData;
        const riskVal = calculateVendorRisk(finalVendor, finalOrgVendor);

        entityName = finalVendor.name || 'New Vendor';
        contextDataString = `Vendor: "${finalVendor.name || 'Unnamed'}"
Headquarters Country: "${finalVendor.headquartersCountry || 'Unknown'}"
EU Hosting Available: ${finalVendor.euHostingAvailable ? 'Yes' : 'No'}
Security Certifications: ${(finalVendor.securityCertifications || []).join(', ')}
Transfer Mechanisms: ${(finalVendor.transferMechanisms || []).join(', ')}
DPA Status: ${finalOrgVendor.dpaStatus || 'not_signed'}
Calculated Risk: Score ${riskVal.score}/100, Level: ${riskVal.level}`;
      } else if (module === 'breaches') {
        RAGQuery = 'EDPB guidelines personal data breach notification Article 33 Article 34 risk assessment';
        const breachInput = formData || (entityId ? await ctx.db.query.breaches.findFirst({ where: eq(breaches.id, entityId) }) : null);
        if (breachInput) {
          entityName = breachInput.title || 'New Breach';
          contextDataString = `Breach Title: "${breachInput.title || 'Unnamed'}"
Description: "${breachInput.description || ''}"
Discovered At: ${breachInput.discoveredAt || ''}
Affected Data Categories: ${(breachInput.dataCategoriesAffected || []).join(', ')}
Estimated Records: ${breachInput.estimatedRecordsAffected || 'unknown'}`;
        }
      } else if (module === 'dsar') {
        RAGQuery = 'GDPR Article 12 Article 15 DSAR right of access erasure rectification portability objections exemptions legal privilege';
        const dsarInput = formData || (entityId ? await ctx.db.query.dsarRequests.findFirst({ where: eq(dsarRequests.id, entityId) }) : null);
        if (dsarInput) {
          entityName = dsarInput.referenceNumber || 'New DSAR';
          contextDataString = `DSAR Reference: "${dsarInput.referenceNumber || 'Unnamed'}"
Request Type: "${dsarInput.requestType || ''}"
Original Message: "${dsarInput.originalMessage || ''}"
Received At: ${dsarInput.receivedAt || ''}`;
        }
      } else if (module === 'consent') {
        RAGQuery = 'CJEU Planet49 cookie consent prior consent active consent EDPB guidelines 05/2020 2/2019 cookie wall';
        const consentInput = formData || (entityId ? await ctx.db.query.consentDomains.findFirst({ where: eq(consentDomains.id, entityId) }) : null);
        let cookiesList: any[] = [];
        if (entityId) {
          cookiesList = await ctx.db.select().from(consentCookies).where(eq(consentCookies.domainId, entityId));
        } else if (formData?.cookies) {
          cookiesList = formData.cookies;
        }

        if (consentInput) {
          entityName = consentInput.domain || 'New Domain';
          const cookiesStr = cookiesList.map((c: any) => `- Name: ${c.cookieName}, Domain: ${c.cookieDomain || ''}, Category: ${c.category}, Provider: ${c.provider || ''}`).join('\n');
          contextDataString = `Domain: "${consentInput.domain || 'Unnamed'}"
Cookies Discovered:\n${cookiesStr || 'None'}`;
        }
      } else if (module === 'compliance_scoring') {
        const gapRecord = entityId ? await ctx.db.query.complianceGaps.findFirst({ where: eq(complianceGaps.id, entityId) }) : null;
        if (gapRecord) {
          entityName = gapRecord.title;
          const arts = (gapRecord.gdprArticles || []) as any[];
          if (gapRecord.source === 'dpia' && gapRecord.dpiaId) {
            const dpiaRecord = await ctx.db.query.dpias.findFirst({ where: eq(dpias.id, gapRecord.dpiaId) });
            const dpiaTitleStr = dpiaRecord ? dpiaRecord.title : 'DPIA';
            RAGQuery = `GDPR Article 35 DPIA risk mitigation EDPB guidelines wp248rev.01 compliance gap GDPR Article ${arts.join(', ')}`;
            contextDataString = `Compliance Gap Title: "${gapRecord.title}"
Description: "${gapRecord.description || ''}"
Severity: "${gapRecord.severity}"
Source: DPIA
DPIA Title: "${dpiaTitleStr}"
DPIA Risk ID: "${gapRecord.dpiaRiskId || ''}"
GDPR Articles referenced: ${arts.join(', ')}

Please provide a contextual explanation referring specifically to the DPIA titled "${dpiaTitleStr}" and suggestions citing the EDPB DPIA guidelines (wp248rev.01) for concrete mitigation options.`;
          } else {
            RAGQuery = `GDPR compliance gap enforcement administrative fines GDPR Article ${arts.join(', ')} EDPB guidelines`;
            contextDataString = `Compliance Gap Title: "${gapRecord.title}"
Description: "${gapRecord.description || ''}"
Severity: "${gapRecord.severity}"
GDPR Articles referenced: ${arts.join(', ')}`;
          }
        } else {
          RAGQuery = 'GDPR compliance gaps Article 5 Article 24 Article 32 administrative fines';
          contextDataString = `Compliance Gaps analysis.`;
        }
      }

      // 3. Retrieve Context via pgvector RAG
      const retrieved = await retrieveContext(ctx, RAGQuery, orgId, locale);

      let contextStr = `\nReference materials:\n`;
      const citationsList: { title: string; url: string }[] = [];
      let citationIndex = 1;

      retrieved.forEach((c) => {
        const sourceName = c.section || c.title;
        const sourceUrl = c.sourceUrl || '';
        contextStr += `--- Source ${citationIndex}: ${c.title} (${c.source}) ---\nSection: ${sourceName}\n${c.content}\n---\n\n`;
        citationsList.push({ title: sourceName, url: sourceUrl });
        citationIndex++;
      });

      // 4. Construct Prompt
      let moduleSpecificPrompt = '';
      if (module === 'ropa') {
        moduleSpecificPrompt = `Generate suggestions for this processing activity:
${contextDataString}

You MUST return a JSON object matching this schema:
{
  "lawfulBasis": "consent" | "contract" | "legal_obligation" | "vital_interests" | "public_task" | "legitimate_interest",
  "lawfulBasisNotes": "Reasoning for the lawful basis under Article 6, citing specific guidelines or recitals.",
  "dataCategories": ["Category 1", "Category 2"],
  "dataCategoriesReasoning": "Why these categories are necessary for the processing.",
  "retentionPeriod": "6_months" | "1_year" | "3_years" | "5_years" | "duration_of_contract" | "indefinite" | "custom",
  "retentionJustification": "Reasoning for the retention period based on storage limitation (Article 5(1)(e)) and EDPB guidance.",
  "recipients": ["Recipient 1"],
  "transfers": "Details about third country transfers, standard contractual clauses, or adequacy decisions for tools.",
  "warnings": ["Warning about missing data, high risk, or compliance gaps."]
}`;
      } else if (module === 'vendors') {
        moduleSpecificPrompt = `Generate compliance transfer guidance and risk explanation for this vendor:
${contextDataString}

You MUST return a JSON object matching this schema:
{
  "transferGuidance": "Guidance regarding third-country transfers under Chapter V (e.g. if US-based, mention Standard Contractual Clauses or adequacy decision).",
  "riskExplanation": "A narrative explanation of the risk score (e.g. 'This vendor scored 72/100 risk because: no DPA signed (Article 28 violation), US-based with no SCCs (Chapter V), processes special category health data (Article 9)'). Highlight specific missing certifications or DPA issues.",
  "complianceChecklist": ["Action item 1", "Action item 2"]
}`;
      } else if (module === 'breaches') {
        moduleSpecificPrompt = `Analyze this personal data breach and suggest actions:
${contextDataString}

You MUST return a JSON object matching this schema:
{
  "guidelines": "Summary of relevant EDPB breach notification guidelines (Guidelines 9/2022).",
  "supervisoryAuthorityDecision": "Analysis of notification requirements for the SA under Article 33. State clearly if required or not, with reasons.",
  "dataSubjectsDecision": "Analysis of notification requirements for data subjects under Article 34. State clearly if required or not, with reasons.",
  "notificationTemplate": "Draft notification email/text template to send to the Supervisory Authority (e.g. CNIL, DPC).",
  "individualTemplate": "Draft notification email/text template to send to affected data subjects."
}`;
      } else if (module === 'dsar') {
        moduleSpecificPrompt = `Analyze this Data Subject Access Request (DSAR) and suggest actions:
${contextDataString}

You MUST return a JSON object matching this schema:
{
  "rightType": "Identification of the specific right being exercised (e.g. Right of Access (Article 15), Right to Erasure (Article 17)).",
  "deadlineGuidance": "Explanation of the deadline (e.g. 1 month from received date, extendable to 3 months for complex requests).",
  "suggestedData": ["Database systems to search/action", "Specific data packages to compile"],
  "exemptions": ["List of potential exemptions like rights of others (Article 15(4)), legal privilege, manifestly unfounded or excessive requests."],
  "draftResponse": "A formal draft response template acknowledging or responding to the request."
}`;
      } else if (module === 'consent') {
        moduleSpecificPrompt = `Analyze these cookies scanned and suggest consent manager configuration:
${contextDataString}

You MUST return a JSON object matching this schema:
{
  "cookieAnalysis": "A summary warning if non-necessary trackers (e.g. Google Analytics _ga, Facebook Pixel _fbp) are found, explaining compliance requirements under CJEU Planet49 and EDPB Guidelines 2/2019 (e.g. 'We found Google Analytics cookies. Under the CJEU Planet49 ruling and EDPB Guidelines 2/2019, these require prior consent. They should be classified as 'Analytics' and blocked until consent is given.').",
  "actionSteps": ["Actions to classify cookies", "Actions to configure the CMP banner to block scripts until consent"]
}`;
      } else if (module === 'compliance_scoring') {
        moduleSpecificPrompt = `Analyze this compliance gap and suggest remediation:
${contextDataString}

You MUST return a JSON object matching this schema:
{
  "violationExplanation": "Which article/guideline is being violated, explaining the violation details.",
  "riskLevelEnforcement": "Explanation of the risk level (critical/high/medium/low) based on enforcement precedent (cite relevant DPA decisions/fines if applicable).",
  "remediationSteps": ["Step 1", "Step 2"],
  "remediationLink": "Relative workspace link to fix the gap (e.g. '/ropa' for ROPA gaps, '/vendors' for vendor DPA/transfer gaps, '/consent' for cookie banner settings, '/dsar' for DSAR queue)."
}`;
      }

      const targetLanguageName = locale === 'de' ? 'German' : locale === 'fr' ? 'French' : 'English';
      const systemPrompt = `You are a GDPR compliance expert assistant for an organization.
Analyze the provided context data and suggest structured compliance recommendations.
Always ground your answers in the reference materials provided. Do not speculate or make up information.
You must return a raw JSON object matching the exact schema specified for the requested module.
Do not wrap the JSON in markdown code blocks or add any other text.

CRITICAL LANGUAGE REQUIREMENT: You MUST translate all string values in the returned JSON object to ${targetLanguageName} (matching the requested locale '${locale || 'en'}'). Keep the JSON keys exactly in English as specified in the schema, but translate all content values and narrative explanations to ${targetLanguageName}.

Reference materials:
${contextStr}
`;

      try {
        const msg = await anthropic.messages.create({
          model: 'claude-3-5-sonnet-20240620',
          max_tokens: 2048,
          system: systemPrompt,
          messages: [
            { role: 'user', content: moduleSpecificPrompt }
          ]
        });

        const responseText = msg.content.filter((block: any) => block.type === 'text').map((block: any) => block.text).join('\n');
        
        let jsonResponse: any;
        try {
          const cleanedText = responseText.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();
          jsonResponse = JSON.parse(cleanedText);
        } catch (e) {
          throw new Error('Failed to parse AI response as JSON: ' + responseText);
        }

        // Post-processing additions
        if (module === 'ropa') {
          const ropaInput = formData || {};
          if (!ropaInput.retentionPeriod && (!jsonResponse.warnings || !jsonResponse.warnings.includes("This activity is missing a retention period. Under Article 5(1)(e), you need to specify storage limitations."))) {
            jsonResponse.warnings = jsonResponse.warnings || [];
            jsonResponse.warnings.unshift("This activity is missing a retention period. Under Article 5(1)(e), you need to specify storage limitations.");
          }
        }

        if (module === 'compliance_scoring') {
          const gapRecord = entityId ? await ctx.db.query.complianceGaps.findFirst({ where: eq(complianceGaps.id, entityId) }) : null;
          if (gapRecord && gapRecord.source === 'dpia') {
            const actId = gapRecord.entityId;
            if (actId) {
              jsonResponse.remediationLink = `/ropa/${actId}?tab=dpia#risk-${gapRecord.dpiaRiskId || ''}`;
            }
          }
        }

        // Calculate confidence level
        let highestAuthority = 'general';
        retrieved.forEach(c => {
          if (c.similarity > 0.6) {
            if (c.authority === 'eu' || c.authority === 'edpb') {
              if (highestAuthority !== 'eu' && highestAuthority !== 'edpb') {
                highestAuthority = 'eu';
              }
            } else if (c.authority === 'cjeu' || c.authority === 'ico' || c.authority === 'cnil' || c.authority === 'bfdi' || c.authority === 'dpc' || c.authority === 'ap' || c.authority === 'aepd') {
              if (highestAuthority !== 'eu' && highestAuthority !== 'edpb') {
                highestAuthority = 'national';
              }
            }
          }
        });

        let confidence = 'advisory';
        if (highestAuthority === 'eu') {
          confidence = 'high';
        } else if (highestAuthority === 'national') {
          confidence = 'medium';
        }

        const topSim = retrieved.length > 0 ? Math.max(...retrieved.map(r => r.similarity)) : 0;

        // Save to guidance logs table
        const [insertedLog] = await ctx.db.insert(aiGuidanceLogs).values({
          organizationId: orgId,
          userId: ctx.user!.id,
          module,
          entityId: entityId || null,
          query: cacheKey,
          response: JSON.stringify(jsonResponse),
          sources: citationsList,
          confidence,
          topSimilarity: topSim,
        }).returning();

        return {
          logId: insertedLog.id,
          suggestions: jsonResponse,
          confidence,
          sources: citationsList,
          cached: false,
        };
      } catch (err: any) {
        console.error('Contextual suggestions error:', err);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: err.message || 'Failed to generate contextual suggestions',
        });
      }
    }),

  submitFeedback: protectedProcedure
    .input(z.object({
      logId: z.string().uuid(),
      feedback: z.enum(['helpful', 'not_helpful']),
    }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.user!.orgId;
      
      const [updatedLog] = await ctx.db.update(aiGuidanceLogs)
        .set({ 
          feedback: input.feedback,
          feedbackAt: new Date(),
        })
        .where(and(
          eq(aiGuidanceLogs.id, input.logId),
          eq(aiGuidanceLogs.organizationId, orgId)
        ))
        .returning();

      if (!updatedLog) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Guidance log not found or access denied',
          });
        }

      return { success: true };
    }),

  getCorpusStats: protectedProcedure
    .query(async ({ ctx }) => {
      const docsResult = await ctx.db.execute(sql`
        SELECT COUNT(DISTINCT document_id) as count FROM document_embeddings
      `);
      const chunksResult = await ctx.db.execute(sql`
        SELECT COUNT(*) as count FROM document_embeddings
      `);
      const authsResult = await ctx.db.execute(sql`
        SELECT 
          authority, 
          COUNT(*) as count, 
          MAX(updated_at) as last_updated 
        FROM document_embeddings 
        GROUP BY authority
      `);
      const currentResult = await ctx.db.execute(sql`
        SELECT is_current, COUNT(*) as count FROM document_embeddings GROUP BY is_current
      `);

      return {
        totalDocuments: Number(docsResult.rows?.[0]?.count || 0),
        totalChunks: Number(chunksResult.rows?.[0]?.count || 0),
        authorities: (authsResult.rows || []).map((row: any) => ({
          authority: row.authority,
          count: Number(row.count),
          lastUpdated: row.last_updated,
        })),
        versions: (currentResult.rows || []).map((row: any) => ({
          isCurrent: Boolean(row.is_current),
          count: Number(row.count),
        })),
      };
    }),

  getQualityMetrics: protectedProcedure
    .query(async ({ ctx }) => {
      const orgId = ctx.user!.orgId;
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const feedbackResult = await ctx.db.execute(sql`
        SELECT feedback, COUNT(*) as count 
        FROM ai_guidance_logs 
        WHERE feedback IS NOT NULL 
          AND organization_id = ${orgId}
        GROUP BY feedback
      `);

      const similarityStats = await ctx.db.execute(sql`
        SELECT 
          COUNT(*) as total_queries,
          COALESCE(AVG(top_similarity), 0) as avg_similarity,
          SUM(CASE WHEN top_similarity < 0.7 THEN 1 ELSE 0 END) as low_similarity_count
        FROM ai_guidance_logs
        WHERE created_at >= ${sevenDaysAgo}
          AND organization_id = ${orgId}
      `);

      const categoriesResult = await ctx.db.execute(sql`
        SELECT module, COUNT(*) as count 
        FROM ai_guidance_logs 
        WHERE organization_id = ${orgId}
        GROUP BY module 
        ORDER BY count DESC 
        LIMIT 5
      `);

      const simRow = similarityStats.rows?.[0] || {};
      const total = Number(simRow.total_queries || 0);
      const lowCount = Number(simRow.low_similarity_count || 0);
      const lowSimilarityPercentage = total > 0 ? (lowCount / total) * 100 : 0;
      const triggerAlert = lowSimilarityPercentage > 20;

      return {
        feedback: (feedbackResult.rows || []).reduce((acc: any, row: any) => {
          acc[row.feedback] = Number(row.count);
          return acc;
        }, { helpful: 0, not_helpful: 0 }),
        totalQueriesLast7Days: total,
        averageSimilarity: Number(simRow.avg_similarity || 0),
        lowSimilarityCount: lowCount,
        lowSimilarityPercentage,
        triggerAlert,
        categories: (categoriesResult.rows || []).map((row: any) => ({
          module: row.module,
          count: Number(row.count),
        })),
      };
    }),

  listDocuments: protectedProcedure
    .input(z.object({
      query: z.string().optional(),
      authority: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const results = await ctx.db.execute(sql`
        SELECT 
          document_id as "documentId",
          MAX(title) as title,
          MAX(authority) as authority,
          MAX(language) as language,
          BOOL_AND(is_current) as "isCurrent",
          MAX(superseded_by) as "supersededBy",
          COUNT(*) as "chunkCount"
        FROM document_embeddings
        WHERE 1=1
        ${input.query ? sql`AND title ILIKE ${'%' + input.query + '%'}` : sql``}
        ${input.authority ? sql`AND authority = ${input.authority}` : sql``}
        GROUP BY document_id
        ORDER BY title ASC
        LIMIT 100
      `);
      return (results.rows || []).map((row: any) => ({
        documentId: row.documentId,
        title: row.title,
        authority: row.authority,
        language: row.language,
        isCurrent: Boolean(row.isCurrent),
        supersededBy: row.supersededBy,
        chunkCount: Number(row.chunkCount),
      }));
    }),

  overrideSupersededStatus: protectedProcedure
    .input(z.object({
      documentId: z.string(),
      isCurrent: z.boolean(),
      supersededBy: z.string().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.execute(sql`
        UPDATE document_embeddings
        SET is_current = ${input.isCurrent},
            superseded_by = ${input.supersededBy || null}
        WHERE document_id = ${input.documentId}
      `);
      return { success: true };
    }),

  getAssessmentCostMetrics: protectedProcedure
    .input(z.object({
      startDate: z.date().optional(),
      endDate: z.date().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      // In a real implementation, we would use the actual cost per token.
      // E.g. Claude 3 Haiku: $0.25 / 1M input, $1.25 / 1M output
      const CLAUDE_INPUT_COST_PER_M = parseFloat(process.env.CLAUDE_INPUT_COST_PER_M || '0.25');
      const CLAUDE_OUTPUT_COST_PER_M = parseFloat(process.env.CLAUDE_OUTPUT_COST_PER_M || '1.25');

      const conditions = [];
      if (input?.startDate) conditions.push(sql`assessed_at >= ${input.startDate}`);
      if (input?.endDate) conditions.push(sql`assessed_at <= ${input.endDate}`);
      // Filter by org if they are not an admin/superadmin, otherwise they can see their own
      if (ctx.user?.role !== 'admin' && ctx.user?.role !== 'superadmin' && ctx.user?.orgId) {
         conditions.push(sql`organization_id = ${ctx.user.orgId}`);
      }

      const whereClause = conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)} AND prompt_tokens IS NOT NULL` : sql`WHERE prompt_tokens IS NOT NULL`;

      const result = await ctx.db.execute(sql`
        SELECT 
          SUM(prompt_tokens) as total_prompt_tokens,
          SUM(completion_tokens) as total_completion_tokens,
          COUNT(*) as total_assessments
        FROM regulatory_update_matches
        ${whereClause}
      `);

      const row = result.rows[0] as any;
      const totalPromptTokens = Number(row?.total_prompt_tokens || 0);
      const totalCompletionTokens = Number(row?.total_completion_tokens || 0);
      const totalAssessments = Number(row?.total_assessments || 0);

      const promptCost = (totalPromptTokens / 1_000_000) * CLAUDE_INPUT_COST_PER_M;
      const completionCost = (totalCompletionTokens / 1_000_000) * CLAUDE_OUTPUT_COST_PER_M;

      return {
        totalPromptTokens,
        totalCompletionTokens,
        totalAssessments,
        estimatedCostUsd: promptCost + completionCost,
        breakdown: {
          promptCost,
          completionCost
        }
      };
    }),
});
