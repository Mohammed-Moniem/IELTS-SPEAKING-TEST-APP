import type { Metadata } from 'next';

import { BlogPostPage } from '@/components/blog/BlogPostPage';
import { blogSlugs } from '@/lib/seo/blogSlugs';
import { siteConfig } from '@/lib/seo/site';

type Params = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  return blogSlugs.map(entry => ({ slug: entry.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const entry = blogSlugs.find(b => b.slug === slug);
  const title = entry
    ? entry.title
    : slug
        .replace(/-/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());

  const description = entry
    ? `Learn ${entry.title.toLowerCase().replace(/^how to |^ielts /i, '')} with practical strategies and step-by-step guidance for improving your IELTS ${entry.cluster.replace(/-/g, ' ')} score.`
    : `Spokio IELTS blog article on ${slug.replace(/-/g, ' ')}.`;

  const url = `${siteConfig.url}/blog/${slug}`;

  return {
    title,
    description,
    alternates: { canonical: `/blog/${slug}` },
    openGraph: {
      title: `${title} | Spokio IELTS Blog`,
      description,
      url,
      type: 'article',
      siteName: siteConfig.name
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description
    }
  };
}

export default async function BlogSlugPage({ params }: Params) {
  const { slug } = await params;
  return <BlogPostPage slug={slug} />;
}
