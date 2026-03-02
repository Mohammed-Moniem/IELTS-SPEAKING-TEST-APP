'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { ApiError, webApi } from '@/lib/api/client';
import { PageHeader, SectionCard, MetricCard } from '@/components/ui/v2';
import type { DiscountTier, PointsSummary, PointsTransaction } from '@/lib/types';

const DISCOUNT_TIERS: {
  tier: DiscountTier;
  label: string;
  points: number;
  percentage: number;
  color: string;
  icon: string;
}[] = [
    { tier: '5%', label: 'Bronze Discount', points: 1000, percentage: 5, color: 'from-orange-500 to-orange-600', icon: 'savings' },
    { tier: '10%', label: 'Silver Discount', points: 2500, percentage: 10, color: 'from-gray-400 to-gray-500', icon: 'redeem' },
    { tier: '15%', label: 'Gold Discount', points: 5000, percentage: 15, color: 'from-yellow-500 to-yellow-600', icon: 'workspace_premium' },
    { tier: '20%', label: 'Platinum Discount', points: 7500, percentage: 20, color: 'from-violet-500 to-violet-600', icon: 'diamond' }
  ];

const txTypeIcons: Record<string, { icon: string; color: string }> = {
  practice_completion: { icon: 'fitness_center', color: 'text-emerald-500' },
  practice_improvement: { icon: 'trending_up', color: 'text-emerald-500' },
  practice_streak_bonus: { icon: 'local_fire_department', color: 'text-orange-500' },
  test_completion: { icon: 'quiz', color: 'text-blue-500' },
  test_improvement: { icon: 'trending_up', color: 'text-blue-500' },
  achievement_unlock: { icon: 'emoji_events', color: 'text-yellow-500' },
  achievement_milestone: { icon: 'military_tech', color: 'text-violet-500' },
  profile_completion: { icon: 'person', color: 'text-cyan-500' },
  referral_reward: { icon: 'group_add', color: 'text-pink-500' },
  referral_bonus: { icon: 'card_giftcard', color: 'text-pink-500' },
  friend_added: { icon: 'person_add', color: 'text-indigo-500' },
  group_joined: { icon: 'groups', color: 'text-indigo-500' },
  discount_redemption: { icon: 'redeem', color: 'text-red-500' },
  admin_adjustment: { icon: 'admin_panel_settings', color: 'text-gray-500' },
  other: { icon: 'more_horiz', color: 'text-gray-500' }
};

export default function RewardsPage() {
  const [summary, setSummary] = useState<PointsSummary | null>(null);
  const [transactions, setTransactions] = useState<PointsTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [redeeming, setRedeeming] = useState<DiscountTier | null>(null);
  const [redeemSuccess, setRedeemSuccess] = useState('');

  useEffect(() => {
    void fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    setError('');
    try {
      const [s, t] = await Promise.all([
        webApi.getPointsSummary(),
        webApi.getPointsTransactions(30)
      ]);
      setSummary(s);
      setTransactions(t);
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : 'Failed to load rewards data');
    } finally {
      setLoading(false);
    }
  }

  async function handleRedeem(tier: DiscountTier) {
    setRedeeming(tier);
    setRedeemSuccess('');
    setError('');
    try {
      const result = await webApi.redeemPoints(tier);
      setRedeemSuccess(`Coupon code: ${result.couponCode} — ${result.discountPercentage}% off your next billing period!`);
      await fetchData();
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : 'Failed to redeem points');
    } finally {
      setRedeeming(null);
    }
  }

  /* ── Loading skeleton ── */
  if (loading && !summary) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-56 rounded-lg bg-gray-200 dark:bg-gray-800 animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[0, 1, 2].map(i => (
            <div key={i} className="h-32 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="h-44 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ── Header ── */}
      <PageHeader
        title="Points & Rewards"
        subtitle="Earn points by practicing and redeem them for subscription discounts."
      />

      {summary ? (
        <>
          {/* ── Balance overview ── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <MetricCard
              tone="brand"
              label="Available Balance"
              value={summary.balance.toLocaleString()}
              helper="points"
            />
            <MetricCard
              tone="success"
              label="Total Earned"
              value={summary.totalEarned.toLocaleString()}
              helper="lifetime points"
            />
            <MetricCard
              tone="neutral"
              label="Redeemed"
              value={summary.totalRedeemed.toLocaleString()}
              helper="points used"
            />
          </div>

          {/* ── Tier progress ── */}
          {summary.nextTier ? (
            <SectionCard
              title="Next Discount Tier"
              actions={
                <span className="inline-flex items-center gap-1 text-sm font-semibold text-violet-600 dark:text-violet-400">
                  {summary.nextTier.percentage}% off
                </span>
              }
            >
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="w-full h-3 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-violet-500 to-violet-600 transition-all"
                      style={{
                        width: `${Math.min(100, ((summary.balance) / summary.nextTier.pointsRequired) * 100)}%`
                      }}
                    />
                  </div>
                  <div className="flex justify-between mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                    <span>{summary.balance.toLocaleString()} pts</span>
                    <span>{summary.nextTier.pointsRequired.toLocaleString()} pts needed</span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-gray-900 dark:text-white">{summary.nextTier.pointsNeeded.toLocaleString()}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">pts to go</p>
                </div>
              </div>
            </SectionCard>
          ) : null}

          {/* ── Redeem discount cards ── */}
          <SectionCard title="Redeem Discounts">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {DISCOUNT_TIERS.map(dt => {
                const canAfford = summary.balance >= dt.points;
                const isCurrentOrPast = summary.currentTier && summary.currentTier.pointsRequired >= dt.points;
                return (
                  <article
                    key={dt.tier}
                    className={`rounded-2xl border p-5 flex flex-col gap-3 transition-all ${canAfford
                        ? 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm'
                        : 'border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 opacity-60'
                      }`}
                  >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br ${dt.color}`}>
                      <span className="material-symbols-outlined text-[24px] text-white">{dt.icon}</span>
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-gray-900 dark:text-white">{dt.label}</h3>
                      <p className="text-2xl font-extrabold text-gray-900 dark:text-white mt-1">{dt.percentage}% off</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{dt.points.toLocaleString()} points</p>
                    </div>
                    <button
                      onClick={() => handleRedeem(dt.tier)}
                      disabled={!canAfford || !summary.canRedeem || redeeming !== null}
                      className={`mt-auto w-full rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${canAfford && summary.canRedeem
                          ? 'bg-violet-600 text-white hover:bg-violet-700 shadow-lg shadow-violet-500/25'
                          : 'bg-gray-200 dark:bg-gray-800 text-gray-500 dark:text-gray-500 cursor-not-allowed'
                        }`}
                    >
                      {redeeming === dt.tier ? 'Redeeming…' : isCurrentOrPast ? 'Tier Reached' : canAfford ? 'Redeem' : 'Not Enough Points'}
                    </button>
                  </article>
                );
              })}
            </div>
            {!summary.canRedeem && summary.balance >= 1000 ? (
              <p className="mt-4 text-sm text-amber-600 dark:text-amber-400">
                You already have an active discount this billing period. You can redeem again next month.
              </p>
            ) : null}
          </SectionCard>

          {/* ── Success banner ── */}
          {redeemSuccess ? (
            <div className="rounded-xl border border-emerald-200 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/10 px-5 py-4 flex items-start gap-3">
              <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400">check_circle</span>
              <div>
                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">Discount Redeemed!</p>
                <p className="text-sm text-emerald-600 dark:text-emerald-400 mt-0.5">{redeemSuccess}</p>
                <Link href="/app/billing" className="text-sm font-semibold text-violet-600 dark:text-violet-400 hover:underline mt-2 inline-block">
                  Go to Billing →
                </Link>
              </div>
            </div>
          ) : null}

          {/* ── How to earn ── */}
          <SectionCard title="How to Earn Points">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[
                { icon: 'fitness_center', label: 'Complete a Practice', pts: '10 pts' },
                { icon: 'trending_up', label: 'Improve Your Score', pts: '5 pts' },
                { icon: 'local_fire_department', label: 'Streak Bonus', pts: '5 pts/day' },
                { icon: 'quiz', label: 'Complete a Full Test', pts: '25 pts' },
                { icon: 'emoji_events', label: 'Unlock Achievement', pts: '10+ pts' },
                { icon: 'group_add', label: 'Refer a Friend', pts: '150 pts' }
              ].map(item => (
                <div key={item.label} className="flex items-center gap-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 px-4 py-3">
                  <span className="material-symbols-outlined text-[20px] text-violet-500">{item.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{item.label}</p>
                  </div>
                  <span className="text-sm font-bold text-violet-600 dark:text-violet-400 flex-shrink-0">{item.pts}</span>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* ── Transaction history ── */}
          {transactions.length > 0 ? (
            <SectionCard
              title="Recent Transactions"
              subtitle={`Last ${transactions.length} entries`}
              className="p-0 overflow-hidden"
            >
              <div className="divide-y divide-gray-100 dark:divide-gray-800 border-t border-gray-100 dark:border-gray-800 -m-6 sm:-mx-6 sm:-mb-6 mt-0">
                {transactions.map(tx => {
                  const meta = txTypeIcons[tx.type] || txTypeIcons.other;
                  const isPositive = tx.amount > 0;
                  return (
                    <div key={tx._id} className="flex items-center gap-4 px-6 py-4 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-gray-100 dark:bg-gray-800 flex-shrink-0`}>
                        <span className={`material-symbols-outlined text-[20px] ${meta.color}`}>{meta.icon}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{tx.reason}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                          {new Date(tx.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className={`text-base font-bold ${isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                          {isPositive ? '+' : ''}{tx.amount}
                        </p>
                        <p className="text-xs font-medium text-gray-400 dark:text-gray-500 mt-0.5">bal: {tx.balance}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </SectionCard>
          ) : null}
        </>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/10 px-4 py-3 text-sm font-medium text-red-700 dark:text-red-400">
          {error}
        </div>
      ) : null}
    </div>
  );
}
