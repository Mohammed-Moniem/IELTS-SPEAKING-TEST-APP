'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { ApiError, apiRequest, webApi } from '@/lib/api/client';
import type { AdminPayoutOperationsRow, AdminPayoutOperationsView, PayoutBatchDetail, PayoutBatchPreview } from '@/lib/types';

type StatusFilter = 'all' | 'pending' | 'processing' | 'paid';
type SortFilter = 'amount_desc' | 'amount_asc' | 'name_asc' | 'name_desc';

const money = (value: number) =>
  new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2
  }).format(value);

const toInputDate = (date: Date) => date.toISOString().slice(0, 10);

const nextMonthDate = () => {
  const next = new Date();
  next.setDate(next.getDate() + 30);
  return toInputDate(next);
};

const statusPillClass = (status: string) => {
  if (status === 'paid') return 'inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400';
  if (status === 'processing') return 'inline-flex items-center gap-1.5 rounded-full bg-blue-50 dark:bg-blue-500/10 px-2.5 py-0.5 text-xs font-semibold text-blue-700 dark:text-blue-400';
  return 'inline-flex items-center gap-1.5 rounded-full bg-amber-50 dark:bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400';
};

const statusLabel = (status: string) => status.replace('_', ' ').replace(/\b\w/g, char => char.toUpperCase());

const getInitials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('') || 'PA';

const paymentIcon = (paymentMethod: string) => {
  const method = paymentMethod.toLowerCase();
  if (method.includes('bank')) return 'account_balance';
  if (method.includes('stripe') || method.includes('card')) return 'credit_card';
  if (method.includes('paypal')) return 'payments';
  return 'account_balance_wallet';
};

const obfuscate = (value?: string) => {
  if (!value) return '';
  const [local, domain] = value.split('@');
  if (!domain) return value;
  const safeLocal = local.length <= 2 ? `${local[0] || '*'}*` : `${local.slice(0, 2)}***`;
  return `${safeLocal}@${domain}`;
};

export default function AdminPartnersPage() {
  const [status, setStatus] = useState<StatusFilter>('all');
  const [sort, setSort] = useState<SortFilter>('amount_desc');
  const [view, setView] = useState<AdminPayoutOperationsView | null>(null);
  const [selectedPartnerIds, setSelectedPartnerIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showBatchNote, setShowBatchNote] = useState(true);

  const [periodStart, setPeriodStart] = useState(toInputDate(new Date()));
  const [periodEnd, setPeriodEnd] = useState(nextMonthDate());
  const [preview, setPreview] = useState<PayoutBatchPreview | null>(null);
  const [batchDetail, setBatchDetail] = useState<PayoutBatchDetail | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const selectedRows = useMemo(() => {
    if (!view) return [];
    return view.rows.filter(row => selectedPartnerIds.includes(row.partnerId));
  }, [selectedPartnerIds, view]);

  const modalPreview = useMemo(() => {
    if (batchDetail) {
      return {
        partnerCount: batchDetail.batch.partnerCount,
        totals: batchDetail.batch.totals,
        preflight: batchDetail.preflight
      };
    }
    return preview;
  }, [batchDetail, preview]);

  const topEarner = useMemo(() => {
    if (!selectedRows.length) return null;
    return [...selectedRows].sort((a, b) => b.calculatedPayoutUsd - a.calculatedPayoutUsd)[0];
  }, [selectedRows]);

  const topReferral = useMemo(() => {
    if (!selectedRows.length) return null;
    return [...selectedRows].sort((a, b) => b.conversionCount - a.conversionCount)[0];
  }, [selectedRows]);

  const avgCommission = useMemo(() => {
    if (!selectedRows.length) return 0;
    return selectedRows.reduce((sum, row) => sum + row.commissionRatePercent, 0) / selectedRows.length;
  }, [selectedRows]);

  const loadView = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const payload = await webApi.getAdminPayoutOperationsView({
        status,
        sort,
        limit: 50,
        offset: 0
      });
      setView(payload);
      setSelectedPartnerIds(payload.rows.filter(row => row.status !== 'paid').map(row => row.partnerId));
    } catch (err: unknown) {
      const message = err instanceof ApiError ? err.message : 'Failed to load payout operations';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [sort, status]);

  useEffect(() => {
    void loadView();
  }, [loadView]);

  const onPreview = async () => {
    if (!selectedRows.length) {
      setError('Select at least one payout row to process.');
      return;
    }
    setPreviewLoading(true);
    setError('');
    setSuccess('');
    try {
      const payload = await webApi.previewPayoutBatch({
        periodStart,
        periodEnd,
        partnerIds: selectedRows.map(row => row.partnerId)
      });
      setPreview(payload);
      setBatchDetail(null);
      setConfirmChecked(false);
      setShowModal(true);
    } catch (err: unknown) {
      const message = err instanceof ApiError ? err.message : 'Failed to preview payout batch';
      setError(message);
    } finally {
      setPreviewLoading(false);
    }
  };

  const onConfirm = async () => {
    if (!modalPreview || !confirmChecked) return;
    setConfirming(true);
    setError('');
    setSuccess('');

    try {
      const created = await apiRequest<{ batch: { _id: string } }>('/admin/partners/payout-batches', {
        method: 'POST',
        body: JSON.stringify({
          periodStart,
          periodEnd,
          partnerIds: selectedRows.map(row => row.partnerId)
        })
      });
      const detail = await webApi.getPayoutBatchDetail(created.batch._id);
      setBatchDetail(detail);
      setSuccess('Payout batch created successfully.');
      await loadView();
    } catch (err: unknown) {
      const message = err instanceof ApiError ? err.message : 'Failed to create payout batch';
      setError(message);
    } finally {
      setConfirming(false);
    }
  };

  const openBatchDetail = async (batchId: string) => {
    setError('');
    try {
      const detail = await webApi.getPayoutBatchDetail(batchId);
      setBatchDetail(detail);
      setShowModal(true);
    } catch (err: unknown) {
      const message = err instanceof ApiError ? err.message : 'Failed to load payout batch detail';
      setError(message);
    }
  };

  const togglePartner = (partnerId: string, checked: boolean) => {
    setSelectedPartnerIds(prev => {
      if (checked) return Array.from(new Set([...prev, partnerId]));
      return prev.filter(item => item !== partnerId);
    });
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Admin / Partners / Payout Operations</p>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Partner Payout Operations</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Manage commission approvals and process bulk payout batches for the current billing cycle.</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <button className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-5 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors" type="button">
            Export Report
          </button>
          <button className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/25" type="button" onClick={() => void onPreview()} disabled={previewLoading || loading}>
            {previewLoading ? 'Preparing…' : `Process Batch${selectedRows.length ? ` (${selectedRows.length})` : ''}`}
          </button>
        </div>
      </header>

      {view ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <article className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-2">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Pending Payouts</p>
              <p className="text-2xl font-extrabold text-gray-900 dark:text-white">{money(view.summary.pendingPayoutUsd)}</p>
              <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">+{view.summary.pendingChangePercent.toFixed(1)}%</p>
              <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                <span
                  className="block h-full rounded-full bg-indigo-500 transition-all"
                  style={{
                    width: `${Math.round(
                      (view.rows.filter(row => row.status === 'pending').length / Math.max(1, view.rows.length)) * 100
                    )}%`
                  }}
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {Math.round((view.rows.filter(row => row.status === 'pending').length / Math.max(1, view.rows.length)) * 100)}% of
                rows are pending
              </p>
            </article>
            <article className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-2">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Next Batch Date</p>
              <p className="text-2xl font-extrabold text-gray-900 dark:text-white">
                {new Date(view.summary.nextBatchDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{view.summary.nextBatchCountdownDays} days remaining</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Automated cutoff at 11:59 PM EST</p>
            </article>
            <article className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-2">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Paid (LTM)</p>
              <p className="text-2xl font-extrabold text-gray-900 dark:text-white">{money(view.summary.totalPaidLtmUsd)}</p>
              <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">+{view.summary.totalPaidChangePercent.toFixed(1)}%</p>
              <div className="flex -space-x-2" aria-hidden>
                {view.rows.slice(0, 3).map(row => (
                  <span key={row.partnerId} title={row.partnerName} className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-500/20 text-xs font-bold text-indigo-700 dark:text-indigo-300 ring-2 ring-white dark:ring-gray-900">
                    {getInitials(row.partnerName)}
                  </span>
                ))}
              </div>
            </article>
            <article className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-2">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Rows in Scope</p>
              <p className="text-2xl font-extrabold text-gray-900 dark:text-white">{view.total}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Active payout operations</p>
            </article>
          </div>

          <article className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <h2 className="text-base font-bold text-gray-900 dark:text-white">Pending Commissions</h2>
                <span className="inline-block rounded-full bg-indigo-50 dark:bg-indigo-500/10 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 dark:text-indigo-400">{view.total}</span>
              </div>
              <div className="flex items-center gap-3">
                <select className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40" value={status} onChange={event => setStatus(event.target.value as StatusFilter)}>
                  <option value="all">Status: All</option>
                  <option value="pending">Status: Pending</option>
                  <option value="processing">Status: Processing</option>
                  <option value="paid">Status: Paid</option>
                </select>
                <select className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40" value={sort} onChange={event => setSort(event.target.value as SortFilter)}>
                  <option value="amount_desc">Sort by: Amount ↓</option>
                  <option value="amount_asc">Sort by: Amount ↑</option>
                  <option value="name_asc">Sort by: Name A-Z</option>
                  <option value="name_desc">Sort by: Name Z-A</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    <th className="px-5 py-3">Partner Name</th>
                    <th className="px-5 py-3 text-right">Attributed Revenue</th>
                    <th className="px-5 py-3 text-center">Commission Rate</th>
                    <th className="px-5 py-3 text-right">Calculated Payout</th>
                    <th className="px-5 py-3">Payment Method</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {view.rows.map((row: AdminPayoutOperationsRow) => {
                    const checked = selectedPartnerIds.includes(row.partnerId);
                    return (
                      <tr key={row.partnerId} className={`transition-colors ${checked ? 'bg-indigo-50/50 dark:bg-indigo-500/5' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'}`}>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <span className={`inline-flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold ${row.partnerType === 'institute' ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300' : 'bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300'}`}>
                              {getInitials(row.partnerName)}
                            </span>
                            <div>
                              <p className="font-semibold text-gray-900 dark:text-white">{row.partnerName}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">ID: #{row.partnerId}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-right text-gray-700 dark:text-gray-300">{money(row.attributedRevenueUsd)}</td>
                        <td className="px-5 py-3 text-center">
                          <span className="inline-block rounded-full bg-gray-100 dark:bg-gray-800 px-2.5 py-0.5 text-xs font-semibold text-gray-700 dark:text-gray-300">{row.commissionRatePercent}%</span>
                        </td>
                        <td className="px-5 py-3 text-right font-bold text-gray-900 dark:text-white">{money(row.calculatedPayoutUsd)}</td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-gray-400 text-base" aria-hidden>
                              {paymentIcon(row.paymentMethod)}
                            </span>
                            <div>
                              <p className="text-sm text-gray-700 dark:text-gray-300">{row.paymentMethod}</p>
                              {row.contactEmail ? <p className="text-xs text-gray-500 dark:text-gray-400">{obfuscate(row.contactEmail)}</p> : null}
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <span className={statusPillClass(row.status)}>
                            <span className={`inline-block h-1.5 w-1.5 rounded-full ${row.status === 'paid' ? 'bg-emerald-500' : row.status === 'processing' ? 'bg-blue-500' : 'bg-amber-500'}`} />
                            {statusLabel(row.status)}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <button
                            className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${checked ? 'border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                            aria-label={`${checked ? 'Exclude' : 'Include'} ${row.partnerName}`}
                            type="button"
                            onClick={() => togglePartner(row.partnerId, !checked)}
                          >
                            {checked ? 'Included' : 'Include'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <footer className="px-5 py-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Showing 1 to {Math.min(view.rows.length, view.total)} of {view.total} results
              </p>
              <div className="flex items-center gap-2">
                <button className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5 text-xs font-semibold text-gray-400 dark:text-gray-600" type="button" disabled>
                  Previous
                </button>
                <button className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5 text-xs font-semibold text-gray-400 dark:text-gray-600" type="button" disabled>
                  Next
                </button>
              </div>
            </footer>
          </article>

          {showBatchNote ? (
            <article className="rounded-2xl border border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 px-5 py-4 flex items-start gap-3">
              <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 text-xl mt-0.5" aria-hidden>
                info
              </span>
              <p className="flex-1 text-sm text-blue-800 dark:text-blue-300">
                <strong>Batch Processing Note</strong> Payouts processed after 5:00 PM EST will be deposited the next business day.
                Ensure all bank details are verified before processing the batch.
              </p>
              <button className="text-sm font-semibold text-blue-700 dark:text-blue-400 hover:underline shrink-0" type="button" onClick={() => setShowBatchNote(false)}>
                Dismiss
              </button>
            </article>
          ) : null}
        </>
      ) : null}

      {showModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" role="dialog" aria-modal="true" aria-label="Payout confirmation">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 space-y-5 shadow-2xl">
            <header className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-indigo-600 dark:text-indigo-400 text-2xl" aria-hidden>
                  payments
                </span>
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">{batchDetail ? `Confirm Payout Batch #${batchDetail.batch._id}` : 'Confirm Payout Batch'}</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {batchDetail
                      ? `Created on ${new Date(batchDetail.batch.createdAt).toLocaleString()}`
                      : `Period ${periodStart} to ${periodEnd}`}
                  </p>
                </div>
              </div>
              <button className="rounded-lg p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" aria-label="Close modal" onClick={() => setShowModal(false)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </header>

            {modalPreview ? (
              <div className="grid grid-cols-3 gap-3">
                <article className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 p-4 text-center">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Partners</p>
                  <p className="mt-1 text-2xl font-extrabold text-gray-900 dark:text-white">{modalPreview.partnerCount}</p>
                </article>
                <article className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 p-4 text-center">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Payout</p>
                  <p className="mt-1 text-2xl font-extrabold text-gray-900 dark:text-white">{money(modalPreview.totals.totalUsd)}</p>
                </article>
                <article className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 p-4 text-center">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Processing Fee</p>
                  <p className="mt-1 text-2xl font-extrabold text-gray-900 dark:text-white">{money(modalPreview.preflight.processingFeeUsd)}</p>
                </article>
              </div>
            ) : null}

            {modalPreview?.preflight.flaggedAccounts.length ? (
              <article className="rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
                <p><strong>Action Required: Flagged Accounts Detected</strong></p>
                <p>{modalPreview.preflight.flaggedAccounts.length} partners have been flagged for unusual activity.</p>
              </article>
            ) : null}

            <div className="space-y-3">
              <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white">
                <span className="material-symbols-outlined text-base text-gray-400" aria-hidden>flag</span>
                Flagged Accounts
              </h3>
              <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-800 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      <th className="px-4 py-2.5">Partner Name</th>
                      <th className="px-4 py-2.5">Amount</th>
                      <th className="px-4 py-2.5">Status</th>
                      <th className="px-4 py-2.5">Risk Factor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {(modalPreview?.preflight.flaggedAccounts || []).map(item => (
                      <tr key={item.partnerId}>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-xs font-bold text-gray-500 dark:text-gray-400">{getInitials(item.partnerName)}</span>
                            <span className="text-gray-900 dark:text-white font-semibold">{item.partnerName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300">{money(item.amountUsd)}</td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${item.status === 'blocked' ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'}`}>
                            {statusLabel(item.status)}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400">{item.riskFactors.join(', ') || '--'}</td>
                      </tr>
                    ))}
                    {!modalPreview?.preflight.flaggedAccounts.length ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 text-center">
                          No flagged accounts.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white">
                <span className="material-symbols-outlined text-base text-gray-400" aria-hidden>leaderboard</span>
                Top Payouts Summary
              </h3>
              <div className="grid grid-cols-3 gap-3">
                <article className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 p-3 space-y-1">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Top Earner</p>
                  <p className="text-sm text-gray-900 dark:text-white">{topEarner?.partnerName || '--'}</p>
                  <strong className="text-sm text-indigo-600 dark:text-indigo-400">{topEarner ? money(topEarner.calculatedPayoutUsd) : '--'}</strong>
                </article>
                <article className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 p-3 space-y-1">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Most Referrals</p>
                  <p className="text-sm text-gray-900 dark:text-white">{topReferral?.partnerName || '--'}</p>
                  <strong className="text-sm text-indigo-600 dark:text-indigo-400">{topReferral ? `${topReferral.conversionCount} refs` : '--'}</strong>
                </article>
                <article className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 p-3 space-y-1">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Avg. Commission</p>
                  <p className="text-sm text-gray-900 dark:text-white">Selected rows</p>
                  <strong className="text-sm text-indigo-600 dark:text-indigo-400">{avgCommission ? `${avgCommission.toFixed(1)}%` : '--'}</strong>
                </article>
              </div>
            </div>

            <footer className="space-y-4 pt-2 border-t border-gray-100 dark:border-gray-800">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500/40" checked={confirmChecked} onChange={event => setConfirmChecked(event.target.checked)} />
                <span className="text-sm text-gray-700 dark:text-gray-300">I have verified the commission logic and reviewed all flagged accounts.</span>
              </label>

              <div className="flex items-center justify-end gap-3">
                {batchDetail ? (
                  <button className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-5 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors" type="button" onClick={() => void openBatchDetail(batchDetail.batch._id)}>
                    Refresh Detail
                  </button>
                ) : null}
                <button className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-5 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors" type="button" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/25 disabled:opacity-50" type="button" disabled={!confirmChecked || confirming} onClick={() => void onConfirm()}>
                  {confirming ? 'Processing…' : 'Confirm & Execute Payout'}
                </button>
              </div>
            </footer>
          </div>
        </div>
      ) : null}

      {success ? <div className="rounded-xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">{success}</div> : null}
      {error ? <div className="rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-400">{error}</div> : null}
    </div>
  );
}
