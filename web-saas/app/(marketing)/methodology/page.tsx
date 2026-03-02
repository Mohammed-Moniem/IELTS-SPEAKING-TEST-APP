import type { Metadata } from 'next';
import Link from 'next/link';

import { MarketingGraphicLayer } from '@/components/marketing/MarketingGraphicLayer';
import { MarketingPageHero } from '@/components/marketing/MarketingPageHero';
import { getServerMarketingVariant } from '@/lib/marketing/variant-server';
import { siteConfig } from '@/lib/seo/site';

export const metadata: Metadata = {
  title: 'Scoring Methodology',
  description:
    'Understand Spokio IELTS scoring methodology across speaking, writing, reading, and listening, including rubric signals and quality controls.',
  alternates: {
    canonical: '/methodology'
  },
  openGraph: {
    title: 'Spokio Scoring Methodology',
    description:
      'Understand Spokio IELTS scoring methodology across speaking, writing, reading, and listening, including rubric signals and quality controls.',
    url: '/methodology'
  }
};

const evaluationPrinciples = [
  {
    icon: 'record_voice_over',
    module: 'Speaking',
    signals: ['Fluency & coherence', 'Lexical resource range', 'Grammatical range & accuracy', 'Pronunciation clarity']
  },
  {
    icon: 'edit_note',
    module: 'Writing',
    signals: ['Task response quality', 'Cohesion & coherence', 'Lexical control', 'Grammar consistency']
  },
  {
    icon: 'auto_stories',
    module: 'Reading & Listening',
    signals: ['Objective answer accuracy', 'Section-level error patterns', 'Band normalisation', 'Time-pressure analysis']
  }
];

const guardrails = [
  {
    icon: 'toggle_on',
    title: 'Feature-flagged rollout',
    body: 'Allows model and scoring updates without broad disruption to active learners.'
  },
  {
    icon: 'savings',
    title: 'Usage budgets',
    body: 'Request controls protect cost stability and service availability across all plans.'
  },
  {
    icon: 'lightbulb',
    title: 'Actionable feedback',
    body: 'Score explanations prioritize specific fixes over generic commentary.'
  }
];

export default async function MethodologyPage() {
  const marketingVariant = await getServerMarketingVariant();
  const isMotionVariant = marketingVariant === 'motion';

  const methodologySchema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Spokio IELTS scoring methodology',
    url: `${siteConfig.url}/methodology`,
    description: 'Methodology overview for scoring workflows, feedback generation, and quality checks.'
  };

  return (
    <div className="space-y-10 lg:space-y-14">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(methodologySchema) }} />

      {isMotionVariant ? (
        <MarketingPageHero
          variant="full"
          animated
          badge={{ icon: 'science', text: 'Scoring Framework' }}
          title="How Spokio Evaluates IELTS Performance"
          description="Spokio combines rule-based checks with AI-assisted analysis and module-specific rubrics to produce feedback designed for practical score improvement."
        />
      ) : (
        <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-violet-600 via-indigo-600 to-violet-700 p-10 lg:p-16 text-white">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMSIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA4KSIvPjwvc3ZnPg==')] opacity-60" />
          <div className="absolute top-0 left-1/2 w-[350px] h-[350px] bg-fuchsia-500/15 rounded-full blur-[100px]" />
          <div className="relative z-10 max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 backdrop-blur-sm px-4 py-1.5 text-xs font-semibold uppercase tracking-wider mb-5">
              <span className="material-symbols-outlined text-[14px]">science</span>
              Scoring Framework
            </span>
            <h1 className="text-4xl lg:text-5xl font-extrabold tracking-tight leading-[1.1]">How Spokio Evaluates IELTS Performance</h1>
            <p className="mt-4 text-lg text-white/80 leading-relaxed max-w-2xl">
              Spokio combines rule-based checks with AI-assisted analysis and module-specific rubrics to produce feedback
              designed for practical score improvement.
            </p>
          </div>
        </section>
      )}

      {/* ── Module Evaluation ── */}
      <section className={`relative isolate overflow-hidden rounded-3xl ${isMotionVariant ? 'p-5 sm:p-6' : ''}`}>
        {isMotionVariant ? <MarketingGraphicLayer preset="content-highlight" intensity="subtle" /> : null}
        <h2 className="relative z-10 text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white mb-6">
          Module Evaluation Principles
        </h2>
        <div className="relative z-10 grid gap-5 sm:grid-cols-3">
          {evaluationPrinciples.map(item => (
            <article
              key={item.module}
              className="group relative overflow-hidden rounded-2xl border border-gray-200/60 bg-white p-7 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-violet-500/10 dark:border-gray-800/60 dark:bg-gray-900"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-violet-50/50 to-transparent opacity-0 transition-opacity group-hover:opacity-100 dark:from-violet-500/5" />
              <div className="relative z-10 mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-violet-100 text-violet-600 transition-transform group-hover:scale-110 dark:bg-violet-500/20 dark:text-violet-400">
                <span className="material-symbols-outlined text-[22px]">{item.icon}</span>
              </div>
              <h3 className="relative z-10 mb-3 text-base font-bold text-gray-900 dark:text-white">{item.module}</h3>
              <ul className="relative z-10 space-y-2">
                {item.signals.map(signal => (
                  <li key={signal} className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-violet-400 flex-shrink-0" />
                    {signal}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      {/* ── Quality and Guardrails ── */}
      <section className="rounded-2xl border border-gray-200/80 bg-white/50 backdrop-blur-sm p-8 dark:border-gray-800/80 dark:bg-gray-900/50 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)]">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Quality and Guardrails</h3>
        <div className="grid gap-5 sm:grid-cols-3">
          {guardrails.map(item => (
            <div key={item.title} className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
                <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
              </div>
              <div>
                <h4 className="text-sm font-bold text-gray-900 dark:text-white">{item.title}</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{item.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Interpretation Guidance ── */}
      <section className="rounded-2xl border border-amber-200/60 bg-amber-50/50 dark:border-amber-500/20 dark:bg-amber-500/5 p-8 backdrop-blur-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
            <span className="material-symbols-outlined text-[22px]">info</span>
          </div>
          <div className="space-y-3">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Interpretation Guidance</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 max-w-2xl leading-relaxed">
              Use score reports as directional feedback. Final official IELTS scores are determined by the official test
              provider.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Link className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-5 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors" href="/editorial-policy">
                Editorial Policy
              </Link>
              <Link className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-5 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors" href="/ielts">
                IELTS Guide Hub
              </Link>
              <Link className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 transition-all shadow-lg shadow-violet-500/25 hover:-translate-y-0.5" href="/pricing">
                Compare Plans
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
