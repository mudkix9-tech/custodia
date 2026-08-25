import React from 'react';
import { AssessmentReport } from './templates/assessmentReport';
import { BreachRegister } from './templates/breachRegister';
import { ComplianceReport } from './templates/complianceReport';
import { ConsentReport } from './templates/consentReport';
import { DpiaReport } from './templates/dpiaReport';
import { DsarRegister } from './templates/dsarRegister';
import { ExecutiveReport } from './templates/executiveReport';
import { GroupSummary } from './templates/groupSummary';
import { RopaRegister } from './templates/ropaRegister';
import { TrainingCertificate } from './templates/trainingCertificate';
import { TrainingReport } from './templates/trainingReport';
import { VendorRegister } from './templates/vendorRegister';
import { VendorsTia } from './templates/vendorsTia';

/**
 * Every PDF the platform produces, addressed by name.
 *
 * The registry exists so all twelve documents render from one route handler:
 * Vercel's Hobby plan caps a deployment at twelve Serverless Functions, and a
 * route per document would have spent that budget on nothing but PDFs.
 *
 * `ropa-record` is gone (J93). It and `ropa-register` were two different, and
 * differently incomplete, Article 30 documents — nine fields per activity against
 * eight — and which one a customer got depended on which button they pressed.
 * There is one now, built server-side by `lib/ropaArticle30.ts`.
 */
export const PDF_TEMPLATES = {
  assessment: AssessmentReport,
  'ropa-register': RopaRegister,
  executive: ExecutiveReport,
  'training-certificate': TrainingCertificate,
  'training-report': TrainingReport,
  vendors: VendorRegister,
  'vendors-tia': VendorsTia,
  dpia: DpiaReport,
  dsar: DsarRegister,
  breaches: BreachRegister,
  consent: ConsentReport,
  compliance: ComplianceReport,
  group: GroupSummary,
} as const;

export type PdfDoc = keyof typeof PDF_TEMPLATES;

export const isPdfDoc = (value: string): value is PdfDoc =>
  Object.prototype.hasOwnProperty.call(PDF_TEMPLATES, value);

/** Default download filename per document; the caller may override it. */
export const PDF_FILENAMES: Record<PdfDoc, string> = {
  assessment: 'assessment-report.pdf',
  'ropa-register': 'article-30-record.pdf',
  executive: 'executive-summary.pdf',
  'training-certificate': 'training-certificate.pdf',
  'training-report': 'training-compliance.pdf',
  vendors: 'vendor-register.pdf',
  'vendors-tia': 'transfer-impact-assessment.pdf',
  dpia: 'dpia.pdf',
  dsar: 'dsar-register.pdf',
  breaches: 'breach-register.pdf',
  consent: 'consent-analytics.pdf',
  compliance: 'compliance-posture.pdf',
  group: 'group-summary.pdf',
};

/**
 * The assessment report is the one template that takes its copy from the
 * marketing message bundle rather than from the payload, so the locale is
 * resolved here and merged into `data.t` before rendering.
 */
async function withAssessmentTranslations(data: any, locale: string) {
  try {
    const messages =
      locale === 'de'
        ? (await import('../../messages/de/marketing.json')).default
        : locale === 'fr'
          ? (await import('../../messages/fr/marketing.json')).default
          : (await import('../../messages/en/marketing.json')).default;
    if ((messages as any)?.pdfReport) {
      return { ...data, t: (messages as any).pdfReport };
    }
  } catch (e) {
    console.error('Failed to load translations for PDF', e);
  }
  return data;
}

export async function buildPdfElement(
  doc: PdfDoc,
  data: unknown,
  locale = 'en',
): Promise<React.ReactElement<any>> {
  const Template = PDF_TEMPLATES[doc] as React.ComponentType<{ data: any }>;
  const prepared = doc === 'assessment' ? await withAssessmentTranslations(data, locale) : data;
  return React.createElement(Template, { data: prepared });
}
