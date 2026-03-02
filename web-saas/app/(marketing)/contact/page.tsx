import type { Metadata } from 'next';
import Link from 'next/link';

import { MarketingGraphicLayer } from '@/components/marketing/MarketingGraphicLayer';
import { MarketingPageHero } from '@/components/marketing/MarketingPageHero';
import { getServerMarketingVariant } from '@/lib/marketing/variant-server';
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

const channels = [
  {
    icon: 'support_agent',
    label: 'Support',
    email: 'support@spokio.app',
    description: 'Account issues, billing questions, and technical problems'
  },
  {
    icon: 'handshake',
    label: 'Partnerships',
    email: 'partnerships@spokio.app',
    description: 'Enterprise onboarding, coaching programs, and institutional accounts'
  }
];

const beforeContact = [
  { icon: 'payments', text: 'For plan and billing questions, review package details on the pricing page.' },
  { icon: 'toggle_on', text: 'For module availability, check feature-flag rollout status in your learner account.' },
  { icon: 'menu_book', text: 'For preparation guidance, start from the IELTS guide hub.' }
];

export default async function ContactPage() {
  const marketingVariant = await getServerMarketingVariant();
  const isMotionVariant = marketingVariant === 'motion';

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
    <div className="space-y-10 lg:space-y-14">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(contactSchema) }} />

      {isMotionVariant ? (
        <MarketingPageHero
          variant="full"
          animated
          badge={{ icon: 'mail', text: 'Get In Touch' }}
          title="Contact Spokio"
          description="Reach Spokio for product support, enterprise onboarding, or partnerships related to IELTS learner programs."
        />
      ) : (
        <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-violet-600 via-indigo-600 to-violet-700 p-10 lg:p-16 text-white">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMSIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA4KSIvPjwvc3ZnPg==')] opacity-60" />
          <div className="absolute bottom-0 left-0 w-[250px] h-[250px] bg-indigo-400/20 rounded-full blur-[80px]" />
          <div className="relative z-10 max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 backdrop-blur-sm px-4 py-1.5 text-xs font-semibold uppercase tracking-wider mb-5">
              <span className="material-symbols-outlined text-[14px]">mail</span>
              Get In Touch
            </span>
            <h1 className="text-4xl lg:text-5xl font-extrabold tracking-tight leading-[1.1]">Contact</h1>
            <p className="mt-4 text-lg text-white/80 leading-relaxed max-w-2xl">
              Reach Spokio for product support, enterprise onboarding, or partnerships related to IELTS learner programs.
            </p>
          </div>
        </section>
      )}

      {/* ── Contact Channels ── */}
      <section className={`relative isolate overflow-hidden rounded-3xl ${isMotionVariant ? 'p-5 sm:p-6' : ''}`}>
        {isMotionVariant ? <MarketingGraphicLayer preset="content-highlight" intensity="subtle" /> : null}
        <div className="relative z-10 grid gap-5 sm:grid-cols-2">
        {channels.map(ch => (
          <article
            key={ch.label}
            className="group relative overflow-hidden rounded-2xl border border-gray-200/60 bg-white p-7 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-violet-500/10 dark:border-gray-800/60 dark:bg-gray-900"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-violet-50/50 to-transparent opacity-0 transition-opacity group-hover:opacity-100 dark:from-violet-500/5" />
            <div className="relative z-10 mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-violet-600 transition-transform group-hover:scale-110 dark:bg-violet-500/20 dark:text-violet-400">
              <span className="material-symbols-outlined text-[24px]">{ch.icon}</span>
            </div>
            <h3 className="relative z-10 mb-1 text-lg font-bold text-gray-900 dark:text-white">{ch.label}</h3>
            <p className="relative z-10 text-sm text-gray-500 dark:text-gray-400 mb-3">{ch.description}</p>
            <a
              href={`mailto:${ch.email}`}
              className="relative z-10 inline-flex items-center gap-2 text-sm font-semibold text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">email</span>
              {ch.email}
            </a>
          </article>
        ))}
        </div>
      </section>

      {/* ── Before You Contact Us ── */}
      <section className="rounded-2xl border border-gray-200/80 bg-white/50 backdrop-blur-sm p-8 dark:border-gray-800/80 dark:bg-gray-900/50 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)]">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-5">Before You Contact Us</h3>
        <div className="space-y-4">
          {beforeContact.map(item => (
            <div key={item.text} className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800">
                <span className="material-symbols-outlined text-[18px] text-gray-500 dark:text-gray-400">{item.icon}</span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed pt-1">{item.text}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3 pt-6 mt-6 border-t border-gray-100 dark:border-gray-800">
          <Link className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-5 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors" href="/pricing">
            Pricing Details
          </Link>
          <Link className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-5 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors" href="/ielts">
            IELTS Guides
          </Link>
          <Link className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 transition-all shadow-lg shadow-violet-500/25 hover:-translate-y-0.5" href="/register">
            Create Account
          </Link>
        </div>
      </section>
    </div>
  );
}
