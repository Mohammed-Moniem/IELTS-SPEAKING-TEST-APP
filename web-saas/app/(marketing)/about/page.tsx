import type { Metadata } from 'next';
import Link from 'next/link';

import { siteConfig } from '@/lib/seo/site';

export const metadata: Metadata = {
  title: 'About',
  description:
    'Learn about Spokio and the product principles behind our IELTS SaaS: practical outcomes, compatibility safety, and phased delivery.',
  alternates: {
    canonical: '/about'
  },
  openGraph: {
    title: 'About Spokio',
    description:
      'Learn about Spokio and the product principles behind our IELTS SaaS: practical outcomes, compatibility safety, and phased delivery.',
    url: '/about'
  }
};

const principles = [
  {
    icon: 'target',
    title: 'Consistent Preparation',
    body: 'Balanced training across speaking, writing, reading, and listening for reliable exam-day performance.'
  },
  {
    icon: 'lightbulb',
    title: 'Clear Scoring Explanations',
    body: 'Feedback reveals specific improvement actions — not generic commentary that doesn\'t translate to score gains.'
  },
  {
    icon: 'devices',
    title: 'Cross-Platform Continuity',
    body: 'Your account, progress, and subscription sync seamlessly between mobile and web learning journeys.'
  }
];

export default function AboutPage() {
  const aboutSchema = {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    name: 'About Spokio',
    description:
      'Spokio is an IELTS SaaS platform focused on practical score outcomes and speaking-safe compatibility.',
    url: `${siteConfig.url}/about`,
    mainEntity: {
      '@type': 'Organization',
      name: 'Spokio',
      url: siteConfig.url,
      email: 'support@spokio.app',
      description:
        'IELTS preparation platform offering speaking, writing, reading, listening, and full exam workflows.'
    }
  };

  return (
    <div className="space-y-10 lg:space-y-14">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(aboutSchema) }} />

      {/* ── Hero ── */}
      <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-violet-600 via-indigo-600 to-violet-700 p-10 lg:p-16 text-white">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMSIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA4KSIvPjwvc3ZnPg==')] opacity-60" />
        <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-white/10 rounded-full blur-[80px]" />
        <div className="relative z-10 max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/15 backdrop-blur-sm px-4 py-1.5 text-xs font-semibold uppercase tracking-wider mb-5">
            <span className="material-symbols-outlined text-[14px]">rocket_launch</span>
            Our Mission
          </span>
          <h1 className="text-4xl lg:text-5xl font-extrabold tracking-tight leading-[1.1]">About Spokio</h1>
          <p className="mt-4 text-lg text-white/80 leading-relaxed max-w-2xl">
            Spokio is built for measurable IELTS outcomes: realistic test conditions, feedback learners can act on, and
            architecture that preserves speaking compatibility while expanding to full-module preparation.
          </p>
        </div>
      </section>

      {/* ── Principles Grid ── */}
      <section>
        <h2 className="text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white mb-6">What We Optimize For</h2>
        <div className="grid gap-5 sm:grid-cols-3">
          {principles.map(item => (
            <article
              key={item.title}
              className="group relative overflow-hidden rounded-2xl border border-gray-200/60 bg-white p-7 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-violet-500/10 dark:border-gray-800/60 dark:bg-gray-900"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-violet-50/50 to-transparent opacity-0 transition-opacity group-hover:opacity-100 dark:from-violet-500/5" />
              <div className="relative z-10 mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-violet-100 text-violet-600 transition-transform group-hover:scale-110 dark:bg-violet-500/20 dark:text-violet-400">
                <span className="material-symbols-outlined text-[22px]">{item.icon}</span>
              </div>
              <h3 className="relative z-10 mb-2 text-base font-bold text-gray-900 dark:text-white">{item.title}</h3>
              <p className="relative z-10 text-sm leading-relaxed text-gray-500 dark:text-gray-400">{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ── Reliability ── */}
      <section className="rounded-2xl border border-gray-200/80 bg-white/50 backdrop-blur-sm p-8 dark:border-gray-800/80 dark:bg-gray-900/50 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)]">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
            <span className="material-symbols-outlined text-[22px]">shield</span>
          </div>
          <div className="space-y-3">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">How We Protect Reliability</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-2xl leading-relaxed">
              Existing speaking API contracts remain stable while new modules ship behind feature flags. This approach
              prevents regressions for live users and supports phased rollout by plan and cohort.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Link className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-5 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors" href="/methodology">
                Scoring Methodology
              </Link>
              <Link className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-5 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors" href="/editorial-policy">
                Editorial Policy
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── V1 Boundaries ── */}
      <section className="rounded-2xl border border-gray-200/80 bg-white/50 backdrop-blur-sm p-8 dark:border-gray-800/80 dark:bg-gray-900/50 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)]">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
            <span className="material-symbols-outlined text-[22px]">info</span>
          </div>
          <div className="space-y-3">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Current V1 Boundaries</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-2xl leading-relaxed">
              English-only interface, email/password authentication, AI cost guardrails, and strict admin role controls for
              operational safety.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Link className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-5 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors" href="/features">
                View Feature Architecture
              </Link>
              <Link className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 transition-all shadow-lg shadow-violet-500/25 hover:-translate-y-0.5" href="/ielts">
                Explore IELTS Guides
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
