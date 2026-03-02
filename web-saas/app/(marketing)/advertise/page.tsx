'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import { useAuth } from '@/components/auth/AuthProvider';
import { ApiError, webApi } from '@/lib/api/client';

/* ── Static data ── */

const inventory = [
  { name: 'Homepage Sponsor Card', icon: 'home', details: 'High-visibility placement on learner and marketing entry experiences.', audience: 'All traffic' },
  { name: 'Module Side Panel', icon: 'view_sidebar', details: 'Contextual placements beside speaking, writing, reading, and listening workflows.', audience: 'Active learners' },
  { name: 'Blog Sponsored Block', icon: 'article', details: 'Sponsored recommendations inside high-intent IELTS strategy articles.', audience: 'Organic content visitors' },
  { name: 'Newsletter Slot', icon: 'mail', details: 'Sponsored feature in weekly learning and exam strategy roundups.', audience: 'Email subscribers' },
  { name: 'Partner Spotlight', icon: 'star', details: 'Premium spotlight unit for institutes and strategic coaching partners.', audience: 'Conversion-ready users' }
];

const packages = [
  {
    key: 'coach_starter',
    name: 'Coach Starter',
    price: 149,
    period: 'month',
    who: 'Solo coaches and small tutoring teams',
    includes: ['Module side panel placement', 'Basic analytics report', 'Affiliate code support'],
    popular: false
  },
  {
    key: 'institute_growth',
    name: 'Institute Growth',
    price: 499,
    period: 'month',
    who: 'Training centers and mid-size institutes',
    includes: ['Homepage sponsor card', 'Blog sponsored block', 'Campaign performance export'],
    popular: true
  },
  {
    key: 'premium_spotlight',
    name: 'Premium Spotlight',
    price: 999,
    period: 'month',
    who: 'Large providers with growth targets',
    includes: ['Partner spotlight', 'Newsletter slot', 'Priority campaign approvals'],
    popular: false
  },
  {
    key: 'enterprise_custom',
    name: 'Enterprise Custom',
    price: null,
    period: null,
    who: 'Multi-region institutions and enterprise partners',
    includes: ['Custom placements', 'Quarterly planning', 'Dedicated operations support'],
    popular: false
  }
];

/* ── Comparison table data ── */

const comparisonFeatures = [
  { label: 'Module side panel', starter: true, growth: false, spotlight: false, enterprise: true },
  { label: 'Homepage sponsor card', starter: false, growth: true, spotlight: false, enterprise: true },
  { label: 'Blog sponsored block', starter: false, growth: true, spotlight: false, enterprise: true },
  { label: 'Newsletter slot', starter: false, growth: false, spotlight: true, enterprise: true },
  { label: 'Partner spotlight', starter: false, growth: false, spotlight: true, enterprise: true },
  { label: 'Basic analytics report', starter: true, growth: true, spotlight: true, enterprise: true },
  { label: 'Campaign performance export', starter: false, growth: true, spotlight: true, enterprise: true },
  { label: 'Affiliate code support', starter: true, growth: true, spotlight: true, enterprise: true },
  { label: 'Priority campaign approvals', starter: false, growth: false, spotlight: true, enterprise: true },
  { label: 'Quarterly planning', starter: false, growth: false, spotlight: false, enterprise: true },
  { label: 'Dedicated operations support', starter: false, growth: false, spotlight: false, enterprise: true },
  { label: 'Custom placements', starter: false, growth: false, spotlight: false, enterprise: true }
];

const faqs = [
  { q: 'How does billing work?', a: 'We support monthly, quarterly, and annual billing cycles via Stripe. Your subscription auto-renews and you can manage billing, download invoices, or cancel anytime from your advertiser dashboard.' },
  { q: 'What are the creative requirements?', a: 'Submit a headline (max 80 characters), a CTA URL, and an optional description. Our team reviews all creative within 1-2 business days before activation.' },
  { q: 'How long does campaign approval take?', a: 'Most campaigns are reviewed and approved within 1-2 business days. Priority approvals are available on Premium Spotlight and Enterprise plans.' },
  { q: 'What reporting is available?', a: 'All advertisers get access to impression, click, and conversion metrics in the advertiser dashboard. Institute Growth and above also get exportable performance reports.' },
  { q: 'Can I pause or cancel a campaign?', a: 'Active campaigns can be paused or cancelled from your advertiser dashboard at any time. Refunds follow our published advertising policy.' },
  { q: 'How does affiliate code tracking work?', a: 'Each advertiser account can be linked to an affiliate code. Conversions driven by your campaigns are tracked and attributed, giving you visibility into ROI.' }
];

const steps = [
  { step: '1', title: 'Select a package', detail: 'Choose the sponsorship tier that fits your goals and audience.' },
  { step: '2', title: 'Submit creative', detail: 'Provide your campaign headline, CTA, and optional assets.' },
  { step: '3', title: 'Checkout via Stripe', detail: 'Complete secure payment and set your campaign schedule.' },
  { step: '4', title: 'Go live', detail: 'Campaign activates after policy review and tracking verification.' }
];

/* ── Animated counter hook ── */

function useCountUp(end: number, suffix: string, duration = 1600) {
  const [display, setDisplay] = useState(`0${suffix}`);
  const ref = useRef<HTMLDivElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;
          const start = performance.now();
          const step = (now: number) => {
            const progress = Math.min((now - start) / duration, 1);
            // Ease-out cubic
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = Math.round(eased * end);
            setDisplay(`${current.toLocaleString()}${suffix}`);
            if (progress < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [end, suffix, duration]);

  return { ref, display };
}

/* ── Stat card with animation ── */

function AnimatedStat({ end, suffix, label, icon }: { end: number; suffix: string; label: string; icon: string }) {
  const { ref, display } = useCountUp(end, suffix);
  return (
    <div ref={ref} className="flex items-center gap-3 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-500/20">
        <span className="material-symbols-outlined text-violet-600 dark:text-violet-400 text-[20px]">{icon}</span>
      </div>
      <div>
        <p className="text-xl font-extrabold text-gray-900 dark:text-white tabular-nums">{display}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      </div>
    </div>
  );
}

/* ── Inner component (needs useSearchParams) ── */

function AdvertisePageInner() {
  const searchParams = useSearchParams();
  const { isAuthenticated, refreshAppConfig } = useAuth();

  const checkoutState = searchParams.get('checkout');
  const autoCheckoutPkg = searchParams.get('package');
  const autoCheckout = searchParams.get('autoCheckout') === 'true';

  const [loadingPackage, setLoadingPackage] = useState<string | null>(null);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [packageView, setPackageView] = useState<'cards' | 'compare'>('cards');

  // Handle checkout return
  useEffect(() => {
    if (!checkoutState) return;
    if (checkoutState === 'success') {
      setSuccess('success');
      void refreshAppConfig();
    }
    if (checkoutState === 'cancel') {
      setError('Checkout was cancelled. No billing changes were applied. You can try again anytime.');
    }
  }, [checkoutState, refreshAppConfig]);

  // Handle auto-checkout after registration redirect
  useEffect(() => {
    if (autoCheckout && autoCheckoutPkg && isAuthenticated && !checkoutState) {
      void startCheckout(autoCheckoutPkg);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoCheckout, autoCheckoutPkg, isAuthenticated]);

  const startCheckout = async (packageKey: string) => {
    setLoadingPackage(packageKey);
    setError('');
    try {
      const origin = window.location.origin;
      const session = await webApi.createAdvertiserCheckoutSession({
        packageId: packageKey,
        successUrl: `${origin}/advertise?checkout=success`,
        cancelUrl: `${origin}/advertise?checkout=cancel`
      });
      if (session.checkoutUrl) {
        window.location.href = session.checkoutUrl;
      }
    } catch (err: unknown) {
      const message = err instanceof ApiError ? err.message : 'Unable to start checkout. Please try again.';
      setError(message);
      setLoadingPackage(null);
    }
  };

  const handlePackageSelect = (pkg: typeof packages[0]) => {
    if (pkg.key === 'enterprise_custom') return; // Enterprise uses contact form
    if (!isAuthenticated) {
      window.location.href = `/register?next=${encodeURIComponent(`/advertise?package=${pkg.key}&autoCheckout=true`)}`;
      return;
    }
    void startCheckout(pkg.key);
  };

  return (
    <div className="space-y-12 lg:space-y-16" data-testid="marketing-advertise-page">
      {/* ── Checkout Success Onboarding ── */}
      {success === 'success' ? (
        <div className="rounded-2xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/80 dark:bg-emerald-500/10 p-6 lg:p-8">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-500/20">
              <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400 text-[28px]">celebration</span>
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-extrabold text-emerald-900 dark:text-emerald-200">Welcome aboard! Your advertiser account is active.</h2>
              <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-400">Complete these steps to launch your first campaign:</p>
            </div>
          </div>
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl border border-emerald-200 dark:border-emerald-500/20 bg-white dark:bg-gray-900 p-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-white text-xs font-bold mb-2">1</div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Create a campaign</h3>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Add your headline, CTA URL, and optional assets.</p>
            </div>
            <div className="rounded-xl border border-emerald-200 dark:border-emerald-500/20 bg-white dark:bg-gray-900 p-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-white text-xs font-bold mb-2">2</div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Submit for review</h3>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Our team reviews creative within 1-2 business days.</p>
            </div>
            <div className="rounded-xl border border-emerald-200 dark:border-emerald-500/20 bg-white dark:bg-gray-900 p-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-white text-xs font-bold mb-2">3</div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Go live</h3>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Approved campaigns activate and start earning impressions.</p>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/app/advertiser?tab=new_campaign"
              className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 transition-colors shadow-lg shadow-violet-500/25"
            >
              Create your first campaign
            </Link>
            <Link
              href="/app/advertiser"
              className="rounded-xl border border-violet-200 dark:border-violet-500/30 px-5 py-2.5 text-sm font-semibold text-violet-700 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-500/10 transition-colors"
            >
              Open dashboard
            </Link>
          </div>
        </div>
      ) : null}

      {/* ── Error Banner ── */}
      {error ? (
        <div className="rounded-2xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 px-6 py-4 text-sm text-red-700 dark:text-red-400">
          <span className="material-symbols-outlined text-[18px] align-text-bottom mr-2">error</span>
          {error}
        </div>
      ) : null}

      {/* ── Hero ── */}
      <section className="marketing-hero-surface relative overflow-hidden rounded-[2rem] p-10 text-white lg:p-16">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMSIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA4KSIvPjwvc3ZnPg==')] opacity-60" />
        <div className="absolute top-0 right-0 w-[350px] h-[350px] bg-violet-300/25 rounded-full blur-[110px]" />
        <div className="absolute bottom-0 left-0 w-[320px] h-[320px] bg-violet-300/20 rounded-full blur-[100px]" />
        <div className="relative z-10 max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/15 backdrop-blur-sm px-4 py-1.5 text-xs font-semibold uppercase tracking-wider mb-5">
            <span className="material-symbols-outlined text-[14px]">campaign</span>
            Sponsorship + Affiliate
          </span>
          <h1 className="hero-elegant-title text-4xl font-extrabold leading-[1.1] tracking-tight lg:text-5xl">Advertise with Spokio</h1>
          <p className="hero-elegant-copy mt-4 max-w-2xl text-lg leading-relaxed text-white/80">
            Reach IELTS learners with policy-reviewed placements, measurable delivery, and attribution aligned with our
            affiliate engine. We support monthly, quarterly, and annual sponsorship programs.
          </p>
          <div className="mt-6 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-white/15 backdrop-blur-sm px-3 py-1.5 font-semibold">110K+ monthly page views</span>
            <span className="rounded-full bg-white/15 backdrop-blur-sm px-3 py-1.5 font-semibold">38K+ active learners</span>
            <span className="rounded-full bg-white/15 backdrop-blur-sm px-3 py-1.5 font-semibold">4 core IELTS modules</span>
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#packages" className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-violet-700 hover:bg-white/90 transition-colors shadow-lg shadow-black/10">
              View packages
            </a>
            <Link href="/contact" className="rounded-xl border border-white/30 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10 transition-colors">
              Talk to partnerships
            </Link>
          </div>
        </div>
      </section>

      {/* ── Animated Social Proof Strip ── */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <AnimatedStat end={110} suffix="K+" label="Monthly page views" icon="visibility" />
        <AnimatedStat end={38} suffix="K+" label="Active learners" icon="school" />
        <AnimatedStat end={4} suffix="" label="IELTS modules" icon="category" />
        <AnimatedStat end={50} suffix="+" label="Advertiser partners" icon="handshake" />
      </section>

      {/* ── Placement Inventory ── */}
      <section>
        <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white mb-6">Where your ads appear</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {inventory.map(item => (
            <div key={item.name} className="group rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 hover:border-violet-300 dark:hover:border-violet-500/40 hover:shadow-md transition-all duration-300">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-500/20 group-hover:bg-violet-200 dark:group-hover:bg-violet-500/30 transition-colors">
                  <span className="material-symbols-outlined text-violet-600 dark:text-violet-400 text-[18px]">{item.icon}</span>
                </div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">{item.name}</h3>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{item.details}</p>
              <p className="mt-2 text-xs font-semibold text-violet-600 dark:text-violet-400">Audience: {item.audience}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Placement Preview Mockups ── */}
      <section>
        <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white mb-2">See it in action</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Visual preview of how sponsored placements integrate seamlessly into the learner experience.</p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Homepage Sponsor Card preview */}
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 p-5 space-y-3">
            <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Homepage Sponsor Card</p>
            <div className="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-gray-200 dark:bg-gray-700" />
                <div className="h-3 w-24 rounded bg-gray-200 dark:bg-gray-700" />
              </div>
              <div className="h-3 w-full rounded bg-gray-100 dark:bg-gray-800" />
              <div className="h-3 w-3/4 rounded bg-gray-100 dark:bg-gray-800" />
            </div>
            <div className="rounded-xl border-2 border-dashed border-violet-300 dark:border-violet-500/50 bg-violet-50 dark:bg-violet-500/10 p-4 text-center">
              <span className="material-symbols-outlined text-violet-500 text-[24px]">campaign</span>
              <p className="text-xs font-bold text-violet-600 dark:text-violet-400 mt-1">Your Sponsor Card</p>
              <p className="text-[10px] text-violet-500 dark:text-violet-400/70">Sponsored</p>
            </div>
            <div className="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 space-y-2">
              <div className="h-3 w-full rounded bg-gray-100 dark:bg-gray-800" />
              <div className="h-3 w-2/3 rounded bg-gray-100 dark:bg-gray-800" />
            </div>
          </div>

          {/* Module Side Panel preview */}
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 p-5 space-y-3">
            <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Module Side Panel</p>
            <div className="flex gap-3">
              <div className="flex-1 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 space-y-2">
                <div className="h-3 w-20 rounded bg-gray-200 dark:bg-gray-700" />
                <div className="h-16 w-full rounded bg-gray-100 dark:bg-gray-800" />
                <div className="h-3 w-full rounded bg-gray-100 dark:bg-gray-800" />
                <div className="h-3 w-1/2 rounded bg-gray-100 dark:bg-gray-800" />
              </div>
              <div className="w-36 shrink-0 rounded-xl border-2 border-dashed border-violet-300 dark:border-violet-500/50 bg-violet-50 dark:bg-violet-500/10 p-3 flex flex-col items-center justify-center text-center">
                <span className="material-symbols-outlined text-violet-500 text-[24px]">ad_units</span>
                <p className="text-xs font-bold text-violet-600 dark:text-violet-400 mt-1">Your Ad</p>
                <p className="text-[10px] text-violet-500 dark:text-violet-400/70 mt-0.5">Side panel placement</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Package Selection ── */}
      <section id="packages">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div>
            <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white">Choose your package</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">All packages include campaign analytics, creative review, and learner-safety compliance.</p>
          </div>
          <div className="flex rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-1 shrink-0 self-start">
            <button
              type="button"
              onClick={() => setPackageView('cards')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                packageView === 'cards'
                  ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <span className="material-symbols-outlined text-[14px]">grid_view</span>
              Cards
            </button>
            <button
              type="button"
              onClick={() => setPackageView('compare')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                packageView === 'compare'
                  ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <span className="material-symbols-outlined text-[14px]">table_chart</span>
              Compare
            </button>
          </div>
        </div>

        {/* Card view */}
        {packageView === 'cards' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {packages.map(pkg => (
              <div
                key={pkg.key}
                className={`relative flex flex-col rounded-2xl border p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${
                  pkg.popular
                    ? 'border-violet-400 dark:border-violet-500 bg-white dark:bg-gray-900 shadow-md shadow-violet-500/10'
                    : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900'
                }`}
              >
                {pkg.popular ? (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-violet-600 px-3 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider shadow-lg shadow-violet-500/25">
                    Most Popular
                  </span>
                ) : null}
                <h3 className="text-base font-bold text-gray-900 dark:text-white">{pkg.name}</h3>
                <div className="mt-2">
                  {pkg.price !== null ? (
                    <>
                      <span className="text-3xl font-extrabold text-gray-900 dark:text-white">${pkg.price}</span>
                      <span className="text-sm text-gray-500 dark:text-gray-400"> / {pkg.period}</span>
                    </>
                  ) : (
                    <span className="text-2xl font-extrabold text-gray-900 dark:text-white">Custom</span>
                  )}
                </div>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{pkg.who}</p>
                <ul className="mt-4 space-y-2 flex-1">
                  {pkg.includes.map(line => (
                    <li key={line} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                      <span className="material-symbols-outlined text-emerald-500 text-[16px] mt-0.5 shrink-0">check_circle</span>
                      {line}
                    </li>
                  ))}
                </ul>
                <div className="mt-5">
                  {pkg.key === 'enterprise_custom' ? (
                    <Link
                      href="/contact"
                      className="block w-full rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-2.5 text-center text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      Contact us
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handlePackageSelect(pkg)}
                      disabled={loadingPackage === pkg.key}
                      className={`block w-full rounded-xl px-4 py-2.5 text-center text-sm font-semibold transition-colors disabled:opacity-50 ${
                        pkg.popular
                          ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/25 hover:bg-violet-700'
                          : 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100'
                      }`}
                    >
                      {loadingPackage === pkg.key ? 'Starting checkout...' : 'Select package'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {/* Comparison table view */}
        {packageView === 'compare' ? (
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/30">
                    <th className="px-5 py-4 text-left font-semibold text-gray-900 dark:text-white min-w-[180px]">Feature</th>
                    <th className="px-4 py-4 text-center font-semibold text-gray-900 dark:text-white">
                      <div>Coach Starter</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-0.5">$149/mo</div>
                    </th>
                    <th className="px-4 py-4 text-center font-semibold text-violet-700 dark:text-violet-400">
                      <div className="flex items-center justify-center gap-1">Institute Growth <span className="material-symbols-outlined text-[14px]">star</span></div>
                      <div className="text-xs text-violet-500 dark:text-violet-400/80 font-medium mt-0.5">$499/mo</div>
                    </th>
                    <th className="px-4 py-4 text-center font-semibold text-gray-900 dark:text-white">
                      <div>Premium Spotlight</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-0.5">$999/mo</div>
                    </th>
                    <th className="px-4 py-4 text-center font-semibold text-gray-900 dark:text-white">
                      <div>Enterprise</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-0.5">Custom</div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {comparisonFeatures.map(feature => (
                    <tr key={feature.label} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                      <td className="px-5 py-3 text-gray-700 dark:text-gray-300">{feature.label}</td>
                      {([feature.starter, feature.growth, feature.spotlight, feature.enterprise] as boolean[]).map((has, i) => (
                        <td key={i} className="px-4 py-3 text-center">
                          {has ? (
                            <span className="material-symbols-outlined text-emerald-500 text-[18px]">check_circle</span>
                          ) : (
                            <span className="material-symbols-outlined text-gray-300 dark:text-gray-600 text-[18px]">remove</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/30">
                    <td className="px-5 py-4" />
                    {packages.map(pkg => (
                      <td key={pkg.key} className="px-4 py-4 text-center">
                        {pkg.key === 'enterprise_custom' ? (
                          <Link
                            href="/contact"
                            className="inline-block rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-800 transition-colors"
                          >
                            Contact us
                          </Link>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handlePackageSelect(pkg)}
                            disabled={loadingPackage === pkg.key}
                            className={`inline-block rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
                              pkg.popular
                                ? 'bg-violet-600 text-white hover:bg-violet-700'
                                : 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100'
                            }`}
                          >
                            {loadingPackage === pkg.key ? 'Starting...' : 'Select'}
                          </button>
                        )}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        ) : null}
      </section>

      {/* ── How It Works ── */}
      <section>
        <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white mb-6">How it works</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {steps.map(s => (
            <div key={s.step} className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-600 text-white text-sm font-bold mb-3">{s.step}</div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">{s.title}</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{s.detail}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Policy & Approval ── */}
      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="text-base font-bold text-gray-900 dark:text-white mb-3">Policy and Approval</h2>
          <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
            <li className="flex items-start gap-2"><span className="material-symbols-outlined text-violet-500 text-[16px] mt-0.5 shrink-0">verified</span> Creative and destination URLs are reviewed before campaign activation.</li>
            <li className="flex items-start gap-2"><span className="material-symbols-outlined text-violet-500 text-[16px] mt-0.5 shrink-0">visibility</span> Sponsored placements are clearly labeled to preserve learner trust.</li>
            <li className="flex items-start gap-2"><span className="material-symbols-outlined text-violet-500 text-[16px] mt-0.5 shrink-0">shield</span> Campaigns violating learner-safety rules are paused and refunded per policy.</li>
            <li className="flex items-start gap-2"><span className="material-symbols-outlined text-violet-500 text-[16px] mt-0.5 shrink-0">bar_chart</span> Impression and click analytics are available in advertiser billing cycles.</li>
          </ul>
        </article>

        {/* ── Returning advertiser CTA ── */}
        <article className="rounded-2xl border border-violet-200 dark:border-violet-500/30 bg-violet-50 dark:bg-violet-500/10 p-5 flex flex-col justify-center">
          <h2 className="text-base font-bold text-violet-900 dark:text-violet-200 mb-2">Already an advertiser?</h2>
          <p className="text-sm text-violet-700 dark:text-violet-300 mb-4">
            Manage your campaigns, view analytics, and handle billing from your advertiser dashboard.
          </p>
          <Link
            href="/app/advertiser"
            className="inline-flex self-start rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 transition-colors shadow-lg shadow-violet-500/25"
          >
            Open advertiser dashboard
          </Link>
        </article>
      </section>

      {/* ── FAQ ── */}
      <section>
        <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white mb-6">Frequently asked questions</h2>
        <div className="space-y-2">
          {faqs.map((faq, i) => (
            <div key={i} className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="flex w-full items-center justify-between px-5 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              >
                {faq.q}
                <span className={`material-symbols-outlined text-[20px] text-gray-400 transition-transform duration-200 ${openFaq === i ? 'rotate-180' : ''}`}>expand_more</span>
              </button>
              {openFaq === i ? (
                <div className="px-5 pb-4 text-sm text-gray-600 dark:text-gray-400 leading-relaxed border-t border-gray-100 dark:border-gray-800 pt-3">
                  {faq.a}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="rounded-[2rem] bg-gradient-to-r from-violet-700 to-violet-600 p-10 lg:p-14 text-center text-white">
        <h2 className="text-3xl font-extrabold">Ready to reach IELTS learners?</h2>
        <p className="mt-3 text-lg text-white/80 max-w-xl mx-auto">Start advertising on Spokio today. Select a package, submit your creative, and go live within days.</p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <a href="#packages" className="rounded-xl bg-white px-6 py-3 text-sm font-semibold text-violet-700 hover:bg-white/90 transition-colors shadow-lg shadow-black/10">
            Get started
          </a>
          <Link href="/contact" className="rounded-xl border border-white/30 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors">
            Talk to partnerships
          </Link>
        </div>
      </section>
    </div>
  );
}

/* ── Suspense wrapper (required for useSearchParams) ── */

export default function AdvertisePage() {
  return (
    <Suspense fallback={<div className="animate-pulse space-y-6"><div className="h-64 rounded-[2rem] bg-gray-200 dark:bg-gray-800" /><div className="h-32 rounded-2xl bg-gray-100 dark:bg-gray-800" /></div>}>
      <AdvertisePageInner />
    </Suspense>
  );
}
