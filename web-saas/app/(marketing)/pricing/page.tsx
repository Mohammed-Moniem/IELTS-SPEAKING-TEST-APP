import type { Metadata } from 'next';

import { PricingMotionCallout } from '@/components/marketing/PricingMotionCallout';
import { TrackedMarketingLink } from '@/components/marketing/TrackedMarketingLink';
import { UsageLimitToast } from '@/components/marketing/UsageLimitToast';
import { getServerMarketingVariant } from '@/lib/marketing/variant-server';
import { ieltsGuides } from '@/lib/seo/ieltsGuides';
import { siteConfig } from '@/lib/seo/site';

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'Compare Spokio IELTS plans across Free, Starter, Premium, Pro, and Team packages with monthly and annual billing options.',
  alternates: {
    canonical: '/pricing'
  },
  openGraph: {
    title: 'Spokio Pricing | IELTS Plans',
    description:
      'Compare Spokio IELTS plans across Free, Starter, Premium, Pro, and Team packages with monthly and annual billing options.',
    url: '/pricing'
  }
};

const plans = [
  {
    tier: 'free',
    name: 'Free',
    priceMonthly: '$0',
    priceAnnual: 'N/A',
    note: 'Keep as acquisition funnel with a 3 practice sessions/week cap',
    bullets: [
      'One free full test with feedback and results',
      '3 practice sessions/week baseline',
      'Baseline diagnostics and account foundation',
      'Upgrade when you need more volume and deeper scoring'
    ]
  },
  {
    tier: 'starter',
    name: 'Starter',
    priceMonthly: '$9/mo',
    priceAnnual: '$90/yr',
    note: 'Bridge tier for price-sensitive learners',
    bullets: [
      'Basic AI feedback across modules',
      'Core practice workflow without advanced analytics',
      'Ideal first paid step before Premium'
    ]
  },
  {
    tier: 'premium',
    name: 'Premium',
    priceMonthly: '$24/mo',
    priceAnnual: '$240/yr',
    note: 'Full AI evaluation across all 4 modules with progress tracking',
    bullets: [
      'Full AI evaluation across all IELTS modules',
      'Detailed rubric feedback with actionable weaknesses',
      'Cross-module history and progress drill-down'
    ]
  },
  {
    tier: 'pro',
    name: 'Pro',
    priceMonthly: '$49/mo',
    priceAnnual: '$490/yr',
    note: 'Advanced analytics, priority AI, and custom study plans',
    bullets: [
      'Everything in Premium with priority scoring throughput',
      'Advanced analytics and score prediction',
      'Custom study plans for rapid band-improvement cycles',
      'Band Score Improvement Guarantee included'
    ]
  },
  {
    tier: 'team',
    name: 'Team',
    priceMonthly: '$99/mo',
    priceAnnual: '$990/yr per seat (min 5)',
    note: 'Coach dashboard, student management, and group analytics',
    bullets: [
      'Everything in Pro with higher shared throughput',
      'Coach dashboard and student management controls',
      'Group analytics for cohort-based IELTS programs'
    ]
  }
];

export default async function PricingPage() {
  const marketingVariant = await getServerMarketingVariant();
  const isMotionVariant = marketingVariant === 'motion';
  const softwareApplicationSchema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Spokio',
    applicationCategory: 'EducationalApplication',
    operatingSystem: 'Web',
    url: `${siteConfig.url}/pricing`,
    offers: plans.map(plan => ({
      '@type': 'Offer',
      name: `${plan.name} plan`,
      priceCurrency: 'USD',
      price: plan.priceMonthly === '$0' ? '0' : plan.priceMonthly.replace(/[^0-9.]/g, ''),
      category: 'subscription'
    }))
  };

  const recommendedGuides = ieltsGuides.filter(guide =>
    ['ielts-full-mock-test-online', 'ielts-study-plan-30-days', 'ielts-speaking-practice-online'].includes(guide.slug)
  );

  return (
    <div className="space-y-10 lg:space-y-14">
      <UsageLimitToast />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationSchema) }} />

      {/* ── Hero ── */}
      <section className="marketing-hero-surface relative overflow-hidden rounded-[2rem] p-10 text-center text-white lg:p-16">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMSIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA4KSIvPjwvc3ZnPg==')] opacity-60" />
        <div className="absolute top-0 left-1/4 w-[400px] h-[400px] bg-fuchsia-500/15 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[300px] h-[300px] bg-violet-300/25 rounded-full blur-[100px]" />
        <div className="relative z-10 mx-auto max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/15 backdrop-blur-sm px-4 py-1.5 text-xs font-semibold uppercase tracking-wider mb-5">
            <span className="material-symbols-outlined text-[14px]">payments</span>
            Flexible Plans
          </span>
          <h1 className="hero-elegant-title text-4xl font-extrabold leading-[1.1] tracking-tight lg:text-5xl">Simple Pricing for Every IELTS Preparation Stage</h1>
          <p className="hero-elegant-copy mt-4 text-lg leading-relaxed text-white/80">
            Start with a free full test, then upgrade when you need higher usage, deeper feedback, and faster progress.
          </p>
        </div>
      </section>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {plans.map(plan => (
          <article
            key={plan.name}
            className={`motion-tilt-card group relative flex h-full flex-col gap-4 overflow-hidden rounded-2xl border bg-white p-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl dark:bg-gray-900 ${plan.tier === 'pro'
                ? 'border-violet-400 dark:border-violet-500 ring-2 ring-violet-600/30 shadow-lg shadow-violet-500/10 hover:shadow-violet-500/20'
                : 'border-gray-200 dark:border-gray-800 hover:shadow-violet-500/10'
              }`}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-violet-50/30 to-transparent opacity-0 transition-opacity group-hover:opacity-100 dark:from-violet-500/5" />
            <div className="relative z-10 space-y-2">
              {plan.tier === 'pro' ? (
                <span className="inline-flex rounded-full bg-violet-600 px-3 py-0.5 text-xs font-semibold text-white shadow-lg shadow-violet-500/25">
                  Most Popular
                </span>
              ) : null}
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">{plan.name}</h3>
              <p className="text-4xl font-extrabold text-gray-900 dark:text-white mt-2">{plan.priceMonthly}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Annual: {plan.priceAnnual}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">{plan.note}</p>
            </div>
            <ul className="relative z-10 space-y-2.5 text-sm text-gray-700 dark:text-gray-300">
              {plan.bullets.map(item => (
                <li key={item} className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-[16px] text-violet-600 dark:text-violet-400 mt-0.5 flex-shrink-0">check_circle</span>
                  {item}
                </li>
              ))}
            </ul>
            <TrackedMarketingLink
              href="/register"
              ctaId={`pricing_choose_${plan.tier}`}
              section="pricing-plans"
              trackPricingSelect
              planTier={plan.tier}
              className="relative z-10 mt-auto inline-flex w-full items-center justify-center rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 transition-all hover:-translate-y-0.5 hover:bg-violet-700"
            >
              {plan.tier === 'pro' ? 'Choose Pro (Recommended)' : `Choose ${plan.name}`}
            </TrackedMarketingLink>
          </article>
        ))}
      </div>

      {isMotionVariant ? <PricingMotionCallout /> : null}

      <article className="rounded-2xl border border-violet-200 dark:border-violet-800/50 bg-gradient-to-br from-violet-50 to-white dark:from-violet-500/10 dark:to-[#12082e] p-6 space-y-4">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-[24px] text-violet-600 dark:text-violet-300">verified</span>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Band Score Improvement Guarantee</h3>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 max-w-3xl">
          Pro subscribers who follow their study plan for 90 days (at least 3 sessions per week) are guaranteed a minimum
          0.5 band improvement. If you don&apos;t improve, we extend your Pro subscription free for another 90 days &mdash; no questions asked.
        </p>
        <div className="flex flex-wrap gap-3">
          <TrackedMarketingLink
            href="/register"
            ctaId="pricing_guarantee_start_pro"
            section="pricing-guarantee"
            className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 transition-colors shadow-lg shadow-violet-500/25"
          >
            Start With Pro
          </TrackedMarketingLink>
          <TrackedMarketingLink
            href="/guarantee"
            ctaId="pricing_guarantee_terms"
            section="pricing-guarantee"
            className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-5 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Full Guarantee Terms
          </TrackedMarketingLink>
        </div>
      </article>

      <article className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 space-y-4">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Choose by Exam Timeline</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 p-5 space-y-2">
            <p className="text-xs font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wider">Long Runway</p>
            <h4 className="font-semibold text-gray-900 dark:text-white">Free or Starter</h4>
            <p className="text-sm text-gray-500 dark:text-gray-400">Best when exam date is far and you are building stable habits.</p>
          </div>
          <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 p-5 space-y-2">
            <p className="text-xs font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wider">Exam in 4–8 Weeks</p>
            <h4 className="font-semibold text-gray-900 dark:text-white">Premium</h4>
            <p className="text-sm text-gray-500 dark:text-gray-400">Balances daily module practice with regular mocks and targeted feedback.</p>
          </div>
          <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 p-5 space-y-2">
            <p className="text-xs font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wider">Exam Sprint</p>
            <h4 className="font-semibold text-gray-900 dark:text-white">Pro</h4>
            <p className="text-sm text-gray-500 dark:text-gray-400">Built for high-frequency full-test cycles and faster scoring throughput.</p>
          </div>
        </div>
      </article>

      <article className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 space-y-4">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Choose by Preparation Intensity</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 p-5 space-y-2">
            <h4 className="font-semibold text-gray-900 dark:text-white">Steady Progress</h4>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Premium is the best fit for daily module practice and regular score feedback across speaking, writing,
              reading, and listening.
            </p>
          </div>
          <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 p-5 space-y-2">
            <h4 className="font-semibold text-gray-900 dark:text-white">Exam Sprint Mode</h4>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Pro is optimized for high-frequency mocks and readiness analytics when your exam date is close.
            </p>
          </div>
        </div>
      </article>

      <article className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 space-y-4">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Preparation Guides Linked to Plans</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Start with these guides to match your package with a focused IELTS training flow.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          {recommendedGuides.map(guide => (
            <TrackedMarketingLink
              key={guide.slug}
              href={`/ielts/${guide.slug}`}
              ctaId={`pricing_guide_${guide.slug}`}
              section="pricing-guides"
              className="block rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 p-5 space-y-2 hover:border-violet-300 dark:hover:border-violet-700 transition-colors no-underline"
            >
              <p className="text-xs font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wider">Guide</p>
              <h4 className="font-semibold text-gray-900 dark:text-white">{guide.title}</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {guide.description}
              </p>
            </TrackedMarketingLink>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <TrackedMarketingLink
            href="/ielts"
            ctaId="pricing_all_guides"
            section="pricing-guides"
            className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-5 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            All IELTS Guides
          </TrackedMarketingLink>
          <TrackedMarketingLink
            href="/register"
            ctaId="pricing_start_trial_path"
            section="pricing-guides"
            className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 transition-colors shadow-lg shadow-violet-500/25"
          >
            Start Free Trial Path
          </TrackedMarketingLink>
        </div>
      </article>
    </div>
  );
}
