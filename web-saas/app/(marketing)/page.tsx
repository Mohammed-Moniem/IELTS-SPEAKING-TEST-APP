import type { Metadata } from 'next';
import Link from 'next/link';

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
    title: 'Band-focused coaching loop',
    body: 'Every session feeds a clear next action so learners know exactly what to practice next and why.'
  },
  {
    title: 'Full IELTS in one place',
    body: 'Speaking, writing, reading, listening, and full mocks are connected in one progress timeline.'
  },
  {
    title: 'Mobile + web continuity',
    body: 'The same account, limits, and score history follow learners across devices without reset friction.'
  },
  {
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

export default function HomePage() {
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
    <section className="section-wrap">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <div className="marketing-hero-grid" data-testid="marketing-hero-grid">
        <div className="panel hero-panel stack marketing-hero-panel">
          <span className="tag">Spokio IELTS Platform</span>
          <h1>Raise your IELTS band with one focused learning system.</h1>
          <p className="subtitle">
            Spokio combines realistic test practice, AI feedback, and clear improvement steps so learners can move from
            random practice to measurable band growth.
          </p>
          <div className="marketing-proof-strip" data-testid="marketing-proof-strip">
            <span className="proof-chip">Band-focused feedback</span>
            <span className="proof-chip">One free full test</span>
            <span className="proof-chip">No card for trial</span>
          </div>
          <div className="cta-row marketing-hero-actions">
            <Link className="btn btn-primary" href="/register">
              Start Free Test
            </Link>
            <Link className="btn btn-secondary" href="/pricing">
              View plans
            </Link>
            <Link className="btn btn-secondary" href="/ielts">
              IELTS guides
            </Link>
          </div>
        </div>

        <aside className="panel marketing-hero-side stack">
          <p className="small marketing-side-kicker">Outcome snapshot</p>
          <h3>From practice to test-day confidence</h3>
          <ul className="feature-list">
            <li>Guided speaking sessions with clear rubric feedback</li>
            <li>Full test simulation with results and coaching actions</li>
            <li>Cross-module roadmap for fluency, coherence, and timing</li>
          </ul>
          <div className="cta-row">
            <Link className="btn btn-secondary" href="/app/dashboard">
              Open learner app
            </Link>
            <Link className="btn btn-secondary" href="/admin/overview">
              Admin suite
            </Link>
          </div>
        </aside>
      </div>

      <div className="marketing-value-grid" data-testid="marketing-value-grid">
        {pillars.map(item => (
          <article key={item.title} className="panel stack value-card">
            <p className="small value-card-label">Why it matters</p>
            <h3>{item.title}</h3>
            <p className="subtitle">{item.body}</p>
          </article>
        ))}
      </div>

      <article className="panel stack">
        <h3>How learners use Spokio in practice</h3>
        <div className="grid-3">
          {journey.map(item => (
            <div key={item.step} className="panel panel-subtle stack">
              <span className="tag">Step {item.step}</span>
              <h4>{item.title}</h4>
              <p className="small">{item.copy}</p>
            </div>
          ))}
        </div>
      </article>

      <article className="panel stack marketing-bottom-panel">
        <h3>Built for serious IELTS progress, not random question drills</h3>
        <p className="subtitle">
          Use targeted practice for weak areas, run full mock tests for readiness, then follow explicit next steps from
          your latest results.
        </p>
        <div className="cta-row">
          <Link className="btn btn-primary" href="/register">
            Create account
          </Link>
          <Link className="btn btn-secondary" href="/features">
            Explore all features
          </Link>
        </div>
      </article>
    </section>
  );
}
