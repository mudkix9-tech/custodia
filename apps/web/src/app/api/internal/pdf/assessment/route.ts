import { NextRequest, NextResponse } from 'next/server';
import React from 'react';
import { AssessmentReport } from '../../../../../lib/pdf/templates/assessmentReport';
import { renderReactToPdf } from '../../../../../lib/pdf/pdfRenderer';

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get('INTERNAL_API_KEY');
  if (!process.env.INTERNAL_API_KEY || apiKey !== process.env.INTERNAL_API_KEY) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const { reportData } = await req.json();

    if (!reportData) {
      return new NextResponse('Missing reportData', { status: 400 });
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
