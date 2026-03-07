import type { Metadata } from 'next';
import Link from 'next/link';

import { HardNavigationLink } from '@/components/navigation/HardNavigationLink';
import { MarketingPageHero } from '@/components/marketing/MarketingPageHero';
import { getServerMarketingVariant } from '@/lib/marketing/variant-server';
import { getGuideTreeWithFallback } from '@/lib/seo/guideData';
import { siteConfig } from '@/lib/seo/site';
import type { GuideModule, GuideTreeNode } from '@/lib/types';

export const metadata: Metadata = {
  title: 'IELTS Guides',
  description:
    'Explore Spokio IELTS guides by module with hierarchical routes, practice-first blocks, and conversion-focused next actions.',
  alternates: {
    canonical: '/ielts'
  },
  openGraph: {
    title: 'IELTS Guides | Spokio',
    description:
      'Explore Spokio IELTS guides by module with hierarchical routes, practice-first blocks, and conversion-focused next actions.',
    url: '/ielts'
  }
};

const MODULE_ORDER: GuideModule[] = [
  'speaking',
  'writing',
  'reading',
  'listening',
  'vocabulary',
  'exam-strategy',
  'band-scores',
  'resources',
  'faq',
  'updates'
];

const MODULE_LABELS: Record<GuideModule, string> = {
  speaking: 'Speaking',
  writing: 'Writing',
  reading: 'Reading',
  listening: 'Listening',
  vocabulary: 'Vocabulary',
  'exam-strategy': 'Exam Strategy',
  'band-scores': 'Band Scores',
  resources: 'Resources',
  faq: 'FAQ',
  updates: 'Updates',
  offers: 'Offers',
  membership: 'Membership'
};

const MODULE_DESCRIPTION: Record<GuideModule, string> = {
  speaking: 'Cue cards, part-by-part response drills, and fluency scoring paths.',
  writing: 'Task 1 and Task 2 methods with rubric-aware structure and practice routines.',
  reading: 'Question-type execution strategies with timing and elimination workflows.',
  listening: 'Section-by-section listening tactics and answer-transfer accuracy routines.',
  vocabulary: 'Band-focused word usage patterns, collocations, and grammar precision.',
  'exam-strategy': 'Study plans, mock sequencing, and exam-week execution frameworks.',
  'band-scores': 'Band-target roadmaps with score movement checkpoints.',
  resources: 'Reference material, tools, and support assets for preparation.',
  faq: 'Quick answers for common IELTS preparation and policy questions.',
  updates: 'Date-based updates, exam trends, and recent strategy changes.',
  offers: 'Program offers, pricing promotions, and enrollment support routes.',
  membership: 'Membership and plan guidance for learner and team needs.'
};

function sortByDepthAndOrder(a: GuideTreeNode, b: GuideTreeNode) {
  if (a.depth !== b.depth) return a.depth - b.depth;
  if (a.order !== b.order) return a.order - b.order;
  return a.title.localeCompare(b.title);
}

export default async function IeltsGuidesPage() {
  const [guideTree, marketingVariant] = await Promise.all([getGuideTreeWithFallback(), getServerMarketingVariant()]);
  const isMotionVariant = marketingVariant === 'motion';

  const flat = guideTree.flat
    .filter(item => item.canonicalPath !== '/ielts')
    .filter(item => item.module !== 'offers' && item.module !== 'membership')
    .sort(sortByDepthAndOrder);

  const modules = MODULE_ORDER.map(module => {
    const routes = flat.filter(item => item.module === module);
    return {
      module,
      label: MODULE_LABELS[module],
      description: MODULE_DESCRIPTION[module],
      routes,
      count: routes.length,
      hubPath: `/ielts/${module}`
    };
  }).filter(item => item.count > 0);

  const itemListSchema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Spokio IELTS Guides',
    itemListElement: flat.slice(0, 200).map((guide, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: `${siteConfig.url}${guide.canonicalPath}`,
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
          description={`Browse ${flat.length} mapped IELTS guide routes across ${modules.length} modules with practice-first structure and next-step navigation.`}
          ctas={[
            {
              href: '/register',
              label: 'Start Free',
              ctaId: 'ielts_hub_primary',
              section: 'ielts-hub-hero'
            },
            {
              href: '/pricing',
              label: 'View Plans',
              tone: 'secondary',
              ctaId: 'ielts_hub_secondary',
              section: 'ielts-hub-hero'
            }
          ]}
        />
      ) : (
        <section className="marketing-hero-surface relative overflow-hidden rounded-[2rem] p-10 text-white lg:p-14">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMSIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA4KSIvPjwvc3ZnPg==')] opacity-45" />
          <div className="relative z-10 max-w-3xl space-y-4">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider">
              IELTS Learning Hub
            </span>
            <h1 className="hero-elegant-title text-4xl font-extrabold leading-tight lg:text-5xl">IELTS Preparation Guides by Module and Score Goal</h1>
            <p className="hero-elegant-copy text-lg text-white/85">
              Browse {flat.length} mapped IELTS guide routes across {modules.length} modules with practice-first structure and next-step navigation.
            </p>
          </div>
        </section>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-gray-200/70 dark:border-gray-800/70 bg-white dark:bg-gray-900 p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Total Guide Routes</p>
          <p className="mt-2 text-3xl font-extrabold text-gray-900 dark:text-white">{flat.length}</p>
        </article>
        <article className="rounded-2xl border border-gray-200/70 dark:border-gray-800/70 bg-white dark:bg-gray-900 p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Modules Covered</p>
          <p className="mt-2 text-3xl font-extrabold text-gray-900 dark:text-white">{modules.length}</p>
        </article>
        <article className="rounded-2xl border border-gray-200/70 dark:border-gray-800/70 bg-white dark:bg-gray-900 p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Generated</p>
          <p className="mt-2 text-lg font-semibold text-gray-900 dark:text-white">
            {new Date(guideTree.generatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
          </p>
        </article>
        <article className="rounded-2xl border border-gray-200/70 dark:border-gray-800/70 bg-white dark:bg-gray-900 p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Canonical Hub</p>
          <p className="mt-2 text-lg font-semibold text-gray-900 dark:text-white">/ielts/* hierarchy</p>
        </article>
      </section>

      <section className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Module Coverage</h2>
          <HardNavigationLink
            href="/register"
            className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 transition-colors shadow-lg shadow-violet-500/25"
          >
            Start Free
          </HardNavigationLink>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {modules.map(moduleEntry => (
            <article key={moduleEntry.module} className="rounded-2xl border border-gray-200/70 dark:border-gray-800/70 bg-white dark:bg-gray-900 p-6 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">{moduleEntry.label}</h3>
                <span className="rounded-full bg-violet-100 dark:bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-700 dark:text-violet-300">
                  {moduleEntry.count} routes
                </span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300">{moduleEntry.description}</p>
              <div className="flex items-center gap-3 pt-2">
                <Link
                  href={moduleEntry.hubPath}
                  className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  Open Hub
                </Link>
                <span className="text-xs text-gray-500 dark:text-gray-400">/ielts/{moduleEntry.module}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-7">
        {modules.map(moduleEntry => {
          const featuredRoutes = moduleEntry.routes.slice(0, 8);
          return (
            <article key={`routes-${moduleEntry.module}`} className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">{moduleEntry.label} Routes</h3>
                {moduleEntry.count > featuredRoutes.length ? (
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                    Showing {featuredRoutes.length} of {moduleEntry.count}
                  </span>
                ) : null}
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {featuredRoutes.map(route => (
                  <Link
                    key={route.id}
                    href={route.canonicalPath}
                    className="group rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 space-y-2 hover:border-violet-300 dark:hover:border-violet-700 transition-colors no-underline"
                  >
                    <p className="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-violet-700 dark:group-hover:text-violet-300 transition-colors">
                      {route.title}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-3">
                      {route.excerpt || `Open this ${moduleEntry.label.toLowerCase()} route and continue to the next linked drill.`}
                    </p>
                  </Link>
                ))}
              </div>
            </article>
          );
        })}
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
