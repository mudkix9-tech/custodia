import fetch from 'node-fetch';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface LinkSentinelResult {
  vendorName: string;
  url: string;
  status: 'ok' | 'broken' | 'redirect_changed' | 'soft_404';
  code: number | null;
  message: string;
}

export async function checkUrl(vendorName: string, urlStr: string): Promise<LinkSentinelResult> {
  try {
    const urlObj = new URL(urlStr);

    // HEAD request first
    let response = await fetch(urlStr, {
      method: 'HEAD',
      redirect: 'manual',
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) LinkSentinel/1.0' }
    });

    // If HEAD fails or returns method not allowed, fallback to GET
    if (response.status === 405 || response.status === 404 || response.status === 403) {
      response = await fetch(urlStr, {
        method: 'GET',
        redirect: 'manual',
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) LinkSentinel/1.0' }
      });
    }

    // Handle Redirects (301, 302, 307, 308)
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (location) {
        const destUrlObj = new URL(location, urlStr);
        if (destUrlObj.pathname !== urlObj.pathname) {
          return {
            vendorName,
            url: urlStr,
            status: 'redirect_changed',
            code: response.status,
            message: `Redirected to a different path: ${location}`
          };
        }
      }
    }

    // Handle client/server errors
    if (response.status >= 400) {
      return {
        vendorName,
        url: urlStr,
        status: 'broken',
        code: response.status,
        message: `Returned error status ${response.status}`
      };
    }

    // Handle soft-404: 200 OK but "not found" in page body
    if (response.status === 200) {
      const fullResponse = await fetch(urlStr, {
        method: 'GET',
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) LinkSentinel/1.0' }
      });
      const bodyText = await fullResponse.text();
      const lowerBody = bodyText.toLowerCase();

      const soft404Keywords = [
        'page not found',
        '404 not found',
        '404 error',
        'sorry, we couldn\'t find that page',
        'the page you requested was not found'
      ];

      const isSoft404 = soft404Keywords.some(kw => lowerBody.includes(kw));
      if (isSoft404) {
        return {
          vendorName,
          url: urlStr,
          status: 'soft_404',
          code: 200,
          message: 'Soft-404 detected: page body indicates "not found" despite 200 OK status.'
        };
      }
    }

    return {
      vendorName,
      url: urlStr,
      status: 'ok',
      code: response.status,
      message: 'OK'
    };
  } catch (err: any) {
    return {
      vendorName,
      url: urlStr,
      status: 'broken',
      code: null,
      message: err.message
    };
  }
}

async function runLinkSentinel() {
  console.log('--- LINK SENTINEL RUNNING ---');
  const vendorsDir = path.resolve(__dirname, '../../vendors');
  const files = fs.readdirSync(vendorsDir);

  const results: LinkSentinelResult[] = [];

  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    const vendorPath = path.join(vendorsDir, file);
    const vendor = JSON.parse(fs.readFileSync(vendorPath, 'utf-8'));

    if (vendor.dpaUrl) {
      const dpaRes = await checkUrl(vendor.name, vendor.dpaUrl);
      if (dpaRes.status !== 'ok') results.push(dpaRes);
    }
    if (vendor.subProcessorListUrl) {
      const subRes = await checkUrl(vendor.name, vendor.subProcessorListUrl);
      if (subRes.status !== 'ok') results.push(subRes);
    }
  }

  console.log(`Scan complete. Found ${results.length} issues.`);
  console.log(JSON.stringify(results, null, 2));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runLinkSentinel().catch(err => console.error(err));
}
