import { reconsentFlags, processingActivities } from 'db';
import { db } from '../db.js';
import { eq, sql } from 'drizzle-orm';
import { createQueue, createWorker } from '../lib/queue.js';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { trackAiUsage } from '../lib/billing.js';
import { queueNotification } from '../utils/notifications.js';
import { WORKER_MODEL, complete } from '../lib/llm.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });


export const reconsentQueue = process.env.NODE_ENV === 'test'
  ? null as any
  : createQueue('reconsent-material-change');

interface ReconsentJobData {
  activityId: string;
  organizationId: string;
  oldPurpose: string | null;
  newPurpose: string | null;
  dataCategories: string[];
  lawfulBasis: string | null;
  vendorList: { name: string; purpose?: string | null }[];
}

export const reconsentWorker = createWorker(
  'reconsent-material-change',
  async (job: any) => {
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
- Linked Vendors: ${vendorList.map((v: any) => `${v.name} (${v.purpose || 'No purpose specified'})`).join(', ') || 'None'}

Under GDPR, consent is specific and informed. Does this change in the purpose description constitute a *material change* that would require obtaining fresh consent from data subjects? 
A material change significantly alters the nature, scope, context, or purposes of processing (e.g., adding personalized marketing, expanding data sharing). Minor wording adjustments, typo fixes, or stylistic changes are NOT material.

Respond in strict JSON format with exactly three fields:
1. "isMaterial": boolean (true if it requires re-consent, false otherwise)
2. "confidence": string ("high", "medium", "ambiguous") - Use "ambiguous" if it's a borderline case that requires human judgment.
3. "reasoning": A 1-2 sentence explanation of why.

JSON format only:`;

      await trackAiUsage(organizationId, 1);

      const response = await complete({
        model: WORKER_MODEL,
        maxTokens: 2048,
        system: "You are a GDPR compliance expert. Output strictly valid JSON.",
        prompt: prompt,
      });

      const messageContent = response.text;
      
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
    // No `connection` here: opts goes straight to pg-boss work(), which has no such
    // option — it was a BullMQ leftover, and it dereferenced reconsentQueue, which is
    // null under NODE_ENV=test. That made the worker barrel unimportable from tests.
    concurrency: 2,
  }
);
