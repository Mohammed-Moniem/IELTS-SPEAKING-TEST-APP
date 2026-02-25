import type { Metadata } from 'next';
import Link from 'next/link';

import { ieltsGuides } from '@/lib/seo/ieltsGuides';
import { siteConfig } from '@/lib/seo/site';

export const metadata: Metadata = {
  title: 'IELTS Guides',
  description:
    'Explore Spokio IELTS guides for speaking, writing, reading, listening, full mock tests, and study-planning strategy.',
  alternates: {
    canonical: '/ielts'
  },
  openGraph: {
    title: 'IELTS Guides | Spokio',
    description:
      'Explore Spokio IELTS guides for speaking, writing, reading, listening, full mock tests, and study-planning strategy.',
    url: '/ielts'
  }
};

export default function IeltsGuidesPage() {
  const itemListSchema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Spokio IELTS Guides',
    itemListElement: ieltsGuides.map((guide, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: `${siteConfig.url}/ielts/${guide.slug}`,
      name: guide.title
    }))
  };

  return (
    <section className="section-wrap">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }} />
      <div className="panel hero-panel stack">
        <span className="tag">IELTS Learning Hub</span>
        <h1>IELTS preparation guides by module and score goal</h1>
        <p className="subtitle">
          Use these practical guides to build a repeatable training routine for speaking, writing, reading, listening,
          and full mock readiness.
        </p>
      </div>

      <div className="grid-2">
        {ieltsGuides.map(guide => (
          <article key={guide.slug} className="panel stack">
            <span className="tag">{guide.intent}</span>
            <h3>{guide.title}</h3>
            <p className="subtitle">{guide.description}</p>
            <Link className="btn btn-secondary" href={`/ielts/${guide.slug}`} style={{ width: 'fit-content' }}>
              Open guide
            </Link>
          </article>
        ))}
      </div>

      <article className="panel stack">
        <h3>Trust and scoring transparency</h3>
        <p className="small">
          Every guide is authored, reviewed, and refreshed on a maintenance cycle. See how scoring guidance is built and
          how content quality is maintained.
        </p>
        <div className="cta-row">
          <Link className="btn btn-secondary" href="/methodology">
            View methodology
          </Link>
          <Link className="btn btn-secondary" href="/editorial-policy">
            Editorial policy
          </Link>
          <Link className="btn btn-primary" href="/pricing">
            Choose a plan
          </Link>
        </div>
      </article>
    </section>
  );
}
