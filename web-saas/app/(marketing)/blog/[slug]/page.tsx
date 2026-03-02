import type { Metadata } from 'next';

import { BlogPostPage } from '@/components/blog/BlogPostPage';

type Params = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `Blog | ${slug.replace(/-/g, ' ')}`,
    description: 'Spokio IELTS blog article',
    alternates: {
      canonical: `/blog/${slug}`
    }
  };
}

export default async function BlogSlugPage({ params }: Params) {
  const { slug } = await params;
  return <BlogPostPage slug={slug} />;
}
