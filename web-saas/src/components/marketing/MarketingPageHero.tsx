'use client';

import Link from 'next/link';

import { HeroHeadlineAnimated } from '@/components/marketing/HeroHeadlineAnimated';
import { MarketingGraphicLayer } from '@/components/marketing/MarketingGraphicLayer';
import { TrackedMarketingLink } from '@/components/marketing/TrackedMarketingLink';

type MarketingHeroVariant = 'full' | 'compact';
type MarketingHeroCtaTone = 'primary' | 'secondary';

type MarketingHeroCta = {
  href: string;
  label: string;
  ctaId?: string;
  section?: string;
  tone?: MarketingHeroCtaTone;
  trackPricingSelect?: boolean;
  planTier?: string;
};

type MarketingHeroBadge = {
  text: string;
  icon?: string;
};

type MarketingPageHeroProps = {
  variant: MarketingHeroVariant;
  badge?: MarketingHeroBadge;
  title: string;
  description?: string;
  ctas?: MarketingHeroCta[];
  animated?: boolean;
  keyphrase?: string;
};

const ctaToneClass: Record<MarketingHeroCtaTone, string> = {
  primary:
    'bg-white text-violet-700 shadow-xl shadow-violet-900/20 hover:bg-violet-50 dark:bg-white dark:text-violet-700',
  secondary:
    'border border-white/35 bg-white/10 text-white backdrop-blur-sm hover:bg-white/16 dark:border-violet-200/30 dark:bg-violet-950/20'
};

const renderCta = (cta: MarketingHeroCta, index: number) => {
  const tone = cta.tone || (index === 0 ? 'primary' : 'secondary');
  const classes = `inline-flex items-center justify-center rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors ${ctaToneClass[tone]}`;

  if (cta.ctaId) {
    return (
      <TrackedMarketingLink
        key={cta.ctaId}
        href={cta.href}
        ctaId={cta.ctaId}
        section={cta.section || 'shared-hero'}
        className={classes}
        trackPricingSelect={cta.trackPricingSelect}
        planTier={cta.planTier}
      >
        {cta.label}
      </TrackedMarketingLink>
    );
  }

  return (
    <Link key={`${cta.href}-${cta.label}`} href={cta.href} className={classes}>
      {cta.label}
    </Link>
  );
};

export function MarketingPageHero({
  variant,
  badge,
  title,
  description,
  ctas = [],
  animated = true,
  keyphrase
}: MarketingPageHeroProps) {
  const lines = title
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  if (variant === 'compact') {
    return (
      <section
        data-testid="marketing-shared-hero-compact"
        className="relative overflow-hidden rounded-2xl border border-violet-300/45 bg-gradient-to-r from-violet-700 via-violet-600 to-purple-600 px-6 py-6 text-white shadow-xl shadow-violet-900/30"
      >
        {animated ? <MarketingGraphicLayer preset="hero" intensity="subtle" /> : null}
        <div className="relative z-10 space-y-3">
          {badge ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider">
              {badge.icon ? (
                <span className="material-symbols-outlined text-[14px]" aria-hidden>
                  {badge.icon}
                </span>
              ) : null}
              {badge.text}
            </span>
          ) : null}
          <HeroHeadlineAnimated
            textParts={lines.length ? lines : [title]}
            keyphrase={keyphrase}
            enabled={animated}
            className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl"
          />
          {description ? <p className="max-w-3xl text-sm text-violet-100/90">{description}</p> : null}
        </div>
      </section>
    );
  }

  return (
    <section
      data-testid="marketing-shared-hero-full"
      className="relative overflow-hidden rounded-[2.25rem] border border-violet-300/45 bg-gradient-to-br from-violet-700 via-violet-600 to-purple-600 px-8 py-10 text-white shadow-2xl shadow-violet-900/35 lg:px-12 lg:py-14"
    >
      {animated ? <MarketingGraphicLayer preset="hero" intensity="balanced" /> : null}

      <div className="relative z-10 max-w-3xl space-y-5">
        {badge ? (
          <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider backdrop-blur-sm">
            {badge.icon ? (
              <span className="material-symbols-outlined text-[14px]" aria-hidden>
                {badge.icon}
              </span>
            ) : null}
            {badge.text}
          </span>
        ) : null}

        <HeroHeadlineAnimated
          textParts={lines.length ? lines : [title]}
          keyphrase={keyphrase}
          enabled={animated}
          className="text-4xl font-extrabold tracking-tight leading-[1.08] text-white lg:text-5xl"
        />

        {description ? <p className="max-w-2xl text-lg text-violet-100/90 leading-relaxed">{description}</p> : null}

        {ctas.length > 0 ? <div className="flex flex-wrap items-center gap-3 pt-2">{ctas.map(renderCta)}</div> : null}
      </div>
    </section>
  );
}
