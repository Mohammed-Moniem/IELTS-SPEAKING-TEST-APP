'use client';

import Image from 'next/image';

import { TrackedMarketingLink } from '@/components/marketing/TrackedMarketingLink';

export function PricingMotionCallout() {
  return (
    <aside
      data-testid="pricing-motion-callout"
      className="relative overflow-hidden rounded-2xl border border-violet-200/70 dark:border-violet-500/35 bg-white/80 dark:bg-[#12082e]/85 p-6 shadow-xl ring-1 ring-violet-200/50 dark:ring-violet-500/25"
    >
      <div className="absolute -top-8 -right-10 h-44 w-44 rounded-full bg-fuchsia-300/30 blur-3xl" />
      <div className="relative z-10 grid gap-4 md:grid-cols-[180px_1fr] md:items-center">
        <Image
          src="/marketing/images/study-desk.svg"
          alt="Structured IELTS study setup"
          width={360}
          height={228}
          className="rounded-xl border border-violet-100 dark:border-violet-500/25 bg-white/60 dark:bg-violet-900/20"
          loading="lazy"
        />
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-700 dark:text-violet-300">
            Recommendation engine
          </p>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">
            Need faster score movement? Pro is built for exam sprint cycles.
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            High-frequency mocks + priority scoring + guarantee coverage for learners targeting near-term exam dates.
          </p>
          <TrackedMarketingLink
            href="/register"
            ctaId="pricing_motion_callout_start_pro"
            section="pricing-motion-callout"
            className="inline-flex items-center justify-center rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 transition-colors shadow-lg shadow-violet-500/25"
          >
            Start With Pro
          </TrackedMarketingLink>
        </div>
      </div>
    </aside>
  );
}
