import type { MetadataRoute } from 'next';

import { ieltsGuides } from '@/lib/seo/ieltsGuides';
import { blogSlugs } from '@/lib/seo/blogSlugs';
import { siteConfig } from '@/lib/seo/site';

const staticMarketingRoutes = [
  '/',
  '/ielts',
  '/blog',
  '/advertise',
  '/pricing',
  '/features',
  '/about',
  '/contact',
  '/editorial-policy',
  '/methodology'
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  const guideRoutes = ieltsGuides.map(guide => `/ielts/${guide.slug}`);
  const blogRoutes = blogSlugs.map(entry => `/blog/${entry.slug}`);
  const routes = [...staticMarketingRoutes, ...guideRoutes, ...blogRoutes];

  return routes.map(route => ({
    url: `${siteConfig.url}${route}`,
    lastModified,
    changeFrequency: route === '/'
      ? 'weekly'
      : route.startsWith('/ielts/')
        ? 'weekly'
        : route.startsWith('/blog/')
          ? 'weekly'
          : 'monthly',
    priority: route === '/'
      ? 1
      : route.startsWith('/ielts/')
        ? 0.8
        : route.startsWith('/blog/')
          ? 0.7
          : 0.6
  }));
}
