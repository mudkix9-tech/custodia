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
 *
 * Sprint 6 (VD-3, VD-4, VD-6) adds the four classes that were being collapsed
 * into the three above. The test each of them has to pass is the same one:
 * would a reviewer clearing the queue take a different action on seeing it?
 */
import type { FieldEvidence } from './vendorFieldConfidence.js';

export const PROBE_FAILURE_CLASSES = [
  /** The URL answered non-2xx/3xx. */
  'url_not_found',
  /** Timed out or aborted — transient, worth a retry. */
  'timeout',
  /**
   * The host's name does not resolve. A catalogue data error, not a retry: the
   * website column is wrong, or the vendor is gone. Separated from `timeout` in
   * Sprint 6 (VD-4) because the two used to be the same value and send a
   * reviewer to two different places.
   */
  'dns_failure',
  /** The host resolved and refused or dropped the connection. */
  'connection_refused',
  /** 403/429 or a bot-wall signature in the body. */
  'blocked_bot_protection',
  /** Login wall / sales gate on an otherwise reachable page. */
  'gated_content',
  /** Content fetched but the expected signals were absent. */
  'content_mismatch',
  /**
   * The host answers 2xx for a path that cannot exist, so its 2xx carries no
   * information (VD-6). Every document from it is downgraded to partial no
   * matter how well its tokens match — this is not `content_mismatch`, which
   * claims we saw the page and it was something else.
   */
  'soft_404',
  /**
   * The host's robots.txt disallows this path for our token (VD-3). Not a
   * failure: it says the host asked us not to look, and nothing at all about
   * whether the document exists. Filing it as `url_not_found` would turn a
   * politeness rule into a published assertion about the vendor.
   */
  'blocked_by_robots',
  /** Response exceeded the size cap. */
  'too_large',
  /**
   * The URL resolved to a loopback, link-local or RFC 1918 address and was refused
   * before any request was made. Distinct from `url_not_found` because it says
   * nothing about the vendor and everything about the URL we were handed — a
   * candidate list that produces `http://localhost/dpa` should show up as this,
   * not as a missing document.
   */
  'blocked_private_address',
] as const;

export type ProbeFailureClass = (typeof PROBE_FAILURE_CLASSES)[number];

export interface ProbeOutcome {
  status: 'verified' | 'partial' | 'failed';
  failureClass?: ProbeFailureClass;
  resolvedUrl?: string | null;
  httpStatus?: number | null;
}

/**
 * The crawler's own name, and the token a host writes in robots.txt to address
 * it. A compliance product crawling behind a spoofed Chrome UA "will eventually
 * be a support ticket from a vendor's security team" (audit P-8).
 *
 * Both live here rather than in the service because `robotsTxt.ts` has to match
 * on the same token we send, and a fixture can then assert that it does — the
 * failure mode otherwise is silent and total: we honour a group nobody writes
 * while ignoring the one they do.
 */
export const USER_AGENT_TOKEN = 'CustodiaVendorIntelligence';

export const USER_AGENT =
  `${USER_AGENT_TOKEN}/1.0 (+https://custodia.com/bot; compliance-document-verification)`;

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
 * Collect every message and `code` an error carries, down its `cause` chain and
 * across an `AggregateError`'s `errors`.
 *
 * Both branches are needed and neither is optional. Node's `fetch` reports a
 * refused connection as `TypeError: fetch failed` whose cause is an
 * `AggregateError` — one entry per address the host resolved to — so a
 * `cause`-only walk finds nothing but the word "failed" and every refusal falls
 * through to the default. That is the same collapse VD-4 is about, one level
 * further down.
 */
function errorSignature(err: unknown, depth = 0): string {
  if (!err || depth > 4) return '';
  const parts: string[] = [];
  if (typeof err === 'string') return err.toUpperCase();
  if (err instanceof Error) {
    parts.push(err.message);
    const code = (err as { code?: unknown }).code;
    if (typeof code === 'string') parts.push(code);
    const nested = (err as { errors?: unknown }).errors;
    if (Array.isArray(nested)) {
      for (const entry of nested.slice(0, 4)) parts.push(errorSignature(entry, depth + 1));
    }
  }
  if (typeof err === 'object' && 'cause' in err) {
    parts.push(errorSignature((err as { cause: unknown }).cause, depth + 1));
  }
  return parts.join(' ').toUpperCase();
}

/**
 * Classify a fetch that threw.
 *
 * All three branches used to `return 'timeout'`, so a domain that does not
 * resolve read as a slow one (VD-4). They are different findings: NXDOMAIN
 * means the `website` column is wrong and a human should fix the catalogue,
 * a refused connection means the host is up and the port is not, and a timeout
 * means try again later. Node's `fetch` wraps all of them in a bare
 * `TypeError: fetch failed`, so the real code is down the `cause` chain and
 * nothing useful is on the top-level message.
 *
 * DNS is tested first: `EAI_AGAIN` is a *temporary* resolver failure whose text
 * reads like a timeout, and a resolver problem is still a resolver problem.
 */
export function classifyFetchError(err: unknown): ProbeFailureClass {
  const signature = errorSignature(err);
  if (/ENOTFOUND|EAI_AGAIN|GETADDRINFO|ERR_NAME_NOT_RESOLVED/.test(signature)) return 'dns_failure';
  if (/ECONNREFUSED|ECONNRESET|EPIPE|ECONNABORTED|SOCKET HANG UP/.test(signature)) {
    return 'connection_refused';
  }
  if (/ABORT|TIMEOUT|ETIMEDOUT|DEADLINE/.test(signature)) return 'timeout';
  // Anything unrecognised is treated as transient rather than as evidence: the
  // one thing we must not do is let an unclassified throw read as "no DPA".
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

/**
 * Map a probe outcome to the confidence vocabulary `fieldConfidence` scores.
 *
 * Lives beside the failure classes rather than in the service (where it sat
 * until Sprint 6) so that adding a class and deciding what it is worth are one
 * edit in one file, and so the fixtures can assert the mapping without
 * importing `db.js`.
 */
export function statusFromOutcome(
  outcome: { status: string; failureClass?: string },
): NonNullable<FieldEvidence['probeStatus']> {
  if (outcome.status === 'verified') return 'verified_probed_success';
  if (outcome.failureClass === 'content_mismatch') return 'partially_probed';
  // A soft-404 host's 2xx is worth exactly what a signal-less page is worth:
  // something came back, and it is not evidence.
  if (outcome.failureClass === 'soft_404') return 'partially_probed';
  if (outcome.failureClass === 'gated_content') return 'failed_gated';
  return 'failed_probed';
}

export type ProbeDocType = 'dpa' | 'privacy' | 'subprocessors';

/**
 * Content-signal evaluation, carried over from the gatherer (the deleted
 * `gather-vendors.ts`) because it was the one part of that script the
 * audit called right: a page counts as verified only when its text actually
 * looks like the document it claims to be. Lives here rather than in the
 * service so the fixtures can exercise it without a network.
 *
 * A login wall is checked BEFORE signal matching: a gated page that happens to
 * contain the word "agreement" must not verify.
 *
 * **All three families are en/de/fr (VD-5).** The module ships in three
 * languages and this was an English-only keyword scan, so a German
 * *Auftragsverarbeitungsvertrag* scored `partial` (45) rather than `verified`
 * (90) and a French *accord de sous-traitance* did the same. That is the Art. 9
 * vocabulary defect one door down: a scan in one language inside a
 * three-language product finds nothing and says so confidently. Accented forms
 * are matched alongside their transliterations because a vendor's own page uses
 * whichever its CMS produced.
 */
const GATED_BODY_SIGNATURE =
  /(enter your username)|(password.{0,40}log in)|(log in.{0,40}password)|(passwort.{0,40}anmeld)|(mot de passe.{0,40}connexion)/i;

const GATED_URL_PATTERN =
  /login|signin|sign-in|register|oauth|portal|gate|contact-sales|contact\/sales|request-demo|anmelden|connexion/i;

export function isGatedUrl(url: string): boolean {
  return GATED_URL_PATTERN.test(url.toLowerCase());
}

/**
 * Does this host answer 2xx with a body for a path that cannot exist?
 *
 * The negative control (VD-6). A host that soft-404s hands back its homepage
 * or a marketing page for every path we enumerate, so nine of nine candidate
 * DPA URLs "exist" and the first one whose boilerplate mentions a controller
 * and a signature verifies at 90. The control costs one request per host and
 * is the only way to tell that apart from a vendor who really does publish at
 * `/legal/dpa`.
 */
export function detectSoftNotFound(probe: {
  ok: boolean;
  httpStatus?: number | null;
  body?: string;
}): boolean {
  if (!probe.ok) return false;
  const status = probe.httpStatus ?? 200;
  if (status < 200 || status >= 300) return false;
  // An empty 2xx is a badly configured 404 handler, not a page that will be
  // mistaken for a DPA. Only a body can produce a false verification.
  return (probe.body ?? '').trim().length > 0;
}

/**
 * Apply the negative control's verdict to one probe's signals.
 *
 * A verified match from a soft-404 host is downgraded to `partial` regardless
 * of tokens — the tokens came from a page the host serves for every path. A
 * `gated` verdict is left alone: it is about what we could see, not about
 * whether the URL exists.
 */
export function downgradeForSoftNotFound(
  signals: 'verified' | 'partial' | 'gated',
  hostSoftNotFound: boolean,
): 'verified' | 'partial' | 'gated' {
  if (!hostSoftNotFound || signals !== 'verified') return signals;
  return 'partial';
}

export function evaluateContentSignals(text: string, type: ProbeDocType): 'verified' | 'partial' | 'gated' {
  const body = text.replace(/\s+/g, ' ').toLowerCase();

  if (GATED_BODY_SIGNATURE.test(body)) return 'gated';

  if (type === 'dpa') {
    const names =
      /data[\s\-_]processing[\s\-_](agreement|addendum)|data[\s\-_]protection[\s\-_]agreement|\bdpa\b|auftragsverarbeitungsvertrag|auftragsverarbeitung|\bavv\b|(accord|contrat)[\s\-_]de[\s\-_]sous[\s\-_]traitance|avenant[\s\-_]de[\s\-_]traitement/i;
    const roles =
      /controller|processor|standard[\s\-_]contractual[\s\-_]clauses|\bscc\b|verantwortlicher|auftragsverarbeiter|standardvertragsklauseln|responsable[\s\-_]d[ue][\s\-_]traitement|sous[\s\-_]traitant|clauses[\s\-_]contractuelles[\s\-_]types/i;
    const execution =
      /sign|execute|parties|signature|execution|duly[\s\-_]authorised|unterzeichn|unterschrift|vertragsparteien|abgeschlossen|conclu|paraphe/i;
    return names.test(body) && roles.test(body) && execution.test(body) ? 'verified' : 'partial';
  }
  if (type === 'subprocessors') {
    const list =
      /subprocessor|sub[\s\-_]processor|third[\s\-_]party[\s\-_]list|unterauftragsverarbeiter|unter[\s\-_]?auftragnehmer|sous[\s\-_]traitants?[\s\-_]ult[ée]rieurs?/i;
    const detail =
      /location|purpose|entity|hosting|standort|zweck|unternehmen|sitz|lieu|finalit[ée]|entit[ée]|h[ée]bergement/i;
    return list.test(body) && detail.test(body) ? 'verified' : 'partial';
  }
  return /privacy[\s\-_](policy|statement|notice)|datenschutz(erkl[äa]rung|erklaerung|hinweise|richtlinie)|politique[\s\-_]de[\s\-_]confidentialit[ée]|d[ée]claration[\s\-_]de[\s\-_]confidentialit[ée]/i.test(
    body,
  )
    ? 'verified'
    : 'partial';
}
