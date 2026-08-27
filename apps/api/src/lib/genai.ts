import { GoogleGenAI, type GoogleGenAIOptions } from '@google/genai';

// ---------------------------------------------------------------------------
// The Google GenAI client. Vertex AI only.
//
// This SDK can address two entirely different Google products, and the
// difference is not cosmetic: the Gemini Developer API (AI Studio) at
// generativelanguage.googleapis.com, and Vertex AI — now the Gemini Enterprise
// Agent Platform — at aiplatform.googleapis.com. Different billing, different
// quota, different regional processing commitments, different terms.
//
// **This product uses Vertex, and only Vertex.** AI Studio is not a fallback,
// not a development convenience and not a degraded mode: there is no code path
// here that can reach generativelanguage.googleapis.com. A GDPR compliance
// platform cannot have its processing location decided by which environment
// variable happened to be set, and that is exactly what an implicit fallback
// does — an earlier version of this file preferred an API key over a configured
// project, so a Vertex deployment silently ran on AI Studio for months.
//
// Two supported configurations:
//
//   Express      GEMINI_API_KEY issued for the **Vertex AI API**.
//                No service account. Endpoint is global; the key's own project
//                is billed, so GCP_PROJECT_ID / GCP_LOCATION are not used.
//
//   Cloud        GCP_PROJECT_ID + GCP_LOCATION with a service account, via
//   principal    GOOGLE_CREDENTIALS (inline JSON) or
//                GOOGLE_APPLICATION_CREDENTIALS (file path), or the metadata
//                server on a Google Cloud host. The only mode that can pin a
//                processing region.
//
// A key issued for the *Generative Language API* is an AI Studio key and will
// be rejected by Vertex with a 403. That is the correct outcome — the fix is a
// Vertex key or a service account, not a fallback.
// ---------------------------------------------------------------------------

export type GenAiMode = 'vertex' | 'vertex_express' | 'unconfigured';

/**
 * Northflank has no persistent filesystem to mount a service-account key onto,
 * so the usual GOOGLE_APPLICATION_CREDENTIALS path — which google-auth-library
 * reads as a *file path* — cannot be used there. `GOOGLE_CREDENTIALS` carries
 * the same JSON inline instead.
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
const location = process.env.GCP_LOCATION;

/** A credential this process can actually see. The metadata server is not one. */
const hasExplicitAdc = Boolean(
  process.env.GOOGLE_CREDENTIALS || process.env.GOOGLE_APPLICATION_CREDENTIALS,
);

/**
 * `GOOGLE_GENAI_USE_VERTEXAI` is read only to reject it if someone sets it to
 * false. There is no AI Studio mode to switch to, and silently ignoring an
 * explicit instruction is worse than saying it does not apply.
 */
const vertexFlag = process.env.GOOGLE_GENAI_USE_VERTEXAI ?? process.env.GOOGLE_GENAI_USE_ENTERPRISE;
if (vertexFlag !== undefined && /^(0|false|no)$/i.test(vertexFlag.trim())) {
  console.warn(
    '[genai] GOOGLE_GENAI_USE_VERTEXAI is set to false, which would select AI ' +
      'Studio. This product is Vertex-only; the setting is ignored. Unset it.',
  );
}

function resolveMode(): GenAiMode {
  // A service account is the strongest signal and the only one that can pin a
  // region, so it wins whenever a project is there to use it with.
  if (hasExplicitAdc && project) return 'vertex';
  // A key with no visible service account means express — the only Vertex path
  // that can authenticate without one.
  if (apiKey) return 'vertex_express';
  // No key: ADC through a metadata server, which is correct on a Google Cloud
  // host and the reason this is not treated as unconfigured.
  if (project) return 'vertex';
  return 'unconfigured';
}

export const genAiMode: GenAiMode = resolveMode();

if (genAiMode === 'vertex' && apiKey) {
  console.warn(
    `[genai] A service account is configured for project "${project}", so the ` +
      'API key is not used.',
  );
}

// Express mode cannot carry a project or a location: the SDK rejects a client
// holding both an API key and project/location, and resolves the region to
// `global`. That is a data-residency change in a product whose whole subject is
// data residency, so it is said out loud rather than left to a billing line.
if (genAiMode === 'vertex_express' && project) {
  console.warn(
    `[genai] Vertex express mode — authenticating with the API key, so ` +
      `GCP_PROJECT_ID ("${project}") and GCP_LOCATION are NOT in use. The key's ` +
      `own project is billed and the endpoint is global, not "${location || 'us-central1'}". ` +
      'Set GOOGLE_CREDENTIALS to use the project and pin the region.',
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
      location: location || 'us-central1',
      ...(credentials ? { googleAuthOptions: { credentials } } : {}),
    };
    return new GoogleGenAI(options);
  }

  // Express, or unconfigured. An unconfigured client is still constructed so
  // that importing this module never throws; the call is what fails, and
  // `genAiConfigError()` is what explains it. `vertexai` stays true in both
  // cases — there is no configuration of this file that produces an AI Studio
  // client.
  return new GoogleGenAI({ vertexai: true, apiKey: apiKey ?? '' });
}

export const genai = createClient();

/** Where requests actually go, for startup logging and diagnostics. */
export const genAiEndpoint =
  genAiMode === 'vertex'
    ? `https://${location || 'us-central1'}-aiplatform.googleapis.com/`
    : genAiMode === 'vertex_express'
      ? 'https://aiplatform.googleapis.com/ (global)'
      : '(none)';

/**
 * Why a call is going to fail, or null if the configuration is coherent.
 *
 * This deliberately does **not** block on missing ADC when a project is set.
 * Application Default Credentials can come from a mounted file, an inline blob,
 * or a metadata server, and only the first two are visible from here — refusing
 * to call because we cannot see a credential is how a working deployment gets
 * blocked by its own preflight.
 */
export function genAiConfigError(): string | null {
  if (genAiMode !== 'unconfigured') return null;
  return (
    'No Vertex AI configuration found. Either set GEMINI_API_KEY to a key ' +
    'issued for the Vertex AI API (express mode), or set GCP_PROJECT_ID + ' +
    'GCP_LOCATION together with GOOGLE_CREDENTIALS (inline service-account ' +
    'JSON) or GOOGLE_APPLICATION_CREDENTIALS (path to it).'
  );
}

/** Retained for callers that only want a boolean. */
export const hasGenAiCredentials = genAiMode !== 'unconfigured';

/**
 * True when the Cloud-principal mode is selected but no credential is visible
 * to this process. Not fatal — a metadata server may still answer — but it is
 * the single most likely cause of `Could not load the default credentials` at
 * call time, so it is worth saying once at startup rather than per request.
 */
export const vertexCredentialsUnverified = genAiMode === 'vertex' && !hasExplicitAdc;

if (vertexCredentialsUnverified) {
  console.warn(
    `[genai] Cloud-principal mode (project "${project}", location ` +
      `"${location || 'us-central1'}") with no GOOGLE_CREDENTIALS or ` +
      'GOOGLE_APPLICATION_CREDENTIALS. This works on a Google Cloud host via ' +
      'the metadata server; anywhere else — Northflank included — the first ' +
      'call will fail to authenticate.',
  );
}

console.log(`[genai] mode=${genAiMode} endpoint=${genAiEndpoint}`);
