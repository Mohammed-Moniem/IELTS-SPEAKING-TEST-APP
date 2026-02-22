'use client';

import { useEffect, useState } from 'react';

import { apiRequest } from '@/lib/api/client';

type UserRecord = {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  subscriptionPlan: string;
  adminRoles?: string[];
};

type UsersResponse = {
  users: UserRecord[];
  total: number;
};

export default function AdminUsersPage() {
  const [payload, setPayload] = useState<UsersResponse | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    void (async () => {
      try {
        const users = await apiRequest<UsersResponse>('/admin/users?limit=50&offset=0');
        setPayload(users);
      } catch (err: any) {
        setError(err?.message || 'Failed to load users');
      }
    })();
  }, []);

  return (
    <section className="section-wrap">
      <div className="panel hero-panel stack">
        <span className="tag">User support tooling</span>
        <h1>Admin users</h1>
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
              </tr>
            </thead>
            <tbody>
              {(payload?.users || []).map(user => (
                <tr key={user._id}>
                  <td>{user.email}</td>
                  <td>{user.firstName} {user.lastName}</td>
                  <td>{user.subscriptionPlan}</td>
                  <td>{(user.adminRoles || []).join(', ') || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}
    </section>
  );
}
