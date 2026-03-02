import { expect, test, type Page } from '@playwright/test';

const DEFAULT_SITE_ORIGIN = 'https://spokio.app';

const publicIndexableRoutes = [
  '/',
  '/pricing',
  '/features',
  '/advertise',
  '/blog',
  '/about',
  '/contact',
  '/editorial-policy',
  '/methodology',
  '/ielts',
  '/ielts/ielts-speaking-practice-online'
] as const;

const shouldBeNoIndexRoutes = ['/login', '/register'] as const;

const gotoStable = async (page: Page, route: string) => {
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const isTransientNavigationIssue =
        message.includes('NS_BINDING_ABORTED') || message.includes('interrupted by another navigation');
      if (!isTransientNavigationIssue || attempt === maxAttempts) {
        throw error;
      }
      await page.waitForTimeout(200);
    }
  }
};

const assertMarketingSeoTags = async (page: Page, route: string) => {
  await gotoStable(page, route);

  const title = await page.title();
  expect(title.length).toBeGreaterThan(10);

  const description = page.locator('meta[name="description"]');
  await expect(description).toHaveCount(1);
  const descriptionContent = await description.getAttribute('content');
  expect((descriptionContent || '').trim().length).toBeGreaterThan(30);

  const canonical = page.locator('link[rel="canonical"]');
  await expect(canonical).toHaveCount(1);
  const canonicalHref = await canonical.getAttribute('href');
  expect(canonicalHref).toBeTruthy();

  const robots = page.locator('meta[name="robots"]');
  await expect(robots).toHaveCount(1);
  const robotsContent = (await robots.getAttribute('content')) || '';
  expect(robotsContent.toLowerCase()).not.toContain('noindex');
};

test.describe('SEO marketing baseline', () => {
  test('indexable marketing pages expose core metadata and canonical tags', async ({ page }) => {
    for (const route of publicIndexableRoutes) {
      await assertMarketingSeoTags(page, route);
    }
  });

  test('auth entry pages are intentionally noindex', async ({ page }) => {
    for (const route of shouldBeNoIndexRoutes) {
      await gotoStable(page, route);
      const robotsContent = (await page.locator('meta[name="robots"]').getAttribute('content')) || '';
      expect(robotsContent.toLowerCase()).toContain('noindex');
      expect(robotsContent.toLowerCase()).toContain('nofollow');
    }
  });

  test('public marketing pages include structured data scripts', async ({ page }) => {
    const routesWithStructuredData = [
      '/',
      '/pricing',
      '/features',
      '/about',
      '/contact',
      '/editorial-policy',
      '/methodology',
      '/ielts',
      '/ielts/ielts-study-plan-30-days'
    ];

    for (const route of routesWithStructuredData) {
      await gotoStable(page, route);
      const jsonLdScripts = await page.locator('script[type="application/ld+json"]').allInnerTexts();
      expect(jsonLdScripts.length).toBeGreaterThan(0);
      expect(jsonLdScripts.join(' ')).toMatch(/schema\.org|@context|@type/i);
    }
  });

  test('guide detail pages expose breadcrumbs and editorial attribution', async ({ page }) => {
    await gotoStable(page, '/ielts/ielts-speaking-practice-online');

    await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Editorial Trust and Methodology/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Scoring methodology' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Editorial policy' })).toBeVisible();
  });

  test('robots and sitemap expose crawl configuration for public pages only', async ({ request }) => {
    const robotsResponse = await request.get('/robots.txt');
    expect(robotsResponse.ok()).toBeTruthy();
    const robotsText = await robotsResponse.text();
    const hostMatch = robotsText.match(/^Host:\s*(.+)$/m);
    const hostOrigin = hostMatch?.[1]?.trim() || DEFAULT_SITE_ORIGIN;
    expect(robotsText).toContain('Allow: /');
    expect(robotsText).toContain('Disallow: /app/');
    expect(robotsText).toContain('Disallow: /admin/');
    expect(robotsText).toContain(`Sitemap: ${hostOrigin}/sitemap.xml`);

    const sitemapResponse = await request.get('/sitemap.xml');
    expect(sitemapResponse.ok()).toBeTruthy();
    const sitemapText = await sitemapResponse.text();

    for (const route of publicIndexableRoutes) {
      expect(sitemapText).toContain(`${hostOrigin}${route}`);
    }

    for (const route of shouldBeNoIndexRoutes) {
      expect(sitemapText).not.toContain(`${hostOrigin}${route}`);
    }
  });
});
