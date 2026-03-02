import type { Metadata } from 'next';
import Link from 'next/link';

import { MarketingGraphicLayer } from '@/components/marketing/MarketingGraphicLayer';
import { MarketingPageHero } from '@/components/marketing/MarketingPageHero';
import { getServerMarketingVariant } from '@/lib/marketing/variant-server';
import { ieltsGuides } from '@/lib/seo/ieltsGuides';
import { siteConfig } from '@/lib/seo/site';

export const metadata: Metadata = {
  title: 'IELTS Guides',
  description:
    'Explore Spokio IELTS guides for speaking, writing, reading, listening, full mock tests, and study-planning strategy.',
  alternates: {
    canonical: '/ielts'
  },
  openGraph: {
    title: 'IELTS Guides | Spokio',
    description:
      'Explore Spokio IELTS guides for speaking, writing, reading, listening, full mock tests, and study-planning strategy.',
    url: '/ielts'
  }
};

export default async function IeltsGuidesPage() {
  const marketingVariant = await getServerMarketingVariant();
  const isMotionVariant = marketingVariant === 'motion';

  const itemListSchema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Spokio IELTS Guides',
    itemListElement: ieltsGuides.map((guide, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: `${siteConfig.url}/ielts/${guide.slug}`,
      name: guide.title
    }))
  };

  return (
    <div className="space-y-10 lg:space-y-14">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }} />

      {isMotionVariant ? (
        <MarketingPageHero
          variant="full"
          animated
          badge={{ icon: 'school', text: 'IELTS Learning Hub' }}
          title="IELTS Preparation Guides by Module and Score Goal"
          description="Use these practical guides to build a repeatable training routine for speaking, writing, reading, listening, and full mock readiness."
        />
      ) : (
        <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#4C1D95] via-[#6D28D9] to-[#7C3AED] p-10 lg:p-16 text-white">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMSIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA4KSIvPjwvc3ZnPg==')] opacity-60" />
          <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-violet-300/30 rounded-full blur-[90px]" />
          <div className="absolute top-0 right-0 w-[320px] h-[320px] bg-fuchsia-300/20 rounded-full blur-[100px]" />
          <div className="relative z-10 max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 backdrop-blur-sm px-4 py-1.5 text-xs font-semibold uppercase tracking-wider mb-5">
              <span className="material-symbols-outlined text-[14px]">school</span>
              IELTS Learning Hub
            </span>
            <h1 className="text-4xl lg:text-5xl font-extrabold tracking-tight leading-[1.1]">IELTS Preparation Guides by Module and Score Goal</h1>
            <p className="mt-4 text-lg text-white/80 leading-relaxed max-w-2xl">
              Use these practical guides to build a repeatable training routine for speaking, writing, reading, listening,
              and full mock readiness.
            </p>
          </div>
        </section>
      )}

      <section className={`relative isolate overflow-hidden rounded-3xl ${isMotionVariant ? 'p-5 sm:p-6' : ''}`}>
        {isMotionVariant ? <MarketingGraphicLayer preset="content-highlight" intensity="subtle" /> : null}
        <div className="relative z-10 grid gap-5 sm:grid-cols-2">
        {ieltsGuides.map(guide => (
          <article key={guide.slug} className="group relative overflow-hidden rounded-2xl border border-gray-200/60 bg-white dark:bg-gray-900 p-6 space-y-3 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-violet-500/10 dark:border-gray-800/60">
            <div className="absolute inset-0 bg-gradient-to-br from-violet-50/50 to-transparent opacity-0 transition-opacity group-hover:opacity-100 dark:from-violet-500/5" />
            <span className="relative z-10 inline-block rounded-full bg-violet-100 dark:bg-violet-500/10 px-3 py-0.5 text-xs font-semibold text-violet-700 dark:text-violet-400">{guide.intent}</span>
            <h3 className="relative z-10 text-base font-bold text-gray-900 dark:text-white">{guide.title}</h3>
            <p className="relative z-10 text-sm text-gray-500 dark:text-gray-400">{guide.description}</p>
            <Link className="relative z-10 inline-flex items-center gap-1 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors" href={`/ielts/${guide.slug}`}>
              Open Guide <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </Link>
          </article>
        ))}
        </div>
      </section>

      <article className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 space-y-4">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Trust and Scoring Transparency</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Every guide is authored, reviewed, and refreshed on a maintenance cycle. See how scoring guidance is built and
          how content quality is maintained.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Link className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-5 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors" href="/methodology">
            View Methodology
          </Link>
          <Link className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-5 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors" href="/editorial-policy">
            Editorial Policy
          </Link>
          <Link className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 transition-colors shadow-lg shadow-violet-500/25" href="/pricing">
            Choose a Plan
          </Link>
        </div>
      </article>
    </div>
  );
}
