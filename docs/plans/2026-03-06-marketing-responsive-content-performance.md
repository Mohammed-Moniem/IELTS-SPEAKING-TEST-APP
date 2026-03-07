# Marketing Responsiveness And Content Performance Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the public site responsive and move the blog to a server-rendered, cacheable architecture that is fast for users and strong for SEO/GEO.

**Architecture:** Introduce a responsive marketing shell with mobile navigation, add server-side public blog fetchers that use revalidation instead of `no-store`, server-render the blog index and blog articles, and keep the interactive search/filter layer client-side on top of preloaded metadata. Performance validation focuses on cached page rendering and the upstream blog APIs separately.

**Tech Stack:** Next.js App Router, React, TypeScript, Playwright, Lighthouse CI, server `fetch` with ISR/revalidation

---

### Task 1: Add failing responsive coverage for the public shell and key marketing routes

**Files:**
- Modify: `web-saas/tests/e2e/seo-marketing.spec.ts`
- Create or modify: `web-saas/tests/e2e/marketing-responsive.spec.ts`
- Reference: `web-saas/src/components/layout/MarketingShell.tsx`

**Step 1: Write the failing test**

Add mobile viewport tests that verify:

- the marketing shell exposes a mobile navigation trigger
- primary links are reachable from the mobile menu
- auth CTA remains reachable on mobile
- `/`, `/pricing`, `/features`, `/blog`, and one `/blog/[slug]` route render a visible heading without horizontal overflow

**Step 2: Run test to verify it fails**

Run: `cd web-saas && npx playwright test tests/e2e/marketing-responsive.spec.ts --project=chromium`

Expected: FAIL because the marketing shell currently hides nav below `md` with no replacement.

**Step 3: Write minimal implementation**

Do not change production code yet. Only keep the failing regression coverage.

**Step 4: Run test to verify it still fails for the right reason**

Run the same command again and confirm the failures are about missing mobile behavior, not test setup.

**Step 5: Commit**

```bash
git add web-saas/tests/e2e/marketing-responsive.spec.ts web-saas/tests/e2e/seo-marketing.spec.ts
git commit -m "test: cover marketing responsiveness on mobile"
```

### Task 2: Implement responsive marketing shell navigation

**Files:**
- Modify: `web-saas/src/components/layout/MarketingShell.tsx`
- Test: `web-saas/tests/e2e/marketing-responsive.spec.ts`

**Step 1: Write the failing test**

Use the Task 1 tests as the contract. Ensure the mobile menu test asserts open, close, and route navigation behavior.

**Step 2: Run test to verify it fails**

Run: `cd web-saas && npx playwright test tests/e2e/marketing-responsive.spec.ts -g "navigation|mobile" --project=chromium`

Expected: FAIL

**Step 3: Write minimal implementation**

In `MarketingShell.tsx`:

- add a small-screen menu button
- render a mobile navigation drawer/dialog
- include primary marketing links and auth CTAs
- close on overlay click and route change
- preserve current desktop nav

**Step 4: Run test to verify it passes**

Run: `cd web-saas && npx playwright test tests/e2e/marketing-responsive.spec.ts -g "navigation|mobile" --project=chromium`

Expected: PASS

**Step 5: Commit**

```bash
git add web-saas/src/components/layout/MarketingShell.tsx web-saas/tests/e2e/marketing-responsive.spec.ts
git commit -m "feat: add responsive marketing navigation"
```

### Task 3: Create a server-side public blog data layer

**Files:**
- Create: `web-saas/src/lib/seo/blogData.ts`
- Modify: `web-saas/src/lib/seo/blogFallback.ts`
- Reference: `web-saas/src/lib/seo/guideData.ts`
- Reference: `web-saas/src/lib/seo/blogSlugs.ts`

**Step 1: Write the failing test**

Add or extend tests so they expect:

- `/blog` initial HTML to include article links/content without waiting for client fetch
- `/blog/[slug]` initial HTML to include article content

Prefer Playwright assertions that work against server-rendered content, not client-only skeleton transitions.

**Step 2: Run test to verify it fails**

Run: `cd web-saas && npx playwright test tests/e2e/seo-marketing.spec.ts -g "blog" --project=chromium`

Expected: FAIL because the current blog pages fetch after hydration.

**Step 3: Write minimal implementation**

Create `blogData.ts` with:

- server API base resolution
- cacheable blog list fetcher
- cacheable blog detail fetcher
- full published blog index fetcher
- safe fallback metadata path for index rendering when API fails

Keep the browser `webApi` unchanged.

**Step 4: Run test to verify partial progress**

Run the same blog-focused SEO tests and confirm failures move from “no server content” toward page-component behavior.

**Step 5: Commit**

```bash
git add web-saas/src/lib/seo/blogData.ts web-saas/src/lib/seo/blogFallback.ts web-saas/tests/e2e/seo-marketing.spec.ts
git commit -m "feat: add server blog data fetchers"
```

### Task 4: Server-render the blog index with instant client-side filtering

**Files:**
- Modify: `web-saas/app/(marketing)/blog/page.tsx`
- Modify or split: `web-saas/src/components/blog/BlogIndexPage.tsx`
- Create if needed: `web-saas/src/components/blog/BlogIndexClient.tsx`
- Test: `web-saas/tests/e2e/seo-marketing.spec.ts`
- Test: `web-saas/tests/e2e/marketing-responsive.spec.ts`

**Step 1: Write the failing test**

Add assertions for:

- visible article cards present in initial load
- blog search/filter still works
- blog page remains usable on mobile viewport

**Step 2: Run test to verify it fails**

Run:

- `cd web-saas && npx playwright test tests/e2e/seo-marketing.spec.ts -g "blog" --project=chromium`
- `cd web-saas && npx playwright test tests/e2e/marketing-responsive.spec.ts -g "blog" --project=chromium`

Expected: FAIL

**Step 3: Write minimal implementation**

Refactor the blog index so:

- server page fetches the full metadata set
- server renders the first page of cards
- a client component handles search/filter/pagination in memory
- no initial client API request is required to show posts

Do not render all 500+ cards in the initial DOM.

**Step 4: Run test to verify it passes**

Run the same commands again.

Expected: PASS

**Step 5: Commit**

```bash
git add web-saas/app/(marketing)/blog/page.tsx web-saas/src/components/blog/BlogIndexPage.tsx web-saas/src/components/blog/BlogIndexClient.tsx web-saas/tests/e2e/seo-marketing.spec.ts web-saas/tests/e2e/marketing-responsive.spec.ts
git commit -m "feat: server render blog index with instant filtering"
```

### Task 5: Server-render blog article pages

**Files:**
- Modify: `web-saas/app/(marketing)/blog/[slug]/page.tsx`
- Modify: `web-saas/src/components/blog/BlogPostPage.tsx`
- Test: `web-saas/tests/e2e/seo-marketing.spec.ts`

**Step 1: Write the failing test**

Add assertions that:

- a representative blog article shows title and article body without waiting on a client loading state
- canonical and JSON-LD remain present

**Step 2: Run test to verify it fails**

Run: `cd web-saas && npx playwright test tests/e2e/seo-marketing.spec.ts -g "blog|structured data" --project=chromium`

Expected: FAIL

**Step 3: Write minimal implementation**

Convert the article route to server rendering:

- fetch blog detail on the server
- render the article body directly
- preserve fallback behavior only for API failure

**Step 4: Run test to verify it passes**

Run the same command again.

Expected: PASS

**Step 5: Commit**

```bash
git add web-saas/app/(marketing)/blog/[slug]/page.tsx web-saas/src/components/blog/BlogPostPage.tsx web-saas/tests/e2e/seo-marketing.spec.ts
git commit -m "feat: server render blog article pages"
```

### Task 6: Harden responsive layouts on key public pages

**Files:**
- Modify as needed:
  - `web-saas/app/(marketing)/page.tsx`
  - `web-saas/app/(marketing)/pricing/page.tsx`
  - `web-saas/app/(marketing)/features/page.tsx`
  - `web-saas/src/components/blog/BlogIndexPage.tsx`
  - `web-saas/src/components/blog/BlogPostPage.tsx`
- Test: `web-saas/tests/e2e/marketing-responsive.spec.ts`

**Step 1: Write the failing test**

Add or extend route-specific viewport assertions for:

- visible H1
- no broken CTA cluster
- no clipped or obviously overflowing content areas on narrow viewports

**Step 2: Run test to verify it fails**

Run: `cd web-saas && npx playwright test tests/e2e/marketing-responsive.spec.ts --project=chromium`

Expected: FAIL where layouts still need tightening.

**Step 3: Write minimal implementation**

Make only the responsive fixes needed to satisfy the regression coverage:

- stack wide hero sections correctly
- keep CTA groups usable on mobile
- adjust blog grid/card behavior for narrow widths

**Step 4: Run test to verify it passes**

Run the same responsive suite again.

Expected: PASS

**Step 5: Commit**

```bash
git add web-saas/app/(marketing)/page.tsx web-saas/app/(marketing)/pricing/page.tsx web-saas/app/(marketing)/features/page.tsx web-saas/src/components/blog/BlogIndexPage.tsx web-saas/src/components/blog/BlogPostPage.tsx web-saas/tests/e2e/marketing-responsive.spec.ts
git commit -m "fix: improve marketing responsiveness across key pages"
```

### Task 7: Add repeatable performance measurement for blog pages and APIs

**Files:**
- Create: `web-saas/perf/scenarios/blog-index.json`
- Create: `web-saas/perf/scenarios/blog-post.json`
- Create: `output/perf/` reports when running locally
- Modify docs if needed: `docs/plans/2026-03-06-marketing-responsive-content-performance-design.md`

**Step 1: Write the failing check**

Define the exact commands and thresholds for:

- page-level Lighthouse checks on `/blog`
- HTTP load baselines for blog list/detail APIs

**Step 2: Run baseline**

Run a local baseline after implementation:

- `cd web-saas && npm run build`
- `cd web-saas && npm run test:seo:lighthouse`

For API testing, use the load-performance-analysis scripts with the actual local/staging blog endpoints and save reports to `output/perf/`.

**Step 3: Write minimal implementation**

Keep this phase mostly as repeatable measurement assets and documented commands unless benchmarks show an immediate need for phase 2 caching.

**Step 4: Re-run and compare**

Use the same commands to compare before/after metrics where possible.

**Step 5: Commit**

```bash
git add web-saas/perf/scenarios docs/plans/2026-03-06-marketing-responsive-content-performance-design.md output/perf
git commit -m "chore: add blog performance verification scenarios"
```

### Task 8: Final verification

**Files:**
- Verify:
  - `web-saas/src/components/layout/MarketingShell.tsx`
  - `web-saas/src/components/blog/BlogIndexPage.tsx`
  - `web-saas/src/components/blog/BlogPostPage.tsx`
  - `web-saas/src/lib/seo/blogData.ts`
  - `web-saas/tests/e2e/marketing-responsive.spec.ts`
  - `web-saas/tests/e2e/seo-marketing.spec.ts`

**Step 1: Run focused responsive and SEO suites**

Run:

- `cd web-saas && npx playwright test tests/e2e/marketing-responsive.spec.ts --project=chromium`
- `cd web-saas && npx playwright test tests/e2e/seo-marketing.spec.ts --project=chromium`

Expected: PASS

**Step 2: Run typecheck**

Run: `cd web-saas && npm run typecheck`

Expected: PASS

**Step 3: Run Lighthouse baseline**

Run: `cd web-saas && npm run test:seo:lighthouse`

Expected: pass or produce explicit threshold deltas to address next

**Step 4: Clean Playwright artifacts**

Run:

- `git restore --source=HEAD --worktree --staged -- web-saas/output/playwright/report`
- `find web-saas/test-results -mindepth 1 -delete`
- `test -d web-saas/test-results && rmdir web-saas/test-results || true`

**Step 5: Commit**

```bash
git add web-saas/src/components/layout/MarketingShell.tsx web-saas/src/components/blog/BlogIndexPage.tsx web-saas/src/components/blog/BlogPostPage.tsx web-saas/src/lib/seo/blogData.ts web-saas/app/(marketing)/blog/page.tsx web-saas/app/(marketing)/blog/[slug]/page.tsx web-saas/tests/e2e/marketing-responsive.spec.ts web-saas/tests/e2e/seo-marketing.spec.ts
git commit -m "feat: improve marketing responsiveness and blog delivery"
```
