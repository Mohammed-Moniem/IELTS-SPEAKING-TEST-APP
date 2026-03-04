import 'reflect-metadata';

import request from 'supertest';
import { createExpressServer, useContainer } from 'routing-controllers';
import { Container } from 'typedi';

import { ReadingController } from '../../../../../src/api/controllers/ReadingController';
import { ReadingService } from '../../../../../src/api/services/ReadingService';
import { generateAccessToken } from '../../../../../src/lib/auth/token';

const accessToken = generateAccessToken({
  sub: '507f1f77bcf86cd799439011',
  email: 'learner@example.com',
  plan: 'free',
  roles: []
});

describe('ReadingController', () => {
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
      controllers: [ReadingController],
      defaultErrorHandler: false
    });

  it('supports additive history filters', async () => {
    const mockService = {
      getHistory: jest.fn().mockResolvedValue([])
    } as unknown as ReadingService;

    Container.set({ id: ReadingService, value: mockService });
    const app = createApp();

    const response = await request(app)
      .get('/api/v1/reading/history?limit=10&offset=2&track=academic&from=2026-01-01&to=2026-01-31')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Unique-Reference-Code', 'reading-history-filter-test');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(mockService.getHistory).toHaveBeenCalledWith('507f1f77bcf86cd799439011', 10, 2, {
      track: 'academic',
      from: '2026-01-01',
      to: '2026-01-31'
    });
  });

  it('saves in-progress reading state without submitting', async () => {
    const mockService = {
      saveProgress: jest.fn().mockResolvedValue({
        _id: 'reading-attempt-1',
        status: 'in_progress'
      })
    };

    Container.set({ id: ReadingService, value: mockService as unknown as ReadingService });
    const app = createApp();

    const response = await request(app)
      .post('/api/v1/reading/tests/reading-attempt-1/save')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Unique-Reference-Code', 'reading-save-progress-test')
      .send({
        answers: [{ questionId: 'p1_q1', sectionId: 'p1', answer: 'i' }],
        durationSeconds: 212,
        activeSectionId: 'p1',
        activeQuestionIndex: 0,
        flaggedQuestionIds: ['p1_q1'],
        isPaused: false
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(mockService.saveProgress).toHaveBeenCalledWith(
      '507f1f77bcf86cd799439011',
      'reading-attempt-1',
      expect.objectContaining({
        durationSeconds: 212,
        isPaused: false
      }),
      expect.any(Object)
    );
  });

  it('pauses reading timer state for in-progress attempt', async () => {
    const mockService = {
      saveProgress: jest.fn().mockResolvedValue({
        _id: 'reading-attempt-1',
        status: 'in_progress'
      })
    };

    Container.set({ id: ReadingService, value: mockService as unknown as ReadingService });
    const app = createApp();

    const response = await request(app)
      .post('/api/v1/reading/tests/reading-attempt-1/pause')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Unique-Reference-Code', 'reading-pause-progress-test')
      .send({
        durationSeconds: 305,
        activeSectionId: 'p1',
        activeQuestionIndex: 3,
        flaggedQuestionIds: ['p1_q2'],
        answers: [{ questionId: 'p1_q2', sectionId: 'p1', answer: 'True' }]
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(mockService.saveProgress).toHaveBeenCalledWith(
      '507f1f77bcf86cd799439011',
      'reading-attempt-1',
      expect.objectContaining({
        durationSeconds: 305,
        isPaused: true
      }),
      expect.any(Object)
    );
  });
});
