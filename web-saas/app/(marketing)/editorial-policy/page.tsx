import type { Metadata } from 'next';
import Link from 'next/link';

import { siteConfig } from '@/lib/seo/site';

export const metadata: Metadata = {
  title: 'Editorial Policy',
  description:
    'Review Spokio editorial policy for IELTS guidance: accuracy standards, review workflow, update cadence, and correction process.',
  alternates: {
    canonical: '/editorial-policy'
  },
  openGraph: {
    title: 'Spokio Editorial Policy',
    description:
      'Review Spokio editorial policy for IELTS guidance: accuracy standards, review workflow, update cadence, and correction process.',
    url: '/editorial-policy'
  }
};

export default function EditorialPolicyPage() {
  const policySchema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Spokio Editorial Policy',
    url: `${siteConfig.url}/editorial-policy`,
    description:
      'Editorial policy describing content creation, review, and maintenance standards for IELTS learning materials.'
  };

  return (
    <section className="section-wrap">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(policySchema) }} />
      <div className="panel hero-panel stack">
        <span className="tag">Trust and quality</span>
        <h1>Editorial policy</h1>
        <p className="subtitle">
          Spokio content is designed for exam readiness, updated regularly, and reviewed against practical IELTS scoring
          criteria and learner usability.
        </p>
      </div>

      <article className="panel stack">
        <h3>How content is created</h3>
        <ul>
          <li>Each guide starts from an intent-focused brief and one primary user outcome.</li>
          <li>Content drafts are mapped to IELTS tasks and known scoring constraints.</li>
          <li>Examples are written for practical exam performance, not theory-only explanations.</li>
        </ul>
      </article>

      <article className="panel stack">
        <h3>Review and update standards</h3>
        <ul>
          <li>Every published guide includes author, reviewer, and last-reviewed date.</li>
          <li>Critical pages are rechecked on a fixed schedule and after major product updates.</li>
          <li>Inaccuracies are corrected and timestamped in the next content revision cycle.</li>
        </ul>
      </article>

      <article className="panel stack">
        <h3>Corrections process</h3>
        <p className="small">
          If you find content issues, contact support@spokio.app with page URL and details. Corrections are prioritized
          by learner impact and released after review.
        </p>
        <div className="cta-row">
          <Link className="btn btn-secondary" href="/methodology">
            View methodology
          </Link>
          <Link className="btn btn-secondary" href="/ielts">
            IELTS guide hub
          </Link>
          <Link className="btn btn-primary" href="/contact">
            Contact team
          </Link>
        </div>
      </article>
    </section>
  );
}

