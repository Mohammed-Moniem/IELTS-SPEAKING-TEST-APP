import { expect, test } from '@playwright/test';

test.describe('marketing visual system', () => {
  test('homepage renders the new hero layout scaffold', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByTestId('marketing-hero-grid')).toBeVisible();
    await expect(page.getByTestId('marketing-proof-strip')).toBeVisible();
    await expect(page.getByTestId('marketing-value-grid')).toBeVisible();
  });
});
