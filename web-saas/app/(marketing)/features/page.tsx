import type { Metadata } from 'next';
import Link from 'next/link';

import { MarketingGraphicLayer } from '@/components/marketing/MarketingGraphicLayer';
import { MarketingPageHero } from '@/components/marketing/MarketingPageHero';
import { getServerMarketingVariant } from '@/lib/marketing/variant-server';
import { ieltsGuides } from '@/lib/seo/ieltsGuides';
import { siteConfig } from '@/lib/seo/site';

export const metadata: Metadata = {
  title: 'Features',
  description:
    'Explore Spokio IELTS features: speaking-safe web parity, writing, reading, listening, full exams, and role-based admin controls.',
  alternates: {
    canonical: '/features'
  },
  openGraph: {
    title: 'Spokio Features | Complete IELTS SaaS',
    description:
      'Explore Spokio IELTS features: speaking-safe web parity, writing, reading, listening, full exams, and role-based admin controls.',
    url: '/features'
  }
};

const cards = [
  ['Speaking', 'Browser recording, transcription, evaluator flow, and robust fallback for mic-denied states.'],
  ['Writing', 'Prompt generation, scored submissions, rubric breakdown, and history endpoints.'],
  ['Reading', 'Practice/full mocks with objective scoring and normalized band feedback.'],
  ['Listening', 'Audio-aware test flow with transcript metadata and objective scoring.'],
  ['Full Exams', 'Section orchestration and consolidated results under one exam session.'],
  ['Progress', 'Unified trends, skill breakdowns, and practical recommendations for next sessions.'],
  ['Partner Program', 'Track partner-code performance, earnings, payouts, and monthly targets.'],
  ['Admin Suite', 'Role-gated content ops, user/subscription support, analytics, AI cost, and feature flags.']
] as const;

export default async function FeaturesPage() {
  const marketingVariant = await getServerMarketingVariant();
  const isMotionVariant = marketingVariant === 'motion';
  const itemListSchema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Spokio IELTS feature modules',
    itemListElement: cards.map(([title, copy], index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: title,
      description: copy
    }))
  };

  const guideHighlights = ieltsGuides.slice(0, 4);

  return (
    <div className="space-y-10 lg:space-y-14">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }} />

      {isMotionVariant ? (
        <MarketingPageHero
          variant="full"
          animated
          badge={{ icon: 'widgets', text: 'Complete IELTS Feature Stack' }}
          title="Everything Learners Need for IELTS Progress in One Connected Workflow"
          description="Spokio links speaking, writing, reading, listening, and full mocks into one measurable learning loop with clear progress and actionable coaching signals."
        />
      ) : (
        <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-violet-600 via-indigo-600 to-violet-700 p-10 lg:p-16 text-white">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMSIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA4KSIvPjwvc3ZnPg==')] opacity-60" />
          <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-fuchsia-500/15 rounded-full blur-[80px]" />
          <div className="relative z-10 max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 backdrop-blur-sm px-4 py-1.5 text-xs font-semibold uppercase tracking-wider mb-5">
              <span className="material-symbols-outlined text-[14px]">widgets</span>
              Complete IELTS Feature Stack
            </span>
            <h1 className="text-4xl lg:text-5xl font-extrabold tracking-tight leading-[1.1]">Everything Learners Need for IELTS Progress in One Connected Workflow</h1>
            <p className="mt-4 text-lg text-white/80 leading-relaxed max-w-2xl">
              Spokio links speaking, writing, reading, listening, and full mocks into one measurable learning loop with
              clear progress and actionable coaching signals.
            </p>
          </div>
        </section>
      )}

      <section className={`relative isolate overflow-hidden rounded-3xl ${isMotionVariant ? 'p-5 sm:p-6' : ''}`}>
        {isMotionVariant ? <MarketingGraphicLayer preset="content-highlight" intensity="subtle" /> : null}
        <div className="relative z-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(([title, copy]) => (
          <article key={title} className="group relative overflow-hidden rounded-2xl border border-gray-200/60 bg-white dark:bg-gray-900 p-6 space-y-2 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-violet-500/10 dark:border-gray-800/60">
            <div className="absolute inset-0 bg-gradient-to-br from-violet-50/50 to-transparent opacity-0 transition-opacity group-hover:opacity-100 dark:from-violet-500/5" />
            <p className="relative z-10 text-xs font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wider">Module</p>
            <h3 className="relative z-10 text-base font-bold text-gray-900 dark:text-white">{title}</h3>
            <p className="relative z-10 text-sm text-gray-500 dark:text-gray-400">{copy}</p>
          </article>
        ))}
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200/80 bg-white/50 backdrop-blur-sm p-8 dark:border-gray-800/80 dark:bg-gray-900/50 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)] space-y-4">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">How This Improves IELTS Score Consistency</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Most learners underperform because module preparation stays fragmented. Spokio links each module into one
          measurable progress loop with shared history, billing, and readiness tracking.
        </p>
        <ul className="space-y-2.5 text-sm text-gray-700 dark:text-gray-300">
          <li className="flex items-start gap-2"><span className="material-symbols-outlined text-[16px] text-violet-600 dark:text-violet-400 mt-0.5 flex-shrink-0">check_circle</span>Practice mode for focused skill drills.</li>
          <li className="flex items-start gap-2"><span className="material-symbols-outlined text-[16px] text-violet-600 dark:text-violet-400 mt-0.5 flex-shrink-0">check_circle</span>Mock mode for realistic time pressure and completion discipline.</li>
          <li className="flex items-start gap-2"><span className="material-symbols-outlined text-[16px] text-violet-600 dark:text-violet-400 mt-0.5 flex-shrink-0">check_circle</span>Progress view for section-level weakness detection and correction planning.</li>
        </ul>
      </section>

      <article className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 space-y-4">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">IELTS Strategy Guides</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Explore module-specific preparation guides and execution plans for Academic and General IELTS pathways.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {guideHighlights.map(guide => (
            <Link
              key={guide.slug}
              href={`/ielts/${guide.slug}`}
              className="block rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 p-5 space-y-2 hover:border-violet-300 dark:hover:border-violet-700 transition-colors no-underline"
            >
              <p className="text-xs font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wider">Guide</p>
              <h4 className="font-semibold text-gray-900 dark:text-white">{guide.title}</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {guide.description}
              </p>
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Link className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-5 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors" href="/ielts">
            Browse All Guides
          </Link>
          <Link className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 transition-colors shadow-lg shadow-violet-500/25" href="/pricing">
            View Plans
          </Link>
        </div>
      </article>

      <article className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 space-y-3">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Built for Staged Rollout and Reliability</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Admin controls, audit logs, and feature flags keep module launches predictable while protecting speaking
          compatibility guarantees.
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400">Canonical web URL: {siteConfig.url}/features</p>
      </article>
    </div>
  );
}
