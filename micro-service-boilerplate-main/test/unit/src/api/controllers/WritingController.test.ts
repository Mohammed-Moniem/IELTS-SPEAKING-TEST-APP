import 'reflect-metadata';

import request from 'supertest';
import { createExpressServer, useContainer } from 'routing-controllers';
import { Container } from 'typedi';

import { WritingController } from '../../../../../src/api/controllers/WritingController';
import { WritingService } from '../../../../../src/api/services/WritingService';
import { generateAccessToken } from '../../../../../src/lib/auth/token';

const testUserId = '507f1f77bcf86cd799439011';
const accessToken = generateAccessToken({
  sub: testUserId,
  email: 'learner@example.com',
  plan: 'free',
  roles: []
});

describe('WritingController', () => {
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
      controllers: [WritingController],
      defaultErrorHandler: false
    });

  it('generates a writing task', async () => {
    const mockService = {
      generateTask: jest.fn().mockResolvedValue({ taskId: 'task-1', track: 'general', taskType: 'task1' })
    } as unknown as WritingService;

    Container.set({ id: WritingService, value: mockService });

    const app = createApp();

    const response = await request(app)
      .post('/api/v1/writing/tasks/generate')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Unique-Reference-Code', 'writing-generate-test')
      .send({ track: 'general', taskType: 'task1' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.taskId).toBe('task-1');
    expect(mockService.generateTask).toHaveBeenCalledWith(
      '507f1f77bcf86cd799439011',
      { track: 'general', taskType: 'task1' },
      expect.objectContaining({ urc: 'writing-generate-test' })
    );
  });

  it('submits a writing response for evaluation', async () => {
    const mockService = {
      submitWriting: jest.fn().mockResolvedValue({ _id: 'submission-1', overallBand: 6.5 })
    } as unknown as WritingService;

    Container.set({ id: WritingService, value: mockService });

    const app = createApp();

    const response = await request(app)
      .post('/api/v1/writing/submissions')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Unique-Reference-Code', 'writing-submit-test')
      .send({ taskId: 'task-1', responseText: 'My essay response', durationSeconds: 900 });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data._id).toBe('submission-1');
    expect(mockService.submitWriting).toHaveBeenCalledWith(
      '507f1f77bcf86cd799439011',
      'task-1',
      'My essay response',
      900,
      expect.objectContaining({ urc: 'writing-submit-test' })
    );
  });
});
