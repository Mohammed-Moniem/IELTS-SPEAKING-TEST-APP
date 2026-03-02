import 'reflect-metadata';

import request from 'supertest';
import { createExpressServer, useContainer } from 'routing-controllers';
import { Container } from 'typedi';

import { PartnerController } from '../../../../../src/api/controllers/PartnerController';
import { PartnerProgramService } from '../../../../../src/api/services/PartnerProgramService';
import { generateAccessToken } from '../../../../../src/lib/auth/token';

const userId = '507f1f77bcf86cd799439011';
const accessToken = generateAccessToken({
  sub: userId,
  email: 'partner@example.com',
  plan: 'premium',
  roles: []
});

describe('PartnerController', () => {
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
      controllers: [PartnerController],
      defaultErrorHandler: false
    });

  it('submits partner application for authenticated user', async () => {
    const partnerProgramService = {
      submitApplication: jest.fn().mockResolvedValue({
        partnerId: '507f1f77bcf86cd7994390aa',
        status: 'pending'
      })
    } as unknown as PartnerProgramService;

    Container.set({ id: PartnerProgramService, value: partnerProgramService });
    const app = createApp();

    const response = await request(app)
      .post('/api/v1/partners/applications')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Unique-Reference-Code', 'partners-apply-test')
      .send({
        partnerType: 'influencer',
        displayName: 'Creator One'
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(partnerProgramService.submitApplication).toHaveBeenCalledWith(
      userId,
      expect.objectContaining({ partnerType: 'influencer', displayName: 'Creator One' })
    );
  });

  it('returns partner dashboard for authenticated owner', async () => {
    const partnerProgramService = {
      getPartnerDashboard: jest.fn().mockResolvedValue({
        partner: { id: 'p_1' },
        lifetime: { conversions: 1 }
      })
    } as unknown as PartnerProgramService;

    Container.set({ id: PartnerProgramService, value: partnerProgramService });
    const app = createApp();

    const response = await request(app)
      .get('/api/v1/partners/dashboard')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Unique-Reference-Code', 'partners-dashboard-test');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(partnerProgramService.getPartnerDashboard).toHaveBeenCalledWith(userId);
  });

  it('forwards pagination when listing codes', async () => {
    const partnerProgramService = {
      listPartnerCodes: jest.fn().mockResolvedValue({
        partnerId: '507f1f77bcf86cd7994390aa',
        total: 1,
        limit: 20,
        offset: 10,
        codes: [{ _id: 'c_1', code: 'CREATOR10' }]
      })
    } as unknown as PartnerProgramService;

    Container.set({ id: PartnerProgramService, value: partnerProgramService });
    const app = createApp();

    const response = await request(app)
      .get('/api/v1/partners/codes?limit=20&offset=10')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Unique-Reference-Code', 'partners-codes-test');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(partnerProgramService.listPartnerCodes).toHaveBeenCalledWith(userId, 20, 10);
  });
});
