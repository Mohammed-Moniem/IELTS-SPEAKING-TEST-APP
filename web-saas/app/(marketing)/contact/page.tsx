import type { Metadata } from 'next';
import Link from 'next/link';

import { siteConfig } from '@/lib/seo/site';

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Contact Spokio for support, partnerships, enterprise onboarding, and rollout advisory.',
  alternates: {
    canonical: '/contact'
  },
  openGraph: {
    title: 'Contact Spokio',
    description: 'Contact Spokio for support, partnerships, enterprise onboarding, and rollout advisory.',
    url: '/contact'
  }
};

export default function ContactPage() {
  const contactSchema = {
    '@context': 'https://schema.org',
    '@type': 'ContactPage',
    name: 'Spokio Contact',
    url: `${siteConfig.url}/contact`,
    mainEntity: {
      '@type': 'Organization',
      name: 'Spokio',
      url: siteConfig.url,
      contactPoint: [
        {
          '@type': 'ContactPoint',
          contactType: 'customer support',
          email: 'support@spokio.app',
          availableLanguage: ['English']
        },
        {
          '@type': 'ContactPoint',
          contactType: 'partnerships',
          email: 'partnerships@spokio.app',
          availableLanguage: ['English']
        }
      ]
    }
  };

  return (
    <section className="section-wrap">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(contactSchema) }} />
      <div className="panel hero-panel stack">
        <span className="tag">Contact</span>
        <h1>Contact</h1>
        <p className="subtitle">
          Reach Spokio for product support, enterprise onboarding, or partnerships related to IELTS learner programs.
        </p>
      </div>

      <article className="panel stack">
        <h3>Support channels</h3>
        <p>Support: support@spokio.app</p>
        <p>Partnerships: partnerships@spokio.app</p>
      </article>

      <article className="panel stack">
        <h3>Before you contact us</h3>
        <ul>
          <li>For plan and billing questions, review package details on the pricing page.</li>
          <li>For module availability, check feature-flag rollout status in your learner account.</li>
          <li>For preparation guidance, start from the IELTS guide hub.</li>
        </ul>
        <div className="cta-row">
          <Link className="btn btn-secondary" href="/pricing">
            Pricing details
          </Link>
          <Link className="btn btn-secondary" href="/ielts">
            IELTS guides
          </Link>
          <Link className="btn btn-primary" href="/register">
            Create account
          </Link>
        </div>
      </article>
    </section>
  );
}
