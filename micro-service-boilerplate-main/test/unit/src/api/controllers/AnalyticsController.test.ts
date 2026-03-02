import 'reflect-metadata';

import request from 'supertest';
import { createExpressServer, useContainer } from 'routing-controllers';
import { Container } from 'typedi';

import { AnalyticsController } from '../../../../../src/api/controllers/AnalyticsController';
import { AuthMiddleware } from '../../../../../src/api/middlewares/AuthMiddleware';
import { AnalyticsService } from '../../../../../src/api/services/AnalyticsService';
import { generateAccessToken } from '../../../../../src/lib/auth/token';

const ownerId = '507f1f77bcf86cd799439021';
const nonOwnerId = '507f1f77bcf86cd799439022';

const ownerToken = generateAccessToken({
  sub: ownerId,
  email: 'owner@example.com',
  plan: 'free',
  roles: []
});

const supportAgentToken = generateAccessToken({
  sub: nonOwnerId,
  email: 'support@example.com',
  plan: 'pro',
  roles: ['support_agent']
});

describe('AnalyticsController', () => {
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
      controllers: [AnalyticsController],
      middlewares: [AuthMiddleware],
      defaultErrorHandler: false
    });

  it('allows test owner to delete test history item', async () => {
    const mockService = {
      getTestDetails: jest.fn().mockResolvedValue({ _id: 'test-1', userId: ownerId }),
      deleteTest: jest.fn().mockResolvedValue(undefined)
    } as unknown as AnalyticsService;

    Container.set({ id: AnalyticsService, value: mockService });

    const app = createApp();
    const response = await request(app)
      .delete('/api/v1/analytics/test/test-1')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('Unique-Reference-Code', 'analytics-delete-owner');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(mockService.deleteTest).toHaveBeenCalledWith('test-1');
  });

  it('blocks non-owner delete attempts for non-admin users', async () => {
    const mockService = {
      getTestDetails: jest.fn().mockResolvedValue({ _id: 'test-2', userId: ownerId }),
      deleteTest: jest.fn().mockResolvedValue(undefined)
    } as unknown as AnalyticsService;

    Container.set({ id: AnalyticsService, value: mockService });

    const app = createApp();
    const response = await request(app)
      .delete('/api/v1/analytics/test/test-2')
      .set(
        'Authorization',
        `Bearer ${generateAccessToken({ sub: nonOwnerId, email: 'learner@example.com', plan: 'free', roles: [] })}`
      )
      .set('Unique-Reference-Code', 'analytics-delete-forbidden');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe('Forbidden');
    expect(mockService.deleteTest).not.toHaveBeenCalled();
  });

  it('allows support agent to delete another user test', async () => {
    const mockService = {
      getTestDetails: jest.fn().mockResolvedValue({ _id: 'test-3', userId: ownerId }),
      deleteTest: jest.fn().mockResolvedValue(undefined)
    } as unknown as AnalyticsService;

    Container.set({ id: AnalyticsService, value: mockService });

    const app = createApp();
    const response = await request(app)
      .delete('/api/v1/analytics/test/test-3')
      .set('Authorization', `Bearer ${supportAgentToken}`)
      .set('Unique-Reference-Code', 'analytics-delete-support');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(mockService.deleteTest).toHaveBeenCalledWith('test-3');
  });
});
