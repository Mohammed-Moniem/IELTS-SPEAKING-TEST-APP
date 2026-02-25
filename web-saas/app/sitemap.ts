import type { MetadataRoute } from 'next';

import { ieltsGuides } from '@/lib/seo/ieltsGuides';
import { siteConfig } from '@/lib/seo/site';

const staticMarketingRoutes = [
  '/',
  '/ielts',
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
  const routes = [...staticMarketingRoutes, ...guideRoutes];

  return routes.map(route => ({
    url: `${siteConfig.url}${route}`,
    lastModified,
    changeFrequency: route === '/' ? 'weekly' : route.startsWith('/ielts/') ? 'weekly' : 'monthly',
    priority: route === '/' ? 1 : route.startsWith('/ielts/') ? 0.8 : 0.7
  }));
}
