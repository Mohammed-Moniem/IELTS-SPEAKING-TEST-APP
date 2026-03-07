import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

import { bootstrapSession, mockAppConfig, mockJsonSuccess, mockUsageSummary } from './helpers/mockApi';

const assertNoSeriousOrCriticalA11yIssues = async (page: Page) => {
  const results = await new AxeBuilder({ page }).analyze();
  const seriousIssues = results.violations.filter(
    violation => violation.impact === 'serious' || violation.impact === 'critical'
  );
  expect(seriousIssues).toEqual([]);
};

test.describe('Accessibility checks', () => {
  test('login page supports keyboard flow and has no serious axe violations', async ({ page }) => {
    await page.goto('/login');

    await expect(page.locator('header')).toBeVisible();
    await expect(page.locator('main')).toBeVisible();
    await expect(page.locator('nav')).toBeVisible();

    const emailInput = page.getByLabel('Email', { exact: true });
    const passwordInput = page.getByLabel('Password', { exact: true });
    const forgotPasswordLink = page.getByRole('link', { name: /forgot password/i });
    const submitButton = page.getByRole('button', { name: 'Login' });

    await emailInput.focus();
    await expect(emailInput).toBeFocused();
    await page.keyboard.press('Tab');
    const keyboardMovedFocus = await page.evaluate(() => document.activeElement?.tagName !== 'BODY');
    expect(keyboardMovedFocus).toBe(true);

    await forgotPasswordLink.focus();
    await expect(forgotPasswordLink).toBeFocused();

    await passwordInput.focus();
    await expect(passwordInput).toBeFocused();

    await submitButton.focus();
    await expect(submitButton).toBeFocused();

    await assertNoSeriousOrCriticalA11yIssues(page);
  });

  test('speaking page maintains landmarks and no serious axe violations for authenticated learner', async ({ page }) => {
    await bootstrapSession(page);
    await mockAppConfig(page);
    await mockUsageSummary(page);

    await page.route('**/api/v1/topics/practice**', route =>
      route.fulfill(
        mockJsonSuccess({
          topics: [
            {
              slug: 'local-food',
              title: 'Local Food',
              description: 'Describe a local dish you enjoy.',
              part: 1
            }
          ],
          total: 1,
          hasMore: false,
          limit: 9,
          offset: 0
        })
      )
    );

    await page.route('**/api/v1/practice/sessions?**', route => route.fulfill(mockJsonSuccess([])));
    await page.route('**/api/v1/test-simulations?**', route => route.fulfill(mockJsonSuccess([])));

    await page.goto('/app/speaking');

    await expect(page.locator('main')).toBeVisible();
    await expect(page.locator('aside')).toBeVisible();
    await expect(page.getByRole('heading', { name: /Speaking Practice/i })).toBeVisible();

    await assertNoSeriousOrCriticalA11yIssues(page);
  });
});
