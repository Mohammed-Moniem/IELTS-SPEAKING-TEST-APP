'use client';

import Link from 'next/link';

interface HeroCta {
  href: string;
  label: string;
  tone?: 'primary' | 'secondary';
  ctaId?: string;
  section?: string;
}

interface HeroBadge {
  icon: string;
  text: string;
}

interface MarketingPageHeroProps {
  variant?: 'full' | 'compact';
  animated?: boolean;
  badge?: HeroBadge;
  title: string;
  description?: string;
  ctas?: HeroCta[];
}

export function MarketingPageHero({
  variant = 'full',
  animated = false,
  badge,
  title,
  description,
  ctas = [],
}: MarketingPageHeroProps) {
  const isCompact = variant === 'compact';

  return (
    <section
      className={`marketing-hero-surface relative space-y-4 overflow-hidden rounded-2xl text-white ${
        isCompact ? 'p-6' : 'p-8'
      } ${animated ? 'animate-in fade-in slide-in-from-bottom-4 duration-500' : ''}`}
    >
      {/* Decorative blurs */}
      <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-violet-300/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-violet-400/15 blur-2xl" />

      {badge ? (
        <span className="relative z-10 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-0.5 text-xs font-semibold uppercase tracking-wider">
          <span className="material-symbols-rounded text-sm">{badge.icon}</span>
          {badge.text}
        </span>
      ) : null}

      <h1 className={`hero-elegant-title relative z-10 font-bold ${isCompact ? 'text-2xl' : 'text-3xl'}`}>
        {title}
      </h1>

      {description ? (
        <p className="hero-elegant-copy relative z-10 max-w-2xl text-white/80">{description}</p>
      ) : null}

      {ctas.length > 0 ? (
        <div className="relative z-10 flex flex-wrap items-center gap-3">
          {ctas.map((cta) =>
            cta.tone === 'secondary' ? (
              <Link
                key={cta.href}
                href={cta.href}
                className="rounded-xl border border-white/30 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
                data-cta-id={cta.ctaId}
                data-section={cta.section}
              >
                {cta.label}
              </Link>
            ) : (
              <Link
                key={cta.href}
                href={cta.href}
                className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-violet-700 hover:bg-gray-100 transition-colors shadow-lg shadow-black/10"
                data-cta-id={cta.ctaId}
                data-section={cta.section}
              >
                {cta.label}
              </Link>
            )
          )}
        </div>
      ) : null}
    </section>
  );
}
