import type { Metadata } from 'next';

import { siteConfig } from '@/lib/seo/site';

export const metadata: Metadata = {
  title: 'Contact',
  description:
    'Contact Spokio for support, partnerships, enterprise onboarding, and rollout advisory. Browse our FAQ for answers to common questions about IELTS preparation, billing, and platform features.',
  alternates: {
    canonical: '/contact'
  },
  openGraph: {
    title: 'Contact Spokio',
    description:
      'Contact Spokio for support, partnerships, enterprise onboarding, and rollout advisory. Browse our FAQ for answers to common questions.',
    url: '/contact'
  }
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
