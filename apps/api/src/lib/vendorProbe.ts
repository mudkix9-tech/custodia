/**
 * Probe failure classes — audit P-6.
 *
 * The gatherer's 40/40 probe failures were indistinguishable from bad data
 * because every failure collapsed into one of two statuses and the reason lived
 * only in a `console.warn`. The audit's sharpest single observation: "that is a
 * bot-block, user-agent or timeout signature, not a data-quality signal, and
 * the quarantine is currently indistinguishable from 'bad data'". These classes
 * are what separates them, so a quarantine can be read as "blocked — retry via
 * the Puppeteer fallback" rather than "the DPA does not exist".
 */

export const PROBE_FAILURE_CLASSES = [
  /** The URL answered non-2xx/3xx. */
  'url_not_found',
  /** Timed out, connection refused/reset, DNS failure. */
  'timeout',
  /** 403/429 or a bot-wall signature in the body. */
  'blocked_bot_protection',
  /** Login wall / sales gate on an otherwise reachable page. */
  'gated_content',
  /** Content fetched but the expected signals were absent. */
  'content_mismatch',
  /** Response exceeded the size cap. */
  'too_large',
] as const;

export type ProbeFailureClass = (typeof PROBE_FAILURE_CLASSES)[number];

export interface ProbeOutcome {
  status: 'verified' | 'partial' | 'failed';
  failureClass?: ProbeFailureClass;
  resolvedUrl?: string | null;
  httpStatus?: number | null;
}

const BOT_WALL_SIGNATURES: readonly RegExp[] = [
  /access denied/i,
  /captcha/i,
  /are you a robot/i,
  /unusual traffic/i,
  /cloudflare ray id/i,
  /ddos protection by cloudflare/i,
  /attention required.*cloudflare/i,
  /just a moment/i,
  /enable javascript and cookies to continue/i,
];

/**
 * Classify a fetch that threw. Node's fetch errors carry a `cause` chain; the
 * shapes below are the ones a compliance crawler actually produces. DNS and
 * connection failures land on `timeout` because from the pipeline's point of
 * view they share its property that matters: transient, worth a retry, and no
 * evidence about the URL's existence either way.
 */
export function classifyFetchError(err: unknown): ProbeFailureClass {
  const message = err instanceof Error ? err.message : String(err);
  const causeMessage =
    err && typeof err === 'object' && 'cause' in err && err.cause instanceof Error
      ? err.cause.message.toUpperCase()
      : '';
  if (/abort|timeout|etimedout|deadline/i.test(message)) return 'timeout';
  if (/ENOTFOUND|EAI_AGAIN|getaddrinfo/.test(causeMessage)) return 'timeout';
  return 'timeout';
}

/** Classify a response that returned but did not verify. */
export function classifyResponse(
  httpStatus: number,
  bodyText: string,
  gatedUrlPatternHit: boolean,
): ProbeFailureClass {
  if (httpStatus === 401 || httpStatus === 403 || httpStatus === 429) {
    return 'blocked_bot_protection';
  }
  if (httpStatus >= 400) return 'url_not_found';
  if (gatedUrlPatternHit) return 'gated_content';
  // Only the first 20 KB — a bot wall is served small, and scanning megabytes
  // of PDF text for "captcha" is how a legitimate page gets misfiled.
  if (BOT_WALL_SIGNATURES.some((re) => re.test(bodyText.slice(0, 20_000)))) {
    return 'blocked_bot_protection';
  }
  return 'content_mismatch';
}

export type ProbeDocType = 'dpa' | 'privacy' | 'subprocessors';

/**
 * Content-signal evaluation, carried over from the gatherer (`gather-vendors.ts`
 * `evaluateContentSignals`) because it was the one part of that script the
 * audit called right: a page counts as verified only when its text actually
 * looks like the document it claims to be. Lives here rather than in the
 * service so the fixtures can exercise it without a network.
 *
 * A login wall is checked BEFORE signal matching: a gated page that happens to
 * contain the word "agreement" must not verify.
 */
const GATED_BODY_SIGNATURE =
  /(enter your username)|(password.{0,40}log in)|(log in.{0,40}password)/i;

const GATED_URL_PATTERN =
  /login|signin|sign-in|register|oauth|portal|gate|contact-sales|contact\/sales|request-demo/i;

export function isGatedUrl(url: string): boolean {
  return GATED_URL_PATTERN.test(url.toLowerCase());
}

export function evaluateContentSignals(text: string, type: ProbeDocType): 'verified' | 'partial' | 'gated' {
  const body = text.replace(/\s+/g, ' ').toLowerCase();

  if (GATED_BODY_SIGNATURE.test(body)) return 'gated';

  if (type === 'dpa') {
    const names = /data[\s\-_]processing[\s\-_](agreement|addendum)|data[\s\-_]protection[\s\-_]agreement|\bdpa\b/i;
    const roles = /controller|processor|standard[\s\-_]contractual[\s\-_]clauses|scc/i;
    const execution = /sign|execute|parties|signature|execution|duly[\s\-_]authorised/i;
    return names.test(body) && roles.test(body) && execution.test(body) ? 'verified' : 'partial';
  }
  if (type === 'subprocessors') {
    const list = /subprocessor|sub[\s\-_]processor|third[\s\-_]party[\s\-_]list/i;
    const detail = /location|purpose|entity|hosting/i;
    return list.test(body) && detail.test(body) ? 'verified' : 'partial';
  }
  return /privacy[\s\-_]policy|privacy[\s\-_]statement|privacy[\s\-_]notice/i.test(body)
    ? 'verified'
    : 'partial';
}
