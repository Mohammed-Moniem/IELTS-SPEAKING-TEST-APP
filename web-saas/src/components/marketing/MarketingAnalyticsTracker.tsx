'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

import { marketingEvents } from '@/lib/analytics/marketingEvents';
import { useMarketingVariant } from '@/lib/marketing/useMarketingVariant';

const SCROLL_THRESHOLDS = [25, 50, 75, 100] as const;

export function MarketingAnalyticsTracker() {
  const pathname = usePathname();
  const variant = useMarketingVariant();
  const firedDepthsRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    const route = pathname || '/';
    marketingEvents.pageView({
      route,
      variant
    });
  }, [pathname, variant]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    firedDepthsRef.current = new Set();
    const route = pathname || '/';

    const onScroll = () => {
      const doc = document.documentElement;
      const scrollHeight = doc.scrollHeight - window.innerHeight;
      if (scrollHeight <= 0) return;

      const depth = Math.min(
        100,
        Math.round((window.scrollY / scrollHeight) * 100)
      );

      for (const threshold of SCROLL_THRESHOLDS) {
        if (depth >= threshold && !firedDepthsRef.current.has(threshold)) {
          firedDepthsRef.current.add(threshold);
          marketingEvents.scrollDepth({
            route,
            variant,
            depthPercent: threshold
          });
        }
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    return () => {
      window.removeEventListener('scroll', onScroll);
    };
  }, [pathname, variant]);

  return null;
}
