import 'reflect-metadata';

import request from 'supertest';
import { createExpressServer, useContainer } from 'routing-controllers';
import { Container } from 'typedi';

import { SubscriptionController } from '../../../../../src/api/controllers/SubscriptionController';
import { SubscriptionService } from '../../../../../src/api/services/SubscriptionService';
import { UsageService } from '../../../../../src/api/services/UsageService';
import { generateAccessToken } from '../../../../../src/lib/auth/token';

const userId = '507f1f77bcf86cd799439011';
const accessToken = generateAccessToken({
  sub: userId,
  email: 'learner@example.com',
  plan: 'free',
  roles: []
});

describe('SubscriptionController', () => {
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
      controllers: [SubscriptionController],
      defaultErrorHandler: false
    });

  it('returns enriched plans catalog including team package', async () => {
    const mockSubscriptionService = {
      getPlansCatalog: jest.fn().mockReturnValue([
        {
          tier: 'free',
          name: 'Free'
        },
        {
          tier: 'team',
          name: 'Team'
        }
      ])
    } as unknown as SubscriptionService;

    Container.set({ id: SubscriptionService, value: mockSubscriptionService });
    Container.set({ id: UsageService, value: {} as UsageService });

    const app = createApp();

    const response = await request(app)
      .get('/api/v1/subscription/plans')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Unique-Reference-Code', 'subscription-plans-contract');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.plans).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ tier: 'free' }),
        expect.objectContaining({ tier: 'team' })
      ])
    );
    expect(mockSubscriptionService.getPlansCatalog).toHaveBeenCalled();
  });

  it('forwards billing cycle to checkout service additively', async () => {
    const mockSubscriptionService = {
      createCheckoutSession: jest.fn().mockResolvedValue({
        sessionId: 'cs_test_123',
        checkoutUrl: 'https://checkout.stripe.com/pay/cs_test_123',
        billingCycle: 'annual'
      })
    } as unknown as SubscriptionService;

    Container.set({ id: SubscriptionService, value: mockSubscriptionService });
    Container.set({ id: UsageService, value: {} as UsageService });

    const app = createApp();

    const response = await request(app)
      .post('/api/v1/subscription/checkout')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Unique-Reference-Code', 'subscription-checkout-billing-cycle')
      .send({
        planType: 'pro',
        billingCycle: 'annual',
        successUrl: 'http://localhost:3000/app/billing?checkout=success',
        cancelUrl: 'http://localhost:3000/app/billing?checkout=cancel'
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(mockSubscriptionService.createCheckoutSession).toHaveBeenCalledWith(
      userId,
      'pro',
      expect.objectContaining({ urc: 'subscription-checkout-billing-cycle' }),
      expect.objectContaining({
        successUrl: 'http://localhost:3000/app/billing?checkout=success',
        cancelUrl: 'http://localhost:3000/app/billing?checkout=cancel',
        billingCycle: 'annual'
      })
    );
  });

  it('forwards optional partnerCode and couponCode to checkout service', async () => {
    const mockSubscriptionService = {
      createCheckoutSession: jest.fn().mockResolvedValue({
        sessionId: 'cs_test_partner_123',
        checkoutUrl: 'https://checkout.stripe.com/pay/cs_test_partner_123',
        billingCycle: 'monthly'
      })
    } as unknown as SubscriptionService;

    Container.set({ id: SubscriptionService, value: mockSubscriptionService });
    Container.set({ id: UsageService, value: {} as UsageService });

    const app = createApp();

    const response = await request(app)
      .post('/api/v1/subscription/checkout')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Unique-Reference-Code', 'subscription-checkout-partner-code')
      .send({
        planType: 'pro',
        billingCycle: 'monthly',
        partnerCode: 'CREATOR10',
        couponCode: 'WELCOME10',
        successUrl: 'http://localhost:3000/app/billing?checkout=success',
        cancelUrl: 'http://localhost:3000/app/billing?checkout=cancel'
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(mockSubscriptionService.createCheckoutSession).toHaveBeenCalledWith(
      userId,
      'pro',
      expect.objectContaining({ urc: 'subscription-checkout-partner-code' }),
      expect.objectContaining({
        billingCycle: 'monthly',
        partnerCode: 'CREATOR10',
        couponCode: 'WELCOME10'
      })
    );
  });

  it('creates billing portal session for existing Stripe customers', async () => {
    const mockSubscriptionService = {
      createPortalSession: jest.fn().mockResolvedValue({
        portalUrl: 'https://billing.stripe.com/p/session_123'
      })
    } as unknown as SubscriptionService;

    Container.set({ id: SubscriptionService, value: mockSubscriptionService });
    Container.set({ id: UsageService, value: {} as UsageService });

    const app = createApp();

    const response = await request(app)
      .post('/api/v1/subscription/portal')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Unique-Reference-Code', 'subscription-portal')
      .send({
        returnUrl: 'http://localhost:3000/app/billing'
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.portalUrl).toBe('https://billing.stripe.com/p/session_123');
    expect(mockSubscriptionService.createPortalSession).toHaveBeenCalledWith(
      userId,
      expect.objectContaining({ urc: 'subscription-portal' }),
      'http://localhost:3000/app/billing'
    );
  });
});
