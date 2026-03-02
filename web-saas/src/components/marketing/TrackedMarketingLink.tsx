'use client';

import Link, { type LinkProps } from 'next/link';
import { usePathname } from 'next/navigation';
import type { ComponentPropsWithoutRef } from 'react';

import { marketingEvents } from '@/lib/analytics/marketingEvents';
import { useMarketingVariant } from '@/lib/marketing/useMarketingVariant';

type TrackedMarketingLinkProps = LinkProps &
  Omit<ComponentPropsWithoutRef<'a'>, 'href'> & {
    ctaId: string;
    section: string;
    planTier?: string;
    trackPricingSelect?: boolean;
  };

export function TrackedMarketingLink({
  ctaId,
  section,
  planTier,
  trackPricingSelect = false,
  onClick,
  href,
  children,
  ...props
}: TrackedMarketingLinkProps) {
  const pathname = usePathname();
  const variant = useMarketingVariant();

  const destination = typeof href === 'string' ? href : href.pathname || '';

  return (
    <Link
      {...props}
      href={href}
      onClick={event => {
        marketingEvents.ctaClick({
          route: pathname || '/',
          variant,
          section,
          ctaId,
          destination
        });
        if (trackPricingSelect && planTier) {
          marketingEvents.pricingPlanSelect({
            route: pathname || '/',
            variant,
            planTier,
            destination
          });
        }

        onClick?.(event);
      }}
    >
      {children}
    </Link>
  );
}
