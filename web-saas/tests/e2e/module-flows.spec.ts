import { expect, test, type Page } from '@playwright/test';

import { bootstrapSession, mockAppConfig, mockJsonSuccess, mockUsageSummary } from './helpers/mockApi';

const writingSubmissionId = 'writing-attempt-1';
const readingAttemptId = 'reading-attempt-1';
const listeningAttemptId = 'listening-attempt-1';

const setupLearnerContext = async (page: Page) => {
  await bootstrapSession(page);
  await mockAppConfig(page);
  await mockUsageSummary(page);
};

const mockWritingRoutes = async (page: Page) => {
  await page.route('**/api/v1/writing/tasks/generate', async route => {
    if (route.request().method() !== 'POST') {
      return route.fallback();
    }

    return route.fulfill(
      mockJsonSuccess({
        taskId: 'writing-task-1',
        track: 'academic',
        taskType: 'task2',
        title: 'Global Urbanization',
        prompt: 'Discuss benefits and drawbacks of urban migration.',
        minimumWords: 250,
        suggestedTimeMinutes: 40
      })
    );
  });

  await page.route('**/api/v1/writing/submissions', async route => {
    if (route.request().method() !== 'POST') {
      return route.fallback();
    }

    return route.fulfill(
      mockJsonSuccess(
        {
          _id: writingSubmissionId,
          taskId: 'writing-task-1',
          overallBand: 7,
          feedback: {
            summary: 'Clear argument progression with good lexical range.',
            inlineSuggestions: ['Use more precise examples in paragraph 2.']
          },
          breakdown: {
            taskResponse: 7,
            coherenceCohesion: 7,
            lexicalResource: 7,
            grammaticalRangeAccuracy: 6.5
          },
          createdAt: '2026-02-20T10:00:00.000Z'
        },
        201,
        'Submission accepted'
      )
    );
  });

  await page.route('**/api/v1/writing/submissions/*', route =>
    route.fulfill(
      mockJsonSuccess({
        _id: writingSubmissionId,
        taskId: 'writing-task-1',
        overallBand: 7,
        feedback: {
          summary: 'Clear argument progression with good lexical range.',
          inlineSuggestions: ['Use more precise examples in paragraph 2.']
        },
        breakdown: {
          taskResponse: 7,
          coherenceCohesion: 7,
          lexicalResource: 7,
          grammaticalRangeAccuracy: 6.5
        },
        createdAt: '2026-02-20T10:00:00.000Z'
      })
    )
  );

  await page.route('**/api/v1/writing/history?**', route =>
    route.fulfill(
      mockJsonSuccess([
        {
          _id: writingSubmissionId,
          overallBand: 7,
          feedback: { summary: 'Clear argument progression.' },
          breakdown: {
            taskResponse: 7,
            coherenceCohesion: 7,
            lexicalResource: 7,
            grammaticalRangeAccuracy: 6.5
          },
          createdAt: '2026-02-20T10:00:00.000Z'
        }
      ])
    )
  );
};

const mockReadingRoutes = async (page: Page) => {
  await page.route('**/api/v1/reading/tests/start', async route => {
    if (route.request().method() !== 'POST') {
      return route.fallback();
    }

    return route.fulfill(
      mockJsonSuccess(
        {
          attemptId: readingAttemptId,
          test: {
            title: 'Reading Practice Set 01',
            passageText: 'A short passage about renewable energy adoption trends.',
            suggestedTimeMinutes: 20,
            questions: [
              {
                questionId: 'r-q1',
                prompt: 'What is the primary topic?',
                options: ['Energy', 'Transport', 'Tourism']
              },
              {
                questionId: 'r-q2',
                prompt: 'Write one keyword from the passage.'
              }
            ]
          }
        },
        201
      )
    );
  });

  await page.route('**/api/v1/reading/tests/*/submit', async route => {
    if (route.request().method() !== 'POST') {
      return route.fallback();
    }
    return route.fulfill(mockJsonSuccess({ submitted: true }));
  });

  await page.route('**/api/v1/reading/tests/*', async route => {
    if (route.request().method() !== 'GET') {
      return route.fallback();
    }

    return route.fulfill(
      mockJsonSuccess({
        _id: readingAttemptId,
        status: 'completed',
        normalizedBand: 6.5,
        score: 1,
        totalQuestions: 2,
        feedback: { summary: 'Focus on precision in short answer responses.' },
        answers: [
          { questionId: 'r-q1', answer: 'Energy', isCorrect: true },
          { questionId: 'r-q2', answer: 'solar', isCorrect: false }
        ],
        createdAt: '2026-02-20T10:00:00.000Z'
      })
    );
  });

  await page.route('**/api/v1/reading/history?**', route =>
    route.fulfill(
      mockJsonSuccess([
        {
          _id: readingAttemptId,
          status: 'completed',
          normalizedBand: 6.5,
          score: 1,
          totalQuestions: 2,
          createdAt: '2026-02-20T10:00:00.000Z'
        }
      ])
    )
  );
};

const mockListeningRoutes = async (page: Page) => {
  await page.route('**/api/v1/listening/tests/start', async route => {
    if (route.request().method() !== 'POST') {
      return route.fallback();
    }

    return route.fulfill(
      mockJsonSuccess(
        {
          attemptId: listeningAttemptId,
          test: {
            title: 'Listening Practice Set 01',
            transcript: 'Host: Welcome to today’s orientation briefing...',
            suggestedTimeMinutes: 20,
            questions: [
              {
                questionId: 'l-q1',
                prompt: 'Which facility opens first?',
                options: ['Library', 'Lab', 'Cafeteria']
              }
            ]
          }
        },
        201
      )
    );
  });

  await page.route('**/api/v1/listening/tests/*/submit', async route => {
    if (route.request().method() !== 'POST') {
      return route.fallback();
    }
    return route.fulfill(mockJsonSuccess({ submitted: true }));
  });

  await page.route('**/api/v1/listening/tests/*', async route => {
    if (route.request().method() !== 'GET') {
      return route.fallback();
    }

    return route.fulfill(
      mockJsonSuccess({
        _id: listeningAttemptId,
        status: 'completed',
        normalizedBand: 7,
        score: 1,
        totalQuestions: 1,
        feedback: { summary: 'Strong comprehension in this set.' },
        answers: [{ questionId: 'l-q1', answer: 'Library', isCorrect: true }],
        createdAt: '2026-02-20T10:00:00.000Z'
      })
    );
  });

  await page.route('**/api/v1/listening/history?**', route =>
    route.fulfill(
      mockJsonSuccess([
        {
          _id: listeningAttemptId,
          status: 'completed',
          normalizedBand: 7,
          score: 1,
          totalQuestions: 1,
          createdAt: '2026-02-20T10:00:00.000Z'
        }
      ])
    )
  );
};

test.describe('Module learner flows', () => {
  test('completes writing flow with submit and deep-link detail', async ({ page }) => {
    await setupLearnerContext(page);
    await mockWritingRoutes(page);

    await page.goto('/app/writing');

    await page.getByRole('button', { name: 'Generate Writing Task' }).click();
    await expect(page.getByRole('heading', { name: 'Global Urbanization' })).toBeVisible();

    await page.getByPlaceholder('Write your response here...').fill(
      'Urban migration creates economic opportunity and wider service access, but it also increases rent pressure, congestion, and environmental strain. Policymakers should invest in transport infrastructure and affordable housing to balance growth with social stability and equal opportunity.'
    );

    await page.getByRole('button', { name: 'Submit for Evaluation' }).click();

    await expect(page.getByRole('heading', { name: 'Submission detail' })).toBeVisible();
    await expect(page.getByText('Submission evaluated successfully.')).toBeVisible();

    await page
      .getByRole('row', { name: new RegExp(writingSubmissionId) })
      .getByRole('link', { name: 'Deep Link' })
      .click();

    await expect(page).toHaveURL(new RegExp(`/app/writing/history/${writingSubmissionId}`));
    await expect(page.getByRole('heading', { name: 'Writing Submission Detail' })).toBeVisible();
  });

  test('completes reading flow with review-before-submit and deep-link detail', async ({ page }) => {
    await setupLearnerContext(page);
    await mockReadingRoutes(page);

    await page.goto('/app/reading');

    await page.getByRole('button', { name: 'Start Reading Test' }).click();
    await expect(page.getByRole('heading', { name: 'Reading Practice Set 01' })).toBeVisible();

    await page.locator('select').nth(1).selectOption('Energy');
    await page.getByRole('button', { name: /^Next$/ }).click();
    await page.getByPlaceholder('Your answer').fill('solar');
    await page.getByRole('button', { name: 'Review Answers' }).click();

    await expect(page.getByRole('heading', { name: 'Review before submit' })).toBeVisible();
    await expect(page.getByText('You answered 2 out of 2 questions.')).toBeVisible();

    await page.getByRole('button', { name: 'Submit Reading Test' }).click();
    await expect(page.getByRole('heading', { name: 'Reading result' })).toBeVisible();

    await page
      .getByRole('row', { name: new RegExp(readingAttemptId) })
      .getByRole('link', { name: 'Deep Link' })
      .click();

    await expect(page).toHaveURL(new RegExp(`/app/reading/history/${readingAttemptId}`));
    await expect(page.getByRole('heading', { name: 'Reading Attempt Detail' })).toBeVisible();
  });

  test('completes listening flow with transcript fallback and deep-link detail', async ({ page }) => {
    await setupLearnerContext(page);
    await mockListeningRoutes(page);

    await page.goto('/app/listening');

    await page.getByRole('button', { name: 'Start Listening Test' }).click();
    await expect(page.getByRole('heading', { name: 'Listening Practice Set 01' })).toBeVisible();
    await expect(page.getByText('Audio unavailable, use transcript fallback.')).toBeVisible();

    await page.locator('select').nth(1).selectOption('Library');
    await page.getByRole('button', { name: 'Review Answers' }).click();
    await page.getByRole('button', { name: 'Submit Listening Test' }).click();

    await expect(page.getByRole('heading', { name: 'Listening result' })).toBeVisible();

    await page
      .getByRole('row', { name: new RegExp(listeningAttemptId) })
      .getByRole('link', { name: 'Deep Link' })
      .click();

    await expect(page).toHaveURL(new RegExp(`/app/listening/history/${listeningAttemptId}`));
    await expect(page.getByRole('heading', { name: 'Listening Attempt Detail' })).toBeVisible();
  });

  test('supports progress-page deep links for all non-speaking modules', async ({ page }) => {
    await setupLearnerContext(page);

    await page.route('**/api/v1/writing/history?**', route =>
      route.fulfill(
        mockJsonSuccess([
          {
            _id: writingSubmissionId,
            overallBand: 7,
            feedback: { summary: 'Strong structure.' },
            breakdown: {
              taskResponse: 7,
              coherenceCohesion: 7,
              lexicalResource: 7,
              grammaticalRangeAccuracy: 6.5
            }
          }
        ])
      )
    );

    await page.route('**/api/v1/reading/history?**', route =>
      route.fulfill(
        mockJsonSuccess([
          {
            _id: readingAttemptId,
            normalizedBand: 6.5,
            score: 1,
            totalQuestions: 2
          }
        ])
      )
    );

    await page.route('**/api/v1/listening/history?**', route =>
      route.fulfill(
        mockJsonSuccess([
          {
            _id: listeningAttemptId,
            normalizedBand: 7,
            score: 1,
            totalQuestions: 1
          }
        ])
      )
    );

    await page.route('**/api/v1/writing/submissions/*', route =>
      route.fulfill(
        mockJsonSuccess({
          _id: writingSubmissionId,
          overallBand: 7,
          feedback: { summary: 'Strong structure.', inlineSuggestions: ['Keep examples concrete.'] },
          breakdown: {
            taskResponse: 7,
            coherenceCohesion: 7,
            lexicalResource: 7,
            grammaticalRangeAccuracy: 6.5
          }
        })
      )
    );

    await page.route('**/api/v1/reading/tests/*', route =>
      route.fulfill(
        mockJsonSuccess({
          _id: readingAttemptId,
          normalizedBand: 6.5,
          score: 1,
          totalQuestions: 2,
          feedback: { summary: 'Focus on precise short answers.' },
          answers: []
        })
      )
    );

    await page.route('**/api/v1/listening/tests/*', route =>
      route.fulfill(
        mockJsonSuccess({
          _id: listeningAttemptId,
          normalizedBand: 7,
          score: 1,
          totalQuestions: 1,
          feedback: { summary: 'Strong comprehension.' },
          answers: []
        })
      )
    );

    await page.goto('/app/progress');

    await page.getByRole('link', { name: 'Band 7 - Open detail' }).click();
    await expect(page.getByRole('heading', { name: 'Writing Submission Detail' })).toBeVisible();

    await page.goto('/app/progress');
    await page.getByRole('link', { name: /Reading band 6.5/ }).click();
    await expect(page.getByRole('heading', { name: 'Reading Attempt Detail' })).toBeVisible();

    await page.goto('/app/progress');
    await page.getByRole('link', { name: /Listening band 7/ }).click();
    await expect(page.getByRole('heading', { name: 'Listening Attempt Detail' })).toBeVisible();
  });
});
