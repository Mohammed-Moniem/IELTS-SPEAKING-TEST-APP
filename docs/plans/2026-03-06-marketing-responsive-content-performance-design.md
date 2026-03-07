# Marketing Responsiveness And Content Performance Design

**Date:** 2026-03-06

**Goal:** Make the public site responsive, remove the mobile navigation gap, and redesign public content delivery so blog pages are fast, crawlable, and GEO-friendly without breaking authenticated learner flows.

## Problems

### Public responsiveness

- The public shell hides the primary navigation below `md` with no mobile replacement.
- Marketing pages rely on desktop-oriented action clusters and wide section layouts.
- There is no stable responsive regression coverage for the public site.

### Public content performance

- `/blog` is currently a client-fetched page.
- `/blog/[slug]` is also client-fetched after hydration.
- The browser API client uses `cache: 'no-store'` and per-request unique headers, which is inappropriate for cacheable public content.
- The current blog fallback only materializes a small subset of posts while the slug inventory is much larger.

### SEO/GEO mismatch

- Public articles should be present in server-rendered HTML for search crawlers and answer engines.
- The current client-first blog path delays visible article content until after hydration and API fetch completion.

## Chosen Approach

Use a server-first public content architecture with incremental static regeneration and cacheable server fetchers.

This means:

- Keep authenticated learner/admin flows on their current live API pattern.
- Add dedicated server-side blog/content fetchers for marketing routes.
- Server-render the blog index and blog article pages.
- Hydrate only the search/filter layer on the blog index for instant client-side interaction.
- Add a real mobile nav to the marketing shell.

Redis is explicitly deferred to phase 2. The first implementation should prove whether server rendering plus ISR is already sufficient.

## Architecture

### 1. Marketing Shell

The shared marketing shell becomes the responsive baseline.

- Add a mobile menu trigger on small screens.
- Open a navigation drawer/dialog with primary links and auth CTA actions.
- Keep the desktop nav unchanged.
- Close the drawer on route change, overlay click, and explicit close action.

This reduces the chance of page-by-page nav drift.

### 2. Server-Side Blog Data Layer

Create a dedicated public blog data module separate from the browser API client.

Responsibilities:

- resolve the absolute API base on the server
- fetch blog list/detail payloads with `fetch`
- use `next: { revalidate: ... }`
- avoid unique cache-busting request headers
- support paged fetches when loading the full published index
- provide graceful fallback metadata when the upstream blog API fails

This module becomes the single source for public blog pages.

### 3. Blog Index

The `/blog` page should:

- fetch published blog metadata server-side
- render the initial visible article list in HTML
- embed enough metadata for instant client-side search/filter/pagination
- avoid runtime client fetch for the initial page load

Important distinction:

- do not render all 500+ cards in the initial viewport
- do preload the searchable metadata set so interaction is instant after hydration

This balances SEO, page weight, and perceived speed.

### 4. Blog Article Pages

The `/blog/[slug]` page should:

- fetch article content server-side
- render body HTML in the server response
- preserve metadata, JSON-LD, and static params
- keep fallback behavior for API failure, but prefer real article content whenever available

### 5. Responsiveness Scope

Phase 1 responsive work targets:

- shell and shared marketing layout
- homepage
- pricing
- features
- blog index
- blog article page

The rest of the site is guarded with viewport regression checks so we catch obvious breakage even if no visual rewrite is needed.

## Caching Strategy

### Public content

Use server-side `fetch` with route revalidation.

Recommended defaults:

- blog index metadata: longer revalidation window
- article detail: medium revalidation window
- guide trees/details: keep existing cache strategy and align patterns where helpful

### Authenticated content

Do not switch learner/admin data flows to public caching primitives.

### Redis

Do not introduce Redis in phase 1 unless benchmarks show:

- origin API latency remains the bottleneck after ISR
- cache misses are still too expensive
- page generation time remains outside the acceptable budget

If Redis is needed later, use it for precomputed blog index payloads or server fetch memoization, not as the first solution.

## Performance Targets

### Blog index

- initial HTML should already contain visible article cards
- no client-side fetch should block first content visibility
- client-side search/filter should operate on in-memory metadata and feel instant

### Blog article

- initial HTML should already contain article title, excerpt, and body
- no loading skeleton should be the primary user path on a healthy cache hit

### Public APIs

- benchmark the upstream blog list/detail API separately from the page shell
- use the results to decide whether phase 2 caching is necessary

## Testing Strategy

### Responsive

Add Playwright mobile coverage for:

- marketing shell mobile menu
- key public routes at mobile viewport
- navigation reachability and absence of horizontal overflow regressions

### SEO/GEO

Extend the SEO suite so it verifies:

- `/blog` has indexable metadata and structured data
- `/blog/[slug]` renders article content in server HTML
- canonical tags remain correct
- blog routes stay in sitemap as expected

### Performance

Add repeatable page/API benchmarks for:

- `/blog`
- one representative `/blog/[slug]`
- blog list API
- blog detail API

Use Lighthouse for page-level outcomes and HTTP load/perf tooling for endpoint latency.

## Non-Goals

- No Redis rollout in phase 1
- No blanket caching changes to the existing browser API client
- No redesign of every marketing page’s visual language beyond what responsive fixes require
- No attempt to render hundreds of article cards in the initial viewport HTML
