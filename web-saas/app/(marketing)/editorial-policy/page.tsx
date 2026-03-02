import type { Metadata } from 'next';
import Link from 'next/link';

import { siteConfig } from '@/lib/seo/site';

export const metadata: Metadata = {
  title: 'Editorial Policy',
  description:
    'Review Spokio editorial policy for IELTS guidance: accuracy standards, review workflow, update cadence, and correction process.',
  alternates: {
    canonical: '/editorial-policy'
  },
  openGraph: {
    title: 'Spokio Editorial Policy',
    description:
      'Review Spokio editorial policy for IELTS guidance: accuracy standards, review workflow, update cadence, and correction process.',
    url: '/editorial-policy'
  }
};

const contentCreation = [
  { icon: 'description', text: 'Each guide starts from an intent-focused brief and one primary user outcome.' },
  { icon: 'checklist', text: 'Content drafts are mapped to IELTS tasks and known scoring constraints.' },
  { icon: 'school', text: 'Examples are written for practical exam performance, not theory-only explanations.' }
];

const reviewStandards = [
  { icon: 'person', text: 'Every published guide includes author, reviewer, and last-reviewed date.' },
  { icon: 'calendar_month', text: 'Critical pages are rechecked on a fixed schedule and after major product updates.' },
  { icon: 'history', text: 'Inaccuracies are corrected and timestamped in the next content revision cycle.' }
];

export default function EditorialPolicyPage() {
  const policySchema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Spokio Editorial Policy',
    url: `${siteConfig.url}/editorial-policy`,
    description:
      'Editorial policy describing content creation, review, and maintenance standards for IELTS learning materials.'
  };

  return (
    <div className="space-y-10 lg:space-y-14">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(policySchema) }} />

      {/* ── Hero ── */}
      <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-violet-600 via-indigo-600 to-violet-700 p-10 lg:p-16 text-white">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMSIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA4KSIvPjwvc3ZnPg==')] opacity-60" />
        <div className="absolute bottom-0 right-0 w-[300px] h-[300px] bg-cyan-400/15 rounded-full blur-[80px]" />
        <div className="relative z-10 max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/15 backdrop-blur-sm px-4 py-1.5 text-xs font-semibold uppercase tracking-wider mb-5">
            <span className="material-symbols-outlined text-[14px]">verified</span>
            Trust and Quality
          </span>
          <h1 className="text-4xl lg:text-5xl font-extrabold tracking-tight leading-[1.1]">Editorial Policy</h1>
          <p className="mt-4 text-lg text-white/80 leading-relaxed max-w-2xl">
            Spokio content is designed for exam readiness, updated regularly, and reviewed against practical IELTS scoring
            criteria and learner usability.
          </p>
        </div>
      </section>

      {/* ── Content Creation ── */}
      <section className="rounded-2xl border border-gray-200/80 bg-white/50 backdrop-blur-sm p-8 dark:border-gray-800/80 dark:bg-gray-900/50 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)]">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-5">How Content Is Created</h3>
        <div className="space-y-4">
          {contentCreation.map(item => (
            <div key={item.text} className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400">
                <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed pt-1.5">{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Review Standards ── */}
      <section className="rounded-2xl border border-gray-200/80 bg-white/50 backdrop-blur-sm p-8 dark:border-gray-800/80 dark:bg-gray-900/50 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)]">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-5">Review and Update Standards</h3>
        <div className="space-y-4">
          {reviewStandards.map(item => (
            <div key={item.text} className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
                <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed pt-1.5">{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Corrections ── */}
      <section className="rounded-2xl border border-amber-200/60 bg-amber-50/50 dark:border-amber-500/20 dark:bg-amber-500/5 p-8 backdrop-blur-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
            <span className="material-symbols-outlined text-[22px]">report</span>
          </div>
          <div className="space-y-3">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Corrections Process</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 max-w-2xl leading-relaxed">
              If you find content issues, contact support@spokio.app with page URL and details. Corrections are prioritized
              by learner impact and released after review.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Link className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-5 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors" href="/methodology">
                View Methodology
              </Link>
              <Link className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-5 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors" href="/ielts">
                IELTS Guide Hub
              </Link>
              <Link className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 transition-all shadow-lg shadow-violet-500/25 hover:-translate-y-0.5" href="/contact">
                Contact Team
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
