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

// Graceful shutdown
process.on('SIGTERM', async () => {
  if (cluster) {
    await cluster.idle();
    await cluster.close();
  }
});
