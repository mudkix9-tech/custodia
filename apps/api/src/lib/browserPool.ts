import { Cluster } from 'puppeteer-cluster';

let cluster: Cluster | null = null;

export async function getBrowserCluster() {
  if (cluster) return cluster;

  cluster = await Cluster.launch({
    concurrency: Cluster.CONCURRENCY_CONTEXT, // Each task gets a fresh page in shared browser
    maxConcurrency: 4, // 4 simultaneous renders
    puppeteerOptions: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    },
    timeout: 60000,
    retryLimit: 2,
  });

  return cluster;
}

export async function renderHtmlToPdf(html: string, options = {}): Promise<Buffer> {
  const cluster = await getBrowserCluster();
  return cluster.execute(async ({ page }: any) => {
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true, ...options });
    return Buffer.from(pdfBuffer);
  });
}

function parseCookieHeaders(setCookieHeaders: string | string[]) {
  if (!setCookieHeaders) return [];
  const headers = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
  return headers.map(header => {
    const parts = header.split(';');
    const firstPart = parts[0];
    if (!firstPart) return { name: '', value: '', domain: '' };
    const [name, ...valueParts] = firstPart.split('=');
    if (!name) return { name: '', value: '', domain: '' };
    return {
      name: name.trim(),
      value: valueParts.join('=').trim(),
      domain: '', // Simplified, would need to parse fully in a real app
    };
  });
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
        cookies.push(...parseCookieHeaders(setCookieHeaders as any));
      }
    });

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.waitForTimeout(3000);

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

// Graceful shutdown
process.on('SIGTERM', async () => {
  if (cluster) {
    await cluster.idle();
    await cluster.close();
  }
});
