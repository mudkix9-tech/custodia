/**
 * Outbound fetch for URLs that came from outside the product.
 *
 * The vendor module fetches things a user or a model chose: a trust-centre page, a
 * DPA, a sub-processor list, a privacy policy. Every one of those is a URL the
 * backend is asked to open on someone else's say-so, which is a server-side request
 * forgery unless the destination is checked first. What made it worth fixing here
 * rather than case by case is the deployment: one Northflank container serves
 * Fastify *and* every worker, so "what the API can reach" includes the cloud
 * metadata endpoint and anything else bound inside the container.
 *
 * The check is on the resolved address, not on the hostname, because a name is not
 * a destination — `metadata.example.com` can resolve to 169.254.169.254, and a
 * hostname allowlist would wave it through. Redirects are followed manually so each
 * hop is checked the same way; a permitted URL that redirects to localhost is the
 * oldest trick against a naive guard.
 *
 * This deliberately does not attempt to be a general egress policy. It blocks the
 * address ranges that have no business being fetched by name from user input, and
 * it fails closed on anything it cannot resolve.
 */
import dns from 'dns/promises';
import net from 'net';

export type BlockedReason =
  | 'unsupported_scheme'
  | 'unresolvable_host'
  | 'private_address'
  | 'too_many_redirects';

export class BlockedRequestError extends Error {
  constructor(public reason: BlockedReason, message: string) {
    super(message);
    this.name = 'BlockedRequestError';
  }
}

/**
 * True for any address a public HTTP client has no reason to reach: loopback,
 * RFC 1918, link-local (which is where cloud metadata lives), carrier-grade NAT,
 * unique-local IPv6 and the unspecified address. IPv4-mapped IPv6 (`::ffff:10.0.0.1`)
 * is unwrapped first, because that is the same private address wearing a different
 * notation.
 */
export function isPrivateAddress(address: string): boolean {
  let addr = address.toLowerCase().trim();

  // Unwrap IPv4-mapped IPv6 so ::ffff:127.0.0.1 is judged as 127.0.0.1.
  const mapped = addr.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped && mapped[1]) addr = mapped[1];

  if (net.isIPv4(addr)) {
    const parts = addr.split('.').map(Number);
    if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true;
    const a = parts[0] as number;
    const b = parts[1] as number;
    if (a === 0) return true;                          // 0.0.0.0/8 — "this network"
    if (a === 10) return true;                         // RFC 1918
    if (a === 127) return true;                        // loopback
    if (a === 169 && b === 254) return true;           // link-local, incl. cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true;  // RFC 1918
    if (a === 192 && b === 168) return true;           // RFC 1918
    if (a === 100 && b >= 64 && b <= 127) return true; // RFC 6598 carrier-grade NAT
    if (a === 192 && b === 0) return true;             // 192.0.0.0/24 protocol assignments
    if (a >= 224) return true;                         // multicast and reserved
    return false;
  }

  if (net.isIPv6(addr)) {
    if (addr === '::' || addr === '::1') return true;  // unspecified, loopback
    if (addr.startsWith('fe8') || addr.startsWith('fe9') ||
        addr.startsWith('fea') || addr.startsWith('feb')) return true; // link-local fe80::/10
    if (addr.startsWith('fc') || addr.startsWith('fd')) return true;   // unique-local fc00::/7
    if (addr.startsWith('ff')) return true;                            // multicast
    return false;
  }

  // Not an address we can reason about — fail closed.
  return true;
}

/**
 * Resolve a hostname and refuse it if any address it answers with is private.
 * Every address is checked, not just the first: a name that returns one public and
 * one private address is still a way into the private one.
 */
export async function assertPublicHost(hostname: string): Promise<void> {
  const literal = hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(literal)) {
    if (isPrivateAddress(literal)) {
      throw new BlockedRequestError('private_address', `Refusing to fetch a private address (${literal}).`);
    }
    return;
  }

  let addresses: string[];
  try {
    const results = await dns.lookup(hostname, { all: true });
    addresses = results.map((r) => r.address);
  } catch {
    throw new BlockedRequestError('unresolvable_host', `Could not resolve ${hostname}.`);
  }

  if (addresses.length === 0) {
    throw new BlockedRequestError('unresolvable_host', `Could not resolve ${hostname}.`);
  }
  for (const address of addresses) {
    if (isPrivateAddress(address)) {
      throw new BlockedRequestError('private_address', `${hostname} resolves to a private address (${address}).`);
    }
  }
}

export interface SafeFetchOptions {
  headers?: Record<string, string>;
  timeoutMs?: number;
  maxRedirects?: number;
  /** Cap on the body actually read, in bytes. */
  maxBytes?: number;
}

export interface SafeFetchResult {
  ok: boolean;
  status: number;
  url: string;
  body: string;
  truncated: boolean;
}

/**
 * Fetch a URL that came from user or model input.
 *
 * Throws `BlockedRequestError` when the destination is refused. Redirects are
 * followed one hop at a time so that every intermediate URL is validated; the
 * response body is read through a reader with a byte cap, because a compliance
 * product should not be a way to make its own backend download an arbitrarily
 * large file.
 */
export async function safeFetch(rawUrl: string, options: SafeFetchOptions = {}): Promise<SafeFetchResult> {
  const {
    headers = {},
    timeoutMs = 6000,
    maxRedirects = 3,
    maxBytes = 2_000_000,
  } = options;

  let current = rawUrl;

  for (let hop = 0; hop <= maxRedirects; hop++) {
    let parsed: URL;
    try {
      parsed = new URL(current);
    } catch {
      throw new BlockedRequestError('unsupported_scheme', `Not a usable URL: ${current}`);
    }

    // `new URL()` happily accepts file:, gopher: and friends; only real web
    // schemes are fetchable here.
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new BlockedRequestError('unsupported_scheme', `Refusing scheme ${parsed.protocol}.`);
    }

    await assertPublicHost(parsed.hostname);

    const response = await fetch(parsed.toString(), {
      headers,
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) {
        return { ok: false, status: response.status, url: parsed.toString(), body: '', truncated: false };
      }
      current = new URL(location, parsed).toString();
      continue;
    }

    const { text, truncated } = await readCapped(response, maxBytes);
    return { ok: response.ok, status: response.status, url: parsed.toString(), body: text, truncated };
  }

  throw new BlockedRequestError('too_many_redirects', `More than ${maxRedirects} redirects from ${rawUrl}.`);
}

async function readCapped(response: Response, maxBytes: number): Promise<{ text: string; truncated: boolean }> {
  if (!response.body) return { text: '', truncated: false };
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  let truncated = false;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      chunks.push(value.slice(0, value.byteLength - (total - maxBytes)));
      truncated = true;
      await reader.cancel().catch(() => {});
      break;
    }
    chunks.push(value);
  }
  const merged = new Uint8Array(chunks.reduce((n, c) => n + c.byteLength, 0));
  let offset = 0;
  for (const c of chunks) {
    merged.set(c, offset);
    offset += c.byteLength;
  }
  return { text: new TextDecoder().decode(merged), truncated };
}
