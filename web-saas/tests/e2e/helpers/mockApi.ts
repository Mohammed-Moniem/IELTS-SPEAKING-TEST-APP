import { Page } from '@playwright/test';

const sessionStorageKey = 'spokio.web.session.v1';

type AdminRole = 'superadmin' | 'content_manager' | 'support_agent';
type SubscriptionPlan = 'free' | 'premium' | 'pro' | 'team';

type FeatureFlagState = {
  enabled: boolean;
  rolloutPercentage: number;
};

type MockConfigOptions = {
  roles?: AdminRole[];
  subscriptionPlan?: SubscriptionPlan;
  featureFlags?: Record<string, FeatureFlagState>;
};

const defaultFeatureFlags: Record<string, FeatureFlagState> = {
  writing_module: { enabled: true, rolloutPercentage: 100 },
  reading_module: { enabled: true, rolloutPercentage: 100 },
  listening_module: { enabled: true, rolloutPercentage: 100 },
  full_exam_module: { enabled: true, rolloutPercentage: 100 },
  admin_suite: { enabled: true, rolloutPercentage: 100 },
  growth_blog_v1: { enabled: true, rolloutPercentage: 100 },
  growth_geo_v1: { enabled: true, rolloutPercentage: 100 },
  growth_library_v1: { enabled: true, rolloutPercentage: 100 },
  growth_ads_v1: { enabled: true, rolloutPercentage: 100 },
  growth_insights_v1: { enabled: true, rolloutPercentage: 100 }
};

const buildStandardResponse = <T>(data: T, status = 200, message?: string) =>
  JSON.stringify({
    status,
    success: true,
    ...(message ? { message } : {}),
    data,
    timestamp: new Date().toISOString()
  });

export const mockJsonSuccess = <T>(data: T, status = 200, message?: string) => ({
  status,
  contentType: 'application/json',
  body: buildStandardResponse(data, status, message)
});

export async function bootstrapSession(
  page: Page,
  options: {
    userId?: string;
    email?: string;
    subscriptionPlan?: SubscriptionPlan;
    adminRoles?: AdminRole[];
  } = {}
) {
  const {
    userId = '507f1f77bcf86cd799439011',
    email = 'learner@example.com',
    subscriptionPlan = 'premium',
    adminRoles = []
  } = options;

  await page.addInitScript(
    payload => {
      window.localStorage.setItem(payload.key, JSON.stringify(payload.value));
    },
    {
      key: sessionStorageKey,
      value: {
        accessToken: 'playwright-access-token',
        refreshToken: 'playwright-refresh-token',
        user: {
          _id: userId,
          email,
          firstName: 'Playwright',
          lastName: 'Learner',
          subscriptionPlan,
          adminRoles
        }
      }
    }
  );
}

export async function mockAppConfig(page: Page, options: MockConfigOptions = {}) {
  const roles = options.roles || [];
  const subscriptionPlan = options.subscriptionPlan || 'premium';
  const featureFlags = {
    ...defaultFeatureFlags,
    ...(options.featureFlags || {})
  };
  const enabledFeatureFlags = Object.entries(featureFlags)
    .filter(([, value]) => value.enabled)
    .map(([key]) => key);

  await page.route('**/api/v1/app/config', route =>
    route.fulfill(
      mockJsonSuccess({
        roles,
        subscriptionPlan,
        usageSummary: {
          plan: subscriptionPlan,
          practiceCount: 2,
          testCount: 1,
          writingCount: 1,
          readingCount: 1,
          listeningCount: 1,
          aiRequestCount: 8,
          aiTokenCount: 22000,
          aiEstimatedCostUsd: 0.22,
          practiceLimit: 20,
          testLimit: 8,
          writingLimit: 12,
          readingLimit: 12,
          listeningLimit: 12,
          lastReset: new Date().toISOString()
        },
        enabledFeatureFlags,
        featureFlags
      })
    )
  );
}

export async function mockUsageSummary(page: Page) {
  await page.route('**/api/v1/usage/summary', route =>
    route.fulfill(
      mockJsonSuccess({
        plan: 'premium',
        practiceCount: 2,
        testCount: 1,
        writingCount: 1,
        readingCount: 1,
        listeningCount: 1,
        aiRequestCount: 8,
        aiTokenCount: 22000,
        aiEstimatedCostUsd: 0.22,
        practiceLimit: 20,
        testLimit: 8,
        writingLimit: 12,
        readingLimit: 12,
        listeningLimit: 12,
        lastReset: new Date().toISOString()
      })
    )
  );
}
