import { expect, test } from '@playwright/test';

import { bootstrapSession, mockAppConfig, mockJsonSuccess } from './helpers/mockApi';

test.describe('Learner notification settings', () => {
  test('hides social notification toggles and persists visible preference updates', async ({ page }) => {
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
    await expect(page.getByRole('heading', { name: /Profile\s*&\s*Notification Preferences/i })).toBeVisible();
    await expect(page.getByText('Study Preferences')).toBeVisible();
    await expect(page.getByText('Browser notifications are not available in this browser yet.')).toBeVisible();
    await expect(page.getByText('Study Defaults (UI Only)')).toHaveCount(0);
    await expect(page.getByText('unsupported')).toHaveCount(0);
    await expect(page.getByText('not registered')).toHaveCount(0);
    await expect(page.getByRole('switch', { name: /Direct messages/i })).toHaveCount(0);
    await expect(page.getByRole('switch', { name: /Group messages/i })).toHaveCount(0);
    await expect(page.getByRole('switch', { name: /Friend requests/i })).toHaveCount(0);
    await expect(page.getByRole('switch', { name: /Friend acceptances/i })).toHaveCount(0);

    const systemAnnouncementsToggle = page.getByRole('switch', { name: /System announcements/i });
    await expect(systemAnnouncementsToggle).toHaveAttribute('aria-checked', 'true');
    await systemAnnouncementsToggle.click();
    await expect(systemAnnouncementsToggle).toHaveAttribute('aria-checked', 'false');

    await expect(page.getByText('Notification preferences updated')).toBeVisible();
    expect(putCalls.length).toBeGreaterThan(0);
    expect(putCalls.at(-1)?.systemAnnouncementsEnabled).toBe(false);
  });
});
