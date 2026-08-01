import { NextRequest, NextResponse } from 'next/server';
import React from 'react';
import { AssessmentReport } from '../../../../../lib/pdf/templates/assessmentReport';
import { renderReactToPdf } from '../../../../../lib/pdf/pdfRenderer';
// Removed getTranslations from fs

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get('INTERNAL_API_KEY');
  if (!process.env.INTERNAL_API_KEY || apiKey !== process.env.INTERNAL_API_KEY) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const { reportData, locale = 'en' } = await req.json();

    if (!reportData) {
      return new NextResponse('Missing reportData', { status: 400 });
    }

    let translations: any = null;
    try {
      if (locale === 'de') {
        translations = (await import('../../../../../messages/de/marketing.json')).default;
      } else if (locale === 'fr') {
        translations = (await import('../../../../../messages/fr/marketing.json')).default;
      } else {
        translations = (await import('../../../../../messages/en/marketing.json')).default;
      }
    } catch (e) {
      console.error('Failed to load translations for PDF', e);
    }

    if (translations && translations.pdfReport) {
      reportData.t = translations.pdfReport;
    }

    const element = React.createElement(AssessmentReport, { data: reportData });
    const pdfBuffer = await renderReactToPdf(element);

    return new NextResponse(pdfBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="assessment.pdf"',
      },
    });
  } catch (error: any) {
    console.error('Failed to generate PDF in Vercel function:', error);
    return new NextResponse(error?.message || 'Internal Server Error', { status: 500 });
  }
}
