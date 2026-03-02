import { expect, test } from '@playwright/test';

const fullHeroRoutes = [
  '/about',
  '/advertise',
  '/blog',
  '/blog/example-slug',
  '/contact',
  '/editorial-policy',
  '/features',
  '/guarantee',
  '/ielts',
  '/ielts/ielts-speaking-practice-online',
  '/methodology',
  '/pricing'
] as const;

const authCompactRoutes = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email'
] as const;

test.describe('marketing motion visuals', () => {
  test('full shared hero renders only in motion variant on non-home marketing pages', async ({ page }) => {
    for (const route of fullHeroRoutes) {
      await page.goto(`${route}?mkt_variant=control`);
      await expect(page.getByTestId('marketing-shared-hero-full')).toHaveCount(0);

      await page.goto(`${route}?mkt_variant=motion`);
      await expect(page.getByTestId('marketing-shared-hero-full').first()).toBeVisible();
    }
  });

  test('compact shared hero renders only in motion variant on auth marketing pages', async ({ page }) => {
    for (const route of authCompactRoutes) {
      await page.goto(`${route}?mkt_variant=control`);
      await expect(page.getByTestId('marketing-shared-hero-compact')).toHaveCount(0);

      await page.goto(`${route}?mkt_variant=motion`);
      await expect(page.getByTestId('marketing-shared-hero-compact').first()).toBeVisible();
    }
  });

  test('home hero layout remains unchanged', async ({ page }) => {
    await page.goto('/?mkt_variant=motion');
    await expect(page.getByTestId('marketing-shared-hero-full')).toHaveCount(0);
  });

  test('homepage renders motion hero scene only in motion variant', async ({ page }) => {
    await page.goto('/?mkt_variant=control');
    await expect(page.getByTestId('motion-hero-scene')).toHaveCount(0);

    await page.goto('/?mkt_variant=motion');
    await expect(page.getByTestId('motion-hero-scene')).toBeVisible();
  });

  test('pricing page renders motion recommendation callout only in motion variant', async ({ page }) => {
    await page.goto('/pricing?mkt_variant=control');
    await expect(page.getByTestId('pricing-motion-callout')).toHaveCount(0);

    await page.goto('/pricing?mkt_variant=motion');
    await expect(page.getByTestId('pricing-motion-callout')).toBeVisible();
  });

  test('register page renders motion side illustration in motion variant', async ({ page }) => {
    await page.goto('/register?mkt_variant=motion');
    await expect(page.getByTestId('register-motion-side')).toBeVisible();
  });

  test('motion variant enables hero graphics while control keeps them hidden', async ({ page }) => {
    await page.goto('/about?mkt_variant=control');
    await expect(page.getByTestId('marketing-graphic-layer-hero')).toHaveCount(0);

    await page.goto('/about?mkt_variant=motion');
    await expect(page.getByTestId('marketing-graphic-layer-hero')).toBeVisible();
    await expect(page.getByTestId('marketing-graphic-layer-content').first()).toBeVisible();
  });

  test('shared hero respects reduced motion', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();

    await page.goto('/about?mkt_variant=motion');
    const line = page.locator('.motion-hero-line').first();
    await expect(line).toBeVisible();
    await expect
      .poll(async () => line.evaluate(el => window.getComputedStyle(el).animationName))
      .toBe('none');

    await context.close();
  });
});
