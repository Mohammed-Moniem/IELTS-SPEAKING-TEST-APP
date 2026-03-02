import 'reflect-metadata';

import request from 'supertest';
import { createExpressServer, useContainer } from 'routing-controllers';
import { Container } from 'typedi';

import { ListeningController } from '../../../../../src/api/controllers/ListeningController';
import { ListeningService } from '../../../../../src/api/services/ListeningService';
import { generateAccessToken } from '../../../../../src/lib/auth/token';

const accessToken = generateAccessToken({
  sub: '507f1f77bcf86cd799439011',
  email: 'learner@example.com',
  plan: 'free',
  roles: []
});

describe('ListeningController', () => {
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
      controllers: [ListeningController],
      defaultErrorHandler: false
    });

  it('supports additive history filters', async () => {
    const mockService = {
      getHistory: jest.fn().mockResolvedValue([])
    } as unknown as ListeningService;

    Container.set({ id: ListeningService, value: mockService });
    const app = createApp();

    const response = await request(app)
      .get('/api/v1/listening/history?limit=7&offset=1&track=general&from=2026-01-01&to=2026-01-31')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Unique-Reference-Code', 'listening-history-filter-test');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(mockService.getHistory).toHaveBeenCalledWith('507f1f77bcf86cd799439011', 7, 1, {
      track: 'general',
      from: '2026-01-01',
      to: '2026-01-31'
    });
  });
});
