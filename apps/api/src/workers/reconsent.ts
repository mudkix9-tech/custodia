import { Worker, type Job } from 'bullmq';
import { Queue } from 'bullmq';
import { reconsentFlags, processingActivities } from 'db';
import { db } from '../db.js';
import { Anthropic } from '@anthropic-ai/sdk';
import { eq, sql } from 'drizzle-orm';
import { createQueue } from '../lib/queue.js';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export const reconsentQueue = createQueue('reconsent-material-change');

interface ReconsentJobData {
  activityId: string;
  organizationId: string;
  oldPurpose: string | null;
  newPurpose: string | null;
  dataCategories: string[];
  lawfulBasis: string | null;
  vendorList: { name: string; purpose?: string | null }[];
}

export const reconsentWorker = new Worker<ReconsentJobData>(
  'reconsent-material-change',
  async (job: Job<ReconsentJobData>) => {
    try {
      const { 
        activityId, 
        organizationId, 
        oldPurpose, 
        newPurpose, 
        dataCategories, 
        lawfulBasis, 
        vendorList 
      } = job.data;

      // Ensure this only evaluates purpose-text changes on consent-based activities
      if (oldPurpose === newPurpose) {
        return { skipped: true, reason: 'No purpose change' };
      }

      const prompt = `You are a strict GDPR compliance assistant. A user has updated the purpose description of a processing activity that relies on consent (Lawful Basis: ${lawfulBasis || 'Consent'}). 

Old Purpose Description:
"${oldPurpose || 'N/A'}"

New Purpose Description:
"${newPurpose || 'N/A'}"

Additional Context for the Activity:
- Data Categories Processed: ${dataCategories.length > 0 ? dataCategories.join(', ') : 'None specified'}
- Linked Vendors: ${vendorList.map(v => `${v.name} (${v.purpose || 'No purpose specified'})`).join(', ') || 'None'}

Under GDPR, consent is specific and informed. Does this change in the purpose description constitute a *material change* that would require obtaining fresh consent from data subjects? 
A material change significantly alters the nature, scope, context, or purposes of processing (e.g., adding personalized marketing, expanding data sharing). Minor wording adjustments, typo fixes, or stylistic changes are NOT material.

Respond in strict JSON format with exactly three fields:
1. "isMaterial": boolean (true if it requires re-consent, false otherwise)
2. "confidence": string ("high", "medium", "ambiguous") - Use "ambiguous" if it's a borderline case that requires human judgment.
3. "reasoning": A 1-2 sentence explanation of why.

JSON format only:`;

      const response = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20240620',
        max_tokens: 500,
        temperature: 0,
        system: "You are a GDPR compliance expert. Output strictly valid JSON.",
        messages: [{ role: 'user', content: prompt }]
      });

      const messageContent = response.content[0].type === 'text' ? response.content[0].text : '';
      
      let parsed: { isMaterial: boolean; confidence: string; reasoning: string };
      try {
        const jsonStr = messageContent.replace(/```json/g, '').replace(/```/g, '').trim();
        parsed = JSON.parse(jsonStr);
      } catch (err) {
        throw new Error('Failed to parse Claude response as JSON: ' + messageContent);
      }

      if (parsed.isMaterial || parsed.confidence === 'ambiguous') {
        await db.insert(reconsentFlags).values({
          organizationId,
          processingActivityId: activityId,
          reason: parsed.reasoning || 'Potential material change detected in purpose.',
          confidence: parsed.confidence,
          status: 'flagged'
        });
      }

      return parsed;

    } catch (error) {
      console.error('[ReconsentWorker] Error processing job:', error);
      throw error;
    }
  },
  {
    connection: (reconsentQueue as any).client,
    concurrency: 2,
  }
);
