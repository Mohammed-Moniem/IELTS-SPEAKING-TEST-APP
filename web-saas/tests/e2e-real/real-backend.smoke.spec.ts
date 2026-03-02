import { APIResponse, expect, test } from '@playwright/test';

const sessionStorageKey = 'spokio.web.session.v1';

const email = `playwright.real.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@example.com`;
const password = 'Spokio!123A';

const toResponseBody = async (response: APIResponse) => {
  try {
    return await response.json();
  } catch {
    return await response.text();
  }
};

const expectNonServerErrorResponse = (response: APIResponse, body: unknown, label: string) => {
  expect(response.status(), `${label} status=${response.status()} body=${JSON.stringify(body)}`).toBeLessThan(500);

  if (typeof body === 'object' && body !== null && 'success' in body) {
    expect(typeof (body as { success?: unknown }).success).toBe('boolean');
  } else {
    expect(String(body || '').length).toBeGreaterThan(0);
  }
};

test.describe.serial('real backend smoke', () => {
  test('registers, navigates learner routes, and validates core app/billing endpoints', async ({ page, request, baseURL }) => {
    const origin = baseURL || 'http://127.0.0.1:3020';
    const signInRequiredHeading = page.getByRole('heading', { name: 'Sign in required' });

    const ensureAuthenticated = async (targetPath: string) => {
      if (!(await signInRequiredHeading.isVisible().catch(() => false))) {
        return;
      }

      await page.getByRole('link', { name: 'Go to Login' }).click();
      await page.waitForURL('**/login**', { timeout: 20_000 });
      await page.getByLabel('Email').fill(email);
      await page.getByLabel('Password').fill(password);
      await page.getByRole('button', { name: 'Login' }).click();
      await page.waitForURL('**/app/**', { timeout: 45_000 });
      await page.goto(targetPath);
    };

    await page.goto('/register');
    await page.getByLabel('First name').fill('Playwright');
    await page.getByLabel('Last name').fill('Smoke');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByLabel('Phone (optional)').fill('+15550000000');
    await page.getByRole('button', { name: 'Create Account' }).click();

    await page.waitForURL('**/app/dashboard', { timeout: 45_000 });
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();

    const learnerRouteChecks: Array<{ path: string; heading: RegExp }> = [
      { path: '/app/dashboard', heading: /welcome back/i },
      { path: '/app/speaking', heading: /speaking practice/i },
      { path: '/app/progress', heading: /progress hub/i },
      { path: '/app/billing', heading: /subscription & billing/i },
      { path: '/app/settings', heading: /profile & notification preferences/i }
    ];

    for (const routeCheck of learnerRouteChecks) {
      await page.goto(routeCheck.path);
      await ensureAuthenticated(routeCheck.path);
      await expect(page).toHaveURL(new RegExp(`${routeCheck.path.replace(/\//g, '\\/')}`));
      await expect(page.getByRole('heading', { name: routeCheck.heading })).toBeVisible();
      await expect(page.getByText('Sign in required')).toHaveCount(0);
    }

    await page.getByRole('button', { name: 'Logout' }).click();
    await expect(page.getByRole('heading', { name: 'Sign in required' })).toBeVisible();
    await page.getByRole('link', { name: 'Go to Login' }).click();
    await page.waitForURL('**/login**', { timeout: 20_000 });
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();

    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Login' }).click();

    await page.waitForURL('**/app/**', { timeout: 45_000 });
    await page.goto('/app/dashboard');
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();

    const accessToken = await page.evaluate((key: string) => {
      const raw = window.localStorage.getItem(key);
      if (!raw) return null;
      try {
        const parsed = JSON.parse(raw) as { accessToken?: string };
        return parsed.accessToken || null;
      } catch {
        return null;
      }
    }, sessionStorageKey);

    expect(accessToken).toBeTruthy();

    const headers = {
      Authorization: `Bearer ${accessToken}`,
      'Unique-Reference-Code': `playwright-real-${Date.now()}`
    };

    const appConfigResponse = await request.get(`${origin}/api/v1/app/config`, { headers });
    const appConfigBody = await toResponseBody(appConfigResponse);
    expect(appConfigResponse.ok(), JSON.stringify(appConfigBody)).toBeTruthy();
    expect(appConfigBody.success).toBe(true);
    expect(Array.isArray(appConfigBody?.data?.enabledFeatureFlags)).toBe(true);

    const plansResponse = await request.get(`${origin}/api/v1/subscription/plans`, { headers });
    const plansBody = await toResponseBody(plansResponse);
    expect(plansResponse.ok(), JSON.stringify(plansBody)).toBeTruthy();
    expect(plansBody.success).toBe(true);
    expect(Array.isArray(plansBody?.data?.plans)).toBe(true);

    const stripeConfigResponse = await request.get(`${origin}/api/v1/subscription/config`, { headers });
    const stripeConfigBody = await toResponseBody(stripeConfigResponse);
    expect(stripeConfigResponse.ok(), JSON.stringify(stripeConfigBody)).toBeTruthy();
    expect(stripeConfigBody.success).toBe(true);
    expect(typeof stripeConfigBody?.data?.enabled).toBe('boolean');

    const checkoutResponse = await request.post(`${origin}/api/v1/subscription/checkout`, {
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      data: {
        planType: 'premium',
        billingCycle: 'monthly',
        successUrl: `${origin}/app/billing?checkout=success&plan=premium`,
        cancelUrl: `${origin}/app/billing?checkout=cancel&plan=premium`
      }
    });
    const checkoutBody = await toResponseBody(checkoutResponse);

    if (checkoutResponse.ok() && checkoutBody?.success) {
      expect(typeof checkoutBody?.data?.checkoutUrl).toBe('string');
      expect(checkoutBody.data.checkoutUrl.length).toBeGreaterThan(0);
    } else {
      expect(checkoutBody?.success).toBe(false);
      const checkoutError = checkoutBody?.error?.message || checkoutBody?.message || '';
      expect(String(checkoutError).length).toBeGreaterThan(0);
    }
  });

  test('validates module endpoint resilience and admin guard behavior on real backend', async ({ page, request, baseURL }) => {
    const origin = baseURL || 'http://127.0.0.1:3020';
    const localEmail = `playwright.real.deep.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@example.com`;

    await page.goto('/register');
    await page.getByLabel('First name').fill('Playwright');
    await page.getByLabel('Last name').fill('Deep');
    await page.getByLabel('Email').fill(localEmail);
    await page.getByLabel('Password').fill(password);
    await page.getByLabel('Phone (optional)').fill('+15550000011');
    await page.getByRole('button', { name: 'Create Account' }).click();
    await page.waitForURL('**/app/dashboard', { timeout: 45_000 });

    const accessToken = await page.evaluate((key: string) => {
      const raw = window.localStorage.getItem(key);
      if (!raw) return null;
      try {
        const parsed = JSON.parse(raw) as { accessToken?: string };
        return parsed.accessToken || null;
      } catch {
        return null;
      }
    }, sessionStorageKey);

    expect(accessToken).toBeTruthy();

    const headers = {
      Authorization: `Bearer ${accessToken}`,
      'Unique-Reference-Code': `playwright-real-deep-${Date.now()}`,
      'Content-Type': 'application/json'
    };

    const dateFrom = '2026-01-01';
    const dateTo = '2026-12-31';

    const writingGenerateResponse = await request.post(`${origin}/api/v1/writing/tasks/generate`, {
      headers,
      data: {
        track: 'academic',
        taskType: 'task2'
      }
    });
    const writingGenerateBody = await toResponseBody(writingGenerateResponse);
    expectNonServerErrorResponse(writingGenerateResponse, writingGenerateBody, 'writing generate');

    const taskId =
      typeof writingGenerateBody === 'object' && writingGenerateBody !== null
        ? (writingGenerateBody as { data?: { taskId?: string } }).data?.taskId
        : undefined;

    if (taskId) {
      const writingSubmitResponse = await request.post(`${origin}/api/v1/writing/submissions`, {
        headers,
        data: {
          taskId,
          responseText:
            'Public transport should be subsidized because it reduces congestion and emissions while improving equity.',
          durationSeconds: 900
        }
      });
      const writingSubmitBody = await toResponseBody(writingSubmitResponse);
      expectNonServerErrorResponse(writingSubmitResponse, writingSubmitBody, 'writing submit');
    }

    const writingHistoryResponse = await request.get(
      `${origin}/api/v1/writing/history?limit=2&offset=0&track=academic&from=${dateFrom}&to=${dateTo}`,
      { headers }
    );
    const writingHistoryBody = await toResponseBody(writingHistoryResponse);
    expectNonServerErrorResponse(writingHistoryResponse, writingHistoryBody, 'writing history');

    const readingStartResponse = await request.post(`${origin}/api/v1/reading/tests/start`, {
      headers,
      data: { track: 'academic' }
    });
    const readingStartBody = await toResponseBody(readingStartResponse);
    expectNonServerErrorResponse(readingStartResponse, readingStartBody, 'reading start');

    const readingAttemptId =
      typeof readingStartBody === 'object' && readingStartBody !== null
        ? (readingStartBody as { data?: { attemptId?: string; _id?: string } }).data?.attemptId ||
          (readingStartBody as { data?: { attemptId?: string; _id?: string } }).data?._id
        : undefined;

    if (readingAttemptId) {
      const readingSubmitResponse = await request.post(
        `${origin}/api/v1/reading/tests/${readingAttemptId}/submit`,
        {
          headers,
          data: {
            answers: {},
            durationSeconds: 300
          }
        }
      );
      const readingSubmitBody = await toResponseBody(readingSubmitResponse);
      expectNonServerErrorResponse(readingSubmitResponse, readingSubmitBody, 'reading submit');

      const readingDetailResponse = await request.get(`${origin}/api/v1/reading/tests/${readingAttemptId}`, { headers });
      const readingDetailBody = await toResponseBody(readingDetailResponse);
      expectNonServerErrorResponse(readingDetailResponse, readingDetailBody, 'reading detail');
    }

    const readingHistoryResponse = await request.get(
      `${origin}/api/v1/reading/history?limit=2&offset=0&track=academic&from=${dateFrom}&to=${dateTo}`,
      { headers }
    );
    const readingHistoryBody = await toResponseBody(readingHistoryResponse);
    expectNonServerErrorResponse(readingHistoryResponse, readingHistoryBody, 'reading history');

    const listeningStartResponse = await request.post(`${origin}/api/v1/listening/tests/start`, {
      headers,
      data: { track: 'academic' }
    });
    const listeningStartBody = await toResponseBody(listeningStartResponse);
    expectNonServerErrorResponse(listeningStartResponse, listeningStartBody, 'listening start');

    const listeningAttemptId =
      typeof listeningStartBody === 'object' && listeningStartBody !== null
        ? (listeningStartBody as { data?: { attemptId?: string; _id?: string } }).data?.attemptId ||
          (listeningStartBody as { data?: { attemptId?: string; _id?: string } }).data?._id
        : undefined;

    if (listeningAttemptId) {
      const listeningSubmitResponse = await request.post(
        `${origin}/api/v1/listening/tests/${listeningAttemptId}/submit`,
        {
          headers,
          data: {
            answers: {},
            durationSeconds: 300
          }
        }
      );
      const listeningSubmitBody = await toResponseBody(listeningSubmitResponse);
      expectNonServerErrorResponse(listeningSubmitResponse, listeningSubmitBody, 'listening submit');

      const listeningDetailResponse = await request.get(`${origin}/api/v1/listening/tests/${listeningAttemptId}`, {
        headers
      });
      const listeningDetailBody = await toResponseBody(listeningDetailResponse);
      expectNonServerErrorResponse(listeningDetailResponse, listeningDetailBody, 'listening detail');
    }

    const listeningHistoryResponse = await request.get(
      `${origin}/api/v1/listening/history?limit=2&offset=0&track=academic&from=${dateFrom}&to=${dateTo}`,
      { headers }
    );
    const listeningHistoryBody = await toResponseBody(listeningHistoryResponse);
    expectNonServerErrorResponse(listeningHistoryResponse, listeningHistoryBody, 'listening history');

    const examStartResponse = await request.post(`${origin}/api/v1/exams/full/start`, {
      headers,
      data: {
        track: 'academic'
      }
    });
    const examStartBody = await toResponseBody(examStartResponse);
    expectNonServerErrorResponse(examStartResponse, examStartBody, 'full exam start');

    const examId =
      typeof examStartBody === 'object' && examStartBody !== null
        ? (examStartBody as { data?: { examId?: string; _id?: string } }).data?.examId ||
          (examStartBody as { data?: { examId?: string; _id?: string } }).data?._id
        : undefined;

    if (examId) {
      const examResultsResponse = await request.get(`${origin}/api/v1/exams/full/${examId}/results`, { headers });
      const examResultsBody = await toResponseBody(examResultsResponse);
      expectNonServerErrorResponse(examResultsResponse, examResultsBody, 'full exam results');
    }

    await page.goto('/admin/overview');
    await expect(page.getByRole('heading', { name: 'Admin role required' })).toBeVisible();
  });
});
