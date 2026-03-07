'use client';

import type { ComponentPropsWithoutRef } from 'react';

type HardNavigationLinkProps = ComponentPropsWithoutRef<'a'> & {
  href: string;
};

export function HardNavigationLink({ href, children, ...props }: HardNavigationLinkProps) {
  return (
    <a {...props} href={href}>
      {children}
    </a>
  );
}
