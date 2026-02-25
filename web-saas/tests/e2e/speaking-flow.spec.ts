import { expect, test, type Page } from '@playwright/test';

import { bootstrapSession, mockAppConfig, mockJsonSuccess, mockUsageSummary } from './helpers/mockApi';

const practiceSessionId = '507f1f77bcf86cd799439012';

type MediaMockOptions = {
  getUserMediaErrorName?: string;
  getUserMediaErrorMessage?: string;
  recorderConstructorErrorName?: string;
  recorderConstructorErrorMessage?: string;
  recorderStartErrorName?: string;
  recorderStartErrorMessage?: string;
  devices?: Array<{ kind: string; deviceId: string; label: string }>;
};

const installMockMediaStack = async (page: Page, options: MediaMockOptions = {}) => {
  await page.addInitScript(
    opts => {
      const devices =
        opts.devices && opts.devices.length > 0
          ? opts.devices
          : [{ kind: 'audioinput', deviceId: 'mic-1', label: 'Mock Microphone' }];

      const createNamedError = (name: string, message: string) => {
        const error = new Error(message) as Error & { name: string };
        error.name = name;
        return error;
      };

      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: {
          enumerateDevices: async () => devices,
          getUserMedia: async () => {
            if (opts.getUserMediaErrorName) {
              throw createNamedError(opts.getUserMediaErrorName, opts.getUserMediaErrorMessage || 'Media error');
            }
            return {
              getTracks: () => [{ stop: () => undefined }]
            };
          }
        }
      });

      class FakeMediaRecorder {
        public state = 'inactive';
        public ondataavailable: ((event: { data: Blob }) => void) | null = null;
        public onstop: (() => void) | null = null;

        constructor(_: unknown) {
          if (opts.recorderConstructorErrorName) {
            throw createNamedError(
              opts.recorderConstructorErrorName,
              opts.recorderConstructorErrorMessage || 'Recorder constructor error'
            );
          }
        }

        public start() {
          if (opts.recorderStartErrorName) {
            throw createNamedError(
              opts.recorderStartErrorName,
              opts.recorderStartErrorMessage || 'Recorder start error'
            );
          }

          this.state = 'recording';
          if (this.ondataavailable) {
            this.ondataavailable({
              data: new Blob(['mock-audio'], { type: 'audio/webm' })
            });
          }
        }

        public stop() {
          this.state = 'inactive';
          if (this.onstop) {
            this.onstop();
          }
        }
      }

      Object.defineProperty(window, 'MediaRecorder', {
        configurable: true,
        value: FakeMediaRecorder
      });
    },
    { ...options }
  );
};

const mockSpeakingRoutes = async (page: Page) => {
  await page.route('**/api/v1/topics/practice**', route =>
    route.fulfill(
      mockJsonSuccess({
        topics: [
          {
            slug: 'memorable-trip',
            title: 'Memorable Trip',
            description: 'Describe a memorable trip you took.',
            part: 2,
            difficulty: 'medium'
          }
        ],
        total: 1,
        hasMore: false,
        limit: 9,
        offset: 0
      })
    )
  );

  await page.route('**/api/v1/practice/sessions?**', route =>
    route.fulfill(
      mockJsonSuccess([
        {
          _id: practiceSessionId,
          topicId: 'memorable-trip',
          topicTitle: 'Memorable Trip',
          question: 'Describe a memorable trip you took.',
          status: 'completed',
          feedback: {
            overallBand: 6.5,
            summary: 'Good structure and a clear narrative.',
            improvements: ['Use a wider range of linking phrases']
          },
          createdAt: '2026-02-01T10:00:00.000Z'
        }
      ])
    )
  );

  await page.route('**/api/v1/practice/sessions/*', async route => {
    if (route.request().method() !== 'GET') {
      return route.fallback();
    }

    return route.fulfill(
      mockJsonSuccess({
        _id: practiceSessionId,
        topicId: 'memorable-trip',
        topicTitle: 'Memorable Trip',
        question: 'Describe a memorable trip you took.',
        status: 'completed',
        userResponse: 'I travelled and explained my experience clearly.',
        feedback: {
          overallBand: 6.5,
          summary: 'Good structure and a clear narrative.',
          strengths: ['Clear sequence'],
          improvements: ['Use richer collocations'],
          bandBreakdown: {
            pronunciation: 6.5,
            fluency: 6.5,
            lexicalResource: 6.0,
            grammaticalRange: 6.5
          }
        },
        createdAt: '2026-02-01T10:00:00.000Z',
        completedAt: '2026-02-01T10:10:00.000Z'
      })
    );
  });

  await page.route('**/api/v1/test-simulations?**', route => route.fulfill(mockJsonSuccess([])));

  await page.route('**/api/v1/practice/sessions', async route => {
    if (route.request().method() !== 'POST') {
      return route.fallback();
    }

    return route.fulfill(
      mockJsonSuccess(
        {
          sessionId: practiceSessionId,
          question: 'Describe a memorable trip you took.',
          timeLimit: 120,
          tips: ['Give specific details', 'Use past-tense linking phrases'],
          topic: {
            slug: 'memorable-trip',
            title: 'Memorable Trip',
            part: 2
          }
        },
        201,
        'Practice session started'
      )
    );
  });

  await page.route('**/api/v1/practice/sessions/*/complete', route =>
    route.fulfill(
      mockJsonSuccess(
        {
          _id: practiceSessionId,
          topicId: 'memorable-trip',
          status: 'completed',
          feedback: {
            overallBand: 6.5,
            summary: 'Good structure and a clear narrative.',
            improvements: ['Use a wider range of linking phrases']
          }
        },
        200,
        'Practice session completed'
      )
    )
  );
};

test.describe('Speaking flow', () => {
  test.beforeEach(async ({ page }) => {
    await bootstrapSession(page);
    await mockAppConfig(page);
    await mockUsageSummary(page);
    await mockSpeakingRoutes(page);
  });

  test('completes speaking practice with manual transcript fallback', async ({ page }) => {
    await page.goto('/app/speaking');

    await expect(page.getByRole('heading', { name: /Practice, simulation, and quick evaluator/i })).toBeVisible();
    await page.getByRole('button', { name: 'Start Practice' }).first().click();

    await expect(page.getByText(`Session: ${practiceSessionId}`)).toBeVisible();
    await page
      .getByPlaceholder('Type your answer if microphone permission is denied or device fails')
      .fill('I visited Istanbul last year and explored the historical districts with my family.');

    await page.getByRole('button', { name: 'Submit Manual Transcript' }).click();

    await expect(page.getByRole('heading', { name: 'Practice evaluator result' })).toBeVisible();
    await expect(page.getByText(/Band 6.5/i)).toBeVisible();

    await page.getByRole('link', { name: 'Open' }).first().click();
    await expect(page.getByRole('heading', { name: /Speaking session report|Memorable Trip/i })).toBeVisible();
    await expect(page.getByText(/Band insights/i)).toBeVisible();
  });

  test('shows explicit error when microphone permission is denied', async ({ page }) => {
    await installMockMediaStack(page, {
      getUserMediaErrorName: 'NotAllowedError',
      getUserMediaErrorMessage: 'Permission denied'
    });

    await page.goto('/app/speaking');

    await page.getByRole('button', { name: 'Start Practice' }).first().click();
    await page.getByRole('button', { name: 'Start Recording' }).click();

    await expect(
      page.getByText('Microphone permission denied. You can continue with manual transcript input.')
    ).toBeVisible();
  });

  test('shows explicit error when no microphone device is available', async ({ page }) => {
    await installMockMediaStack(page, {
      devices: [],
      getUserMediaErrorName: 'NotFoundError',
      getUserMediaErrorMessage: 'No input devices'
    });

    await page.goto('/app/speaking');
    await page.getByRole('button', { name: 'Start Practice' }).first().click();
    await page.getByRole('button', { name: 'Start Recording' }).click();

    await expect(
      page.getByText('No microphone device found. Connect a microphone or use manual transcript input.')
    ).toBeVisible();
  });

  test('handles recorder runtime failure and keeps manual transcript fallback available', async ({ page }) => {
    await installMockMediaStack(page, {
      recorderStartErrorName: 'RecorderError',
      recorderStartErrorMessage: 'Recorder crashed while starting'
    });

    await page.goto('/app/speaking');
    await page.getByRole('button', { name: 'Start Practice' }).first().click();
    await page.getByRole('button', { name: 'Start Recording' }).click();

    await expect(page.getByText('Recorder crashed while starting')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Submit Manual Transcript' })).toBeEnabled();
  });

  test('surfaces upload timeout and allows manual transcript recovery', async ({ page }) => {
    await installMockMediaStack(page);

    await page.route('**/api/v1/practice/sessions/*/audio', route =>
      route.fulfill({
        status: 504,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          message: 'Upload timed out'
        })
      })
    );

    await page.goto('/app/speaking');
    await page.getByRole('button', { name: 'Start Practice' }).first().click();
    await page.getByRole('button', { name: 'Start Recording' }).click();
    await page.getByRole('button', { name: 'Stop + Upload' }).click();

    await expect(page.getByText('Upload timed out')).toBeVisible();

    await page
      .getByPlaceholder('Type your answer if microphone permission is denied or device fails')
      .fill('I travelled with my family and learned a lot from the experience.');
    await page.getByRole('button', { name: 'Submit Manual Transcript' }).click();
    await expect(page.getByRole('heading', { name: 'Practice evaluator result' })).toBeVisible();
  });

  test('handles transcription failure with fallback transcript path', async ({ page }) => {
    await installMockMediaStack(page);

    await page.route('**/api/v1/practice/sessions/*/audio', route =>
      route.fulfill({
        status: 422,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          message: 'Transcription failed. Please use manual transcript input.'
        })
      })
    );

    await page.goto('/app/speaking');
    await page.getByRole('button', { name: 'Start Practice' }).first().click();
    await page.getByRole('button', { name: 'Start Recording' }).click();
    await page.getByRole('button', { name: 'Stop + Upload' }).click();

    await expect(page.getByText('Transcription failed. Please use manual transcript input.')).toBeVisible();

    await page
      .getByPlaceholder('Type your answer if microphone permission is denied or device fails')
      .fill('My answer is provided manually after transcription fallback.');
    await page.getByRole('button', { name: 'Submit Manual Transcript' }).click();

    await expect(page.getByRole('heading', { name: 'Practice evaluator result' })).toBeVisible();
  });
});
