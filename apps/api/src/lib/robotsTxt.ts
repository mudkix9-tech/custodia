/**
 * robots.txt for the vendor probe — Sprint 6, VD-3.
 *
 * The comment this replaces claimed the control was "handled at the batch
 * level". Nothing fetched `/robots.txt` anywhere in the repo, so a
 * self-identifying crawler was announcing itself by name while ignoring the one
 * file a host uses to answer it. That is the worst of both: identifiable *and*
 * impolite.
 *
 * Parsing is pure and lives here rather than in `vendorIntelligence.ts` so the
 * standalone fixtures can exercise it without `DATABASE_URL` and without a
 * network — the same reason `vendorUrlCandidates.ts` is split out. The one
 * function that does reach the network, `RobotsCache`, takes its fetcher as an
 * argument for the same reason.
 *
 * A disallowed path is **not** a probe failure. `blocked_by_robots` says the
 * host asked us not to look, which is silent on whether the DPA exists; filing
 * it as `url_not_found` would turn a politeness rule into a published assertion
 * that the vendor has no DPA.
 */
import { USER_AGENT_TOKEN } from './vendorProbe.js';

/**
 * One group's rules, already reduced to the group that applies to us.
 *
 * `allow` and `disallow` hold the raw path patterns in source order; precedence
 * is by match length at decision time (RFC 9309 §2.2.2), not by order, which is
 * why both lists are kept rather than folded into one.
 */
export interface RobotsRules {
  allow: string[];
  disallow: string[];
  /** Which `User-agent:` group these came from — carried for the reject log. */
  matchedAgent: string;
}

/** No robots.txt, or one with nothing to say to us. */
export const ROBOTS_ALLOW_ALL: RobotsRules = { allow: [], disallow: [], matchedAgent: '*' };

/**
 * Parse robots.txt and return the rules for one crawler token.
 *
 * Group selection follows RFC 9309 §2.2.1: the most specific matching
 * `User-agent` wins, and `*` is the fallback rather than an addition — a host
 * that writes a group for us has said what it wants and the wildcard group is
 * then not ours to obey. Consecutive `User-agent` lines share the record that
 * follows them.
 *
 * Everything is matched case-insensitively, because the agent token in a
 * robots.txt is written by a human reading our User-Agent header off a log.
 */
export function parseRobotsTxt(text: string, token: string = USER_AGENT_TOKEN): RobotsRules {
  const wanted = token.toLowerCase();

  const groups: Array<{ agents: string[]; allow: string[]; disallow: string[] }> = [];
  let current: { agents: string[]; allow: string[]; disallow: string[] } | null = null;
  // A blank line does not end a group, but a rule line followed by a fresh
  // `User-agent` does — that is what tells consecutive agents apart from a new
  // record for a different crawler.
  let sawRule = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const field = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();

    if (field === 'user-agent') {
      if (!current || sawRule) {
        current = { agents: [], allow: [], disallow: [] };
        groups.push(current);
        sawRule = false;
      }
      if (value) current.agents.push(value.toLowerCase());
      continue;
    }
    if (field !== 'allow' && field !== 'disallow') continue;
    if (!current) continue;
    sawRule = true;
    // `Disallow:` with an empty value is the documented way to say "everything
    // is permitted"; recording it as a rule matching the empty prefix would
    // block the entire host.
    if (field === 'disallow' && !value) continue;
    if (!value) continue;
    current[field].push(value);
  }

  const exact = groups.find((g) => g.agents.some((a) => a === wanted));
  // A host that writes `User-agent: CustodiaVendorIntelligence/1.0` means us;
  // so does one that writes the bare product token. Match either way round so a
  // version suffix on one side does not silently void the rule.
  const partial = groups.find((g) =>
    g.agents.some((a) => a !== '*' && (a.includes(wanted) || wanted.includes(a))),
  );
  const wildcard = groups.find((g) => g.agents.includes('*'));
  const chosen = exact ?? partial ?? wildcard;
  if (!chosen) return ROBOTS_ALLOW_ALL;

  return {
    allow: chosen.allow,
    disallow: chosen.disallow,
    matchedAgent: chosen.agents[0] ?? '*',
  };
}

/**
 * Turn a robots.txt path pattern into a regex.
 *
 * `*` is any run of characters and a trailing `$` anchors the end (RFC 9309
 * §2.2.3). Everything else is a literal prefix, so `/legal` matches
 * `/legal/dpa` — which is the rule people are relying on when they write it.
 */
function patternToRegex(pattern: string): RegExp {
  const anchored = pattern.endsWith('$');
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const escaped = body.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}${anchored ? '$' : ''}`);
}

/** Length of the longest pattern in `patterns` that matches `path`, or -1. */
function longestMatch(patterns: string[], path: string): number {
  let best = -1;
  for (const pattern of patterns) {
    if (!patternToRegex(pattern).test(path)) continue;
    // Length of the pattern, not of the match: `/legal/*` and `/legal/dpa`
    // both match `/legal/dpa`, and the more specific pattern is the longer one.
    if (pattern.length > best) best = pattern.length;
  }
  return best;
}

/**
 * May we fetch this path?
 *
 * The tie goes to `Allow`, which is the documented behaviour and also the
 * charitable reading: a host that wrote both rules for the same prefix meant
 * the narrower permission to count.
 */
export function isPathAllowed(rules: RobotsRules | null | undefined, pathWithQuery: string): boolean {
  if (!rules || rules.disallow.length === 0) return true;
  const path = pathWithQuery.startsWith('/') ? pathWithQuery : `/${pathWithQuery}`;
  const disallowed = longestMatch(rules.disallow, path);
  if (disallowed === -1) return true;
  return longestMatch(rules.allow, path) >= disallowed;
}

/** The path-and-query a robots.txt rule is matched against, for one URL. */
export function robotsPath(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return '/';
  }
}

/** What a robots.txt fetch produced, in the shape the cache reasons about. */
export interface RobotsFetchResult {
  /** Missing or explicitly unavailable (any 4xx). */
  status: number;
  body: string;
}

export type RobotsFetcher = (robotsUrl: string) => Promise<RobotsFetchResult | null>;

/**
 * One robots.txt per host, for the life of one enrichment run.
 *
 * Cached per host because the alternative is re-fetching it for every one of
 * the ~30 candidate URLs a single vendor now enumerates, which would make the
 * politeness control the noisiest thing we do to the host.
 *
 * **Only an actual `Disallow` blocks.** A 4xx means no robots.txt exists, which
 * is no restriction. A 5xx, a timeout or a DNS failure means we could not read
 * one, and RFC 9309 permits treating that as a complete disallow — we do not,
 * because a flaky endpoint would then erase a whole vendor's record and the
 * reviewer would read `blocked_by_robots` against a host that never disallowed
 * anything. Absence of a rule is not a rule.
 */
export class RobotsCache {
  private readonly hosts = new Map<string, RobotsRules>();

  constructor(
    private readonly fetcher: RobotsFetcher,
    private readonly token: string = USER_AGENT_TOKEN,
  ) {}

  /** Load and cache the rules for a URL's host. */
  async rulesFor(url: string): Promise<RobotsRules> {
    let origin: string;
    let host: string;
    try {
      const parsed = new URL(url);
      origin = parsed.origin;
      host = parsed.host;
    } catch {
      return ROBOTS_ALLOW_ALL;
    }

    const cached = this.hosts.get(host);
    if (cached) return cached;

    let rules = ROBOTS_ALLOW_ALL;
    const result = await this.fetcher(`${origin}/robots.txt`);
    if (result && result.status >= 200 && result.status < 300 && result.body) {
      rules = parseRobotsTxt(result.body, this.token);
    }
    this.hosts.set(host, rules);
    return rules;
  }

  /** True when this exact URL may be fetched. */
  async allows(url: string): Promise<boolean> {
    const rules = await this.rulesFor(url);
    return isPathAllowed(rules, robotsPath(url));
  }

  /** Hosts already resolved this run — the reason this is one request, not thirty. */
  get size(): number {
    return this.hosts.size;
  }
}
