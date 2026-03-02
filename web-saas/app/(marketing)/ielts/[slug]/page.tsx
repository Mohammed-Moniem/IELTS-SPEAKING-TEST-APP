import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { MarketingGraphicLayer } from '@/components/marketing/MarketingGraphicLayer';
import { MarketingPageHero } from '@/components/marketing/MarketingPageHero';
import { getServerMarketingVariant } from '@/lib/marketing/variant-server';
import { getGuideAnswerBlock, getGuideIntentLinks, getIeltsGuideBySlug, ieltsGuides } from '@/lib/seo/ieltsGuides';
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
  const marketingVariant = await getServerMarketingVariant();
  const isMotionVariant = marketingVariant === 'motion';

  if (!guide) {
    notFound();
  }

  const relatedGuides = ieltsGuides.filter(candidate => candidate.slug !== guide.slug).slice(0, 3);
  const answerBlock = getGuideAnswerBlock(guide);
  const intentLinks = getGuideIntentLinks(guide);

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
    dateModified: guide.lastUpdated || guide.lastReviewed,
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

  const geoAnswerSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: guide.title,
        acceptedAnswer: {
          '@type': 'Answer',
          text: answerBlock.shortAnswer
        }
      }
    ]
  };

  return (
    <div className="space-y-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(geoAnswerSchema) }} />

      {isMotionVariant ? (
        <MarketingPageHero
          variant="full"
          animated
          badge={{ icon: 'menu_book', text: `${guide.intent} Guide` }}
          title={guide.h1}
          description={guide.overview}
          ctas={[
            {
              href: '/register',
              label: 'Start Free',
              ctaId: `guide_hero_start_free_${guide.slug}`,
              section: 'guide-hero'
            },
            {
              href: '/pricing',
              label: 'Compare Plans',
              tone: 'secondary',
              ctaId: `guide_hero_compare_plans_${guide.slug}`,
              section: 'guide-hero'
            }
          ]}
        />
      ) : null}

      <nav className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3" aria-label="Breadcrumb">
        <div className="text-sm text-gray-500 dark:text-gray-400">
          <Link href="/" className="text-violet-600 dark:text-violet-400 hover:underline">Home</Link> {' / '} <Link href="/ielts" className="text-violet-600 dark:text-violet-400 hover:underline">IELTS Guides</Link> {' / '} {guide.title}
        </div>
      </nav>

      {!isMotionVariant ? (
        <div className="rounded-2xl border border-violet-100 dark:border-violet-900/40 bg-gradient-to-r from-violet-600 to-indigo-600 p-8 text-white space-y-4">
          <span className="inline-block rounded-full bg-white/20 px-3 py-0.5 text-xs font-semibold uppercase tracking-wider">{guide.intent} Intent</span>
          <h1 className="text-3xl font-bold">{guide.h1}</h1>
          <p className="text-white/70 max-w-2xl">{guide.overview}</p>
          <div className="flex flex-wrap items-center gap-3">
            <Link className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-violet-700 hover:bg-gray-100 transition-colors shadow-lg shadow-black/10" href="/register">
              Start Free
            </Link>
            <Link className="rounded-xl border border-white/30 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10 transition-colors" href="/pricing">
              Compare Plans
            </Link>
            <Link className="rounded-xl border border-white/30 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10 transition-colors" href="/app/dashboard">
              Open Learner App
            </Link>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <article className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 space-y-3">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">What to Focus On</h3>
          <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300 list-disc list-inside">
            {guide.keyPoints.map(item => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>

        <article className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 space-y-3">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Recommended Practice Routine</h3>
          <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300 list-disc list-inside">
            {guide.actionPlan.map(item => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="text-sm text-gray-500 dark:text-gray-400">Recommended plan: {guide.recommendedPlan}</p>
        </article>
      </div>

      <article className="relative isolate overflow-hidden rounded-2xl border border-indigo-100 dark:border-indigo-900/40 bg-indigo-50 dark:bg-indigo-500/10 p-6 space-y-4">
        {isMotionVariant ? <MarketingGraphicLayer preset="content-highlight" intensity="subtle" /> : null}
        <h2 className="relative z-10 text-lg font-bold text-gray-900 dark:text-white">Quick Answer</h2>
        <p className="relative z-10 text-sm text-gray-700 dark:text-gray-300">{answerBlock.shortAnswer}</p>
        <div className="relative z-10 space-y-2">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Source-attributed references</h3>
          <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-300 list-disc list-inside">
            {answerBlock.sourceBullets.map(item => (
              <li key={`${item.sourceName}-${item.label}`}>
                {item.label}{' '}
                <a href={item.sourceUrl} target="_blank" rel="noreferrer noopener" className="text-violet-700 dark:text-violet-300 underline">
                  ({item.sourceName})
                </a>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative z-10 text-sm text-gray-700 dark:text-gray-300">
          <strong>When to use this strategy:</strong> {answerBlock.whenToUse}
        </p>
      </article>

      <article className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 space-y-4">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Recommended Next Routes</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          {intentLinks.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40 p-4 space-y-1 hover:border-violet-300 dark:hover:border-violet-700 transition-colors no-underline"
            >
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{item.label}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{item.description}</p>
            </Link>
          ))}
        </div>
      </article>

      <article className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 space-y-4">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Next Best Action</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          If your exam date is near, prioritize timed mocks and feedback review. If your exam date is distant, focus on
          one core skill upgrade per week.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Link className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 transition-colors shadow-lg shadow-violet-500/25" href="/pricing">
            Choose {guide.recommendedPlan}
          </Link>
          <Link className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-5 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors" href="/features">
            Explore Module Features
          </Link>
          <Link className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-5 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors" href="/ielts">
            Browse All Guides
          </Link>
        </div>
      </article>

      <article className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 space-y-4">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Editorial Trust and Methodology</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Written by {guide.authorName}. Reviewed by {guide.reviewerName}. Last reviewed on {guide.lastReviewed}. Last updated on{' '}
          {guide.lastUpdated || guide.lastReviewed}.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Link className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-5 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors" href="/methodology">
            Scoring Methodology
          </Link>
          <Link className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-5 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors" href="/editorial-policy">
            Editorial Policy
          </Link>
        </div>
      </article>

      <article className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 space-y-4">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Related IELTS Guides</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          {relatedGuides.map(candidate => (
            <Link key={candidate.slug} href={`/ielts/${candidate.slug}`} className="block rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 p-5 space-y-2 hover:border-violet-300 dark:hover:border-violet-700 transition-colors no-underline">
              <h4 className="font-semibold text-gray-900 dark:text-white">{candidate.title}</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {candidate.description}
              </p>
            </Link>
          ))}
        </div>
      </article>
    </div>
  );
}
