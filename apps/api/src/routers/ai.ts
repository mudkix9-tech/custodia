import { router, protectedProcedure } from '../trpc.js';
import { z } from 'zod';
import { 
  processingActivities, 
  organizations 
} from 'db';
import { eq, and, sql } from 'drizzle-orm';
import OpenAI from 'openai';
import { Anthropic } from '@anthropic-ai/sdk';
import { TRPCError } from '@trpc/server';
// @ts-ignore
import * as pdfParseModule from 'pdf-parse';
const pdfParse = (pdfParseModule as any).default || pdfParseModule;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'dummy_key',
});

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || 'dummy_key',
});

async function generateEmbedding(text: string) {
  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'dummy_key') {
    return new Array(1536).fill(0).map(() => Math.random());
  }

  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
    encoding_format: 'float',
  });
  return response.data[0]?.embedding || [];
}

export const aiRouter = router({
  askCopilot: protectedProcedure
    .input(z.object({
      question: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.user!.orgId;
      
      // 1. Rate Limiting Check
      const org = await ctx.db.query.organizations.findFirst({
        where: eq(organizations.id, orgId)
      });
      
      if (!org) throw new TRPCError({ code: 'NOT_FOUND' });
      
      // Reset logic could be run via cron, or checked here
      let limit = 10;
      if (org.subscriptionTier === 'professional') limit = 50;
      if (org.subscriptionTier === 'agency') limit = 200;
      
      if ((org.aiQueriesUsed || 0) >= limit) {
        throw new TRPCError({ 
          code: 'TOO_MANY_REQUESTS', 
          message: `Daily AI limit reached (${limit}/${limit}). Please upgrade your plan.`
        });
      }
      
      await ctx.db.update(organizations)
        .set({ aiQueriesUsed: (org.aiQueriesUsed || 0) + 1 })
        .where(eq(organizations.id, orgId));

      // 2. Embed Question
      const questionEmbedding = await generateEmbedding(input.question);
      const embeddingArray = `[${questionEmbedding.join(',')}]`;

      // 3. Retrieve Global GDPR Context
      const gdprChunksResult = await ctx.db.execute(sql`
        SELECT content, source_reference, 
               1 - (embedding <=> ${embeddingArray}::vector) AS similarity
        FROM document_embeddings
        WHERE 1 - (embedding <=> ${embeddingArray}::vector) > 0.6
        ORDER BY similarity DESC
        LIMIT 5
      `);
      const gdprChunks = gdprChunksResult.rows || [];

      // 4. Retrieve Org-Specific Embeddings
      const orgChunksResult = await ctx.db.execute(sql`
        SELECT content, metadata,
               1 - (embedding <=> ${embeddingArray}::vector) AS similarity
        FROM organization_embeddings
        WHERE organization_id = ${orgId}
          AND 1 - (embedding <=> ${embeddingArray}::vector) > 0.6
        ORDER BY similarity DESC
        LIMIT 3
      `);
      const orgChunks = orgChunksResult.rows || [];

      // 5. Retrieve ROPA Context
      const activities = await ctx.db.query.processingActivities.findMany({
        where: and(
          eq(processingActivities.organizationId, orgId),
          eq(processingActivities.status, 'active'),
        ),
        with: { dataCategories: true, recipients: true },
      });

      // 6. Assemble LLM Prompt
      let systemPrompt = `You are Privaro Co-Pilot, an expert AI GDPR assistant.
Your goal is to answer questions strictly based on the provided GDPR regulations and the organization's specific context.
ALWAYS cite the relevant Article or EDPB Guideline when providing advice.
If the answer is not in the provided context, inform the user you do not have enough information, rather than hallucinating.
`;

      let contextStr = `\n--- GLOBAL GDPR CONTEXT ---\n`;
      if (gdprChunks.length > 0) {
        gdprChunks.forEach((c: any) => {
          contextStr += `[Source: ${c.source_reference}]: ${c.content}\n\n`;
        });
      } else {
        contextStr += `(No direct GDPR matches found for this query)\n\n`;
      }

      contextStr += `\n--- ORGANIZATION CONTEXT ---\n`;
      if (orgChunks.length > 0) {
        orgChunks.forEach((c: any) => {
          contextStr += `[Org Document]: ${c.content}\n\n`;
        });
      }

      if (activities.length > 0) {
        contextStr += `[Processing Activities]:\n`;
        activities.forEach((a: any) => {
          contextStr += `- ${a.name}: Lawful basis: ${a.lawfulBasis}. Categories: ${a.dataCategories.map((dc: any) => dc.category).join(', ')}.\n`;
        });
      }

      systemPrompt += contextStr;

      try {
        const msg = await anthropic.messages.create({
          model: 'claude-3-5-sonnet-20240620',
          max_tokens: 1024,
          system: systemPrompt,
          messages: [
            { role: 'user', content: input.question }
          ]
        });

        // The correct way to handle text blocks from Anthropic SDK
        const responseText = msg.content.filter((block: any) => block.type === 'text').map((block: any) => block.text).join('\n');
        
        return { answer: responseText };
      } catch (err: any) {
        // Fallback for missing API keys in local development
        console.warn('Anthropic API error:', err);
        return { 
          answer: `This is a mock response because the Anthropic API failed or is not configured.\n\nContext assembled from ${gdprChunks.length} GDPR chunks and ${activities.length} Processing Activities.` 
        };
      }
    }),

  analyzeDpa: protectedProcedure
    .input(z.object({
      fileBase64: z.string(),
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
        const pdfData = await pdfParse(buffer);
        const dpaText = pdfData.text;

        const systemPrompt = `You are a GDPR expert AI. Analyze the provided Data Processing Agreement (DPA) against Article 28 requirements.
Return a structured JSON analysis. Do NOT return markdown formatting around the JSON, just the raw JSON object.
Use this EXACT JSON schema:
{
  "overall_score": number, // 0 to 100
  "clauses": [
    {
      "id": "subject_matter" | "nature_purpose" | "data_types" | "data_subjects" | "instructions" | "confidentiality" | "security" | "sub_processors" | "data_subject_rights" | "breach_notification" | "deletion" | "audit_rights" | "international_transfers",
      "status": "present" | "missing" | "weak",
      "confidence": number, // 0.0 to 1.0
      "location": string | null, // section or paragraph
      "excerpt": string | null,
      "notes": string | null
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
          // Attempt to parse JSON, sometimes models wrap in \`\`\`json
          const cleanedText = responseText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
          jsonResponse = JSON.parse(cleanedText);
        } catch (e) {
          throw new Error('Failed to parse AI response as JSON');
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
});
