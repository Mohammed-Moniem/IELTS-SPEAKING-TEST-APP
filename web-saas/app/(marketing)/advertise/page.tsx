import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Advertise with Spokio',
  description:
    'Reach IELTS learners, coaches, and institutes with policy-reviewed sponsorship packages across modules, blog, and partner surfaces.',
  alternates: {
    canonical: '/advertise'
  },
  openGraph: {
    title: 'Advertise with Spokio',
    description:
      'Tiered sponsorship packages and affiliate-aligned campaigns for IELTS coaches and institutions.',
    url: '/advertise'
  }
};

const inventory = [
  {
    name: 'Homepage Sponsor Card',
    details: 'High-visibility placement on learner and marketing entry experiences.',
    audience: 'All traffic'
  },
  {
    name: 'Module Side Panel Sponsor',
    details: 'Contextual placements beside speaking, writing, reading, and listening workflows.',
    audience: 'Active learners'
  },
  {
    name: 'Blog Sponsored Block',
    details: 'Sponsored recommendations inside high-intent IELTS strategy articles.',
    audience: 'Organic content visitors'
  },
  {
    name: 'Newsletter Slot',
    details: 'Sponsored feature in weekly learning and exam strategy roundups.',
    audience: 'Email subscribers'
  },
  {
    name: 'Partner Spotlight',
    details: 'Premium spotlight unit for institutes and strategic coaching partners.',
    audience: 'Conversion-ready users'
  }
];

const packages = [
  {
    name: 'Coach Starter',
    price: '$149 / month',
    who: 'Solo coaches and small tutoring teams',
    includes: ['Module side panel placement', 'Basic analytics report', 'Affiliate code support']
  },
  {
    name: 'Institute Growth',
    price: '$499 / month',
    who: 'Training centers and mid-size institutes',
    includes: ['Homepage sponsor card', 'Blog sponsored block', 'Campaign performance export']
  },
  {
    name: 'Premium Spotlight',
    price: '$999 / month',
    who: 'Large providers with growth targets',
    includes: ['Partner spotlight', 'Newsletter slot', 'Priority campaign approvals']
  },
  {
    name: 'Enterprise Custom',
    price: 'Custom',
    who: 'Multi-region institutions and enterprise partners',
    includes: ['Custom placements', 'Quarterly planning', 'Dedicated operations support']
  }
];

export default function AdvertisePage() {
  return (
    <div className="space-y-10 lg:space-y-14" data-testid="marketing-advertise-page">
      {/* ── Hero ── */}
      <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#4C1D95] via-[#6D28D9] to-[#7C3AED] p-10 lg:p-16 text-white">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMSIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA4KSIvPjwvc3ZnPg==')] opacity-60" />
        <div className="absolute top-0 right-0 w-[350px] h-[350px] bg-fuchsia-300/25 rounded-full blur-[110px]" />
        <div className="absolute bottom-0 left-0 w-[320px] h-[320px] bg-violet-300/20 rounded-full blur-[100px]" />
        <div className="relative z-10 max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/15 backdrop-blur-sm px-4 py-1.5 text-xs font-semibold uppercase tracking-wider mb-5">
            <span className="material-symbols-outlined text-[14px]">campaign</span>
            Sponsorship + Affiliate
          </span>
          <h1 className="text-4xl lg:text-5xl font-extrabold tracking-tight leading-[1.1]">Advertise with Spokio</h1>
          <p className="mt-4 text-lg text-white/80 leading-relaxed max-w-2xl">
            Reach IELTS learners with policy-reviewed placements, measurable delivery, and attribution aligned with our
            affiliate engine. We support monthly, quarterly, and annual sponsorship programs.
          </p>
          <div className="mt-6 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-white/15 backdrop-blur-sm px-3 py-1.5 font-semibold">110K+ monthly page views</span>
            <span className="rounded-full bg-white/15 backdrop-blur-sm px-3 py-1.5 font-semibold">38K+ active learners</span>
            <span className="rounded-full bg-white/15 backdrop-blur-sm px-3 py-1.5 font-semibold">4 core IELTS modules</span>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-violet-900/50 dark:bg-[#12082e]/90">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Product Inventory</h2>
          <ul className="mt-3 space-y-3">
            {inventory.map(item => (
              <li key={item.name} className="rounded-xl border border-gray-200 p-3 dark:border-violet-900/50">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{item.name}</p>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{item.details}</p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Audience: {item.audience}</p>
              </li>
            ))}
          </ul>
        </article>

        <article className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-violet-900/50 dark:bg-[#12082e]/90">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Package Catalog</h2>
          <div className="mt-3 space-y-3">
            {packages.map(pkg => (
              <div key={pkg.name} className="rounded-xl border border-gray-200 p-3 dark:border-violet-900/50">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{pkg.name}</p>
                  <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-700 dark:bg-violet-500/20 dark:text-violet-300">
                    {pkg.price}
                  </span>
                </div>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{pkg.who}</p>
                <ul className="mt-2 space-y-1 text-xs text-gray-500 dark:text-gray-400">
                  {pkg.includes.map(line => (
                    <li key={line}>• {line}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-violet-900/50 dark:bg-[#12082e]/90">
          <h2 className="text-base font-bold text-gray-900 dark:text-white">Policy and Approval</h2>
          <ul className="mt-3 space-y-2 text-sm text-gray-600 dark:text-gray-300">
            <li>Creative and destination URLs are reviewed before campaign activation.</li>
            <li>Sponsored placements are clearly labeled to preserve learner trust.</li>
            <li>Campaigns violating learner-safety rules are paused and refunded per policy.</li>
            <li>Impression and click analytics are available in advertiser billing cycles.</li>
          </ul>
        </article>

        <article className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-violet-900/50 dark:bg-[#12082e]/90">
          <h2 className="text-base font-bold text-gray-900 dark:text-white">Onboarding Flow</h2>
          <ol className="mt-3 space-y-2 text-sm text-gray-600 dark:text-gray-300">
            <li>1. Select package and share campaign objectives.</li>
            <li>2. Submit creative assets and optional affiliate code mapping.</li>
            <li>3. Complete Stripe checkout and campaign scheduling.</li>
            <li>4. Go live after policy approval and tracking verification.</li>
          </ol>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/register"
              className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
            >
              Start advertiser onboarding
            </Link>
            <Link
              href="/contact"
              className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Talk to partnerships
            </Link>
          </div>
        </article>
      </section>
    </div>
  );
}
