import { Cluster } from 'puppeteer-cluster';
import puppeteer from 'puppeteer';

let cluster: Cluster | null = null;

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

export async function getBrowserCluster() {
  if (cluster) return cluster;

  cluster = await Cluster.launch({
    concurrency: Cluster.CONCURRENCY_CONTEXT, // Each task gets a fresh page in shared browser
    maxConcurrency: 1, // Reduced to 1 to fit within Render's 512MB free tier limit
    puppeteerOptions: {
      headless: true,
      executablePath: puppeteer.executablePath(),
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    },
    // A two-pass consent scan is two full page loads plus settle time in one task,
    // which does not fit inside 60s. This is a ceiling, not a wait, so shorter
    // tasks such as PDF rendering are unaffected.
    timeout: 150000,
    retryLimit: 2,
  });

  return cluster;
}

/**
 * Parses Set-Cookie headers. `responseHost` is the host that sent the header and
 * is the fallback domain when the cookie omits a Domain= attribute, per RFC 6265.
 * Returning an empty domain here used to make every header-set cookie look
 * first-party downstream.
 */
export function parseCookieHeaders(setCookieHeaders: string | string[], responseHost = '') {
  if (!setCookieHeaders) return [];
  const headers = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
  return headers
    .flatMap(header => header.split('\n'))
    .map(header => {
      const parts = header.split(';');
      const firstPart = parts[0];
      if (!firstPart) return { name: '', value: '', domain: responseHost, path: '/' };
      const [name, ...valueParts] = firstPart.split('=');
      if (!name) return { name: '', value: '', domain: responseHost, path: '/' };

      let domain = '';
      let path = '/';
      for (const attr of parts.slice(1)) {
        const eq = attr.indexOf('=');
        if (eq === -1) continue;
        const key = attr.slice(0, eq).trim().toLowerCase();
        const val = attr.slice(eq + 1).trim();
        if (key === 'domain') domain = val.replace(/^\./, '').toLowerCase();
        else if (key === 'path') path = val || '/';
      }

      return {
        name: name.trim(),
        value: valueParts.join('=').trim(),
        domain: domain || responseHost.toLowerCase(),
        path,
      };
    })
    .filter(c => c.name !== '');
}

function mergeCookies(intercepted: any[], browser: any[]) {
  const merged = new Map();
  intercepted.forEach(c => merged.set(c.name, c));
  browser.forEach(c => merged.set(c.name, c));
  return Array.from(merged.values());
}

export async function scanDomain(url: string) {
  const cluster = await getBrowserCluster();
  return cluster.execute(async ({ page }: any) => {
    const cookies: any[] = [];
    page.on('response', async (response: any) => {
      const setCookieHeaders = response.headers()['set-cookie'];
      if (setCookieHeaders) {
        let responseHost = '';
        try {
          responseHost = new URL(response.url()).hostname;
        } catch {
          // Non-parseable response URL; leave the domain to the Domain= attribute.
        }
        cookies.push(...parseCookieHeaders(setCookieHeaders as any, responseHost));
      }
    });

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    // page.waitForTimeout was removed in Puppeteer v22.
    await sleep(3000);

    const browserCookies = await page.cookies();
    return mergeCookies(cookies, browserCookies);
  });
}

export async function scanDomainForThirdParties(url: string) {
  const cluster = await getBrowserCluster();
  return cluster.execute(async ({ page }: any) => {
    const detectedDomains = new Set<string>();
    const detectedDetails: Array<{ domain: string; type: string; url: string }> = [];

    const urlObj = new URL(url);
    const mainHost = urlObj.hostname.replace(/^www\./, '');

    const staticDenylist = [
      'fonts.googleapis.com',
      'fonts.gstatic.com',
      'cdnjs.cloudflare.com',
      'cdn.jsdelivr.net',
      'unpkg.com',
      'fastly.net',
      'akamaihd.net',
      'cloudflare.com',
      'wp.com',
      'w.org',
      'gravatar.com',
      'amazonaws.com',
      'githubusercontent.com'
    ];

    // Enable request interception
    await page.setRequestInterception(true);
    
    const requestHandler = (request: any) => {
      try {
        const reqUrl = request.url();
        const reqUrlObj = new URL(reqUrl);
        const reqHost = reqUrlObj.hostname.toLowerCase();

        // Exclude organization's own domain and same-site subdomains
        if (reqHost === mainHost || reqHost.endsWith('.' + mainHost)) {
          request.continue().catch(() => {});
          return;
        }

        // Exclude denylisted static/CDN domains
        const isDenylisted = staticDenylist.some(deny => reqHost === deny || reqHost.endsWith('.' + deny));
        if (isDenylisted) {
          request.continue().catch(() => {});
          return;
        }

        const resourceType = request.resourceType();
        detectedDomains.add(reqHost);
        detectedDetails.push({
          domain: reqHost,
          type: resourceType,
          url: reqUrl
        });
      } catch (e) {
        // ignore malformed URLs
      }
      request.continue().catch(() => {});
    };

    page.on('request', requestHandler);

    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      // Give extra 3 seconds for dynamic/deferred scripts to load
      await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 3000)));
    } catch (err) {
      console.warn(`[scanDomainForThirdParties] Page navigation warned: ${err}`);
    } finally {
      // Cleanup listener
      page.off('request', requestHandler);
      await page.setRequestInterception(false).catch(() => {});
    }

    return {
      domains: Array.from(detectedDomains),
      details: detectedDetails
    };
  });
}

// ---------------------------------------------------------------------------
// Two-pass consent reconciliation scan
//
// Pass 1 loads the page as a first-time visitor who has not answered the banner.
// Pass 2 loads it again already consented. Comparing the two is what turns "this
// tracker exists" into "this tracker fired before consent".
//
// Each pass runs in its own BrowserContext so pass 1 cannot leak cookies into
// pass 2, and both run inside a single cluster task so they are never interleaved
// with another domain's scan.
// ---------------------------------------------------------------------------

export type ScanPass = 'pre_consent' | 'post_consent';
export type ConsentSignal = 'granted' | 'denied' | 'absent';
export type PostConsentMethod = 'seeded_cookies' | 'clicked' | 'seeded_and_clicked' | 'unknown';

/** One host aggregated across every request the page made to it during a pass. */
export type ScannedRequest = {
  host: string;
  /** Sanitised: origin + path, plus allowlisted query params only. */
  url: string;
  resourceType: string;
  /** The request sent cookies, or carried identifier-shaped query params. */
  carriedIdentifiers: boolean;
  consentSignal: ConsentSignal;
  requestCount: number;
};

export type ScannedCookie = {
  name: string;
  domain: string;
  path: string;
  isThirdParty: boolean;
};

export type PassResult = {
  pass: ScanPass;
  requests: ScannedRequest[];
  cookies: ScannedCookie[];
  navigationError?: string;
};

export type TwoPassScanResult = {
  pre: PassResult;
  post: PassResult;
  postConsentMethod: PostConsentMethod;
};

export type ConsentCookieSeed = { name: string; value: string; domain: string; path: string };

/**
 * Query params that identify a person rather than a property or an event. Their
 * presence means the request carried an identifier even if no cookie was sent —
 * the server-side/CAPI case.
 */
const IDENTIFIER_PARAMS = new Set([
  '_fbp', '_fbc', 'fbp', 'fbc', 'fbclid', 'external_id', 'em', 'ph', 'fn', 'ln',
  'cid', 'client_id', 'uid', 'user_id', 'userid', 'clientid', 'gclid', 'msclkid',
  'ttclid', 'li_fat_id', 'sid', 'vid', 'visitor_id', 'distinct_id', 'anonymous_id',
  'anonymousid', 'device_id', 'ecid', 'idfa', 'aaid', 'advertising_id', 'ajs_uid',
]);

/**
 * The only query params ever persisted. Everything else is dropped before a URL
 * is stored: full tracker URLs carry user identifiers, and keeping them would put
 * personal data in our own evidence tables.
 */
const URL_PARAM_ALLOWLIST = new Set(['gcs', 'gcd', 'id', 'ev']);

export function sanitiseRequestUrl(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    const kept = new URLSearchParams();
    for (const [key, value] of u.searchParams) {
      if (URL_PARAM_ALLOWLIST.has(key.toLowerCase())) kept.append(key, value);
    }
    const query = kept.toString();
    return `${u.origin}${u.pathname}${query ? '?' + query : ''}`;
  } catch {
    return '';
  }
}

/**
 * Reads the consent state a request declared to its own vendor.
 *
 * Google Consent Mode encodes it in `gcs` as G1 + ad_storage + analytics_storage,
 * so G100 is both denied and G111/G101/G110 have at least one granted. Meta's
 * `dpo`/`ldu` (Limited Data Use) and Google's `npa=1` mean the opposite: the tag
 * fired but was told not to personalise.
 */
export function parseConsentSignal(rawUrl: string): ConsentSignal {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    return 'absent';
  }

  const gcs = u.searchParams.get('gcs');
  if (gcs) {
    const match = /^G1(.)(.)$/.exec(gcs);
    if (match) {
      return match[1] === '1' || match[2] === '1' ? 'granted' : 'denied';
    }
  }

  if (u.searchParams.get('npa') === '1') return 'denied';

  const dpo = u.searchParams.get('dpo');
  const ldu = u.searchParams.get('ldu');
  if (dpo === 'LDU' || dpo === '1' || ldu === '1') return 'denied';

  // gcd alone says Consent Mode is present without stating the verdict.
  if (u.searchParams.has('gcd')) return 'denied';

  return 'absent';
}

function urlCarriesIdentifier(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl);
    for (const key of u.searchParams.keys()) {
      if (IDENTIFIER_PARAMS.has(key.toLowerCase())) return true;
    }
    return false;
  } catch {
    return false;
  }
}

const SIGNAL_PRECEDENCE: Record<ConsentSignal, number> = { granted: 3, denied: 2, absent: 1 };

async function tryAcceptAll(page: any): Promise<boolean> {
  const { ACCEPT_ALL_SELECTORS, ACCEPT_ALL_TEXTS } = await import('./cmpRegistry.js');

  for (const selector of ACCEPT_ALL_SELECTORS) {
    try {
      const handle = await page.$(selector);
      if (!handle) continue;
      const box = await handle.boundingBox();
      if (!box) continue;
      await handle.click();
      return true;
    } catch {
      // Selector unsupported on this page, or the node went away mid-click.
    }
  }

  try {
    return await page.evaluate((texts: string[]) => {
      const candidates = Array.from(
        document.querySelectorAll(
          'button, a[role="button"], div[role="button"], input[type="button"], input[type="submit"]'
        )
      ) as any[];
      for (const node of candidates) {
        const label = String(node.textContent || node.value || '').trim().toLowerCase();
        if (!label || label.length > 40) continue;
        if (!texts.some(t => label === t || label.startsWith(t))) continue;
        const rect = node.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          node.click();
          return true;
        }
      }
      return false;
    }, ACCEPT_ALL_TEXTS);
  } catch {
    return false;
  }
}

async function runPass(
  browser: any,
  pass: ScanPass,
  url: string,
  targetHost: string,
  options: { seedCookies?: ConsentCookieSeed[]; waitMs: number; clickAcceptAll: boolean }
): Promise<{ result: PassResult; clicked: boolean }> {
  const context = await browser.createBrowserContext();
  const requestsById = new Map<string, { url: string; type: string }>();
  const cookieSentById = new Map<string, boolean>();
  let navigationError: string | undefined;
  let clicked = false;

  try {
    const page = await context.newPage();
    const client = await page.createCDPSession();
    await client.send('Network.enable');

    client.on('Network.requestWillBeSent', (event: any) => {
      requestsById.set(event.requestId, {
        url: event.request?.url || '',
        type: String(event.type || 'other').toLowerCase(),
      });
    });

    // requestWillBeSentExtraInfo is the only place CDP reports the cookies that
    // were actually attached; the Cookie header is stripped from requestWillBeSent.
    // It can arrive before or after its sibling event, so both are buffered by id
    // and merged once the pass finishes.
    client.on('Network.requestWillBeSentExtraInfo', (event: any) => {
      const associated = Array.isArray(event.associatedCookies) ? event.associatedCookies : [];
      const sentAny = associated.some(
        (entry: any) => !entry.blockedReasons || entry.blockedReasons.length === 0
      );
      const headerCookie = event.headers?.Cookie || event.headers?.cookie;
      if (sentAny || (typeof headerCookie === 'string' && headerCookie.length > 0)) {
        cookieSentById.set(event.requestId, true);
      }
    });

    if (options.seedCookies?.length) {
      // Network.setCookies is all-or-nothing, so a single malformed entry used to
      // silently cost the whole consented state. Try the batch, then fall back to
      // one call per cookie so the rest still land, and name the ones that failed.
      const seeded = await client
        .send('Network.setCookies', { cookies: options.seedCookies })
        .then(() => true)
        .catch(() => false);

      if (!seeded) {
        const rejected: string[] = [];
        for (const cookie of options.seedCookies) {
          await client
            .send('Network.setCookies', { cookies: [cookie] })
            .catch(() => rejected.push(cookie.name));
        }
        console.warn(
          `[twoPassScan] Seeded ${options.seedCookies.length - rejected.length}/` +
          `${options.seedCookies.length} consent cookies` +
          (rejected.length ? `; rejected: ${rejected.join(', ')}` : '')
        );
      }
    }

    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    } catch (err: any) {
      navigationError = err?.message || String(err);
    }

    await sleep(options.waitMs);

    if (options.clickAcceptAll) {
      clicked = await tryAcceptAll(page);
      if (clicked) {
        // Accepting usually triggers a fresh wave of tags without a navigation.
        await sleep(options.waitMs);
      }
    }

    const cookies = await collectCookies(client, page, targetHost);

    return {
      result: {
        pass,
        requests: aggregateRequests(requestsById, cookieSentById),
        cookies,
        ...(navigationError ? { navigationError } : {}),
      },
      clicked,
    };
  } finally {
    await context.close().catch(() => {});
  }
}

function aggregateRequests(
  requestsById: Map<string, { url: string; type: string }>,
  cookieSentById: Map<string, boolean>
): ScannedRequest[] {
  const byHost = new Map<string, ScannedRequest>();

  for (const [requestId, request] of requestsById) {
    let host: string;
    try {
      host = new URL(request.url).hostname.toLowerCase();
    } catch {
      continue;
    }
    if (!host) continue;

    const carried = cookieSentById.get(requestId) === true || urlCarriesIdentifier(request.url);
    const signal = parseConsentSignal(request.url);
    const existing = byHost.get(host);

    if (!existing) {
      byHost.set(host, {
        host,
        url: sanitiseRequestUrl(request.url),
        resourceType: request.type,
        carriedIdentifiers: carried,
        consentSignal: signal,
        requestCount: 1,
      });
      continue;
    }

    existing.requestCount += 1;
    existing.carriedIdentifiers = existing.carriedIdentifiers || carried;
    if (SIGNAL_PRECEDENCE[signal] > SIGNAL_PRECEDENCE[existing.consentSignal]) {
      existing.consentSignal = signal;
      // Keep the URL that justifies the recorded signal, as that is the evidence
      // a finding will cite.
      existing.url = sanitiseRequestUrl(request.url);
    }
  }

  return Array.from(byHost.values());
}

async function collectCookies(client: any, page: any, targetHost: string): Promise<ScannedCookie[]> {
  let raw: any[] = [];
  try {
    const response = await client.send('Network.getAllCookies');
    raw = response?.cookies ?? [];
  } catch {
    raw = await page.cookies().catch(() => []);
  }

  const { isSameSite } = await import('./domains.js');
  const deduped = new Map<string, ScannedCookie>();

  for (const cookie of raw) {
    const domain = String(cookie.domain || '').replace(/^\./, '').toLowerCase();
    const key = `${cookie.name}|${domain}|${cookie.path || '/'}`;
    deduped.set(key, {
      name: String(cookie.name || ''),
      domain,
      path: String(cookie.path || '/'),
      isThirdParty: domain ? !isSameSite(domain, targetHost) : false,
    });
  }

  return Array.from(deduped.values());
}

export async function scanDomainTwoPass(
  url: string,
  opts: {
    consentCookies?: ConsentCookieSeed[];
    waitMs?: number;
    /** Click a best-effort "Accept all" when no acceptance cookie is known. */
    allowClickFallback?: boolean;
  } = {}
): Promise<TwoPassScanResult> {
  const waitMs = opts.waitMs ?? 3000;
  const seedCookies = opts.consentCookies ?? [];
  const allowClickFallback = opts.allowClickFallback ?? true;

  let targetHost = '';
  try {
    targetHost = new URL(url).hostname.toLowerCase();
  } catch {
    throw new Error(`scanDomainTwoPass: not a valid URL: ${url}`);
  }

  const cluster = await getBrowserCluster();
  return cluster.execute(async ({ page }: any) => {
    const browser = page.browser();

    const pre = await runPass(browser, 'pre_consent', url, targetHost, {
      waitMs,
      clickAcceptAll: false,
    });

    const post = await runPass(browser, 'post_consent', url, targetHost, {
      ...(seedCookies.length ? { seedCookies } : {}),
      waitMs,
      clickAcceptAll: allowClickFallback,
    });

    let postConsentMethod: PostConsentMethod;
    if (seedCookies.length && post.clicked) postConsentMethod = 'seeded_and_clicked';
    else if (seedCookies.length) postConsentMethod = 'seeded_cookies';
    else if (post.clicked) postConsentMethod = 'clicked';
    else postConsentMethod = 'unknown';

    return { pre: pre.result, post: post.result, postConsentMethod };
  });
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  if (cluster) {
    await cluster.idle();
    await cluster.close();
  }
});
