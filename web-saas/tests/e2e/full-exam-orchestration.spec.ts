import { expect, test, type Page } from '@playwright/test';

import { bootstrapSession, mockAppConfig, mockJsonSuccess, mockUsageSummary } from './helpers/mockApi';

type ExamSectionStatus = 'pending' | 'in_progress' | 'completed';

type ModuleSection = {
  module: 'speaking' | 'writing' | 'reading' | 'listening';
  status: ExamSectionStatus;
  attemptId?: string;
  score?: number;
};

type MockExam = {
  _id: string;
  track: 'academic' | 'general';
  status: 'in_progress' | 'completed';
  sections: ModuleSection[];
  overallBand?: number;
};

type RuntimeState = {
  examId: string;
  status: 'in_progress' | 'completed';
  currentModule?: 'speaking' | 'writing' | 'reading' | 'listening';
  currentQuestionIndex?: number;
  interruptedAt?: string;
  resumeToken?: string;
  sections: ModuleSection[];
};

const createExam = (id: string, sections: ModuleSection[]): MockExam => ({
  _id: id,
  track: 'academic',
  status: 'in_progress',
  sections
});

const setupLearnerContext = async (page: Page) => {
  await bootstrapSession(page);
  await mockAppConfig(page);
  await mockUsageSummary(page);
};

test.describe('Full exam orchestration', () => {
  test('guides learner through complete full exam without manual IDs', async ({ page }) => {
    await setupLearnerContext(page);

    const examId = 'exam-full-1';
    let currentExam = createExam(examId, [
      { module: 'speaking', status: 'pending' },
      { module: 'writing', status: 'pending' },
      { module: 'reading', status: 'pending' },
      { module: 'listening', status: 'pending' }
    ]);
    let runtimeState: RuntimeState = {
      examId,
      status: 'in_progress',
      currentModule: 'speaking',
      currentQuestionIndex: 0,
      sections: currentExam.sections
    };

    await page.route('**/api/v1/exams/full/start', async route => {
      if (route.request().method() !== 'POST') {
        return route.fallback();
      }
      return route.fulfill(mockJsonSuccess(currentExam, 201, 'Full exam started'));
    });

    await page.route('**/api/v1/exams/full/*/section/*/submit', async route => {
      if (route.request().method() !== 'POST') {
        return route.fallback();
      }

      const body = route.request().postDataJSON() as { module: ModuleSection['module']; attemptId: string; score?: number };
      currentExam = {
        ...currentExam,
        sections: currentExam.sections.map(section =>
          section.module === body.module
            ? {
                ...section,
                status: 'completed',
                attemptId: body.attemptId,
                score: typeof body.score === 'number' ? body.score : section.score
              }
            : section
        )
      };
      const nextModule = currentExam.sections.find(section => section.status !== 'completed')?.module;
      runtimeState = {
        ...runtimeState,
        currentModule: nextModule,
        currentQuestionIndex: 0,
        sections: currentExam.sections
      };

      return route.fulfill(mockJsonSuccess(currentExam));
    });

    await page.route('**/api/v1/exams/full/*/complete', async route => {
      if (route.request().method() !== 'POST') {
        return route.fallback();
      }

      currentExam = {
        ...currentExam,
        status: 'completed',
        overallBand: 6.8
      };
      runtimeState = {
        ...runtimeState,
        status: 'completed',
        currentModule: undefined,
        sections: currentExam.sections
      };

      return route.fulfill(mockJsonSuccess(currentExam));
    });

    await page.route('**/api/v1/exams/full/*/results', route => route.fulfill(mockJsonSuccess(currentExam)));
    await page.route('**/api/v1/exams/full/*/runtime', route => route.fulfill(mockJsonSuccess(runtimeState)));
    await page.route('**/api/v1/exams/full/*/pause', async route => {
      runtimeState = {
        ...runtimeState,
        interruptedAt: new Date().toISOString(),
        resumeToken: 'resume-token-test'
      };
      return route.fulfill(mockJsonSuccess(currentExam));
    });
    await page.route('**/api/v1/exams/full/*/resume', async route => {
      runtimeState = {
        ...runtimeState,
        interruptedAt: undefined,
        resumeToken: 'resume-token-test-2'
      };
      return route.fulfill(mockJsonSuccess(currentExam));
    });

    await page.route('**/api/v1/test-simulations', async route => {
      if (route.request().method() !== 'POST') {
        return route.fallback();
      }

      return route.fulfill(
        mockJsonSuccess(
          {
            simulationId: 'simulation-1',
            parts: [
              { part: 1, question: 'Part 1 question', timeLimit: 60, tips: [] },
              { part: 2, question: 'Part 2 question', timeLimit: 120, tips: [] },
              { part: 3, question: 'Part 3 question', timeLimit: 90, tips: [] }
            ]
          },
          201
        )
      );
    });

    await page.route('**/api/v1/test-simulations/*/complete', async route => {
      if (route.request().method() !== 'POST') {
        return route.fallback();
      }

      return route.fulfill(
        mockJsonSuccess({
          _id: 'simulation-1',
          overallBand: 6.5
        })
      );
    });

    await page.route('**/api/v1/writing/tasks/generate', async route => {
      if (route.request().method() !== 'POST') {
        return route.fallback();
      }

      return route.fulfill(
        mockJsonSuccess({
          taskId: 'full-exam-writing-task',
          track: 'academic',
          taskType: 'task2',
          title: 'Globalization Essay',
          prompt: 'Do advantages of globalization outweigh disadvantages?',
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
        mockJsonSuccess({
          _id: 'writing-submission-1',
          overallBand: 6.5
        })
      );
    });

    await page.route('**/api/v1/reading/tests/start', async route => {
      if (route.request().method() !== 'POST') {
        return route.fallback();
      }

      return route.fulfill(
        mockJsonSuccess({
          attemptId: 'reading-attempt-1',
          test: {
            title: 'Reading Section',
            suggestedTimeMinutes: 20,
            questions: [{ questionId: 'r-q1', prompt: 'Pick one', options: ['A', 'B'] }]
          }
        })
      );
    });

    await page.route('**/api/v1/reading/tests/*/submit', async route => {
      if (route.request().method() !== 'POST') {
        return route.fallback();
      }

      return route.fulfill(mockJsonSuccess({ normalizedBand: 6.5 }));
    });

    await page.route('**/api/v1/listening/tests/start', async route => {
      if (route.request().method() !== 'POST') {
        return route.fallback();
      }

      return route.fulfill(
        mockJsonSuccess({
          attemptId: 'listening-attempt-1',
          test: {
            title: 'Listening Section',
            suggestedTimeMinutes: 20,
            questions: [{ questionId: 'l-q1', prompt: 'Pick one', options: ['X', 'Y'] }]
          }
        })
      );
    });

    await page.route('**/api/v1/listening/tests/*/submit', async route => {
      if (route.request().method() !== 'POST') {
        return route.fallback();
      }

      return route.fulfill(mockJsonSuccess({ normalizedBand: 7 }));
    });

    await page.goto('/app/tests');

    await page.getByRole('button', { name: 'Start Full Exam', exact: true }).click();
    await expect(page.getByText(`Exam ID: ${examId}`)).toBeVisible();
    await expect(page.getByText(/Active module:\s*speaking/i)).toBeVisible();

    await page.getByRole('button', { name: 'Start Speaking Simulation' }).click();
    const speakingResponses = page.locator('textarea');
    await speakingResponses.nth(0).fill('Answer for part one.');
    await speakingResponses.nth(1).fill('Answer for part two.');
    await speakingResponses.nth(2).fill('Answer for part three.');
    await page.getByRole('button', { name: 'Submit Speaking Section' }).click();
    await expect(page.getByText(/Active module:\s*writing/i)).toBeVisible();

    await page.getByRole('button', { name: 'Start Writing Task' }).click();
    await page
      .locator('textarea')
      .first()
      .fill('Globalization can improve economic opportunities, but countries must protect local labor markets and services.');
    await page.getByRole('button', { name: 'Submit Writing Section' }).click();
    await expect(page.getByText(/Active module:\s*reading/i)).toBeVisible();

    await page.getByRole('button', { name: 'Start Reading Section' }).click();
    await page.getByRole('button', { name: 'Submit Reading Section' }).click();
    await expect(page.getByText(/Active module:\s*listening/i)).toBeVisible();

    await page.getByRole('button', { name: 'Start Listening Section' }).click();
    await page.getByRole('button', { name: 'Submit Listening Section' }).click();
    await expect(page.getByText(/Active module:\s*none/i)).toBeVisible();

    await page.getByRole('button', { name: 'Complete Full Exam' }).click();
    await expect(page.getByText('Status: completed').first()).toBeVisible();
    await expect(page.getByText(/Active module:\s*none/i)).toBeVisible();
  });

  test('resumes an interrupted exam from local recovery state', async ({ page }) => {
    await setupLearnerContext(page);

    const resumeExamId = 'exam-full-resume-1';
    let runtime: RuntimeState = {
      examId: resumeExamId,
      status: 'in_progress',
      currentModule: 'reading',
      currentQuestionIndex: 12,
      interruptedAt: '2026-01-10T10:20:00.000Z',
      resumeToken: 'resume-token-resume',
      sections: [
        { module: 'speaking', status: 'completed', attemptId: 'sim-1', score: 6.5 },
        { module: 'writing', status: 'completed', attemptId: 'w-1', score: 6.5 },
        { module: 'reading', status: 'pending' },
        { module: 'listening', status: 'pending' }
      ]
    };

    await page.addInitScript(() => {
      window.localStorage.setItem(
        'spokio.web.full-exam.resume',
        JSON.stringify({
          examId: 'exam-full-resume-1',
          activeModule: 'reading'
        })
      );
    });

    await page.route('**/api/v1/exams/full/*/results', route =>
      route.fulfill(
        mockJsonSuccess({
          _id: resumeExamId,
          track: 'academic',
          status: 'in_progress',
          sections: [
            { module: 'speaking', status: 'completed', attemptId: 'sim-1', score: 6.5 },
            { module: 'writing', status: 'completed', attemptId: 'w-1', score: 6.5 },
            { module: 'reading', status: 'pending' },
            { module: 'listening', status: 'pending' }
          ]
        })
      )
    );
    await page.route('**/api/v1/exams/full/*/runtime', route => route.fulfill(mockJsonSuccess(runtime)));
    await page.route('**/api/v1/exams/full/*/resume', async route => {
      if (route.request().method() !== 'POST') {
        return route.fallback();
      }

      runtime = {
        ...runtime,
        interruptedAt: undefined,
        resumeToken: 'resume-token-resumed'
      };
      return route.fulfill(
        mockJsonSuccess({
          _id: resumeExamId,
          track: 'academic',
          status: 'in_progress',
          sections: runtime.sections
        })
      );
    });

    await page.route('**/api/v1/reading/tests/start', async route => {
      if (route.request().method() !== 'POST') {
        return route.fallback();
      }

      return route.fulfill(
        mockJsonSuccess({
          attemptId: 'reading-resume-attempt-1',
          test: {
            title: 'Reading Resume Section',
            suggestedTimeMinutes: 20,
            questions: [{ questionId: 'resume-r1', prompt: 'Resume question', options: ['A', 'B'] }]
          }
        })
      );
    });

    await page.goto('/app/tests');

    await expect(page.getByText(`Exam ID: ${resumeExamId}`)).toBeVisible();
    await expect(page.getByText('Ready to Resume?')).toBeVisible();
    await page.getByRole('button', { name: 'Start Timer & Continue' }).click();
    await expect(page.getByText('Ready to Resume?')).toBeHidden();
    await expect(page.getByText(/Active module:\s*reading/i)).toBeVisible();

    await page.getByRole('button', { name: 'Start Reading Section' }).click();
    await expect(page.getByText('Resume question')).toBeVisible();
  });
});
