import type { Metadata } from 'next';

import { BlogIndexPage } from '@/components/blog/BlogIndexPage';
import { listPublishedBlogPosts } from '@/lib/seo/blogData';

export const metadata: Metadata = {
  title: 'IELTS Blog – 500+ Study Guides for Speaking, Writing, Reading & Listening',
  description:
    'Browse 500+ free IELTS study guides covering speaking, writing, reading, listening, vocabulary, grammar, pronunciation, exam strategy, and migration requirements. Practical tips for every band score.',
  alternates: {
    canonical: '/blog'
  },
  openGraph: {
    title: 'Spokio IELTS Blog – 500+ Free Study Guides',
    description:
      'Practical IELTS preparation guides for speaking, writing, reading, listening, vocabulary, grammar, and exam strategy. Written for every band score level.',
    url: '/blog'
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Spokio IELTS Blog – 500+ Free Study Guides',
    description:
      'Browse 500+ free IELTS study guides with practical strategies for every module and band score.'
  }
};

export default async function BlogPage() {
  const posts = await listPublishedBlogPosts();

  return <BlogIndexPage posts={posts} />;
}
