import 'reflect-metadata';

import { ExpressMiddlewareInterface, Middleware, createExpressServer, useContainer } from 'routing-controllers';
import request from 'supertest';
import { Container } from 'typedi';

import { AnalyticsController } from '../../../../../src/api/controllers/AnalyticsController';
import { AnalyticsService } from '../../../../../src/api/services/AnalyticsService';

@Middleware({ type: 'before' })
class TestCurrentUserMiddleware implements ExpressMiddlewareInterface {
  use(req: any, res: any, next: (err?: any) => any): void {
    const userId = req.header('x-test-user-id');
    if (userId) {
      req.currentUser = { id: userId, email: 'test@example.com' };
    }
    next();
  }
}

describe('AnalyticsController (auth/ownership)', () => {
  beforeAll(() => {
    useContainer(Container);
  });

  afterEach(() => {
    Container.reset();
    jest.resetModules();
    jest.restoreAllMocks();
  });

  const createApp = () =>
    createExpressServer({
      routePrefix: '/v1',
      controllers: [AnalyticsController],
      middlewares: [TestCurrentUserMiddleware],
      defaultErrorHandler: false
    });

  it('rejects cross-user access for :userId routes', async () => {
    const mockService = {
      getProgressStats: jest.fn()
    } as unknown as AnalyticsService;
    Container.set({ id: AnalyticsService, value: mockService });

    const app = createApp();
    const response = await request(app).get('/v1/analytics/progress/other-user').set('x-test-user-id', 'current-user');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: false, error: 'Forbidden' });
    expect(mockService.getProgressStats).not.toHaveBeenCalled();
  });

  it('saveTestResult ignores body.userId and uses authenticated user', async () => {
    const mockService = {
      saveTestResult: jest.fn().mockResolvedValue({
        _id: 'test-id-1',
        overallBand: 7.5,
        createdAt: new Date('2025-01-01T00:00:00.000Z')
      })
    } as unknown as AnalyticsService;
    Container.set({ id: AnalyticsService, value: mockService });

    const app = createApp();
    const response = await request(app)
      .post('/v1/analytics/test')
      .set('x-test-user-id', 'current-user')
      .send({
        userId: 'attacker-user',
        sessionId: 'session-1',
        topic: 'Topic',
        overallBand: 7.5,
        criteria: { fluency: 7 }
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(mockService.saveTestResult).toHaveBeenCalledTimes(1);
    const arg = (mockService.saveTestResult as jest.Mock).mock.calls[0][0];
    expect(arg.userId).toBe('current-user');
  });

  it('getTestDetails is scoped to authenticated user', async () => {
    const mockService = {
      getTestDetails: jest.fn().mockResolvedValue({ _id: 'abc', userId: 'current-user' })
    } as unknown as AnalyticsService;
    Container.set({ id: AnalyticsService, value: mockService });

    const app = createApp();
    const response = await request(app)
      .get('/v1/analytics/test/67056f2a3c4d5e6f78901234')
      .set('x-test-user-id', 'current-user');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(mockService.getTestDetails).toHaveBeenCalledWith('current-user', '67056f2a3c4d5e6f78901234');
  });

  it('deleteTest returns success:false when record is not owned/found', async () => {
    const mockService = {
      deleteTest: jest.fn().mockResolvedValue(false)
    } as unknown as AnalyticsService;
    Container.set({ id: AnalyticsService, value: mockService });

    const app = createApp();
    const response = await request(app)
      .delete('/v1/analytics/test/67056f2a3c4d5e6f78901234')
      .set('x-test-user-id', 'current-user');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: false, error: 'Test not found' });
    expect(mockService.deleteTest).toHaveBeenCalledWith('current-user', '67056f2a3c4d5e6f78901234');
  });
});
