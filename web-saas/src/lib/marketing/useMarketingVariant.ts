'use client';

import { useEffect, useState } from 'react';

import {
  getMarketingVariantOverride,
  getClientMarketingVariantFromCookies,
  type MarketingMotionVariant
} from '@/lib/marketing/variant';

const DEFAULT_VARIANT: MarketingMotionVariant = 'control';

export function useMarketingVariant() {
  const [variant, setVariant] = useState<MarketingMotionVariant>(DEFAULT_VARIANT);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const override = getMarketingVariantOverride(new URLSearchParams(window.location.search));
    if (override) {
      setVariant(override);
      return;
    }
    setVariant(getClientMarketingVariantFromCookies(document.cookie));
  }, []);

  return variant;
}
