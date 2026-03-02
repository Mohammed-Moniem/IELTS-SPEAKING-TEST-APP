import 'reflect-metadata';

import request from 'supertest';
import { createExpressServer, useContainer } from 'routing-controllers';
import { Container } from 'typedi';

import { HealthController } from '../../../../../src/api/controllers/HealthController';
import { HealthService } from '../../../../../src/api/services/HealthService';

describe('HealthController', () => {
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
      controllers: [HealthController],
      defaultErrorHandler: false
    });

  it('returns health data using StandardResponse', async () => {
    const mockData = {
      status: 'ok',
      uptime: 10,
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      liveness: { status: 'pass', message: 'Service is running' },
      readiness: { status: 'pass', dependencies: [] }
    };

    const mockService = {
      getHealthStatus: jest.fn().mockResolvedValue(mockData)
    } as unknown as HealthService;

    Container.set({ id: HealthService, value: mockService });

    const app = createApp();
    const response = await request(app)
      .get('/health')
      .set('Unique-Reference-Code', 'controller-test');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toMatchObject(mockData);
    expect(mockService.getHealthStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        urc: 'controller-test'
      })
    );
  });

  it('returns error response when service throws', async () => {
    const mockService = {
      getHealthStatus: jest.fn().mockRejectedValue(new Error('health failure'))
    } as unknown as HealthService;

    Container.set({ id: HealthService, value: mockService });

    const app = createApp();
    const response = await request(app).get('/health');

    expect(response.status).toBe(500);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBeDefined();
    expect(mockService.getHealthStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        urc: expect.stringMatching(/^health-/)
      })
    );
  });
});
