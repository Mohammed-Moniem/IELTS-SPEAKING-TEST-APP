import type { Metadata } from 'next';
import Link from 'next/link';

import { siteConfig } from '@/lib/seo/site';

export const metadata: Metadata = {
  title: 'Scoring Methodology',
  description:
    'Understand Spokio IELTS scoring methodology across speaking, writing, reading, and listening, including rubric signals and quality controls.',
  alternates: {
    canonical: '/methodology'
  },
  openGraph: {
    title: 'Spokio Scoring Methodology',
    description:
      'Understand Spokio IELTS scoring methodology across speaking, writing, reading, and listening, including rubric signals and quality controls.',
    url: '/methodology'
  }
};

export default function MethodologyPage() {
  const methodologySchema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Spokio IELTS scoring methodology',
    url: `${siteConfig.url}/methodology`,
    description: 'Methodology overview for scoring workflows, feedback generation, and quality checks.'
  };

  return (
    <section className="section-wrap">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(methodologySchema) }} />
      <div className="panel hero-panel stack">
        <span className="tag">Scoring framework</span>
        <h1>How Spokio evaluates IELTS performance</h1>
        <p className="subtitle">
          Spokio combines rule-based checks with AI-assisted analysis and module-specific rubrics to produce feedback
          designed for practical score improvement.
        </p>
      </div>

      <article className="panel stack">
        <h3>Module evaluation principles</h3>
        <ul>
          <li>Speaking: fluency, coherence, lexical resource, and grammatical range signals.</li>
          <li>Writing: task response, cohesion, lexical control, and grammar consistency.</li>
          <li>Reading and listening: objective answer accuracy with section-level error patterns.</li>
        </ul>
      </article>

      <article className="panel stack">
        <h3>Quality and guardrails</h3>
        <ul>
          <li>Feature-flagged rollout allows model and scoring updates without broad disruption.</li>
          <li>Usage budgets and request controls protect cost stability and service availability.</li>
          <li>Score explanations prioritize actionable fixes over generic commentary.</li>
        </ul>
      </article>

      <article className="panel stack">
        <h3>Interpretation guidance</h3>
        <p className="small">
          Use score reports as directional feedback. Final official IELTS scores are determined by the official test
          provider.
        </p>
        <div className="cta-row">
          <Link className="btn btn-secondary" href="/editorial-policy">
            Editorial policy
          </Link>
          <Link className="btn btn-secondary" href="/ielts">
            IELTS guide hub
          </Link>
          <Link className="btn btn-primary" href="/pricing">
            Compare plans
          </Link>
        </div>
      </article>
    </section>
  );
}

