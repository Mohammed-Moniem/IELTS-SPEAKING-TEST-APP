import { expect, test, type Page } from '@playwright/test';

const mobileViewport = { width: 390, height: 844 };

const routeExpectations = [
  { route: '/', heading: /Raise your IELTS band/i },
  { route: '/pricing', heading: /Simple Pricing for Every IELTS Preparation Stage/i },
  { route: '/features', heading: /Everything Learners Need for IELTS Progress/i },
  { route: '/blog', heading: /IELTS strategy and study insights/i },
  {
    route: '/blog/academic-discussion-skills-for-ielts-speaking-part-3',
    heading: /Academic Discussion Skills for IELTS Speaking Part 3/i
  }
] as const;

const assertNoHorizontalOverflow = async (page: Page) => {
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    return root.scrollWidth - window.innerWidth;
  });

  expect(overflow).toBeLessThanOrEqual(1);
};

test.describe('Marketing responsiveness', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(mobileViewport);
  });

  test('marketing header uses the Spokio brand logo instead of placeholder text', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('header').getByAltText('Spokio')).toBeVisible();
    await expect(page.locator('header').getByText('IELTS SaaS Platform')).toHaveCount(0);
  });

  test('mobile navigation exposes primary links and auth actions', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('button', { name: /open menu/i })).toBeVisible();

    await page.getByRole('button', { name: /open menu/i }).click();

    const mobileDialog = page.getByRole('dialog', { name: /site navigation/i });
    await expect(mobileDialog).toBeVisible();
    await expect(mobileDialog.getByAltText('Spokio')).toBeVisible();
    await expect(mobileDialog.getByRole('link', { name: 'Blog' })).toBeVisible();
    await expect(mobileDialog.getByRole('link', { name: 'Pricing' })).toBeVisible();
    await expect(mobileDialog.getByRole('link', { name: 'Login' })).toBeVisible();
    await expect(mobileDialog.getByRole('link', { name: 'Start Free' })).toBeVisible();

    await mobileDialog.getByRole('link', { name: 'Blog' }).click();

    await expect(page).toHaveURL(/\/blog$/);
    await expect(page.getByRole('heading', { name: /IELTS strategy and study insights/i })).toBeVisible();
    await expect(mobileDialog).toBeHidden();
  });

  test('key public routes remain readable on mobile without horizontal overflow', async ({ page }) => {
    for (const item of routeExpectations) {
      await page.goto(item.route);
      await expect(page.getByRole('heading', { name: item.heading }).first()).toBeVisible();
      await assertNoHorizontalOverflow(page);
    }
  });
});
