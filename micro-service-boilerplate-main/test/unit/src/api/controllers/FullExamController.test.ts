import 'reflect-metadata';

import request from 'supertest';
import { createExpressServer, useContainer } from 'routing-controllers';
import { Container } from 'typedi';

import { FullExamController } from '../../../../../src/api/controllers/FullExamController';
import { FullExamService } from '../../../../../src/api/services/FullExamService';
import { generateAccessToken } from '../../../../../src/lib/auth/token';

const accessToken = generateAccessToken({
  sub: '507f1f77bcf86cd799439011',
  email: 'learner@example.com',
  plan: 'premium',
  roles: []
});

describe('FullExamController', () => {
  beforeAll(() => {
    useContainer(Container);
  });

  afterEach(() => {
    Container.reset();
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  const createApp = () =>
    createExpressServer({
      routePrefix: '/api/v1',
      controllers: [FullExamController],
      defaultErrorHandler: false
    });

  it('supports additive full exam orchestration endpoints', async () => {
    const fullExamService = {
      startExam: jest.fn().mockResolvedValue({
        _id: 'exam-1',
        status: 'in_progress',
        sections: [{ module: 'speaking', status: 'pending' }],
        runtime: {
          currentModule: 'speaking',
          currentQuestionIndex: 0
        }
      }),
      submitSection: jest.fn().mockResolvedValue({
        _id: 'exam-1',
        status: 'in_progress',
        sections: [{ module: 'speaking', status: 'completed', attemptId: 'sim-1', score: 6.5 }],
        runtime: {
          currentModule: 'writing',
          currentQuestionIndex: 0
        }
      }),
      completeExam: jest.fn().mockResolvedValue({
        _id: 'exam-1',
        status: 'completed',
        overallBand: 6.5
      }),
      pauseExam: jest.fn().mockResolvedValue({
        _id: 'exam-1',
        status: 'in_progress',
        runtime: {
          currentModule: 'reading',
          currentQuestionIndex: 12,
          interruptedAt: '2026-02-22T10:00:00.000Z',
          resumeToken: 'resume-token-1'
        }
      }),
      resumeExam: jest.fn().mockResolvedValue({
        _id: 'exam-1',
        status: 'in_progress',
        runtime: {
          currentModule: 'reading',
          currentQuestionIndex: 12,
          resumeToken: 'resume-token-2'
        }
      }),
      getRuntime: jest.fn().mockResolvedValue({
        examId: 'exam-1',
        status: 'in_progress',
        currentModule: 'reading',
        currentQuestionIndex: 12,
        remainingSecondsByModule: {
          reading: 1850
        },
        interruptedAt: '2026-02-22T10:00:00.000Z',
        resumeToken: 'resume-token-2'
      }),
      getResults: jest.fn().mockResolvedValue({
        _id: 'exam-1',
        status: 'completed',
        overallBand: 6.5
      })
    } as unknown as FullExamService;

    Container.set({ id: FullExamService, value: fullExamService });

    const app = createApp();

    const startResponse = await request(app)
      .post('/api/v1/exams/full/start')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Unique-Reference-Code', 'full-exam-start-test')
      .send({ track: 'general' });

    expect(startResponse.status).toBe(201);
    expect(startResponse.body.success).toBe(true);
    expect(startResponse.body.message).toBe('Full exam started');
    expect(fullExamService.startExam).toHaveBeenCalledWith(
      '507f1f77bcf86cd799439011',
      'general',
      expect.objectContaining({ urc: 'full-exam-start-test' })
    );

    const submitResponse = await request(app)
      .post('/api/v1/exams/full/exam-1/section/speaking/submit')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Unique-Reference-Code', 'full-exam-submit-test')
      .send({ module: 'speaking', attemptId: 'sim-1', score: 6.5 });

    expect(submitResponse.status).toBe(200);
    expect(submitResponse.body.success).toBe(true);
    expect(submitResponse.body.message).toBe('Section submitted');
    expect(fullExamService.submitSection).toHaveBeenCalledWith(
      '507f1f77bcf86cd799439011',
      'exam-1',
      'speaking',
      'sim-1',
      6.5,
      expect.objectContaining({ urc: 'full-exam-submit-test' })
    );

    const completeResponse = await request(app)
      .post('/api/v1/exams/full/exam-1/complete')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Unique-Reference-Code', 'full-exam-complete-test')
      .send({});

    expect(completeResponse.status).toBe(200);
    expect(completeResponse.body.success).toBe(true);
    expect(completeResponse.body.message).toBe('Full exam completed');
    expect(fullExamService.completeExam).toHaveBeenCalledWith(
      '507f1f77bcf86cd799439011',
      'exam-1',
      expect.objectContaining({ urc: 'full-exam-complete-test' })
    );

    const resultResponse = await request(app)
      .get('/api/v1/exams/full/exam-1/results')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Unique-Reference-Code', 'full-exam-results-test');

    expect(resultResponse.status).toBe(200);
    expect(resultResponse.body.success).toBe(true);
    expect(fullExamService.getResults).toHaveBeenCalledWith('507f1f77bcf86cd799439011', 'exam-1');

    const pauseResponse = await request(app)
      .post('/api/v1/exams/full/exam-1/pause')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Unique-Reference-Code', 'full-exam-pause-test')
      .send({
        currentModule: 'reading',
        currentQuestionIndex: 12,
        remainingSecondsByModule: {
          reading: 1850
        }
      });

    expect(pauseResponse.status).toBe(200);
    expect(pauseResponse.body.success).toBe(true);
    expect(fullExamService.pauseExam).toHaveBeenCalledWith(
      '507f1f77bcf86cd799439011',
      'exam-1',
      {
        currentModule: 'reading',
        currentQuestionIndex: 12,
        remainingSecondsByModule: {
          reading: 1850
        }
      },
      expect.objectContaining({ urc: 'full-exam-pause-test' })
    );

    const resumeResponse = await request(app)
      .post('/api/v1/exams/full/exam-1/resume')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Unique-Reference-Code', 'full-exam-resume-test')
      .send({
        currentModule: 'reading',
        currentQuestionIndex: 12,
        resumeToken: 'resume-token-1'
      });

    expect(resumeResponse.status).toBe(200);
    expect(resumeResponse.body.success).toBe(true);
    expect(fullExamService.resumeExam).toHaveBeenCalledWith(
      '507f1f77bcf86cd799439011',
      'exam-1',
      {
        currentModule: 'reading',
        currentQuestionIndex: 12,
        resumeToken: 'resume-token-1'
      },
      expect.objectContaining({ urc: 'full-exam-resume-test' })
    );

    const runtimeResponse = await request(app)
      .get('/api/v1/exams/full/exam-1/runtime')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Unique-Reference-Code', 'full-exam-runtime-test');

    expect(runtimeResponse.status).toBe(200);
    expect(runtimeResponse.body.success).toBe(true);
    expect(runtimeResponse.body.data).toMatchObject({
      examId: 'exam-1',
      currentModule: 'reading'
    });
    expect(fullExamService.getRuntime).toHaveBeenCalledWith('507f1f77bcf86cd799439011', 'exam-1');
  });
});
