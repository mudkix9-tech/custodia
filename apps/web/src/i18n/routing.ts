import {defineRouting} from 'next-intl/routing';
import {createNavigation} from 'next-intl/navigation';

export const routing = defineRouting({
  locales: ['en', 'de', 'fr'],
  defaultLocale: 'en',
  localePrefix: 'as-needed',

  // Off deliberately. With `as-needed` the default locale is unprefixed, so English
  // lives at `/dashboard` while German is `/de/dashboard`. With detection on, the
  // middleware resolved the locale for an unprefixed path from the `NEXT_LOCALE`
  // cookie -- so once you had switched to German, every request for `/dashboard`
  // was 307'd back to `/de/dashboard` and English became unreachable from inside
  // the product. Switching *to* a prefixed locale always worked, which is what made
  // it look like a one-way door.
  //
  // The cost is that a German-language browser landing on `/` now gets English
  // rather than a redirect to `/de`; the URL is the single source of truth for
  // locale, and hreflang plus the switcher are what route people to their language.
  localeDetection: false
});

export const {Link, redirect, usePathname, useRouter, getPathname} =
  createNavigation(routing);
