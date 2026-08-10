/**
 * Renders PDFs on the Next.js app instead of in-process.
 *
 * Every document used to go through Puppeteer here, which is why `custodia-api`
 * needed Chromium and half a gigabyte of headroom to serve a report download.
 * The templates now live in apps/web/src/lib/pdf/templates and render with
 * @react-pdf/renderer, so this process only has to POST the data and hold the
 * resulting buffer.
 *
 * All twelve documents share one endpoint — the `doc` segment selects the
 * template — because Vercel's Hobby plan caps a deployment at twelve
 * Serverless Functions.
 */

export type PdfDoc =
  | 'assessment'
  | 'ropa-record'
  | 'ropa-register'
  | 'executive'
  | 'training-certificate'
  | 'training-report'
  | 'vendors'
  | 'dpia'
  | 'dsar'
  | 'breaches'
  | 'consent'
  | 'compliance'
  | 'group';

export interface RenderPdfOptions {
  /** Passed through to templates that localise their copy (currently `assessment`). */
  locale?: string;
  /** Defaults to 60s, matching `maxDuration` on the route. Registers are slow. */
  timeoutMs?: number;
}

export class PdfRenderError extends Error {
  constructor(
    message: string,
    readonly doc: PdfDoc,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'PdfRenderError';
  }
}

/**
 * FRONTEND_INTERNAL_URL lets the worker reach the app over a private address
 * where one exists; it falls back to the public origin, then to local dev.
 */
function pdfEndpoint(doc: PdfDoc): string {
  const base =
    process.env.FRONTEND_INTERNAL_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
  return `${base.replace(/\/$/, '')}/api/internal/pdf/${doc}`;
}

export async function renderPdf(
  doc: PdfDoc,
  data: unknown,
  options: RenderPdfOptions = {},
): Promise<Buffer> {
  const apiKey = process.env.INTERNAL_API_KEY || 'development_key';

  let response: Response;
  try {
    response = await fetch(pdfEndpoint(doc), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        INTERNAL_API_KEY: apiKey,
      },
      body: JSON.stringify({ data, locale: options.locale || 'en' }),
      signal: AbortSignal.timeout(options.timeoutMs ?? 60_000),
    });
  } catch (err) {
    // A timeout surfaces as an AbortError, which is worth distinguishing from a
    // template failure when this shows up in Sentry.
    throw new PdfRenderError(
      `PDF render request for "${doc}" failed: ${(err as Error).message}`,
      doc,
    );
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new PdfRenderError(
      `PDF render for "${doc}" returned ${response.status}: ${detail.slice(0, 200)}`,
      doc,
      response.status,
    );
  }

  return Buffer.from(await response.arrayBuffer());
}
