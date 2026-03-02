'use client';

import firebaseAnalyticsService from '@/lib/analytics/firebaseAnalyticsService';
import { MARKETING_VARIANT_AUDIENCE, type MarketingMotionVariant } from '@/lib/marketing/variant';

type MarketingEventName =
  | 'mkt_page_view'
  | 'mkt_cta_click'
  | 'mkt_scroll_depth'
  | 'mkt_pricing_plan_select'
  | 'mkt_register_submit_start'
  | 'mkt_register_submit_success'
  | 'mkt_register_submit_error';

type MarketingEventPayload = {
  route: string;
  variant: MarketingMotionVariant;
  section?: string;
  cta_id?: string;
  destination?: string;
  depth_percent?: number;
  plan_tier?: string;
  error_code?: string;
  audience?: string;
};

const basePayload = (variant: MarketingMotionVariant) => ({
  variant,
  audience: MARKETING_VARIANT_AUDIENCE
});

const track = (name: MarketingEventName, payload: MarketingEventPayload) => {
  void firebaseAnalyticsService.trackEvent(name, payload);
};

export const marketingEvents = {
  pageView(params: { route: string; variant: MarketingMotionVariant; section?: string }) {
    track('mkt_page_view', {
      route: params.route,
      section: params.section || 'page',
      ...basePayload(params.variant)
    });
  },

  ctaClick(params: {
    route: string;
    variant: MarketingMotionVariant;
    section: string;
    ctaId: string;
    destination: string;
  }) {
    track('mkt_cta_click', {
      route: params.route,
      section: params.section,
      cta_id: params.ctaId,
      destination: params.destination,
      ...basePayload(params.variant)
    });
  },

  scrollDepth(params: { route: string; variant: MarketingMotionVariant; depthPercent: number }) {
    track('mkt_scroll_depth', {
      route: params.route,
      depth_percent: params.depthPercent,
      section: 'page',
      ...basePayload(params.variant)
    });
  },

  pricingPlanSelect(params: {
    route: string;
    variant: MarketingMotionVariant;
    planTier: string;
    destination: string;
  }) {
    track('mkt_pricing_plan_select', {
      route: params.route,
      plan_tier: params.planTier,
      section: 'pricing-plans',
      destination: params.destination,
      ...basePayload(params.variant)
    });
  },

  registerSubmitStart(params: { route: string; variant: MarketingMotionVariant }) {
    track('mkt_register_submit_start', {
      route: params.route,
      section: 'register-form',
      ...basePayload(params.variant)
    });
  },

  registerSubmitSuccess(params: { route: string; variant: MarketingMotionVariant }) {
    track('mkt_register_submit_success', {
      route: params.route,
      section: 'register-form',
      ...basePayload(params.variant)
    });
  },

  registerSubmitError(params: { route: string; variant: MarketingMotionVariant; errorCode: string }) {
    track('mkt_register_submit_error', {
      route: params.route,
      section: 'register-form',
      error_code: params.errorCode,
      ...basePayload(params.variant)
    });
  }
};
