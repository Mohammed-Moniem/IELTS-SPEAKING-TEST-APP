import type { Metadata } from 'next';
import Link from 'next/link';

import { ieltsGuides } from '@/lib/seo/ieltsGuides';
import { siteConfig } from '@/lib/seo/site';

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'Compare Spokio IELTS plans across Free, Premium, Pro, and Team packages with monthly and annual billing options.',
  alternates: {
    canonical: '/pricing'
  },
  openGraph: {
    title: 'Spokio Pricing | IELTS Plans',
    description:
      'Compare Spokio IELTS plans across Free, Premium, Pro, and Team packages with monthly and annual billing options.',
    url: '/pricing'
  }
};

const plans = [
  {
    tier: 'free',
    name: 'Free',
    priceMonthly: '$0',
    priceAnnual: 'N/A',
    note: 'Best for onboarding and baseline IELTS diagnostics',
    bullets: [
      'One free full test with feedback and results',
      '3 speaking practice sessions + 1 simulation each month',
      'Unified account, progress, and entitlement foundation'
    ]
  },
  {
    tier: 'premium',
    name: 'Premium',
    priceMonthly: '$14/mo',
    priceAnnual: '$140/yr',
    note: 'For consistent daily prep across all modules',
    bullets: [
      'Expanded usage for speaking, writing, reading, and listening',
      'Detailed AI rubric feedback with actionable weaknesses',
      'Cross-module history and progress drill-down'
    ]
  },
  {
    tier: 'pro',
    name: 'Pro',
    priceMonthly: '$29/mo',
    priceAnnual: '$290/yr',
    note: 'Recommended for high-intensity exam preparation',
    bullets: [
      'Everything in Premium with priority scoring throughput',
      'Higher-frequency full mocks and readiness analytics',
      'Built for rapid band-improvement cycles'
    ]
  },
  {
    tier: 'team',
    name: 'Team',
    priceMonthly: '$79/mo',
    priceAnnual: '$790/yr',
    note: 'For coaches and cohort-based IELTS programs',
    bullets: [
      'Everything in Pro with higher shared throughput',
      'Operational support lane for billing and account management',
      'Suitable for mentor-led programs and small institutions'
    ]
  }
];

export default function PricingPage() {
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
    <section className="section-wrap">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationSchema) }} />
      <div className="panel hero-panel stack">
        <span className="tag">Flexible plans</span>
        <h1>Simple pricing for every IELTS preparation stage</h1>
        <p className="subtitle">
          Start with a free full test, then upgrade when you need higher usage, deeper feedback, and faster progress.
        </p>
      </div>

      <div className="grid-3 plan-grid">
        {plans.map(plan => (
          <article
            key={plan.name}
            className={`panel stack plan-card ${plan.tier === 'premium' ? 'plan-card-featured' : ''}`}
          >
            {plan.tier === 'premium' ? <span className="tag plan-featured-tag">Most popular</span> : null}
            <h3>{plan.name}</h3>
            <p className="kpi plan-price">{plan.priceMonthly}</p>
            <p className="small">Annual: {plan.priceAnnual}</p>
            <p className="small plan-note">{plan.note}</p>
            <ul className="feature-list">
              {plan.bullets.map(item => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <Link href="/register" className="btn btn-primary" style={{ width: 'fit-content' }}>
              {plan.tier === 'pro' ? 'Choose Pro (Recommended)' : `Choose ${plan.name}`}
            </Link>
          </article>
        ))}
      </div>

      <article className="panel stack">
        <h3>Choose by exam timeline</h3>
        <div className="grid-3">
          <div className="panel panel-subtle stack">
            <p className="small value-card-label">Long runway</p>
            <h4>Free or Premium</h4>
            <p className="small">Best when exam date is far and you are building stable habits.</p>
          </div>
          <div className="panel panel-subtle stack">
            <p className="small value-card-label">Exam in 4-8 weeks</p>
            <h4>Premium</h4>
            <p className="small">Balances daily module practice with regular mocks and targeted feedback.</p>
          </div>
          <div className="panel panel-subtle stack">
            <p className="small value-card-label">Exam sprint</p>
            <h4>Pro</h4>
            <p className="small">Built for high-frequency full-test cycles and faster scoring throughput.</p>
          </div>
        </div>
      </article>

      <article className="panel stack">
        <h3>Choose by preparation intensity</h3>
        <div className="grid-2">
          <div className="panel panel-subtle">
            <h4>Steady progress</h4>
            <p className="small">
              Premium is the best fit for daily module practice and regular score feedback across speaking, writing,
              reading, and listening.
            </p>
          </div>
          <div className="panel panel-subtle">
            <h4>Exam sprint mode</h4>
            <p className="small">
              Pro is optimized for high-frequency mocks and readiness analytics when your exam date is close.
            </p>
          </div>
        </div>
      </article>

      <article className="panel stack">
        <h3>Preparation guides linked to plans</h3>
        <p className="small">
          Start with these guides to match your package with a focused IELTS training flow.
        </p>
        <div className="grid-3">
          {recommendedGuides.map(guide => (
            <Link
              key={guide.slug}
              href={`/ielts/${guide.slug}`}
              className="panel panel-link"
              style={{ textDecoration: 'none' }}
            >
              <p className="small value-card-label">Guide</p>
              <h4>{guide.title}</h4>
              <p className="small" style={{ marginTop: '0.45rem' }}>
                {guide.description}
              </p>
            </Link>
          ))}
        </div>
        <div className="cta-row">
          <Link href="/ielts" className="btn btn-secondary">
            All IELTS guides
          </Link>
          <Link href="/register" className="btn btn-primary">
            Start free trial path
          </Link>
        </div>
      </article>
    </section>
  );
}
