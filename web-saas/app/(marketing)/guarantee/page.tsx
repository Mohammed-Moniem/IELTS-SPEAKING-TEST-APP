import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Band Score Improvement Guarantee',
  description:
    'Spokio guarantees at least a 0.5 band score improvement on a Pro plan within 90 days — or we extend your subscription free.',
  alternates: { canonical: '/guarantee' },
  openGraph: {
    title: 'Spokio | Band Score Improvement Guarantee',
    description:
      'Follow your study plan for 90 days. If your IELTS band score doesn\'t improve by 0.5, we extend your Pro subscription free.',
    url: '/guarantee',
  },
};

const eligibility = [
  'Active Pro subscription for a minimum of 90 consecutive days',
  'Complete at least 3 practice sessions per week (any module)',
  'Take a baseline full test within 7 days of starting',
  'Take a final full test within the last 7 days of the 90-day window',
  'Follow the personalised study plan recommendations',
];

const howItWorks = [
  {
    step: '01',
    title: 'Start with a baseline',
    copy: 'Take a full mock test within your first week to establish your starting band score across all four modules.',
  },
  {
    step: '02',
    title: 'Follow your study plan',
    copy: 'Use the AI-powered Study Plan page to practice your weakest skills at least 3 times per week for 90 days.',
  },
  {
    step: '03',
    title: 'Take a final assessment',
    copy: 'Complete another full mock test in your last week. We compare your baseline and final overall band scores.',
  },
  {
    step: '04',
    title: 'Claim your guarantee',
    copy: 'If your overall band didn\'t improve by at least 0.5, contact support and we\'ll extend your Pro subscription for 90 more days — free.',
  },
];

const faqs = [
  {
    q: 'What counts as a "practice session"?',
    a: 'Any completed speaking session, writing submission, or reading/listening test counts as one session. Partial or abandoned attempts don\'t count.',
  },
  {
    q: 'Do I need to use all four modules?',
    a: 'No, but your study plan may recommend focusing on specific modules. To maximise your chance of improvement, follow the plan recommendations.',
  },
  {
    q: 'What if I already have a high band score?',
    a: 'The guarantee applies to any starting score. Even learners at band 7.5 can benefit — the 0.5 improvement threshold applies equally.',
  },
  {
    q: 'How do I claim the extension?',
    a: 'Email support@spokio.app with your account email and the dates of your baseline and final tests. We\'ll verify your activity and extend your subscription within 48 hours.',
  },
  {
    q: 'Can I claim the guarantee more than once?',
    a: 'The guarantee applies once per subscription period. If you\'re extended for 90 days, you can claim again after completing the extension period under the same terms.',
  },
  {
    q: 'Does this apply to the real IELTS exam?',
    a: 'The guarantee is based on your Spokio mock test scores, not official IELTS results. However, consistent improvement on Spokio mock tests is a strong indicator of real exam progress.',
  },
];

export default function GuaranteePage() {
  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      {/* Hero */}
      <div className="marketing-hero-surface rounded-2xl p-8 space-y-5 text-center text-white">
        <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15">
          <span className="material-symbols-outlined text-[36px] text-white">verified</span>
        </div>
        <h1 className="hero-elegant-title text-3xl font-bold">Band Score Improvement Guarantee</h1>
        <p className="hero-elegant-copy mx-auto max-w-xl text-white/85">
          Follow your personalised study plan on a Pro subscription for 90 days. If your overall band score doesn&apos;t
          improve by at least 0.5 bands, we&apos;ll extend your subscription free for another 90 days.
        </p>
        <Link
          href="/register"
          className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-violet-700 shadow-lg shadow-black/10 transition-colors hover:bg-white/90"
        >
          Get Started With Pro
        </Link>
      </div>

      {/* How It Works */}
      <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 space-y-5">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">How It Works</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {howItWorks.map(item => (
            <div key={item.step} className="rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 p-5 space-y-2">
              <span className="inline-block rounded-full bg-emerald-100 dark:bg-emerald-500/10 px-3 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                Step {item.step}
              </span>
              <h3 className="font-semibold text-gray-900 dark:text-white">{item.title}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">{item.copy}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Eligibility */}
      <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 space-y-4">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Eligibility Requirements</h2>
        <ul className="space-y-3">
          {eligibility.map(item => (
            <li key={item} className="flex items-start gap-2.5 text-sm text-gray-700 dark:text-gray-300">
              <span className="material-symbols-outlined text-[20px] text-emerald-600 dark:text-emerald-400 mt-0.5 flex-shrink-0">check_circle</span>
              {item}
            </li>
          ))}
        </ul>
      </section>

      {/* FAQs */}
      <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 space-y-5">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Frequently Asked Questions</h2>
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {faqs.map(item => (
            <div key={item.q} className="py-4 first:pt-0 last:pb-0 space-y-1.5">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{item.q}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <div className="rounded-2xl border border-violet-100 dark:border-violet-900/40 bg-gradient-to-r from-violet-600 to-indigo-600 p-8 text-white space-y-4 text-center">
        <h2 className="text-2xl font-bold">Ready to Improve Your IELTS Band Score?</h2>
        <p className="text-white/70 max-w-md mx-auto">
          Start your free baseline test today. Upgrade to Pro to activate the Band Score Improvement Guarantee.
        </p>
        <div className="flex flex-wrap justify-center gap-3 pt-1">
          <Link
            className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-violet-700 hover:bg-gray-100 transition-colors shadow-lg shadow-black/10"
            href="/register"
          >
            Create Account
          </Link>
          <Link
            className="rounded-xl border border-white/30 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
            href="/pricing"
          >
            View Plans
          </Link>
        </div>
      </div>
    </div>
  );
}
