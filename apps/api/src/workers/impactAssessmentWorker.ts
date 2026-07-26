import { createWorker } from '../lib/queue.js';
import { Worker, Queue, Job } from 'bullmq';
import { db } from '../db.js';
import { regulatoryUpdateMatches, organizations, processingActivities, vendors, dpias, documentEmbeddings , createRedisClient } from 'db';
import { eq, and, sql } from 'drizzle-orm';
import { Anthropic } from '@anthropic-ai/sdk';
import { trackAiUsage } from '../lib/billing.js';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || 'dummy_key',
});

const connection = process.env.NODE_ENV === 'test'
  ? null as any
  : createRedisClient({
      maxRetriesPerRequest: null,
      retryStrategy: (times: number) => {
        if (times > 3) return null;
        return Math.min(times * 50, 2000);
      }
    });

if (connection && connection.on) {
  connection.on('error', (err: any) => {
    console.warn('[Redis] Connection error in impact assessment worker:', err.message);
  });
}

export const impactAssessmentQueue = process.env.NODE_ENV === 'test'
  ? null as any
  : new Queue('impact-assessment', { connection });

export const impactAssessmentWorker = createWorker('impact-assessment', async (job: Job) => {
  console.log(`[Impact Assessment Worker] Processing job ${job.name} (ID: ${job.id})`);

  if (job.name === 'impact-assessment-dispatcher') {
    const pendingMatches = await db.query.regulatoryUpdateMatches.findMany({
      where: eq(regulatoryUpdateMatches.status, 'pending_assessment'),
    });

    console.log(`[Impact Assessment Worker] Found ${pendingMatches.length} pending matches.`);

    for (const match of pendingMatches) {
      await impactAssessmentQueue.add('generate-assessment', { matchId: match.id });
    }
  } else if (job.name === 'match-org-semantic') {
    const { documentId, organizationId } = job.data;
    
    try {
      await db.execute(sql`
        INSERT INTO regulatory_update_matches (
          regulatory_update_id,
          organization_id,
          matched_entity_type,
          matched_entity_id,
          matched_chunk_id,
          similarity_score,
          status
        )
        SELECT DISTINCT ON (o.entity_type, o.entity_id)
          ${documentId}::uuid,
          ${organizationId}::uuid,
          o.entity_type,
          o.entity_id,
          d.id,
          (1 - (o.embedding <=> d.embedding)) as similarity_score,
          'pending_assessment'
        FROM document_embeddings d
        JOIN organization_embeddings o 
          ON o.organization_id = ${organizationId}::uuid
        WHERE d.document_id = ${documentId}
          AND (1 - (o.embedding <=> d.embedding)) >= 0.7
        ORDER BY o.entity_type, o.entity_id, (1 - (o.embedding <=> d.embedding)) DESC
      `);
      console.log(`[Impact Assessment Worker] Finished semantic matching for doc ${documentId} and org ${organizationId}`);
    } catch (err) {
      console.error(`[Impact Assessment Worker] Failed semantic matching for doc ${documentId} org ${organizationId}`, err);
      throw err; // Rely on BullMQ retry
    }
  } else if (job.name === 'match-catchup') {
    const { organizationId, lastLoginAt } = job.data;
    const sinceDate = new Date(lastLoginAt);
    
    // Find all regulatory updates published since the org's last login
    const missedUpdates = await db.execute(sql`
      SELECT DISTINCT d.document_id
      FROM document_embeddings d
      JOIN regulatory_updates r ON r.id = d.document_id::uuid
      WHERE r.published_at >= ${sinceDate.toISOString()}
    `);

    for (const row of missedUpdates.rows) {
      await impactAssessmentQueue.add('match-org-semantic', {
        documentId: row.document_id,
        organizationId
      });
    }
    console.log(`[Impact Assessment Worker] Catch-up queued ${missedUpdates.rowCount} semantic matches for org ${organizationId}`);
  } else if (job.name === 'generate-assessment') {
    const matchId = job.data.matchId;
    
    const match = await db.query.regulatoryUpdateMatches.findFirst({
      where: eq(regulatoryUpdateMatches.id, matchId),
    });

    if (!match || match.status !== 'pending_assessment') {
      return;
    }

    if (match.similarityScore < 0.7) {
      await db.update(regulatoryUpdateMatches)
        .set({ status: 'dismissed_low_relevance' })
        .where(eq(regulatoryUpdateMatches.id, matchId));
      return;
    }

    let entityContext = '';
    if (match.matchedEntityType === 'processing_activity') {
      const activity = await db.query.processingActivities.findFirst({
        where: eq(processingActivities.id, match.matchedEntityId),
      });
      if (activity) {
        entityContext = `Processing Activity: ${activity.name}\nDescription: ${activity.purpose}\nData Categories: ${(activity.dataSubjectCategories as string[])?.join(', ')}`;
      }
    } else if (match.matchedEntityType === 'vendor') {
      const vendor = await db.query.vendors.findFirst({
        where: eq(vendors.id, match.matchedEntityId),
      });
      if (vendor) {
        entityContext = `Vendor: ${vendor.name}\nCategory: ${vendor.category}\nServices provided: ${vendor.description || 'N/A'}`;
      }
    } else if (match.matchedEntityType === 'dpia') {
      const dpia = await db.query.dpias.findFirst({
        where: eq(dpias.id, match.matchedEntityId),
      });
      if (dpia) {
        entityContext = `DPIA Title: ${dpia.title}\nStatus: ${dpia.status}`;
      }
    }

    let documentContext = '';
    let documentAuthority = 'other';
    if (match.matchedChunkId) {
      const chunk = await db.query.documentEmbeddings.findFirst({
        where: eq(documentEmbeddings.id, match.matchedChunkId),
      });
      if (chunk) {
        documentContext = `Regulatory Text:\n${chunk.content}`;
        documentAuthority = chunk.authority;
      }
    }

    const isLightweight = match.similarityScore >= 0.7 && match.similarityScore < 0.8;
    const prompt = isLightweight 
      ? `You are a compliance assistant. Given the following regulatory text and an organization's entity details, provide a single-sentence explanation of why this regulation applies to the entity.
      
${documentContext}

${entityContext}`
      : `You are an expert privacy lawyer and GDPR compliance officer.
Given the following regulatory text chunk and an organization's entity details, explain precisely why this regulation affects the entity and provide 2-3 recommended actions.
Your output must be in plain text, do not use markdown formatting.

${documentContext}

${entityContext}

Format your response exactly as:
EXPLANATION: <your explanation>
RECOMMENDED ACTIONS: <your recommended actions>`;

    let explanation = '';
    let actions: string | null = null;
    let promptTokens = 0;
    let completionTokens = 0;

    try {
      await trackAiUsage(match.organizationId, 1);

      const msg = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20240620',
        max_tokens: isLightweight ? 100 : 500,
        temperature: 0.1,
        messages: [{ role: 'user', content: prompt }]
      });

      promptTokens = msg.usage.input_tokens;
      completionTokens = msg.usage.output_tokens;
      
      const responseText = (msg.content[0] as any).text;

      if (isLightweight) {
        explanation = responseText.trim();
      } else {
        const parts = responseText.split('RECOMMENDED ACTIONS:');
        explanation = parts[0].replace('EXPLANATION:', '').trim();
        if (parts.length > 1) {
          actions = parts[1].trim();
        }
      }
    } catch (err: any) {
      console.error(`[Impact Assessment Worker] Anthropic API Error for match ${matchId}:`, err);
      // Wait for next run
      return;
    }

    let confidence = 'advisory';
    if (['eu', 'edpb'].includes(documentAuthority.toLowerCase())) {
      confidence = 'high';
    } else if (documentAuthority.toLowerCase() !== 'other') {
      confidence = 'medium';
    }

    let matchStrength = 'weak';
    if (match.similarityScore >= 0.85) {
      matchStrength = 'strong';
    } else if (match.similarityScore >= 0.75) {
      matchStrength = 'moderate';
    }

    await db.update(regulatoryUpdateMatches)
      .set({
        aiExplanation: explanation,
        recommendedAction: actions,
        confidence,
        matchStrength,
        promptTokens,
        completionTokens,
        status: 'assessed',
        assessedAt: new Date()
      })
      .where(eq(regulatoryUpdateMatches.id, matchId));
  }
}, { drainDelay: 15 });

export async function scheduleImpactAssessmentJobs() {
  try {
    if (!impactAssessmentQueue) return;
    
    const repeatableJobs = await impactAssessmentQueue.getRepeatableJobs();
    for (const job of repeatableJobs) {
      await impactAssessmentQueue.removeRepeatableByKey(job.key);
    }

    // Schedule every 15 minutes
    await impactAssessmentQueue.add('impact-assessment-dispatcher', {}, { repeat: { pattern: '*/15 * * * *' } });
    console.log('✅ Impact Assessment recurring jobs scheduled');
  } catch (err: any) {
    console.warn('⚠️ Could not schedule Impact Assessment jobs. Is Redis running? Error:', err.message);
  }
}
