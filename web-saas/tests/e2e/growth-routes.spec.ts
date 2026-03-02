import { expect, test } from '@playwright/test';

import { bootstrapSession, mockAppConfig, mockJsonSuccess, mockUsageSummary } from './helpers/mockApi';

test.describe('Growth routes', () => {
  test('marketing advertise page is available', async ({ page }) => {
    await page.goto('/advertise');
    await expect(page.getByRole('heading', { name: /Advertise with Spokio/i })).toBeVisible();
  });

  test('learner library routes render', async ({ page }) => {
    await bootstrapSession(page);
    await mockAppConfig(page);
    await mockUsageSummary(page);

    await page.route('**/api/v1/library/collocations?**', route =>
      route.fulfill(
        mockJsonSuccess({
          items: [],
          total: 0,
          limit: 24,
          offset: 0,
          hasMore: false
        })
      )
    );

    await page.route('**/api/v1/library/vocabulary?**', route =>
      route.fulfill(
        mockJsonSuccess({
          items: [],
          total: 0,
          limit: 24,
          offset: 0,
          hasMore: false
        })
      )
    );

    await page.route('**/api/v1/library/resources/books?**', route =>
      route.fulfill(
        mockJsonSuccess({
          items: [],
          total: 0,
          limit: 24,
          offset: 0,
          hasMore: false
        })
      )
    );

    await page.route('**/api/v1/library/resources/channels?**', route =>
      route.fulfill(
        mockJsonSuccess({
          items: [],
          total: 0,
          limit: 24,
          offset: 0,
          hasMore: false
        })
      )
    );

    await page.goto('/app/library/collocations');
    await expect(page.getByRole('heading', { name: /Collocations Library/i })).toBeVisible();

    await page.goto('/app/library/vocabulary');
    await expect(page.getByRole('heading', { name: /Vocabulary Library/i })).toBeVisible();

    await page.goto('/app/library/books');
    await expect(page.getByRole('heading', { name: /Books Library/i })).toBeVisible();

    await page.goto('/app/library/channels');
    await expect(page.getByRole('heading', { name: /Channels Library/i })).toBeVisible();
  });

  test('admin blog content route renders', async ({ page }) => {
    await bootstrapSession(page, { adminRoles: ['superadmin'] });
    await mockAppConfig(page, { roles: ['superadmin'] });
    await mockUsageSummary(page);

    await page.route('**/api/v1/admin/blog/posts?**', route =>
      route.fulfill(
        mockJsonSuccess({
          posts: [],
          total: 0,
          limit: 20,
          offset: 0,
          hasMore: false
        })
      )
    );

    await page.route('**/api/v1/admin/seo/content-health', route =>
      route.fulfill(
        mockJsonSuccess({
          generatedAt: new Date().toISOString(),
          totals: {
            totalPosts: 0,
            publishedPosts: 0,
            pendingReviewPosts: 0,
            failedQaPosts: 0,
            schemaFailures: 0,
            brokenLinkPosts: 0,
            queuedJobs: 0
          },
          clusters: []
        })
      )
    );

    await page.goto('/admin/content/blog');
    await expect(page.getByRole('heading', { name: /Blog Content Operations/i })).toBeVisible();
  });
});
