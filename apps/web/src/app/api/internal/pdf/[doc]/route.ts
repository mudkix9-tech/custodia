import { NextRequest, NextResponse } from 'next/server';
import { renderReactToPdf } from '../../../../../lib/pdf/pdfRenderer';
import { PDF_FILENAMES, buildPdfElement, isPdfDoc } from '../../../../../lib/pdf/registry';

/**
 * The single PDF endpoint. `doc` selects a template from the registry, so all
 * twelve documents share one Serverless Function — see registry.ts for why the
 * count matters on Vercel's Hobby plan.
 *
 * Called server-to-server from apps/api (routers and workers); the shared
 * secret is the only authentication, so the route must never be linked from
 * the client.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
/** Registers are the long pole: a large ROPA can take well over the 10s default. */
export const maxDuration = 60;

export async function POST(req: NextRequest, { params }: { params: Promise<{ doc: string }> }) {
  const apiKey = req.headers.get('INTERNAL_API_KEY');
  if (!process.env.INTERNAL_API_KEY || apiKey !== process.env.INTERNAL_API_KEY) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const { doc } = await params;
  if (!isPdfDoc(doc)) {
    return new NextResponse(`Unknown document type: ${doc}`, { status: 404 });
  }

  try {
    const body = await req.json();
    // `reportData` is what the original assessment route accepted; the newer
    // callers send `data`. Both are honoured so the two can coexist.
    const data = body.data ?? body.reportData;
    if (!data) {
      return new NextResponse('Missing data', { status: 400 });
    }

    const element = await buildPdfElement(doc, data, body.locale || 'en');
    const pdfBuffer = await renderReactToPdf(element);

    return new NextResponse(pdfBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${body.filename || PDF_FILENAMES[doc]}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error(`PDF generation failed for "${doc}"`, error);
    return new NextResponse('Failed to generate PDF', { status: 500 });
  }
}
