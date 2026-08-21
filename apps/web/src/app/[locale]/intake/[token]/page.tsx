import React from 'react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { IntakeForm } from './IntakeForm';

/**
 * C32/C33. The delegated-intake questionnaire, answered by someone with no account.
 *
 * Outside the `(app)` group deliberately: the respondent is a department head who
 * has never logged into Custodia and never will, so this page has no sidebar, no
 * navigation and no session. The unguessable token in the path is the access
 * control, exactly as it is for the vendor questionnaire.
 *
 * `noindex` because the URL is a capability. A questionnaire that reached a search
 * index would be a register's contents addressable by anyone who found the link.
 */
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'ropa.intake_public' });
  return {
    title: t('page_title'),
    robots: { index: false, follow: false },
  };
}

/**
 * Next 16 removed synchronous access to the route parameters — a page that
 * declares them as a plain object reads them as undefined at runtime, renders
 * fine, and `tsc` cannot see it, because the page declares that type itself and
 * there is nothing to disagree with. `check:params` fails on that shape.
 */
export default async function IntakePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <IntakeForm token={token} />;
}
