// The comparison route used to title-case its URL slug for display, which
// rendered competitors under names they do not use -- "Cookieyes", "Iubenda",
// "Onetrust". Getting a rival's own brand wrong on a page whose entire premise
// is a fair comparison undermines it before the table is read.
//
// This map is also the allowlist. `/compare/[competitor]` previously returned
// HTTP 200 for any slug at all, so `/compare/totally-fake-competitor` rendered
// a full comparison page with a self-referencing canonical -- an unbounded
// supply of thin pages for a crawler to find. The page pairs this with
// `dynamicParams = false` so anything not listed here 404s.
export const COMPETITOR_NAMES: Record<string, string> = {
  iubenda: 'iubenda',
  onetrust: 'OneTrust',
  cookieyes: 'CookieYes',
  usercentrics: 'Usercentrics',
  cookiebot: 'Cookiebot',
};

export const COMPETITOR_SLUGS = Object.keys(COMPETITOR_NAMES);
