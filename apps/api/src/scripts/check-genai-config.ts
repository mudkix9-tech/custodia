/**
 * Which Google platform is this process actually talking to, and does the
 * credential work there?
 *
 * This product is Vertex-only, but an API key does not say which Google product
 * it was issued for: a Generative Language key (AI Studio) and a Vertex AI key
 * look identical in `GEMINI_API_KEY`. Only a Vertex key will work here, and the
 * only reliable way to tell them apart is to call Vertex and see whether it
 * answers.
 *
 *   npx tsx src/scripts/check-genai-config.ts
 *
 * Read-only: one tiny generate per endpoint, no writes.
 */
import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';
import { genAiMode, genAiEndpoint, genAiConfigError } from '../lib/genai.js';

const MODEL = process.env.GENAI_PROBE_MODEL || 'gemini-3.5-flash';

function mask(value: string | undefined): string {
  if (!value) return '(unset)';
  return value.length <= 8 ? '(set)' : `${value.slice(0, 4)}…${value.slice(-4)}`;
}

async function probe(label: string, build: () => GoogleGenAI): Promise<void> {
  let client: GoogleGenAI;
  try {
    client = build();
  } catch (err) {
    console.log(`  ${label.padEnd(28)} client rejected: ${(err as Error).message}`);
    return;
  }
  try {
    const response = await client.models.generateContent({
      model: MODEL,
      contents: 'Reply with the single word: ok',
      config: { maxOutputTokens: 8 },
    });
    console.log(`  ${label.padEnd(28)} WORKS — replied ${JSON.stringify(response.text?.trim() ?? '')}`);
  } catch (err) {
    const message = (err as Error).message.replace(/\s+/g, ' ').slice(0, 160);
    console.log(`  ${label.padEnd(28)} fails  — ${message}`);
  }
}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  const project = process.env.GCP_PROJECT_ID;

  console.log('\nEnvironment');
  console.log(`  GEMINI_API_KEY / GOOGLE_API_KEY  ${mask(apiKey)}`);
  console.log(`  GCP_PROJECT_ID                   ${project || '(unset)'}`);
  console.log(`  GCP_LOCATION                     ${process.env.GCP_LOCATION || '(unset)'}`);
  console.log(`  GOOGLE_GENAI_USE_VERTEXAI        ${process.env.GOOGLE_GENAI_USE_VERTEXAI || '(unset)'}`);
  console.log(`  GOOGLE_CREDENTIALS               ${process.env.GOOGLE_CREDENTIALS ? '(set, inline JSON)' : '(unset)'}`);
  console.log(`  GOOGLE_APPLICATION_CREDENTIALS   ${process.env.GOOGLE_APPLICATION_CREDENTIALS || '(unset)'}`);

  console.log('\nResolved by lib/genai.ts');
  console.log(`  mode      ${genAiMode}`);
  console.log(`  endpoint  ${genAiEndpoint}`);
  console.log(`  error     ${genAiConfigError() ?? '(none)'}`);

  console.log(`\nProbing Vertex AI with model "${MODEL}"`);

  if (apiKey) {
    await probe('API key → Vertex express', () => new GoogleGenAI({ vertexai: true, apiKey }));
  } else {
    console.log('  (no API key set — skipping the express probe)');
  }

  if (project) {
    await probe(
      'ADC → Vertex (project)',
      () =>
        new GoogleGenAI({
          vertexai: true,
          project,
          location: process.env.GCP_LOCATION || 'us-central1',
        }),
    );
  } else {
    console.log('  (no GCP_PROJECT_ID — skipping the Cloud-principal probe)');
  }

  console.log(
    '\nWhichever line says WORKS is the platform that key belongs to.\n' +
      'If "Vertex express" works, set GOOGLE_GENAI_USE_VERTEXAI=true.\n' +
      'If only "AI Studio" works, the key is a Generative Language key and the\n' +
      'current configuration is already correct for it.\n',
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
