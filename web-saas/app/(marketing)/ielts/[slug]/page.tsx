import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getIeltsGuideBySlug, ieltsGuides } from '@/lib/seo/ieltsGuides';
import { siteConfig } from '@/lib/seo/site';

type GuidePageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  return ieltsGuides.map(guide => ({ slug: guide.slug }));
}

export async function generateMetadata({ params }: GuidePageProps): Promise<Metadata> {
  const { slug } = await params;
  const guide = getIeltsGuideBySlug(slug);

  if (!guide) {
    return {
      title: 'IELTS Guide',
      robots: {
        index: false,
        follow: false
      }
    };
  }

  return {
    title: guide.title,
    description: guide.description,
    alternates: {
      canonical: `/ielts/${guide.slug}`
    },
    openGraph: {
      title: `${guide.title} | Spokio`,
      description: guide.description,
      url: `/ielts/${guide.slug}`
    }
  };
}

export default async function GuideDetailPage({ params }: GuidePageProps) {
  const { slug } = await params;
  const guide = getIeltsGuideBySlug(slug);

  if (!guide) {
    notFound();
  }

  const relatedGuides = ieltsGuides.filter(candidate => candidate.slug !== guide.slug).slice(0, 3);

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: `${siteConfig.url}/`
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'IELTS Guides',
        item: `${siteConfig.url}/ielts`
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: guide.title,
        item: `${siteConfig.url}/ielts/${guide.slug}`
      }
    ]
  };

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: guide.title,
    description: guide.description,
    url: `${siteConfig.url}/ielts/${guide.slug}`,
    mainEntityOfPage: `${siteConfig.url}/ielts/${guide.slug}`,
    dateModified: guide.lastReviewed,
    author: {
      '@type': 'Person',
      name: guide.authorName
    },
    reviewedBy: {
      '@type': 'Person',
      name: guide.reviewerName
    },
    publisher: {
      '@type': 'Organization',
      name: 'Spokio',
      url: siteConfig.url
    },
    about: ['IELTS speaking', 'IELTS writing', 'IELTS reading', 'IELTS listening']
  };

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: `Which Spokio plan is most suitable for ${guide.title.toLowerCase()}?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `${guide.recommendedPlan} is the best default for this guide based on practice volume and feedback depth.`
        }
      },
      {
        '@type': 'Question',
        name: 'How often should I practice this module?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Use short daily drills and one weekly full simulation for measurable score progress.'
        }
      },
      {
        '@type': 'Question',
        name: 'Can I track progress across web and mobile?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes. Account, entitlement, and progress data are unified across web and mobile in Spokio.'
        }
      }
    ]
  };

  return (
    <section className="section-wrap">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

      <nav className="panel" aria-label="Breadcrumb">
        <div className="small">
          <Link href="/">Home</Link> {' / '} <Link href="/ielts">IELTS Guides</Link> {' / '} {guide.title}
        </div>
      </nav>

      <div className="panel hero-panel stack">
        <span className="tag">{guide.intent} intent</span>
        <h1>{guide.h1}</h1>
        <p className="subtitle">{guide.overview}</p>
        <div className="cta-row">
          <Link className="btn btn-primary" href="/register">
            Start Free
          </Link>
          <Link className="btn btn-secondary" href="/pricing">
            Compare Plans
          </Link>
          <Link className="btn btn-secondary" href="/app/dashboard">
            Open Learner App
          </Link>
        </div>
      </div>

      <div className="grid-2">
        <article className="panel stack">
          <h3>What to focus on</h3>
          <ul>
            {guide.keyPoints.map(item => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>

        <article className="panel stack">
          <h3>Recommended practice routine</h3>
          <ul>
            {guide.actionPlan.map(item => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="small">Recommended plan: {guide.recommendedPlan}</p>
        </article>
      </div>

      <article className="panel stack">
        <h3>Next best action</h3>
        <p className="small">
          If your exam date is near, prioritize timed mocks and feedback review. If your exam date is distant, focus on
          one core skill upgrade per week.
        </p>
        <div className="cta-row">
          <Link className="btn btn-primary" href="/pricing">
            Choose {guide.recommendedPlan}
          </Link>
          <Link className="btn btn-secondary" href="/features">
            Explore module features
          </Link>
          <Link className="btn btn-secondary" href="/ielts">
            Browse all guides
          </Link>
        </div>
      </article>

      <article className="panel stack">
        <h3>Editorial trust and methodology</h3>
        <p className="small">
          Written by {guide.authorName}. Reviewed by {guide.reviewerName}. Last reviewed on {guide.lastReviewed}.
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
        <h3>Related IELTS guides</h3>
        <div className="grid-3">
          {relatedGuides.map(candidate => (
            <Link key={candidate.slug} href={`/ielts/${candidate.slug}`} className="panel" style={{ textDecoration: 'none' }}>
              <h4>{candidate.title}</h4>
              <p className="small" style={{ marginTop: '0.45rem' }}>
                {candidate.description}
              </p>
            </Link>
          ))}
        </div>
      </article>
    </section>
  );
}

