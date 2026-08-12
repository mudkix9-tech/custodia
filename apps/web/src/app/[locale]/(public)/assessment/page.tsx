import { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { assessmentTemplates } from 'db';
import { db } from '@/db';
import { buildMarketingMetadata } from '../../(marketing)/seo';
import AssessmentClient, { type AssessmentEntryParams } from './AssessmentClient';

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return buildMarketingMetadata({ locale, path: '/assessment' });
}

/** searchParams values arrive as string | string[] | undefined; every parameter this
 *  flow reads is single-valued, so a repeated key takes the first occurrence. */
function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function AssessmentPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Fetched here rather than through the client tRPC hook so the intro screen is
  // present in the server-rendered HTML. This is the destination of every primary
  // CTA on the marketing site; it previously shipped an empty spinner to both
  // visitors and crawlers. Same query as assessments.getQuestions — a public,
  // unscoped read of the shared template table.
  //
  // A failure here must not take the page down: the client still fetches the same
  // questions over tRPC, so an unreachable database costs the server-rendered copy
  // and nothing else. Returning [] rather than throwing keeps the old behaviour as
  // the floor instead of turning a degraded API into a 500.
  const [questions, sp] = await Promise.all([
    db.select().from(assessmentTemplates).catch((err) => {
      console.error('[assessment] server-side question fetch failed, falling back to client fetch:', err);
      return [];
    }),
    searchParams,
  ]);

  const entry: AssessmentEntryParams = {
    jurisdiction: one(sp.jurisdiction),
    ropa: one(sp.ropa),
    cookies: one(sp.cookies),
    special: one(sp.special),
    utmSource: one(sp.utm_source),
    utmMedium: one(sp.utm_medium),
    utmCampaign: one(sp.utm_campaign),
  };

  return <AssessmentClient initialQuestions={questions} entry={entry} />;
}
