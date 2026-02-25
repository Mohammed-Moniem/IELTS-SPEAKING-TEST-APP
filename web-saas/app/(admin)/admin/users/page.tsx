'use client';

import { useEffect, useMemo, useState } from 'react';

import { apiRequest, ApiError } from '@/lib/api/client';
import { AdminAuditLogPage, AdminRole, AdminUserRecord } from '@/lib/types';

type UsersResponse = {
  users: AdminUserRecord[];
  total: number;
};

const allRoles: AdminRole[] = ['superadmin', 'content_manager', 'support_agent'];

export default function AdminUsersPage() {
  const [payload, setPayload] = useState<UsersResponse | null>(null);
  const [roleDrafts, setRoleDrafts] = useState<Record<string, AdminRole[]>>({});
  const [auditPayload, setAuditPayload] = useState<AdminAuditLogPage | null>(null);
  const [auditActionFilter, setAuditActionFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loadingUserId, setLoadingUserId] = useState<string | null>(null);

  const auditQuery = useMemo(() => {
    const params = new URLSearchParams();
    params.set('limit', '50');
    params.set('offset', '0');
    if (auditActionFilter.trim()) params.set('action', auditActionFilter.trim());
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    return params.toString();
  }, [auditActionFilter, dateFrom, dateTo]);

  const loadUsers = async () => {
    try {
      const users = await apiRequest<UsersResponse>('/admin/users?limit=50&offset=0');
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
    }
  };

  const loadAuditLogs = async () => {
    try {
      const logs = await apiRequest<AdminAuditLogPage>(`/admin/audit-logs?${auditQuery}`);
      setAuditPayload(logs);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load audit logs');
    }
  };

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
    void Promise.all([loadUsers(), loadAuditLogs()]);
  }, []);

  useEffect(() => {
    void loadAuditLogs();
  }, [auditQuery]);

  return (
    <section className="section-wrap">
      <div className="panel hero-panel stack">
        <span className="tag">User support tooling</span>
        <h1>Role management and operational audit logs</h1>
      </div>

      <div className="panel stack">
        <p className="small">Total users: {payload?.total || 0}</p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Email</th>
                <th>Name</th>
                <th>Plan</th>
                <th>Roles</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(payload?.users || []).map(user => (
                <tr key={user._id}>
                  <td>{user.email}</td>
                  <td>
                    {user.firstName} {user.lastName}
                  </td>
                  <td>{user.subscriptionPlan}</td>
                  <td>
                    <div className="stack">
                      {allRoles.map(role => (
                        <label key={`${user._id}-${role}`} className="small">
                          <input
                            type="checkbox"
                            checked={(roleDrafts[user._id] || []).includes(role)}
                            onChange={() => toggleRole(user._id, role)}
                          />{' '}
                          {role}
                        </label>
                      ))}
                    </div>
                  </td>
                  <td>
                    <button className="btn btn-secondary" onClick={() => void saveRoles(user._id)} disabled={loadingUserId === user._id}>
                      {loadingUserId === user._id ? 'Saving...' : 'Save Roles'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel stack">
        <h3>Audit logs</h3>
        <div className="grid-3">
          <label className="stack">
            <span>Action filter</span>
            <input className="input" value={auditActionFilter} onChange={event => setAuditActionFilter(event.target.value)} />
          </label>
          <label className="stack">
            <span>Date from</span>
            <input className="input" type="date" value={dateFrom} onChange={event => setDateFrom(event.target.value)} />
          </label>
          <label className="stack">
            <span>Date to</span>
            <input className="input" type="date" value={dateTo} onChange={event => setDateTo(event.target.value)} />
          </label>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Actor</th>
                <th>Action</th>
                <th>Target</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {(auditPayload?.logs || []).map(log => (
                <tr key={log._id}>
                  <td>{log.actorUserId}</td>
                  <td>{log.action}</td>
                  <td>
                    {log.targetType} {log.targetId ? `(${log.targetId})` : ''}
                  </td>
                  <td>{new Date(log.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}
      {success ? <div className="alert alert-success">{success}</div> : null}
    </section>
  );
}
