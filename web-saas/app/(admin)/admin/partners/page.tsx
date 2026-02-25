'use client';

import { useEffect, useMemo, useState } from 'react';

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
  if (status === 'paid') return 'pill st2-status-chip st2-status-chip-paid';
  if (status === 'processing') return 'pill st2-status-chip st2-status-chip-processing';
  return 'pill st2-status-chip st2-status-chip-pending';
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

  const loadView = async () => {
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
  };

  useEffect(() => {
    void loadView();
  }, [status, sort]);

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
    <section className="section-wrap st2-admin-partners-page">
      <header className="st2-page-heading st2-admin-partners-heading">
        <div className="stack">
          <p className="small">Admin / Partners / Payout Operations</p>
          <h1>Partner Payout Operations</h1>
          <p className="subtitle">Manage commission approvals and process bulk payout batches for the current billing cycle.</p>
        </div>
        <div className="cta-row">
          <button className="btn btn-secondary" type="button">
            Export Report
          </button>
          <button className="btn btn-primary" type="button" onClick={() => void onPreview()} disabled={previewLoading || loading}>
            {previewLoading ? 'Preparing…' : `Process Batch${selectedRows.length ? ` (${selectedRows.length})` : ''}`}
          </button>
        </div>
      </header>

      {view ? (
        <>
          <div className="st2-kpi-grid st2-partner-kpi-grid">
            <article className="panel st2-kpi-card st2-partner-kpi">
              <p className="small">Pending Payouts</p>
              <p className="kpi st2-kpi-metric">{money(view.summary.pendingPayoutUsd)}</p>
              <p className="small st2-positive">+{view.summary.pendingChangePercent.toFixed(1)}%</p>
              <div className="st2-kpi-progress" aria-hidden>
                <span
                  style={{
                    width: `${Math.round(
                      (view.rows.filter(row => row.status === 'pending').length / Math.max(1, view.rows.length)) * 100
                    )}%`
                  }}
                />
              </div>
              <p className="small">
                {Math.round((view.rows.filter(row => row.status === 'pending').length / Math.max(1, view.rows.length)) * 100)}% of
                rows are pending
              </p>
            </article>
            <article className="panel st2-kpi-card st2-partner-kpi">
              <p className="small">Next Batch Date</p>
              <p className="kpi st2-kpi-metric">
                {new Date(view.summary.nextBatchDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
              <p className="small">{view.summary.nextBatchCountdownDays} days remaining</p>
              <p className="small">Automated cutoff at 11:59 PM EST</p>
            </article>
            <article className="panel st2-kpi-card st2-partner-kpi">
              <p className="small">Total Paid (LTM)</p>
              <p className="kpi st2-kpi-metric">{money(view.summary.totalPaidLtmUsd)}</p>
              <p className="small st2-positive">+{view.summary.totalPaidChangePercent.toFixed(1)}%</p>
              <div className="st2-avatar-stack" aria-hidden>
                {view.rows.slice(0, 3).map(row => (
                  <span key={row.partnerId} title={row.partnerName}>
                    {getInitials(row.partnerName)}
                  </span>
                ))}
              </div>
            </article>
            <article className="panel st2-kpi-card st2-partner-kpi">
              <p className="small">Rows in Scope</p>
              <p className="kpi st2-kpi-metric">{view.total}</p>
              <p className="small">Active payout operations</p>
            </article>
          </div>

          <article className="panel st2-commissions-panel">
            <div className="st2-section-head">
              <div className="cta-row">
                <h2>Pending Commissions</h2>
                <span className="tag st2-table-count">{view.total}</span>
              </div>
              <div className="cta-row st2-table-toolbar">
                <div className="st2-select-wrap">
                  <select className="select st2-filter-select" value={status} onChange={event => setStatus(event.target.value as StatusFilter)}>
                    <option value="all">Status: All</option>
                    <option value="pending">Status: Pending</option>
                    <option value="processing">Status: Processing</option>
                    <option value="paid">Status: Paid</option>
                  </select>
                </div>
                <div className="st2-select-wrap">
                  <select className="select st2-filter-select" value={sort} onChange={event => setSort(event.target.value as SortFilter)}>
                    <option value="amount_desc">Sort by: Amount ↓</option>
                    <option value="amount_asc">Sort by: Amount ↑</option>
                    <option value="name_asc">Sort by: Name A-Z</option>
                    <option value="name_desc">Sort by: Name Z-A</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="table-wrap st2-partners-table-wrap">
              <table className="st2-partners-table">
                <thead>
                  <tr>
                    <th>Partner Name</th>
                    <th className="st2-align-right">Attributed Revenue</th>
                    <th className="st2-align-center">Commission Rate</th>
                    <th className="st2-align-right">Calculated Payout</th>
                    <th>Payment Method</th>
                    <th>Status</th>
                    <th className="st2-align-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {view.rows.map((row: AdminPayoutOperationsRow) => {
                    const checked = selectedPartnerIds.includes(row.partnerId);
                    return (
                      <tr key={row.partnerId} className={`st2-partner-row ${checked ? 'is-selected' : ''}`}>
                        <td>
                          <div className="st2-partner-cell">
                            <span className={`st2-partner-avatar ${row.partnerType === 'institute' ? 'institute' : 'influencer'}`}>
                              {getInitials(row.partnerName)}
                            </span>
                            <div>
                              <p className="st2-partner-name">{row.partnerName}</p>
                              <p className="small">ID: #{row.partnerId}</p>
                            </div>
                          </div>
                        </td>
                        <td className="st2-align-right">{money(row.attributedRevenueUsd)}</td>
                        <td className="st2-align-center">
                          <span className="st2-rate-chip">{row.commissionRatePercent}%</span>
                        </td>
                        <td className="st2-align-right st2-strong">{money(row.calculatedPayoutUsd)}</td>
                        <td>
                          <div className="st2-payment-cell">
                            <span className="material-symbols-outlined" aria-hidden>
                              {paymentIcon(row.paymentMethod)}
                            </span>
                            <div>
                              <p>{row.paymentMethod}</p>
                              {row.contactEmail ? <p className="small">{obfuscate(row.contactEmail)}</p> : null}
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className={statusPillClass(row.status)}>
                            <span className="st2-status-dot" />
                            {statusLabel(row.status)}
                          </span>
                        </td>
                        <td className="st2-align-right">
                          <button
                            className={`btn st2-include-btn ${checked ? 'btn-secondary' : 'btn-primary'}`}
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
            <footer className="st2-partners-table-footer">
              <p className="small">
                Showing 1 to {Math.min(view.rows.length, view.total)} of {view.total} results
              </p>
              <div className="cta-row">
                <button className="btn btn-secondary" type="button" disabled>
                  Previous
                </button>
                <button className="btn btn-secondary" type="button" disabled>
                  Next
                </button>
              </div>
            </footer>
          </article>

          {showBatchNote ? (
            <article className="panel st2-batch-note">
              <span className="material-symbols-outlined st2-batch-note-icon" aria-hidden>
                info
              </span>
              <p>
                <strong>Batch Processing Note</strong> Payouts processed after 5:00 PM EST will be deposited the next business day.
                Ensure all bank details are verified before processing the batch.
              </p>
              <button className="btn btn-link" type="button" onClick={() => setShowBatchNote(false)}>
                Dismiss
              </button>
            </article>
          ) : null}
        </>
      ) : null}

      {showModal ? (
        <div className="st2-modal-backdrop" role="dialog" aria-modal="true" aria-label="Payout confirmation">
          <div className="panel st2-confirm-modal st2-payout-modal">
            <header className="st2-modal-header">
              <div className="st2-modal-header-main">
                <span className="st2-modal-header-icon material-symbols-outlined" aria-hidden>
                  payments
                </span>
                <div>
                  <h2>{batchDetail ? `Confirm Payout Batch #${batchDetail.batch._id}` : 'Confirm Payout Batch'}</h2>
                  <p className="subtitle">
                    {batchDetail
                      ? `Created on ${new Date(batchDetail.batch.createdAt).toLocaleString()}`
                      : `Period ${periodStart} to ${periodEnd}`}
                  </p>
                </div>
              </div>
              <button className="icon-btn" aria-label="Close modal" onClick={() => setShowModal(false)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </header>

            {modalPreview ? (
              <div className="st2-modal-kpis st2-modal-summary">
                <article className="panel">
                  <p className="small">Total Partners</p>
                  <p className="kpi">{modalPreview.partnerCount}</p>
                </article>
                <article className="panel">
                  <p className="small">Total Payout</p>
                  <p className="kpi">{money(modalPreview.totals.totalUsd)}</p>
                </article>
                <article className="panel">
                  <p className="small">Processing Fee</p>
                  <p className="kpi">{money(modalPreview.preflight.processingFeeUsd)}</p>
                </article>
              </div>
            ) : null}

            {modalPreview?.preflight.flaggedAccounts.length ? (
              <article className="alert alert-warning st2-modal-warning">
                <p>
                  <strong>Action Required: Flagged Accounts Detected</strong>
                </p>
                <p>{modalPreview.preflight.flaggedAccounts.length} partners have been flagged for unusual activity.</p>
              </article>
            ) : null}

            <div>
              <h3 className="st2-flagged-header">
                <span className="material-symbols-outlined" aria-hidden>
                  flag
                </span>
                Flagged Accounts
              </h3>
              <div className="table-wrap st2-flagged-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Partner Name</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Risk Factor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(modalPreview?.preflight.flaggedAccounts || []).map(item => (
                      <tr key={item.partnerId}>
                        <td>
                          <div className="st2-partner-cell">
                            <span className="st2-partner-avatar muted">{getInitials(item.partnerName)}</span>
                            <span>{item.partnerName}</span>
                          </div>
                        </td>
                        <td>{money(item.amountUsd)}</td>
                        <td>
                          <span className={item.status === 'blocked' ? 'pill pill-amber' : 'pill pill-slate'}>
                            {statusLabel(item.status)}
                          </span>
                        </td>
                        <td>{item.riskFactors.join(', ') || '--'}</td>
                      </tr>
                    ))}
                    {!modalPreview?.preflight.flaggedAccounts.length ? (
                      <tr>
                        <td colSpan={4} className="small">
                          No flagged accounts.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h3 className="st2-flagged-header">
                <span className="material-symbols-outlined" aria-hidden>
                  leaderboard
                </span>
                Top Payouts Summary
              </h3>
              <div className="st2-payout-summary-grid">
                <article className="panel">
                  <p className="small">Top Earner</p>
                  <p>{topEarner?.partnerName || '--'}</p>
                  <strong>{topEarner ? money(topEarner.calculatedPayoutUsd) : '--'}</strong>
                </article>
                <article className="panel">
                  <p className="small">Most Referrals</p>
                  <p>{topReferral?.partnerName || '--'}</p>
                  <strong>{topReferral ? `${topReferral.conversionCount} refs` : '--'}</strong>
                </article>
                <article className="panel">
                  <p className="small">Avg. Commission</p>
                  <p>Selected rows</p>
                  <strong>{avgCommission ? `${avgCommission.toFixed(1)}%` : '--'}</strong>
                </article>
              </div>
            </div>

            <footer className="st2-modal-footer">
              <label className="cta-row st2-confirm-check">
                <input type="checkbox" checked={confirmChecked} onChange={event => setConfirmChecked(event.target.checked)} />
                <span>I have verified the commission logic and reviewed all flagged accounts.</span>
              </label>

              <div className="cta-row st2-modal-actions">
                {batchDetail ? (
                  <button className="btn btn-secondary" type="button" onClick={() => void openBatchDetail(batchDetail.batch._id)}>
                    Refresh Detail
                  </button>
                ) : null}
                <button className="btn btn-secondary" type="button" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button className="btn btn-primary" type="button" disabled={!confirmChecked || confirming} onClick={() => void onConfirm()}>
                  {confirming ? 'Processing…' : 'Confirm & Execute Payout'}
                </button>
              </div>
            </footer>
          </div>
        </div>
      ) : null}

      {success ? <div className="alert alert-success">{success}</div> : null}
      {error ? <div className="alert alert-error">{error}</div> : null}
    </section>
  );
}
