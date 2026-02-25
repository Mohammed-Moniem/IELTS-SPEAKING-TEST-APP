import { expect, test } from '@playwright/test';

import { bootstrapSession, mockAppConfig, mockJsonSuccess } from './helpers/mockApi';

test.describe('Learner notification settings', () => {
  test('loads preferences and persists toggle updates', async ({ page }) => {
    await bootstrapSession(page);
    await mockAppConfig(page);

    let preferences = {
      dailyReminderEnabled: true,
      dailyReminderHour: 19,
      dailyReminderMinute: 0,
      achievementsEnabled: true,
      streakRemindersEnabled: true,
      inactivityRemindersEnabled: true,
      feedbackNotificationsEnabled: true,
      directMessagesEnabled: true,
      groupMessagesEnabled: true,
      friendRequestsEnabled: true,
      friendAcceptancesEnabled: true,
      systemAnnouncementsEnabled: true,
      offersEnabled: true,
      partnerOffersEnabled: true
    };

    const putCalls: any[] = [];

    await page.route('**/api/v1/notifications/preferences', async route => {
      const method = route.request().method();
      if (method === 'GET') {
        return route.fulfill(mockJsonSuccess(preferences));
      }

      if (method === 'PUT') {
        const body = route.request().postDataJSON() as typeof preferences;
        putCalls.push(body);
        preferences = body;
        return route.fulfill(mockJsonSuccess(preferences));
      }

      return route.fallback();
    });

    await page.goto('/app/settings');
    await expect(page.getByRole('heading', { name: /Profile and notification preferences/i })).toBeVisible();

    const friendRequestsToggle = page
      .locator('label')
      .filter({ hasText: /^Friend requests$/i })
      .locator('input[type="checkbox"]');
    await expect(friendRequestsToggle).toBeChecked();
    await friendRequestsToggle.uncheck();

    await expect(page.getByText('Notification preferences updated')).toBeVisible();
    expect(putCalls.length).toBeGreaterThan(0);
    expect(putCalls.at(-1)?.friendRequestsEnabled).toBe(false);
  });
});
