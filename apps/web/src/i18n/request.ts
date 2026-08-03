import {getRequestConfig} from 'next-intl/server';
import {routing} from './routing';

export default getRequestConfig(async ({requestLocale}) => {
  let locale = await requestLocale;

  if (!locale || !routing.locales.includes(locale as any)) {
    locale = routing.defaultLocale;
  }

  return {
    locale,
    messages: {
      common: (await import(`../messages/${locale}/common.json`)).default,
      dashboard: (await import(`../messages/${locale}/dashboard.json`)).default,
      marketing: (await import(`../messages/${locale}/marketing.json`)).default,
      settings: (await import(`../messages/${locale}/settings.json`)).default,
      shared: (await import(`../messages/${locale}/shared.json`)).default,
      ropa: (await import(`../messages/${locale}/ropa.json`)).default,
      vendors: (await import(`../messages/${locale}/vendors.json`)).default,
      dsar: (await import(`../messages/${locale}/dsar.json`)).default,
      policies: (await import(`../messages/${locale}/policies.json`)).default,
      consent: (await import(`../messages/${locale}/consent.json`)).default,
      breaches: (await import(`../messages/${locale}/breaches.json`)).default,
      audit: (await import(`../messages/${locale}/audit.json`)).default,
      training: (await import(`../messages/${locale}/training.json`)).default,
      clients: (await import(`../messages/${locale}/clients.json`)).default,
      onboarding: (await import(`../messages/${locale}/onboarding.json`)).default,
    }
  };
});
