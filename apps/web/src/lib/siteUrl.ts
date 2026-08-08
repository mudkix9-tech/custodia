// The apex is the canonical host: `www.trycustodia.com` 308-redirects to
// `trycustodia.com`, which serves 200.
//
// Canonical tags, hreflang, sitemap entries and the robots.txt sitemap pointer
// must all name that final host. Naming the other one makes every canonical
// point at a URL that redirects straight back to the page declaring it, and
// fills the sitemap with URLs Google has to resolve through a redirect before
// it can index anything -- which is the state this site shipped in until
// August 2026, when Vercel served www while every URL here named the apex.
//
// This constant is the only place the origin is written, but it is only half
// the setting: it must agree with the primary domain in Vercel's project
// settings. Changing one without the other reintroduces the mismatch.
export const SITE_ORIGIN = 'https://trycustodia.com';
