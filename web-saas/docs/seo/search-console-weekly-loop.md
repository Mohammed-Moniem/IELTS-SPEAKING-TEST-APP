# Weekly SEO Optimization Loop (Search Console + Bing)

## Goal

Improve indexation quality, click-through rates, and landing-page relevance using a repeatable weekly workflow.

## Weekly schedule

1. Monday: index coverage and crawl health.
2. Wednesday: query and CTR optimization.
3. Friday: content and internal-linking refresh.

## Step 1: Crawl and index checks

1. Review Search Console `Pages` report for new exclusions.
2. Confirm all public URLs in sitemap are indexed or in progress.
3. Validate no unexpected `noindex` pages outside intended routes:
   - intended noindex: `/app/*`, `/admin/*`, `/login`, `/register`.
4. Inspect top 5 URLs with low crawl frequency and request indexing if needed.

## Step 2: Query and CTR checks

1. Export top queries and pages from last 28 days.
2. Identify pages with:
   - impressions > 100 and CTR below site median.
   - position 6-20 (highest upside for title/meta updates).
3. Update page titles/meta descriptions where query intent mismatch is clear.
4. Annotate every change with date and expected query impact.

## Step 3: Content and internal-link updates

1. Select 2 underperforming guide pages and refresh:
   - first 120 words
   - one new practical example
   - one improved CTA block
2. Add at least 2 new internal links from high-traffic pages to those guides.
3. Re-run SEO checks:
   - `npm run test:seo`
   - `npm run test:seo:lighthouse`

## Step 4: Off-page execution

1. Update `/Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/web-saas/docs/seo/offpage-opportunities.csv`.
2. Move at least 2 rows from `planned` to `outreach_sent` weekly.
3. Track referring-domain gains monthly.

## KPI targets

1. Indexation of all public guide pages within 4-6 weeks.
2. +20% impressions on guide cluster within 8 weeks.
3. CTR uplift on refreshed pages within 2-4 weeks.
4. 5-10 new relevant referring domains per quarter.

