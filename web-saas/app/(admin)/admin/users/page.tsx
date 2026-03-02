'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';

import { apiRequest, ApiError } from '@/lib/api/client';
import { AdminAuditLogPage, AdminRole, AdminUserRecord } from '@/lib/types';

type UsersResponse = {
  users: AdminUserRecord[];
  total: number;
};

const allRoles: AdminRole[] = ['superadmin', 'content_manager', 'support_agent'];

export default function AdminUsersPage() {
  const searchParams = useSearchParams();
  const initialUserQuery = searchParams.get('query') || '';
  const initialAuditAction = searchParams.get('auditAction') || '';
  const initialDateFrom = searchParams.get('dateFrom') || '';
  const initialDateTo = searchParams.get('dateTo') || '';

  const [payload, setPayload] = useState<UsersResponse | null>(null);
  const [roleDrafts, setRoleDrafts] = useState<Record<string, AdminRole[]>>({});
  const [auditPayload, setAuditPayload] = useState<AdminAuditLogPage | null>(null);
  const [userQuery, setUserQuery] = useState(initialUserQuery);
  const [auditActionFilter, setAuditActionFilter] = useState(initialAuditAction);
  const [dateFrom, setDateFrom] = useState(initialDateFrom);
  const [dateTo, setDateTo] = useState(initialDateTo);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loadingUserId, setLoadingUserId] = useState<string | null>(null);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const usersQuery = useMemo(() => {
    const params = new URLSearchParams();
    params.set('limit', '50');
    params.set('offset', '0');
    if (userQuery.trim()) params.set('query', userQuery.trim());
    return params.toString();
  }, [userQuery]);

  const auditQuery = useMemo(() => {
    const params = new URLSearchParams();
    params.set('limit', '50');
    params.set('offset', '0');
    if (auditActionFilter.trim()) params.set('action', auditActionFilter.trim());
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    return params.toString();
  }, [auditActionFilter, dateFrom, dateTo]);

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const users = await apiRequest<UsersResponse>(`/admin/users?${usersQuery}`);
      setPayload(users);
      setRoleDrafts(
        users.users.reduce(
          (acc, user) => {
            acc[user._id] = (user.adminRoles || []) as AdminRole[];
            return acc;
          },
          {} as Record<string, AdminRole[]>
        )
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load users');
    } finally {
      setLoadingUsers(false);
    }
  }, [usersQuery]);

  const loadAuditLogs = useCallback(async () => {
    try {
      const logs = await apiRequest<AdminAuditLogPage>(`/admin/audit-logs?${auditQuery}`);
      setAuditPayload(logs);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load audit logs');
    }
  }, [auditQuery]);

  const toggleRole = (userId: string, role: AdminRole) => {
    setRoleDrafts(prev => {
      const current = prev[userId] || [];
      const hasRole = current.includes(role);
      return {
        ...prev,
        [userId]: hasRole ? current.filter(item => item !== role) : [...current, role]
      };
    });
  };

  const saveRoles = async (userId: string) => {
    setError('');
    setSuccess('');
    setLoadingUserId(userId);
    try {
      await apiRequest(`/admin/users/${userId}/roles`, {
        method: 'PATCH',
        body: JSON.stringify({ roles: roleDrafts[userId] || [] })
      });
      setSuccess('User roles updated.');
      await Promise.all([loadUsers(), loadAuditLogs()]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update user roles.');
    } finally {
      setLoadingUserId(null);
    }
  };

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    setUserQuery(initialUserQuery);
    setAuditActionFilter(initialAuditAction);
    setDateFrom(initialDateFrom);
    setDateTo(initialDateTo);
  }, [initialAuditAction, initialDateFrom, initialDateTo, initialUserQuery]);

  useEffect(() => {
    void loadAuditLogs();
  }, [loadAuditLogs]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-indigo-100 dark:border-indigo-900/40 bg-gradient-to-r from-indigo-600 to-violet-600 p-6 text-white">
        <span className="inline-block rounded-full bg-white/20 px-3 py-0.5 text-xs font-semibold uppercase tracking-wider mb-2">User support tooling</span>
        <h1 className="text-2xl font-bold">Role Management and Operational Audit Logs</h1>
      </div>

      <article className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total users: <strong className="text-gray-900 dark:text-white">{payload?.total || 0}</strong></p>
          <div className="flex items-center gap-2">
            <input
              className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              placeholder="Search users by email/name/id"
              value={userQuery}
              onChange={event => setUserQuery(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void loadUsers();
                }
              }}
            />
            <button
              type="button"
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              onClick={() => void loadUsers()}
              disabled={loadingUsers}
            >
              Search
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Plan</th>
                <th className="px-5 py-3">Roles</th>
                <th className="px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {(payload?.users || []).map(user => (
                <tr key={user._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <td className="px-5 py-3 text-gray-700 dark:text-gray-300">{user.email}</td>
                  <td className="px-5 py-3 font-semibold text-gray-900 dark:text-white">
                    {user.firstName} {user.lastName}
                  </td>
                  <td className="px-5 py-3"><span className="inline-block rounded-full bg-indigo-50 dark:bg-indigo-500/10 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 dark:text-indigo-400">{user.subscriptionPlan}</span></td>
                  <td className="px-5 py-3">
                    <div className="flex flex-col gap-1.5">
                      {allRoles.map(role => (
                        <label key={`${user._id}-${role}`} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 cursor-pointer">
                          <input
                            type="checkbox"
                            className="rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500/40"
                            checked={(roleDrafts[user._id] || []).includes(role)}
                            onChange={() => toggleRole(user._id, role)}
                          />{' '}
                          {role}
                        </label>
                      ))}
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <button className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors" onClick={() => void saveRoles(user._id)} disabled={loadingUserId === user._id}>
                      {loadingUserId === user._id ? 'Saving...' : 'Save Roles'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      <article className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-4">
        <h3 className="text-base font-bold text-gray-900 dark:text-white">Audit Logs</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Action filter</span>
            <input className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40" value={auditActionFilter} onChange={event => setAuditActionFilter(event.target.value)} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date from</span>
            <input className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40" type="date" value={dateFrom} onChange={event => setDateFrom(event.target.value)} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date to</span>
            <input className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40" type="date" value={dateTo} onChange={event => setDateTo(event.target.value)} />
          </label>
        </div>
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                <th className="px-5 py-3">Actor</th>
                <th className="px-5 py-3">Action</th>
                <th className="px-5 py-3">Target</th>
                <th className="px-5 py-3">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {(auditPayload?.logs || []).map(log => (
                <tr key={log._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <td className="px-5 py-3 font-mono text-xs text-gray-500 dark:text-gray-400">{log.actorUserId}</td>
                  <td className="px-5 py-3 font-semibold text-gray-900 dark:text-white">{log.action}</td>
                  <td className="px-5 py-3 text-gray-500 dark:text-gray-400">
                    {log.targetType} {log.targetId ? `(${log.targetId})` : ''}
                  </td>
                  <td className="px-5 py-3 text-gray-500 dark:text-gray-400">{new Date(log.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      {error ? <div className="rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-400">{error}</div> : null}
      {success ? <div className="rounded-xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">{success}</div> : null}
    </div>
  );
}
