import type { Metadata } from 'next';

import { BlogIndexPage } from '@/components/blog/BlogIndexPage';
import { getServerMarketingVariant } from '@/lib/marketing/variant-server';

export const metadata: Metadata = {
  title: 'IELTS Blog',
  description:
    'Read reviewed IELTS strategy content for speaking, writing, reading, listening, vocabulary, and exam-day performance.',
  alternates: {
    canonical: '/blog'
  },
  openGraph: {
    title: 'Spokio IELTS Blog',
    description:
      'Reviewed IELTS strategy content for speaking, writing, reading, listening, vocabulary, and exam-day performance.',
    url: '/blog'
  }
};

export default async function BlogPage() {
  const marketingVariant = await getServerMarketingVariant();
  return <BlogIndexPage isMotionVariant={marketingVariant === 'motion'} />;
}
