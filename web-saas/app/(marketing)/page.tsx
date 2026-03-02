import type { Metadata } from 'next';

import { MotionHeroScene } from '@/components/marketing/MotionHeroScene';
import { MotionReveal } from '@/components/marketing/MotionReveal';
import { TrackedMarketingLink } from '@/components/marketing/TrackedMarketingLink';
import { getServerMarketingVariant } from '@/lib/marketing/variant-server';
import { siteConfig } from '@/lib/seo/site';

export const metadata: Metadata = {
  title: 'Complete IELTS Platform',
  description:
    'Prepare for IELTS speaking, writing, reading, and listening with speaking-safe API compatibility, full mock tests, and guided analytics.',
  alternates: {
    canonical: '/'
  },
  openGraph: {
    title: 'Spokio | Complete IELTS Platform',
    description:
      'Prepare for IELTS speaking, writing, reading, and listening with speaking-safe API compatibility, full mock tests, and guided analytics.',
    url: '/'
  }
};

const pillars = [
  {
    icon: 'moving',
    title: 'Band-focused coaching loop',
    body: 'Every session feeds a clear next action so learners know exactly what to practice next and why.'
  },
  {
    icon: 'hub',
    title: 'Full IELTS in one place',
    body: 'Speaking, writing, reading, listening, and full mocks are connected in one progress timeline.'
  },
  {
    icon: 'devices',
    title: 'Mobile + web continuity',
    body: 'The same account, limits, and score history follow learners across devices without reset friction.'
  },
  {
    icon: 'admin_panel_settings',
    title: 'Instructor-ready visibility',
    body: 'Partners and admins can track learner progress, subscriptions, and growth metrics from one dashboard.'
  }
];

const journey = [
  {
    step: '01',
    title: 'Run a baseline full test',
    copy: 'Start with one realistic mock to identify your highest-impact gaps.'
  },
  {
    step: '02',
    title: 'Train weak modules daily',
    copy: 'Use focused speaking/writing/reading/listening loops instead of random drills.'
  },
  {
    step: '03',
    title: 'Track score movement weekly',
    copy: 'Review your progress dashboard and repeat the cycle with stronger targets.'
  }
];

export default async function HomePage() {
  const marketingVariant = await getServerMarketingVariant();
  const isMotionVariant = marketingVariant === 'motion';
  const structuredData = [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: siteConfig.name,
      url: siteConfig.url,
      email: 'support@spokio.app'
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: siteConfig.name,
      url: siteConfig.url,
      description:
        'IELTS preparation platform with speaking, writing, reading, listening modules and full mock tests.'
    }
  ];

  return (
    <div className="space-y-16 lg:space-y-24">
      {/* ── SEO JSON-LD ── */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />

      {/* ── Hero Section ── */}
      <section className="relative overflow-hidden pt-12 pb-20 lg:pt-24 lg:pb-32">
        {/* Background glow effects */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-violet-500/30 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-indigo-500/20 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative z-10 grid gap-10 lg:grid-cols-12 max-w-7xl mx-auto px-4 sm:px-6">
          <div className="lg:col-span-8 flex flex-col justify-center space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50/50 px-4 py-1.5 text-sm font-semibold text-violet-700 backdrop-blur-md dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300 w-fit shadow-sm">
              <span className="flex h-2 w-2 rounded-full bg-violet-600 dark:bg-violet-400 animate-pulse"></span>
              The Complete IELTS Platform
            </div>

            <h1 className="text-5xl font-extrabold tracking-tight text-gray-900 dark:text-white sm:text-6xl lg:text-7xl leading-[1.1]">
              <span className={isMotionVariant ? 'motion-hero-line motion-hero-line-1' : ''}>Raise your IELTS band with </span>
              <span className={isMotionVariant ? 'motion-hero-line motion-hero-line-2' : ''}>
                <span className={`bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent dark:from-violet-400 dark:to-indigo-300 ${isMotionVariant ? 'motion-hero-keyphrase' : ''}`}>
                  one focused
                </span>
              </span>{' '}
              <span className={isMotionVariant ? 'motion-hero-line motion-hero-line-3' : ''}>learning system.</span>
            </h1>

            <p className="max-w-2xl text-lg text-gray-600 dark:text-gray-300 leading-relaxed">
              Spokio combines realistic test practice, AI feedback, and clear improvement steps so learners can move from random practice to measurable band growth.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-4">
              <TrackedMarketingLink
                className="group relative inline-flex items-center justify-center overflow-hidden rounded-2xl bg-violet-600 px-8 py-4 text-base font-bold text-white shadow-xl shadow-violet-500/25 transition-all hover:bg-violet-700 hover:-translate-y-0.5"
                href="/register"
                ctaId="home_hero_start_free"
                section="hero"
              >
                <span className="relative z-10 flex items-center gap-2">Start Free Test <span className="material-symbols-outlined transition-transform group-hover:translate-x-1">arrow_forward</span></span>
                <div className="absolute inset-0 bg-white/20 translate-y-full transition-transform group-hover:translate-y-0" />
              </TrackedMarketingLink>
              <TrackedMarketingLink
                className="inline-flex items-center justify-center rounded-2xl border-2 border-gray-200 bg-white/50 px-8 py-4 text-base font-bold text-gray-700 backdrop-blur-sm transition-all hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 dark:border-gray-800 dark:bg-gray-900/50 dark:text-gray-300 dark:hover:border-violet-700/50 dark:hover:bg-violet-900/20 dark:hover:text-violet-300"
                href="/pricing"
                ctaId="home_hero_view_plans"
                section="hero"
              >
                View Plans
              </TrackedMarketingLink>
            </div>

            <div className="flex flex-wrap items-center gap-6 pt-6 text-sm font-medium text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-1.5"><span className="material-symbols-outlined text-emerald-500 text-[18px]">check_circle</span> Band-focused feedback</span>
              <span className="flex items-center gap-1.5"><span className="material-symbols-outlined text-emerald-500 text-[18px]">check_circle</span> One free full test</span>
              <span className="flex items-center gap-1.5"><span className="material-symbols-outlined text-emerald-500 text-[18px]">check_circle</span> No card for trial</span>
            </div>
          </div>

          <aside className="lg:col-span-4 relative">
            {isMotionVariant ? (
              <MotionHeroScene />
            ) : (
              <>
                <div className="absolute inset-0 -translate-x-4 translate-y-4 rounded-3xl bg-violet-600/5 blur-lg dark:bg-violet-400/5"></div>
                <div className="relative rounded-3xl border border-gray-200/80 bg-white/80 p-8 shadow-2xl backdrop-blur-xl dark:border-gray-700/80 dark:bg-gray-900/80 ring-1 ring-gray-900/5 dark:ring-white/10">
                  <div className="mb-6 inline-flex items-center gap-2 rounded-xl bg-violet-100 px-3 py-1 text-xs font-bold uppercase tracking-widest text-violet-700 dark:bg-violet-500/20 dark:text-violet-300">
                    <span className="material-symbols-outlined text-[16px]">visibility</span> Outcome Snapshot
                  </div>
                  <h3 className="mb-6 text-xl font-bold tracking-tight text-gray-900 dark:text-white">From practice to test-day confidence</h3>
                  <ul className="mb-8 space-y-4">
                    <li className="flex items-start gap-3">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400">
                        <span className="material-symbols-outlined text-[14px] font-bold">check</span>
                      </div>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Guided speaking sessions with clear rubric feedback</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400">
                        <span className="material-symbols-outlined text-[14px] font-bold">check</span>
                      </div>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Full test simulation with results and coaching actions</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400">
                        <span className="material-symbols-outlined text-[14px] font-bold">check</span>
                      </div>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Cross-module roadmap for fluency, coherence, and timing</span>
                    </li>
                  </ul>
                  <div className="space-y-3">
                    <TrackedMarketingLink
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-3 text-sm font-bold text-white transition-all hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 shadow-md"
                      href="/app/dashboard"
                      ctaId="home_hero_open_app"
                      section="hero"
                    >
                      <span className="material-symbols-outlined text-[18px]">rocket_launch</span> Open Learner App
                    </TrackedMarketingLink>
                  </div>
                </div>
              </>
            )}
          </aside>
        </div>
      </section>

      {/* ── Value Pillars Grid ── */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6">
        <MotionReveal disabled={!isMotionVariant}>
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white sm:text-4xl">Platform Capabilities</h2>
            <p className="mt-4 text-lg text-gray-500 dark:text-gray-400">Designed for measurable improvement, not just isolated exercises.</p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {pillars.map(item => (
              <article key={item.title} className="group relative overflow-hidden rounded-3xl border border-gray-200/60 bg-white p-8 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-violet-500/10 dark:border-gray-800/60 dark:bg-gray-900">
                <div className="absolute inset-0 bg-gradient-to-br from-violet-50/50 to-transparent opacity-0 transition-opacity group-hover:opacity-100 dark:from-violet-500/5" />
                <div className="relative z-10 mb-6 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-violet-600 transition-transform group-hover:scale-110 dark:bg-violet-500/20 dark:text-violet-400 shadow-inner">
                  <span className="material-symbols-outlined text-[24px]">{item.icon}</span>
                </div>
                <h3 className="relative z-10 mb-3 text-lg font-bold text-gray-900 dark:text-white">{item.title}</h3>
                <p className="relative z-10 text-sm leading-relaxed text-gray-500 dark:text-gray-400">{item.body}</p>
              </article>
            ))}
          </div>
        </MotionReveal>
      </section>

      {/* ── Journey Section ── */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6">
        <MotionReveal disabled={!isMotionVariant}>
          <div className="rounded-[40px] bg-gray-50 px-6 py-16 dark:bg-gray-900/50 sm:px-12 sm:py-20 lg:p-24 border border-gray-100 dark:border-gray-800/50">
            <div className="mb-16 max-w-2xl">
              <h2 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white sm:text-4xl">How Learners Use Spokio in Practice</h2>
              <p className="mt-4 text-lg text-gray-500 dark:text-gray-400">A clear, repeatable loop designed to increase your band score efficiently.</p>
            </div>
            <div className="grid gap-8 sm:grid-cols-3 relative">
              <div className="absolute top-8 left-0 hidden w-full border-t-2 border-dashed border-gray-200 dark:border-gray-800 sm:block" />

              {journey.map(item => (
                <div key={item.step} className="relative z-10 pt-4">
                  <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-xl ring-1 ring-gray-900/5 dark:bg-gray-800 dark:ring-white/10">
                    <span className="text-xl font-black bg-clip-text text-transparent bg-gradient-to-br from-violet-600 to-indigo-600 dark:from-violet-400 dark:to-indigo-400">{item.step}</span>
                  </div>
                  <h4 className="mb-3 text-xl font-bold text-gray-900 dark:text-white">{item.title}</h4>
                  <p className="text-base leading-relaxed text-gray-500 dark:text-gray-400">{item.copy}</p>
                </div>
              ))}
            </div>
          </div>
        </MotionReveal>
      </section>

      {/* ── Guarantee Section ── */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6">
        <MotionReveal disabled={!isMotionVariant}>
          <div className="relative overflow-hidden rounded-[40px] bg-gradient-to-br from-[#4C1D95] via-[#6D28D9] to-[#7C3AED] px-6 py-16 text-center sm:px-12 sm:py-20 lg:p-24 shadow-2xl">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMSIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjE1KSIvPjwvc3ZnPg==')] opacity-45" />
            <div className="absolute top-10 left-1/4 h-52 w-52 rounded-full bg-violet-300/35 blur-3xl" />
            <div className="absolute -bottom-8 right-1/4 h-56 w-56 rounded-full bg-fuchsia-300/30 blur-3xl" />

            <div className="relative z-10 mx-auto max-w-3xl">
              <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-3xl bg-white/15 backdrop-blur-sm ring-1 ring-white/30">
                <span className="material-symbols-outlined text-[40px] text-violet-100">verified</span>
              </div>

              <h2 className="mb-6 text-4xl font-extrabold tracking-tight text-white sm:text-5xl">Band Score Improvement Guarantee</h2>
              <p className="mb-10 text-lg leading-relaxed text-violet-50/90">
                Follow your personalised study plan on a Pro subscription for 90 days. If your overall band score doesn&apos;t improve by at least 0.5 bands, we&apos;ll extend your subscription absolutely free for another 90 days.
              </p>

              <div className="grid gap-6 sm:grid-cols-3 mb-12 text-left">
                <div className="rounded-2xl bg-violet-950/35 p-5 backdrop-blur-sm border border-violet-200/25">
                  <span className="material-symbols-outlined text-violet-200 mb-3 text-[28px]">timer</span>
                  <h4 className="font-bold text-white mb-1">90-day commitment</h4>
                  <p className="text-sm text-violet-100/85">Complete at least 3 practice sessions per week</p>
                </div>
                <div className="rounded-2xl bg-violet-950/35 p-5 backdrop-blur-sm border border-violet-200/25">
                  <span className="material-symbols-outlined text-violet-200 mb-3 text-[28px]">monitoring</span>
                  <h4 className="font-bold text-white mb-1">Measurable progress</h4>
                  <p className="text-sm text-violet-100/85">We compare your baseline and final full test scores</p>
                </div>
                <div className="rounded-2xl bg-violet-950/35 p-5 backdrop-blur-sm border border-violet-200/25">
                  <span className="material-symbols-outlined text-violet-200 mb-3 text-[28px]">shield</span>
                  <h4 className="font-bold text-white mb-1">Risk-free guarantee</h4>
                  <p className="text-sm text-violet-100/85">90-day free extension if you don&apos;t improve</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-4">
                <TrackedMarketingLink
                  className="rounded-2xl bg-white px-8 py-4 text-base font-bold text-violet-800 transition-all hover:bg-violet-50 hover:scale-105 shadow-xl shadow-violet-900/30"
                  href="/register"
                  ctaId="home_guarantee_start_pro"
                  section="guarantee"
                >
                  Start With Pro
                </TrackedMarketingLink>
                <TrackedMarketingLink
                  className="rounded-2xl border-2 border-violet-100/45 bg-white/10 px-8 py-4 text-base font-bold text-violet-50 transition-colors hover:bg-white/20 hover:border-violet-50/70"
                  href="/guarantee"
                  ctaId="home_guarantee_terms"
                  section="guarantee"
                >
                  View Full Terms
                </TrackedMarketingLink>
              </div>
            </div>
          </div>
        </MotionReveal>
      </section>

      {/* ── Final CTA Section ── */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 pb-20">
        <MotionReveal disabled={!isMotionVariant}>
          <div className="relative overflow-hidden rounded-[40px] bg-gradient-to-br from-[#140833] via-[#341A71] to-[#5B21B6] px-6 py-20 text-center sm:px-12 lg:p-24 shadow-2xl">
            <div className="absolute inset-0 bg-gradient-to-r from-violet-300/25 via-fuchsia-200/20 to-violet-300/25 mix-blend-screen" />
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wNSkiLz48L3N2Zz4=')] opacity-35" />

            <div className="relative z-10 mx-auto max-w-3xl">
              <h2 className="mb-6 text-4xl font-extrabold tracking-tight text-white sm:text-5xl">Built for Serious Progress, Not Random Question Drills</h2>
              <p className="mb-10 text-lg leading-relaxed text-violet-50/85">
                Use targeted practice for weak areas, run full mock tests for readiness, then follow explicit next steps from your latest results to actually improve your band score.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-4">
                <TrackedMarketingLink
                  className="rounded-2xl bg-white px-8 py-4 text-base font-bold text-violet-800 transition-all hover:bg-violet-50 hover:scale-105 shadow-xl shadow-violet-900/35"
                  href="/register"
                  ctaId="home_final_create_account"
                  section="final-cta"
                >
                  Create Free Account
                </TrackedMarketingLink>
                <TrackedMarketingLink
                  className="rounded-2xl border-2 border-violet-100/40 bg-violet-950/30 px-8 py-4 text-base font-bold text-violet-50 transition-colors hover:bg-violet-900/45 hover:border-violet-100/65 backdrop-blur-sm"
                  href="/features"
                  ctaId="home_final_explore_features"
                  section="final-cta"
                >
                  Explore All Features
                </TrackedMarketingLink>
              </div>
            </div>
          </div>
        </MotionReveal>
      </section>
    </div>
  );
}
