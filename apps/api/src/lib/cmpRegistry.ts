// Consent platform registry.
//
// Pass 2 of the reconciliation scan has to arrive at the page already consented.
// Doing that reliably means knowing which CMP is on the page and what an
// "accepted everything" cookie looks like to it. Where the CMP is unknown we fall
// back to clicking a button, and the caller records that the method was unreliable
// so the evaluator can lower confidence.

export type CmpDefinition = {
  key: string;
  name: string;
  /** Hosts that, when requested by the page, identify this CMP. */
  matchHosts: string[];
  /** Cookie names this CMP writes; used as a secondary signal. */
  cookieNames: string[];
  /**
   * Cookies to seed so the CMP treats the visit as fully consented.
   * `value` is a literal accepted-all payload for that vendor's format.
   */
  acceptanceCookies: Array<{ name: string; value: string }>;
};

export const CMP_REGISTRY: CmpDefinition[] = [
  {
    key: 'custodia',
    name: 'Custodia',
    matchHosts: [],
    cookieNames: ['pvr_consent_id', 'pvr_consent_categories'],
    // The banner script stores only an id cookie and posts the categories to the
    // API, so there is no client-side value that means "accepted". We seed the
    // categories cookie the gating work will read; until that ships, seeding this
    // changes nothing on the page, which is precisely the cmp_no_enforcement case.
    acceptanceCookies: [
      { name: 'pvr_consent_categories', value: 'necessary,analytics,marketing,functional' },
    ],
  },
  {
    key: 'cookiebot',
    name: 'Cookiebot',
    matchHosts: ['consent.cookiebot.com', 'consentcdn.cookiebot.com', 'cookiebot.com'],
    cookieNames: ['CookieConsent'],
    acceptanceCookies: [
      {
        name: 'CookieConsent',
        value: '{stamp:%27custodia-scan%27%2Cnecessary:true%2Cpreferences:true%2Cstatistics:true%2Cmarketing:true%2Cmethod:%27explicit%27%2Cver:1}',
      },
    ],
  },
  {
    key: 'onetrust',
    name: 'OneTrust',
    matchHosts: ['cdn.cookielaw.org', 'geolocation.onetrust.com', 'onetrust.com', 'cookielaw.org'],
    cookieNames: ['OptanonConsent', 'OptanonAlertBoxClosed'],
    acceptanceCookies: [
      {
        name: 'OptanonConsent',
        value: 'isGpcEnabled=0&datestamp=Mon+Jan+01+2035&version=custodia&groups=C0001%3A1%2CC0002%3A1%2CC0003%3A1%2CC0004%3A1%2CC0005%3A1',
      },
      { name: 'OptanonAlertBoxClosed', value: '2035-01-01T00:00:00.000Z' },
    ],
  },
  {
    key: 'usercentrics',
    name: 'Usercentrics',
    matchHosts: ['app.usercentrics.eu', 'api.usercentrics.eu', 'usercentrics.eu', 'privacy-proxy.usercentrics.eu'],
    cookieNames: ['ucCookie', 'usercentrics'],
    acceptanceCookies: [
      { name: 'ucCookie', value: '{"action":"onAcceptAllServices","version":"custodia"}' },
    ],
  },
  {
    key: 'iubenda',
    name: 'Iubenda',
    matchHosts: ['cdn.iubenda.com', 'cs.iubenda.com', 'iubenda.com'],
    cookieNames: ['_iub_cs-', 'euconsent-v2'],
    acceptanceCookies: [
      { name: '_iub_cs-custodia', value: '{"timestamp":"2035-01-01T00:00:00.000Z","version":"custodia","purposes":{"1":true,"2":true,"3":true,"4":true,"5":true}}' },
    ],
  },
  {
    key: 'termly',
    name: 'Termly',
    matchHosts: ['app.termly.io', 'termly.io'],
    cookieNames: ['TERMLY_API_CACHE'],
    acceptanceCookies: [
      { name: 'termly-consent', value: 'advertising=true&analytics=true&performance=true&social_networking=true' },
    ],
  },
  {
    key: 'osano',
    name: 'Osano',
    matchHosts: ['cmp.osano.com', 'osano.com'],
    cookieNames: ['osano_consentmanager'],
    acceptanceCookies: [
      { name: 'osano_consentmanager', value: 'ESSENTIAL=ACCEPT;ANALYTICS=ACCEPT;MARKETING=ACCEPT;PERSONALIZATION=ACCEPT;OPT_OUT=DENY' },
    ],
  },
  {
    key: 'quantcast',
    name: 'Quantcast Choice',
    matchHosts: ['quantcast.mgr.consensu.org', 'cmp.quantcast.com', 'quantcast.com'],
    cookieNames: ['euconsent-v2', 'addtl_consent'],
    acceptanceCookies: [],
  },
  {
    key: 'complianz',
    name: 'Complianz',
    matchHosts: [],
    cookieNames: ['cmplz_consent_status', 'cmplz_marketing', 'cmplz_statistics'],
    acceptanceCookies: [
      { name: 'cmplz_consent_status', value: 'allow' },
      { name: 'cmplz_marketing', value: 'allow' },
      { name: 'cmplz_statistics', value: 'allow' },
      { name: 'cmplz_preferences', value: 'allow' },
      { name: 'cmplz_banner-status', value: 'dismissed' },
    ],
  },
  {
    key: 'cookieyes',
    name: 'CookieYes',
    matchHosts: ['cdn-cookieyes.com', 'log.cookieyes.com', 'cookieyes.com'],
    cookieNames: ['cookieyes-consent'],
    acceptanceCookies: [
      { name: 'cookieyes-consent', value: 'consentid:custodia,consent:yes,action:yes,necessary:yes,functional:yes,analytics:yes,performance:yes,advertisement:yes' },
    ],
  },
];

/**
 * Buttons that mean "accept everything" across the long tail of CMPs. Ordered
 * most specific first; the scanner clicks the first one that is visible.
 */
export const ACCEPT_ALL_SELECTORS = [
  '#onetrust-accept-btn-handler',
  '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll',
  '#CybotCookiebotDialogBodyButtonAccept',
  '#usercentrics-root >>> button[data-testid="uc-accept-all-button"]',
  'button[data-testid="uc-accept-all-button"]',
  '.iubenda-cs-accept-btn',
  '#cmplz-accept',
  '.cmplz-accept',
  '.cky-btn-accept',
  '.osano-cm-accept-all',
  'button[aria-label="Accept all"]',
  'button[aria-label="Accept All"]',
  'button#accept-all',
  'button.accept-all',
  '#accept-cookies',
  '[data-cy="accept-all"]',
];

/** Text a button may carry when no known selector matches. */
export const ACCEPT_ALL_TEXTS = [
  'accept all',
  'allow all',
  'accept all cookies',
  'agree and continue',
  'i accept',
  'accept cookies',
  'got it',
  'alle akzeptieren',
  'tout accepter',
  'accetta tutti',
  'aceptar todo',
];

/**
 * Identifies the CMP from the hosts a page contacted and the cookies it set.
 * Host evidence wins: a page can retain a stale cookie from a CMP it no longer
 * uses, but it only contacts the CMP it actually loads.
 */
export function detectCmp(hosts: string[], cookieNames: string[]): CmpDefinition | null {
  const loweredHosts = hosts.map(h => h.toLowerCase());

  for (const cmp of CMP_REGISTRY) {
    if (cmp.matchHosts.some(mh => loweredHosts.some(h => h === mh || h.endsWith('.' + mh)))) {
      return cmp;
    }
  }

  for (const cmp of CMP_REGISTRY) {
    if (cmp.cookieNames.some(cn => cookieNames.some(name => name.startsWith(cn)))) {
      return cmp;
    }
  }

  return null;
}

/**
 * The registry stores each acceptance cookie in the shape the CMP's own script
 * parses, which for several of them contains characters RFC 6265 excludes from a
 * cookie value — `,` in CookieYes, `;` in Osano, `"` in the JSON that Usercentrics
 * and Iubenda write. A real browser stores those percent-encoded, and CDP's
 * Network.setCookies rejects them outright: one bad entry failed the whole batch,
 * which left pass 2 unconsented and every post-consent finding at low confidence.
 *
 * Only the illegal octets are encoded. `=`, `&`, `:`, `%` and braces are left alone
 * so the CMP's parser still recognises the value it is given.
 */
function toCookieOctets(value: string): string {
  return value.replace(/[\s,;\\"]/g, ch => encodeURIComponent(ch));
}

/** Acceptance cookies for a CMP, scoped to the domain being scanned. */
export function acceptanceCookiesFor(
  cmp: CmpDefinition | null,
  domain: string
): Array<{ name: string; value: string; domain: string; path: string }> {
  if (!cmp) return [];
  return cmp.acceptanceCookies.map(c => ({
    name: c.name,
    value: toCookieOctets(c.value),
    domain: '.' + domain.replace(/^www\./, ''),
    path: '/',
  }));
}
