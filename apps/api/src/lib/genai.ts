import { GoogleGenAI } from '@google/genai';

// ---------------------------------------------------------------------------
// The Google GenAI client, configured for whichever credential the environment
// actually has.
//
// Four modules each built their own with `vertexai: true`, which authenticates
// only through Application Default Credentials — a service-account file, or the
// GCE metadata server. Neither exists on Northflank, so every embedding call in
// production failed with "Could not load the default credentials", preceded by a
// metadata-server lookup that could never succeed. That took out the nightly
// org-embeddings worker, the regulatory scraper, and every Copilot query, since
// retrieval runs before the model call.
//
// Preferring the API key makes the same build work on a non-GCP host. Vertex is
// still used when a project is configured and no key is present, so a deployment
// that does have a service account keeps working unchanged.
// ---------------------------------------------------------------------------

function createClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

  if (apiKey) {
    return new GoogleGenAI({ apiKey });
  }

  return new GoogleGenAI({
    vertexai: true,
    project: process.env.GCP_PROJECT_ID || 'custodia',
    location: process.env.GCP_LOCATION || 'us-central1',
  });
}

export const genai = createClient();

/**
 * True when a credential is actually configured. Vertex mode cannot be verified
 * without making a call, so this only reports whether *something* was supplied —
 * enough for callers to log a useful reason rather than a stack trace from deep
 * inside google-auth-library.
 */
export const hasGenAiCredentials = Boolean(
  process.env.GEMINI_API_KEY ||
  process.env.GOOGLE_API_KEY ||
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  process.env.GOOGLE_CREDENTIALS,
);
