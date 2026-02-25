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
    <section className="section-wrap">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(aboutSchema) }} />
      <div className="panel hero-panel stack">
        <span className="tag">Mission</span>
        <h1>About Spokio</h1>
        <p className="subtitle">
          Spokio is built for measurable IELTS outcomes: realistic test conditions, feedback learners can act on, and
          architecture that preserves speaking compatibility while expanding to full-module preparation.
        </p>
      </div>

      <article className="panel stack">
        <h3>What we optimize for</h3>
        <ul>
          <li>Consistent preparation across speaking, writing, reading, and listening.</li>
          <li>Clear scoring explanations that reveal specific improvement actions.</li>
          <li>Cross-platform continuity between mobile and web learning journeys.</li>
        </ul>
      </article>

      <article className="panel stack">
        <h3>How we protect reliability</h3>
        <p className="subtitle">
          Existing speaking API contracts remain stable while new modules ship behind feature flags. This approach
          prevents regressions for live users and supports phased rollout by plan and cohort.
        </p>
        <div className="cta-row">
          <Link className="btn btn-secondary" href="/methodology">
            Scoring methodology
          </Link>
          <Link className="btn btn-secondary" href="/editorial-policy">
            Editorial policy
          </Link>
        </div>
      </article>

      <article className="panel stack">
        <h3>Current V1 boundaries</h3>
        <p className="subtitle">
          English-only interface, email/password authentication, AI cost guardrails, and strict admin role controls for
          operational safety.
        </p>
        <div className="cta-row">
          <Link className="btn btn-secondary" href="/features">
            View feature architecture
          </Link>
          <Link className="btn btn-secondary" href="/ielts">
            Explore IELTS guides
          </Link>
        </div>
      </article>
    </section>
  );
}
