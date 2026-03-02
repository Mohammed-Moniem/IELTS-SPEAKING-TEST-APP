import { expect, test } from '@playwright/test';

test.describe('marketing motion visuals', () => {
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
});
