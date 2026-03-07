'use client';

import Link, { type LinkProps } from 'next/link';
import { usePathname } from 'next/navigation';
import type { ComponentPropsWithoutRef } from 'react';

import { HardNavigationLink } from '@/components/navigation/HardNavigationLink';
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
  const destinationPath = destination.split('?')[0];
  const shouldUseHardNavigation =
    typeof href === 'string' &&
    (destinationPath === '/login' ||
      destinationPath === '/register' ||
      destinationPath === '/forgot-password' ||
      destinationPath === '/reset-password');

  const handleClick: NonNullable<ComponentPropsWithoutRef<'a'>['onClick']> = event => {
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
  };

  if (shouldUseHardNavigation) {
    return (
      <HardNavigationLink {...props} href={destination} onClick={handleClick}>
        {children}
      </HardNavigationLink>
    );
  }

  return (
    <Link {...props} href={href} onClick={handleClick}>
      {children}
    </Link>
  );
}
