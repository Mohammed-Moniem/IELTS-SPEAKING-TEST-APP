# Spokio SEO Ops Runbook (Search Console + Bing)

## Scope

- Property: `https://spokio.app`
- Sitemap: `https://spokio.app/sitemap.xml`
- Public indexable routes: marketing pages and IELTS guide cluster.
- Intentionally non-indexed routes: `/app/*`, `/admin/*`, `/login`, `/register`.

## 1) Google Search Console

1. Open Google Search Console and add a `Domain` property for `spokio.app`.
2. Verify ownership with DNS TXT on your DNS provider.
3. Submit sitemap URL: `https://spokio.app/sitemap.xml`.
4. Request indexing for:
   - `/`
   - `/pricing`
   - `/features`
   - `/about`
   - `/contact`
   - `/ielts`
   - all `/ielts/<slug>` pages.
5. Monitor:
   - Pages report for `Crawled - currently not indexed`.
   - Enhancements report for structured data warnings.
   - Search results report for impressions/CTR/query mix.

## 2) Bing Webmaster Tools

1. Add site `https://spokio.app`.
2. Verify via DNS or by importing Search Console property.
3. Submit sitemap URL: `https://spokio.app/sitemap.xml`.
4. Run URL inspection for home, pricing, features, and one guide page.
5. Monitor crawl and index coverage weekly.

## 3) Verification cadence

- Weekly checks for first 6 weeks after launch.
- Confirm canonical URL and meta robots on every newly added marketing page.
- Track changes in impressions for guide pages and expand content cluster monthly.

## 4) Decision log

- Keep `noindex` for authenticated and auth-only routes.
- Do not include private learner/admin routes in sitemap.
- Keep the sitemap limited to public marketing and guide pages.

