import { db } from '../db.js';
import { regulatoryUpdates } from 'db';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';
import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const connection = new Redis(REDIS_URL, { maxRetriesPerRequest: null });

export const regulatoryQueue = new Queue('regulatory-jobs', { connection });

const REGULATORY_SOURCES = [
  {
    id: 'edpb',
    name: 'European Data Protection Board',
    url: 'https://edpb.europa.eu/news/news_en.xml',
    type: 'rss',
    region: 'EU',
  },
  {
    id: 'ie_dpc',
    name: 'Data Protection Commission (Ireland)',
    url: 'https://www.dataprotection.ie/news-media/latest-news',
    type: 'html_scrape',
    region: 'IE',
  },
];

export async function scrapeRegulatoryUpdates() {
  console.log('[RegulatoryScraper] Starting scraper job...');

  for (const source of REGULATORY_SOURCES) {
    try {
      console.log(`[RegulatoryScraper] Fetching from ${source.name}...`);
      
      // In development, we'll mock the RSS feed response to avoid brittle live scraping
      // In production, you would use 'rss-parser' or similar.
      const mockArticles = [
        {
          title: `[MOCK] New EDPB Guidelines on EU-US Data Transfers - ${new Date().toISOString().slice(0, 10)}`,
          url: `https://mock.edpb.europa.eu/news/new-guidelines-${Date.now()}`,
          content: 'The EDPB has issued new guidelines regarding the use of Standard Contractual Clauses (SCCs) for data transfers to the United States. Organizations should review their Transfer Impact Assessments (TIAs) and ensure supplementary measures are in place.'
        }
      ];

      for (const article of mockArticles) {
        const hash = crypto.createHash('sha256')
          .update(article.title + article.url)
          .digest('hex');
          
        const existing = await db.query.regulatoryUpdates.findFirst({
          where: eq(regulatoryUpdates.contentHash, hash)
        });
        
        if (existing) {
          console.log(`[RegulatoryScraper] Article already exists: ${article.title}`);
          continue;
        }

        // Mock AI Extraction (We skip actual Vercel AI SDK here to avoid key dependency in the mock, 
        // but this is where `generateObject` from 'ai' would be called)
        const mockAnalysis = {
          summary: "EDPB recommends reviewing TIAs and supplementary measures for US transfers using SCCs.",
          keyChanges: [
            {
              change: "New supplementary measures required for US transfers",
              gdprArticles: ["Article 46"],
              impact: "Organizations must review all TIAs targeting the US."
            }
          ],
          severity: "action_required",
          affectedArticles: ["Article 46"],
          impactRules: [
            {
              conditions: { hasTransfersTo: ["US"] },
              messageTemplate: "Review your TIA for US transfers in light of new EDPB supplementary measure guidance."
            }
          ]
        };

        await db.insert(regulatoryUpdates).values({
          sourceId: source.id,
          sourceName: source.name,
          sourceUrl: article.url,
          title: article.title,
          summary: mockAnalysis.summary,
          keyChanges: mockAnalysis.keyChanges,
          severity: mockAnalysis.severity,
          affectsArticles: mockAnalysis.affectedArticles,
          impactRules: mockAnalysis.impactRules,
          contentHash: hash,
          status: 'draft',
        });
        
        console.log(`[RegulatoryScraper] Draft update created for: ${article.title}`);
      }
      
    } catch (error) {
      console.error(`[RegulatoryScraper] Error scraping ${source.id}:`, error);
      // Capture exception in Sentry/Datadog here in production
    }
  }
}

// Worker to process the regulatory jobs
export const regulatoryWorker = new Worker('regulatory-jobs', async (job) => {
  if (job.name === 'scrape') {
    await scrapeRegulatoryUpdates();
  }
}, { connection });

export async function scheduleRegulatoryJobs() {
  try {
    // Run daily at 3:00 AM
    await regulatoryQueue.add('scrape', null, {
      repeat: { pattern: '0 3 * * *' },
      jobId: 'regulatory-scraper-cron'
    });
    console.log('✅ Regulatory Scraper background jobs scheduled');
  } catch (err: any) {
    console.warn('⚠️ Could not schedule Regulatory jobs:', err.message);
  }
}
