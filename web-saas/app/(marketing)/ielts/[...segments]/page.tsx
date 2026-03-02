import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';

import { MarketingGraphicLayer } from '@/components/marketing/MarketingGraphicLayer';
import { MarketingPageHero } from '@/components/marketing/MarketingPageHero';
import { getServerMarketingVariant } from '@/lib/marketing/variant-server';
import { getGuideCanonicalPathsWithFallback, getGuideDetailWithFallback } from '@/lib/seo/guideData';
import { canonicalPathFromLegacySlug, ieltsPathFromSegments, normalizeIeltsPath, pathSegmentsFromCanonical } from '@/lib/seo/guideRoutes';
import { siteConfig } from '@/lib/seo/site';

type GuidePageProps = {
  params: Promise<{ segments: string[] }>;
};

export async function generateStaticParams() {
  const paths = await getGuideCanonicalPathsWithFallback();
  return paths
    .map(path => ({
      segments: pathSegmentsFromCanonical(path)
    }))
    .filter(item => item.segments.length > 0);
}

function humanizeSegment(value: string): string {
  return value
    .split('-')
    .filter(Boolean)
    .map(part => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

async function resolveGuideCanonicalPath(segments: string[]): Promise<string> {
  if (!segments.length) {
    return '/ielts';
  }

  if (segments.length === 1) {
    const legacyCanonical = canonicalPathFromLegacySlug(segments[0]);
    if (legacyCanonical) {
      return normalizeIeltsPath(legacyCanonical);
    }
  }

  return normalizeIeltsPath(ieltsPathFromSegments(segments));
}

export async function generateMetadata({ params }: GuidePageProps): Promise<Metadata> {
  const { segments } = await params;
  const canonicalPath = await resolveGuideCanonicalPath(segments);

  const detail = await getGuideDetailWithFallback(canonicalPath);

  if (!detail) {
    return {
      title: 'IELTS Guide',
      robots: {
        index: false,
        follow: false
      }
    };
  }

  return {
    title: detail.page.metaTitle || detail.page.title,
    description: detail.page.metaDescription || detail.page.excerpt,
    alternates: {
      canonical: detail.page.canonicalPath
    },
    robots: {
      index: !detail.page.noindex,
      follow: true
    },
    openGraph: {
      title: `${detail.page.title} | Spokio`,
      description: detail.page.metaDescription || detail.page.excerpt,
      url: detail.page.canonicalPath
    }
  };
}

export default async function GuideDetailPage({ params }: GuidePageProps) {
  const { segments } = await params;

  if (segments.length === 1) {
    const legacyCanonical = canonicalPathFromLegacySlug(segments[0]);
    if (legacyCanonical) {
      permanentRedirect(normalizeIeltsPath(legacyCanonical));
    }
  }

  const canonicalPath = await resolveGuideCanonicalPath(segments);
  const detail = await getGuideDetailWithFallback(canonicalPath);
  const marketingVariant = await getServerMarketingVariant();
  const isMotionVariant = marketingVariant === 'motion';

  if (!detail) {
    notFound();
  }

  const page = detail.page;
  const relatedGuides = detail.related.slice(0, 6);

  const breadcrumbSegments = page.canonicalPath.split('/').filter(Boolean);

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbSegments.map((segment: string, index: number) => {
      const path = `/${breadcrumbSegments.slice(0, index + 1).join('/')}`;
      return {
        '@type': 'ListItem',
        position: index + 1,
        name: index === breadcrumbSegments.length - 1 ? page.title : humanizeSegment(segment),
        item: `${siteConfig.url}${path}`
      };
    })
  };

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: page.title,
    description: page.metaDescription || page.excerpt,
    url: `${siteConfig.url}${page.canonicalPath}`,
    mainEntityOfPage: `${siteConfig.url}${page.canonicalPath}`,
    dateModified: page.updatedAt || page.lastReviewedAt,
    datePublished: page.publishedAt || page.updatedAt,
    author: {
      '@type': 'Organization',
      name: 'Spokio IELTS Content Team'
    },
    publisher: {
      '@type': 'Organization',
      name: 'Spokio',
      url: siteConfig.url
    },
    about: [`IELTS ${page.module}`]
  };

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: (page.faqItems || []).slice(0, 6).map((item: { question: string; answer: string }) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer
      }
    }))
  };

  return (
    <div className="space-y-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      {page.faqItems?.length ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      ) : null}

      {isMotionVariant ? (
        <MarketingPageHero
          variant="full"
          animated
          badge={{ icon: 'menu_book', text: `${humanizeSegment(page.module)} Guide` }}
          title={page.title}
          description={page.excerpt || page.metaDescription || 'Step-by-step IELTS guide with practice-first blocks.'}
          ctas={[
            {
              href: page.ctaConfig?.primary?.href || '/register',
              label: page.ctaConfig?.primary?.label || 'Start Free',
              ctaId: `guide_hero_primary_${page.slug}`,
              section: 'guide-hero'
            },
            {
              href: page.ctaConfig?.secondary?.href || '/pricing',
              label: page.ctaConfig?.secondary?.label || 'Compare Plans',
              tone: 'secondary',
              ctaId: `guide_hero_secondary_${page.slug}`,
              section: 'guide-hero'
            }
          ]}
        />
      ) : (
        <section className="rounded-2xl border border-violet-100 dark:border-violet-900/40 bg-gradient-to-r from-violet-700 to-violet-600 p-8 text-white space-y-4">
          <span className="inline-block rounded-full bg-white/20 px-3 py-0.5 text-xs font-semibold uppercase tracking-wider">
            {humanizeSegment(page.module)} Guide
          </span>
          <h1 className="text-3xl font-bold">{page.title}</h1>
          <p className="text-white/80 max-w-2xl">{page.excerpt || page.metaDescription}</p>
          <div className="flex flex-wrap items-center gap-3">
            <Link className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-violet-700 hover:bg-gray-100 transition-colors shadow-lg shadow-black/10" href={page.ctaConfig?.primary?.href || '/register'}>
              {page.ctaConfig?.primary?.label || 'Start Free'}
            </Link>
            <Link className="rounded-xl border border-white/30 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10 transition-colors" href={page.ctaConfig?.secondary?.href || '/pricing'}>
              {page.ctaConfig?.secondary?.label || 'Compare Plans'}
            </Link>
          </div>
        </section>
      )}

      <nav className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3" aria-label="Breadcrumb">
        <div className="text-sm text-gray-500 dark:text-gray-400 flex flex-wrap items-center gap-1">
          {breadcrumbSegments.map((segment: string, index: number) => {
            const href = `/${breadcrumbSegments.slice(0, index + 1).join('/')}`;
            const isLast = index === breadcrumbSegments.length - 1;
            const label = isLast ? page.title : humanizeSegment(segment);
            return (
              <span key={href}>
                {index > 0 ? ' / ' : null}
                {isLast ? (
                  <span>{label}</span>
                ) : (
                  <Link href={href} className="text-violet-600 dark:text-violet-400 hover:underline">
                    {label}
                  </Link>
                )}
              </span>
            );
          })}
        </div>
      </nav>

      <article className="relative isolate overflow-hidden rounded-2xl border border-violet-100 dark:border-violet-900/40 bg-violet-50 dark:bg-violet-500/10 p-6 space-y-4">
        {isMotionVariant ? <MarketingGraphicLayer preset="content-highlight" intensity="subtle" /> : null}
        <h2 className="relative z-10 text-lg font-bold text-gray-900 dark:text-white">Quick Answer</h2>
        <p className="relative z-10 text-sm text-gray-700 dark:text-gray-300">{page.practiceBlocks?.quickAnswer || page.excerpt || 'This guide gives you a practical IELTS execution path.'}</p>
      </article>

      <div className="grid gap-4 sm:grid-cols-2">
        <article className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 space-y-3">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Common Mistakes</h3>
          <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300 list-disc list-inside">
            {(page.practiceBlocks?.commonMistakes || ['Skipping timed practice', 'Ignoring feedback loops', 'Inconsistent module coverage']).map((item: string) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>

        <article className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 space-y-3">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Step-by-Step Method</h3>
          <ol className="space-y-2 text-sm text-gray-700 dark:text-gray-300 list-decimal list-inside">
            {(page.practiceBlocks?.stepByStepMethod || ['Review the prompt and scoring target.', 'Execute one timed practice cycle.', 'Audit weaknesses and schedule the next drill.']).map((item: string) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </article>
      </div>

      <article className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 space-y-4">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Timed Practice Drill</h3>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {page.practiceBlocks?.timedPracticeDrill ||
            'Run a 20-minute drill: 5 minutes planning, 10 minutes execution, 5 minutes self-review against scoring criteria.'}
        </p>
      </article>

      {page.bodyMarkdown?.trim() ? (
        <article className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 space-y-4">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Guide Detail</h3>
          <pre className="whitespace-pre-wrap break-words text-sm leading-7 text-gray-700 dark:text-gray-300 font-sans">
            {page.bodyMarkdown}
          </pre>
        </article>
      ) : null}

      <article className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 space-y-4">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Self-check Checklist</h3>
        <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300 list-disc list-inside">
          {(page.practiceBlocks?.selfCheckChecklist || [
            'I completed this route under a timer.',
            'I logged at least one improvement target.',
            'I selected the next route to continue momentum.'
          ]).map((item: string) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </article>

      <article className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 space-y-4">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Recommended Next Routes</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          {relatedGuides.slice(0, 3).map((item: { id: string; canonicalPath: string; title: string; excerpt?: string }) => (
            <Link
              key={item.id}
              href={item.canonicalPath}
              className="rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40 p-4 space-y-1 hover:border-violet-300 dark:hover:border-violet-700 transition-colors no-underline"
            >
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{item.title}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{item.excerpt || 'Continue to the next guide route.'}</p>
            </Link>
          ))}
        </div>
      </article>

      <article className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 space-y-4">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Next Best Action</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Move from content to action immediately: complete one timed drill, review mistakes, then follow the next route.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Link className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 transition-colors shadow-lg shadow-violet-500/25" href={page.ctaConfig?.primary?.href || '/register'}>
            {page.ctaConfig?.primary?.label || 'Start Free'}
          </Link>
          <Link className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-5 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors" href={page.ctaConfig?.secondary?.href || '/pricing'}>
            {page.ctaConfig?.secondary?.label || 'Compare Plans'}
          </Link>
          <Link className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-5 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors" href="/ielts">
            Browse All Guides
          </Link>
        </div>
      </article>

      {page.faqItems?.length ? (
        <article className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 space-y-4">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">FAQ</h3>
          <div className="space-y-3">
            {page.faqItems.map((item: { question: string; answer: string }) => (
              <details key={item.question} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4">
                <summary className="cursor-pointer text-sm font-semibold text-gray-900 dark:text-white">{item.question}</summary>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{item.answer}</p>
              </details>
            ))}
          </div>
        </article>
      ) : null}

      <article className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 space-y-4">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Editorial Trust and Methodology</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          This page follows Spokio’s rewrite + attribution workflow with practice-first enhancements and structured review gates before publication.
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
    </div>
  );
}
