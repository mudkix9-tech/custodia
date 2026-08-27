import { GoogleGenAI, type GoogleGenAIOptions } from '@google/genai';

// ---------------------------------------------------------------------------
// The Google GenAI client.
//
// There are two entirely different Google products behind this SDK and the
// difference is not cosmetic: the Gemini Developer API (AI Studio), which
// authenticates with a `GEMINI_API_KEY`, and Vertex AI — now the Gemini
// Enterprise Agent Platform — which authenticates as a Google Cloud principal
// against a project and a location. Different billing, different quota,
// different regional processing commitments, different terms.
//
// This deployment is on the Cloud side: `.env` carries GCP_PROJECT_ID and
// GCP_LOCATION and no key of any kind. The previous version of this file
// preferred the API key and only fell through to Vertex when no key was
// present, which was written to fix a real outage (four modules built their own
// client with `vertexai: true`, which needs Application Default Credentials —
// a service-account file or the GCE metadata server, neither of which exists on
// Northflank). The fix worked and the ordering it introduced is wrong for a
// Cloud deployment: a stray GEMINI_API_KEY in the environment would silently
// route every request off the configured project onto AI Studio, which for a
// GDPR product means the processing location commitment changes without anyone
// editing a line of code.
//
// So the mode is now chosen explicitly and the project wins.
// ---------------------------------------------------------------------------

export type GenAiMode = 'vertex' | 'studio' | 'unconfigured';

/**
 * Northflank has no filesystem to mount a service-account key onto, so the
 * usual GOOGLE_APPLICATION_CREDENTIALS path (which google-auth-library reads as
 * a *file path*) cannot be used. `GOOGLE_CREDENTIALS` carries the same JSON
 * inline instead.
 *
 * This was already listed in the old credential check, where it did nothing:
 * nothing passed it to the auth library, so setting it made the check report
 * "configured" and the call still failed. Here it is actually wired in.
 */
function inlineCredentials(): Record<string, unknown> | null {
  const raw = process.env.GOOGLE_CREDENTIALS;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : null;
  } catch {
    console.warn('[genai] GOOGLE_CREDENTIALS is set but is not valid JSON — ignoring it.');
    return null;
  }
}

const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const project = process.env.GCP_PROJECT_ID;

/**
 * A configured project means Vertex, whether or not a key also happens to be
 * present. The two are not interchangeable and quietly preferring the key is
 * the defect this replaces — so if both are set we say so rather than picking
 * silently.
 */
export const genAiMode: GenAiMode = project ? 'vertex' : apiKey ? 'studio' : 'unconfigured';

if (project && apiKey) {
  console.warn(
    '[genai] Both GCP_PROJECT_ID and GEMINI_API_KEY are set. Using Vertex AI ' +
      `(project "${project}"); the API key is ignored. Unset one to remove the ambiguity.`,
  );
}

function createClient(): GoogleGenAI {
  if (genAiMode === 'vertex') {
    const credentials = inlineCredentials();
    const options: GoogleGenAIOptions = {
      // `enterprise` is the SDK's newer name for this same flag. Kept as
      // `vertexai` because every other client in the repo spells it that way and
      // setting both to different values is a constructor error.
      vertexai: true,
      project,
      location: process.env.GCP_LOCATION || 'us-central1',
      ...(credentials ? { googleAuthOptions: { credentials } } : {}),
    };
    return new GoogleGenAI(options);
  }

  // Studio, or unconfigured — an unconfigured client is still constructed so
  // that importing this module never throws; the call is what fails, and
  // `genAiConfigError()` is what explains it.
  return new GoogleGenAI({ apiKey: apiKey ?? '' });
}

export const genai = createClient();

/**
 * Why a call is going to fail, or null if the configuration is coherent.
 *
 * The old export was a boolean built from `GEMINI_API_KEY || GOOGLE_API_KEY ||
 * GOOGLE_APPLICATION_CREDENTIALS || GOOGLE_CREDENTIALS`, which on this
 * deployment — project and location set, no key — evaluated to **false**. So
 * `orgEmbeddings` refused to run and told the operator to set an AI Studio key
 * they had deliberately not set. The check has to be about the mode actually
 * selected, not about one mode's variable.
 *
 * In Vertex mode this deliberately does **not** block on missing credentials.
 * Application Default Credentials can come from a mounted file, an inline blob,
 * or a metadata server, and only the first two are visible from here — refusing
 * to call because we cannot see a credential is how a working deployment gets
 * blocked by its own preflight.
 */
export function genAiConfigError(): string | null {
  if (genAiMode === 'vertex') return null;
  if (genAiMode === 'studio') return null;
  return (
    'No Google GenAI configuration found. Set GCP_PROJECT_ID (and GCP_LOCATION) ' +
    'to use Vertex AI / Gemini Enterprise Agent Platform, or GEMINI_API_KEY to ' +
    'use the Gemini Developer API.'
  );
}

/**
 * Retained for callers that only want a boolean. "Configured" now means the
 * mode is known — not that a specific product's key is present.
 */
export const hasGenAiCredentials = genAiMode !== 'unconfigured';

/**
 * True when Vertex is selected but no credential is visible to this process.
 * Not fatal — the metadata server may still answer — but it is the single most
 * likely cause of a `Could not load the default credentials` at call time, so
 * it is worth saying once at startup rather than per request.
 */
export const vertexCredentialsUnverified =
  genAiMode === 'vertex' &&
  !process.env.GOOGLE_CREDENTIALS &&
  !process.env.GOOGLE_APPLICATION_CREDENTIALS;

if (vertexCredentialsUnverified) {
  console.warn(
    `[genai] Vertex AI mode (project "${project}", location ` +
      `"${process.env.GCP_LOCATION || 'us-central1'}") with no GOOGLE_CREDENTIALS ` +
      'or GOOGLE_APPLICATION_CREDENTIALS. This works on a Google Cloud host via ' +
      'the metadata server; anywhere else the first call will fail to authenticate.',
  );
}
