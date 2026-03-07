'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

import { HardNavigationLink } from '@/components/navigation/HardNavigationLink';
import { siteConfig } from '@/lib/seo/site';

/* ── Static data ── */

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

/* ── FAQ Data ── */

const faqCategories = [
  {
    category: 'Account & Billing',
    icon: 'account_circle',
    items: [
      {
        q: 'How do I create a Spokio account?',
        a: 'Visit the registration page and sign up with your email and password. Your account gives you immediate access to the free plan, which includes one full practice test with feedback and three speaking sessions per month.'
      },
      {
        q: 'What payment methods do you accept?',
        a: 'We accept all major credit and debit cards through Stripe, our secure payment processor. All transactions are encrypted and PCI-compliant. We support monthly and annual billing cycles.'
      },
      {
        q: 'Can I switch between plans?',
        a: 'Yes. You can upgrade or downgrade your plan at any time from your account billing page. Upgrades take effect immediately, and downgrades apply at the end of your current billing period.'
      },
      {
        q: 'How do I cancel my subscription?',
        a: 'You can cancel anytime from the billing section of your account dashboard. Your access continues until the end of your current billing period. No cancellation fees apply.'
      },
      {
        q: 'Do you offer refunds?',
        a: 'If you are unsatisfied within the first 7 days of a paid subscription, contact support@spokio.app for a full refund. After 7 days, remaining time on your plan is available until your billing period ends.'
      }
    ]
  },
  {
    category: 'IELTS Modules',
    icon: 'school',
    items: [
      {
        q: 'Which IELTS modules does Spokio cover?',
        a: 'Spokio covers all four IELTS modules: Speaking, Writing, Reading, and Listening. Each module has dedicated practice sessions, full mock tests, and detailed band score feedback based on official IELTS rubrics.'
      },
      {
        q: 'How does the Speaking module work?',
        a: 'The Speaking module records your responses through your browser microphone, transcribes them in real-time, and evaluates fluency, coherence, lexical range, grammar accuracy, and pronunciation. You receive band scores with specific feedback for each criterion.'
      },
      {
        q: 'What is the difference between Practice and Mock mode?',
        a: 'Practice mode lets you focus on individual sections at your own pace with immediate feedback after each response. Mock mode simulates a full timed exam experience across all sections, giving you a consolidated band score at the end.'
      },
      {
        q: 'How accurate is the scoring compared to the real IELTS exam?',
        a: 'Our scoring combines rule-based checks, AI-assisted analysis, and module-specific rubrics aligned with official IELTS band descriptors. While no practice platform perfectly replicates an official examiner, consistent improvement on Spokio is a strong indicator of real exam progress.'
      }
    ]
  },
  {
    category: 'Platform & Features',
    icon: 'devices',
    items: [
      {
        q: 'Does Spokio work on mobile devices?',
        a: 'Spokio is a web-based platform that works on any modern browser, including mobile browsers on iOS and Android. Your account, progress, and subscription sync across all your devices.'
      },
      {
        q: 'How does progress tracking work?',
        a: 'Spokio tracks your performance across all modules over time. The Progress section shows unified trends, skill breakdowns per module, and practical recommendations to focus your study time on areas that will improve your overall band score.'
      },
      {
        q: 'What is the AI Study Plan?',
        a: 'Based on your practice history and weak areas, Spokio generates a personalized study plan that recommends which modules to focus on, how often to practice, and specific skills to develop. Pro plan subscribers get enhanced study plan features.'
      },
      {
        q: 'What browsers are supported?',
        a: 'Spokio works best on the latest versions of Chrome, Firefox, Safari, and Edge. For the Speaking module, you need a browser that supports microphone access. We recommend Chrome for the most consistent experience.'
      }
    ]
  },
  {
    category: 'Band Score Guarantee',
    icon: 'verified',
    items: [
      {
        q: 'What is the Band Score Improvement Guarantee?',
        a: 'Pro plan subscribers who follow their study plan for 90 consecutive days with at least 3 practice sessions per week are guaranteed a minimum 0.5 band score improvement. If you do not see this improvement, you receive a free 90-day extension.'
      },
      {
        q: 'How do I qualify for the guarantee?',
        a: 'You need an active Pro subscription for 90+ days, complete a baseline full test within your first 7 days, practice at least 3 sessions per week in any module, follow your AI Study Plan, and take a final full test within the last 7 days of the 90-day window.'
      },
      {
        q: 'Is the guarantee based on official IELTS scores?',
        a: 'The guarantee is based on your Spokio mock test scores, not official IELTS exam results. However, consistent score improvement on Spokio is a reliable indicator of progress on the actual exam.'
      }
    ]
  },
  {
    category: 'Data & Privacy',
    icon: 'shield',
    items: [
      {
        q: 'How is my data protected?',
        a: 'All data is transmitted over HTTPS and stored with encryption at rest. We use Stripe for payment processing, meaning we never store your credit card details on our servers. Access controls and role-based permissions protect account data internally.'
      },
      {
        q: 'Are my speaking recordings stored?',
        a: 'Speaking recordings are processed for transcription and scoring, then stored securely in your account history so you can review past sessions. You can delete your practice history at any time from your account settings.'
      },
      {
        q: 'Can I delete my account and data?',
        a: 'Yes. Contact support@spokio.app to request full account deletion. We will remove all personal data, practice history, and recordings within 30 days of your request in compliance with data protection regulations.'
      }
    ]
  },
  {
    category: 'Partnerships & Advertising',
    icon: 'campaign',
    items: [
      {
        q: 'How can my institute partner with Spokio?',
        a: 'We offer institutional partnerships for IELTS coaching centers, language schools, and universities. Partners get dedicated account management, bulk licensing, and integration support. Contact partnerships@spokio.app to learn more.'
      },
      {
        q: 'How does the advertising program work?',
        a: 'Spokio offers sponsored placement packages for IELTS coaches and training institutes. Packages start at $149/month and include placements across the homepage, module side panels, blog, newsletter, and partner spotlight. Visit our Advertise page for details.'
      },
      {
        q: 'How does affiliate code tracking work?',
        a: 'Advertisers and partners can link affiliate codes to their accounts. Conversions driven by your campaigns are tracked and attributed, giving you full visibility into ROI through the advertiser dashboard.'
      }
    ]
  },
  {
    category: 'Technical Support',
    icon: 'build',
    items: [
      {
        q: 'My microphone is not working for Speaking tests. What should I do?',
        a: 'First, make sure your browser has permission to access your microphone (check the address bar for a microphone icon). Try using Chrome if you are on another browser. If the issue persists, check that no other application is using your microphone, and restart your browser.'
      },
      {
        q: 'I am experiencing slow loading or errors. How can I fix this?',
        a: 'Clear your browser cache and cookies, then reload the page. Make sure you have a stable internet connection. If the issue continues, try an incognito/private window to rule out browser extension conflicts. Contact support@spokio.app if problems persist.'
      },
      {
        q: 'How do I report a bug or issue?',
        a: 'Email support@spokio.app with a description of the issue, the browser and device you are using, and any screenshots if possible. Our team reviews all reports and typically responds within one business day.'
      }
    ]
  }
];

/* ── Contact page inner (needs useSearchParams) ── */

function ContactPageInner() {
  const searchParams = useSearchParams();
  const scrollToFaq = searchParams.get('section') === 'faq';
  const faqRef = useRef<HTMLElement>(null);

  const [openFaq, setOpenFaq] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  // Handle scroll-to-faq from footer link
  useEffect(() => {
    if (!scrollToFaq) return;
    const timer = setTimeout(() => {
      const el = faqRef.current ?? document.getElementById('faq');
      if (!el) return;
      // Use smooth scroll with a fallback for environments that don't support it
      try {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch {
        el.scrollIntoView(true);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [scrollToFaq]);

  const toggleFaq = (key: string) => {
    setOpenFaq(prev => (prev === key ? null : key));
  };

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

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqCategories.flatMap(cat =>
      cat.items.map(item => ({
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: {
          '@type': 'Answer',
          text: item.a
        }
      }))
    )
  };

  // Filter FAQs by active category
  const displayedCategories = activeCategory
    ? faqCategories.filter(c => c.category === activeCategory)
    : faqCategories;

  return (
    <div className="space-y-10 lg:space-y-14">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(contactSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

      {/* ── Hero ── */}
      <section className="marketing-hero-surface relative overflow-hidden rounded-[2rem] p-10 text-white lg:p-16">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMSIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA4KSIvPjwvc3ZnPg==')] opacity-60" />
        <div className="absolute bottom-0 left-0 w-[250px] h-[250px] bg-violet-400/20 rounded-full blur-[80px]" />
        <div className="relative z-10 max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/15 backdrop-blur-sm px-4 py-1.5 text-xs font-semibold uppercase tracking-wider mb-5">
            <span className="material-symbols-outlined text-[14px]">mail</span>
            Get In Touch
          </span>
          <h1 className="hero-elegant-title text-4xl font-extrabold leading-[1.1] tracking-tight lg:text-5xl">Contact</h1>
          <p className="hero-elegant-copy mt-4 max-w-2xl text-lg leading-relaxed text-white/80">
            Reach Spokio for product support, enterprise onboarding, or partnerships related to IELTS learner programs.
          </p>
        </div>
      </section>

      {/* ── Contact Channels ── */}
      <section className="grid gap-5 sm:grid-cols-2">
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
          <HardNavigationLink className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 transition-all shadow-lg shadow-violet-500/25 hover:-translate-y-0.5" href="/register">
            Create Account
          </HardNavigationLink>
        </div>
      </section>

      {/* ── Comprehensive FAQ ── */}
      <section ref={faqRef} id="faq" className="scroll-mt-24">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
          <div>
            <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white">Frequently Asked Questions</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Find answers to common questions about Spokio, IELTS preparation, billing, and more.
            </p>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 shrink-0">
            {faqCategories.reduce((sum, c) => sum + c.items.length, 0)} questions across {faqCategories.length} topics
          </p>
        </div>

        {/* Category filter chips */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            type="button"
            onClick={() => setActiveCategory(null)}
            className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              activeCategory === null
                ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/25'
                : 'border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            All Topics
          </button>
          {faqCategories.map(cat => (
            <button
              key={cat.category}
              type="button"
              onClick={() => setActiveCategory(activeCategory === cat.category ? null : cat.category)}
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                activeCategory === cat.category
                  ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/25'
                  : 'border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <span className="material-symbols-outlined text-[14px]">{cat.icon}</span>
              {cat.category}
            </button>
          ))}
        </div>

        {/* FAQ accordion by category */}
        <div className="space-y-8">
          {displayedCategories.map(cat => (
            <div key={cat.category}>
              <div className="flex items-center gap-2.5 mb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-500/20">
                  <span className="material-symbols-outlined text-violet-600 dark:text-violet-400 text-[16px]">{cat.icon}</span>
                </div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wide">{cat.category}</h3>
                <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">{cat.items.length} questions</span>
              </div>
              <div className="space-y-2">
                {cat.items.map((faq, i) => {
                  const key = `${cat.category}-${i}`;
                  const isOpen = openFaq === key;
                  return (
                    <div key={key} className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => toggleFaq(key)}
                        className="flex w-full items-center justify-between px-5 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                      >
                        {faq.q}
                        <span className={`material-symbols-outlined text-[20px] text-gray-400 transition-transform duration-200 shrink-0 ml-3 ${isOpen ? 'rotate-180' : ''}`}>
                          expand_more
                        </span>
                      </button>
                      {isOpen ? (
                        <div className="px-5 pb-4 text-sm text-gray-600 dark:text-gray-400 leading-relaxed border-t border-gray-100 dark:border-gray-800 pt-3">
                          {faq.a}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Still Need Help CTA ── */}
      <section className="rounded-2xl border border-violet-200 dark:border-violet-500/30 bg-violet-50 dark:bg-violet-500/10 p-8 text-center">
        <div className="flex justify-center mb-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100 dark:bg-violet-500/20">
            <span className="material-symbols-outlined text-violet-600 dark:text-violet-400 text-[28px]">help</span>
          </div>
        </div>
        <h3 className="text-lg font-extrabold text-gray-900 dark:text-white mb-2">Still have questions?</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-5 max-w-md mx-auto">
          Our support team typically responds within one business day. Reach out and we will help you get on track.
        </p>
        <a
          href="mailto:support@spokio.app"
          className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 transition-all shadow-lg shadow-violet-500/25 hover:-translate-y-0.5"
        >
          <span className="material-symbols-outlined text-[16px]">email</span>
          Email Support
        </a>
      </section>
    </div>
  );
}

/* ── Suspense wrapper (required for useSearchParams) ── */

export default function ContactPage() {
  return (
    <Suspense fallback={<div className="animate-pulse space-y-6"><div className="h-64 rounded-[2rem] bg-gray-200 dark:bg-gray-800" /><div className="h-32 rounded-2xl bg-gray-100 dark:bg-gray-800" /></div>}>
      <ContactPageInner />
    </Suspense>
  );
}
