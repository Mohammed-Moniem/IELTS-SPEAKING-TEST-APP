'use client';

import { MarketingAnalyticsTracker } from '@/components/marketing/MarketingAnalyticsTracker';
import { MarketingScrollAnimator } from '@/components/marketing/MarketingScrollAnimator';
import { MarketingVariantQueryCleaner } from '@/components/marketing/MarketingVariantQueryCleaner';
import { MarketingShell } from '@/components/layout/MarketingShell';

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <MarketingVariantQueryCleaner />
      <MarketingAnalyticsTracker />
      <MarketingScrollAnimator />
      <MarketingShell>{children}</MarketingShell>
    </>
  );
}
