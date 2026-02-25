import type { Metadata } from 'next';
import Link from 'next/link';

import { ieltsGuides } from '@/lib/seo/ieltsGuides';
import { siteConfig } from '@/lib/seo/site';

export const metadata: Metadata = {
  title: 'Features',
  description:
    'Explore Spokio IELTS features: speaking-safe web parity, writing, reading, listening, full exams, and role-based admin controls.',
  alternates: {
    canonical: '/features'
  },
  openGraph: {
    title: 'Spokio Features | Complete IELTS SaaS',
    description:
      'Explore Spokio IELTS features: speaking-safe web parity, writing, reading, listening, full exams, and role-based admin controls.',
    url: '/features'
  }
};

const cards = [
  ['Speaking', 'Browser recording, transcription, evaluator flow, and robust fallback for mic-denied states.'],
  ['Writing', 'Prompt generation, scored submissions, rubric breakdown, and history endpoints.'],
  ['Reading', 'Practice/full mocks with objective scoring and normalized band feedback.'],
  ['Listening', 'Audio-aware test flow with transcript metadata and objective scoring.'],
  ['Full Exams', 'Section orchestration and consolidated results under one exam session.'],
  ['Progress', 'Unified trends, skill breakdowns, and practical recommendations for next sessions.'],
  ['Partner Program', 'Track partner-code performance, earnings, payouts, and monthly targets.'],
  ['Admin Suite', 'Role-gated content ops, user/subscription support, analytics, AI cost, and feature flags.']
] as const;

export default function FeaturesPage() {
  const itemListSchema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Spokio IELTS feature modules',
    itemListElement: cards.map(([title, copy], index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: title,
      description: copy
    }))
  };

  const guideHighlights = ieltsGuides.slice(0, 4);

  return (
    <section className="section-wrap">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }} />
      <div className="panel hero-panel stack">
        <span className="tag">Complete IELTS feature stack</span>
        <h1>Everything learners need for IELTS progress in one connected workflow</h1>
        <p className="subtitle">
          Spokio links speaking, writing, reading, listening, and full mocks into one measurable learning loop with
          clear progress and actionable coaching signals.
        </p>
      </div>

      <div className="grid-3 feature-grid">
        {cards.map(([title, copy]) => (
          <article key={title} className="panel stack feature-card">
            <p className="small value-card-label">Module</p>
            <h3>{title}</h3>
            <p className="subtitle">{copy}</p>
          </article>
        ))}
      </div>

      <article className="panel stack">
        <h3>How this improves IELTS score consistency</h3>
        <p className="subtitle">
          Most learners underperform because module preparation stays fragmented. Spokio links each module into one
          measurable progress loop with shared history, billing, and readiness tracking.
        </p>
        <ul className="feature-list">
          <li>Practice mode for focused skill drills.</li>
          <li>Mock mode for realistic time pressure and completion discipline.</li>
          <li>Progress view for section-level weakness detection and correction planning.</li>
        </ul>
      </article>

      <article className="panel stack">
        <h3>IELTS strategy guides</h3>
        <p className="small">
          Explore module-specific preparation guides and execution plans for Academic and General IELTS pathways.
        </p>
        <div className="grid-2">
          {guideHighlights.map(guide => (
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
          <Link className="btn btn-secondary" href="/ielts">
            Browse all guides
          </Link>
          <Link className="btn btn-primary" href="/pricing">
            View plans
          </Link>
        </div>
      </article>

      <article className="panel stack">
        <h3>Built for staged rollout and reliability</h3>
        <p className="small">
          Admin controls, audit logs, and feature flags keep module launches predictable while protecting speaking
          compatibility guarantees.
        </p>
        <p className="small">Canonical web URL: {siteConfig.url}/features</p>
      </article>
    </section>
  );
}
