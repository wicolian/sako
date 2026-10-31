import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../lib/http';
import { Icon } from '../components/Icon';
import { toast } from 'sonner';

interface PendingAdmin {
  id: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: string;
}

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: 'CLIENT' | 'PENDING_ADMIN' | 'ADMIN';
  isSuperAdmin: boolean;
  createdAt: string;
}

export const PendingAdminsPage: React.FC = () => {
  const navigate = useNavigate();
  const [pendingAdmins, setPendingAdmins] = useState<PendingAdmin[]>([]);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      // Fetch pending admins and all users separately
      const [pendingRes, usersRes] = await Promise.all([
        apiFetch<PendingAdmin[]>('/admin/users/pending-admins'),
        apiFetch<AdminUser[]>('/admin/users'),
      ]);
      setPendingAdmins(Array.isArray(pendingRes) ? pendingRes : []);
      setAdmins(Array.isArray(usersRes) ? usersRes.filter(u => u.role === 'ADMIN') : []);
    } catch (err: any) {
      console.error('Fetch error:', err);
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleApprove = async (userId: string) => {
    if (!confirm('Approve this user as an admin? They will gain full studio access.')) return;

    setActionLoading(userId);
    try {
      await apiFetch(`/admin/users/${userId}/promote`, { method: 'POST' });
      toast.success('Admin approved successfully');
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to approve admin');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (userId: string) => {
    if (!confirm('Reject this admin request? The user will be downgraded to a client.')) return;

    setActionLoading(userId);
    try {
      await apiFetch(`/admin/users/${userId}/reject-pending`, { method: 'POST' });
      toast.success('Admin request rejected');
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to reject admin');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDemote = async (userId: string) => {
    if (!confirm('Demote this admin to client? They will lose studio access.')) return;

    setActionLoading(userId);
    try {
      await apiFetch(`/admin/users/${userId}/demote`, { method: 'POST' });
      toast.success('Admin demoted to client');
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to demote admin');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-8 space-y-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">Admin</p>
          <h1 className="text-[22px] font-semibold tracking-tight">Admin Management</h1>
          <p className="text-[12px] text-[color:var(--muted-foreground)] mt-1">
            Approve pending admins and manage existing admin access.
          </p>
        </div>
        <button
          onClick={() => navigate('/studio/admin/users')}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--foreground)] text-[13px] hover:bg-[color:var(--accent)] transition"
        >
          <Icon name="users" className="h-4 w-4" />
          All Users
        </button>
      </header>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-700 px-4 py-3 text-[13px] text-red-900 dark:text-red-200">
          <strong>Error:</strong> {error}
          <button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] shadow-sm p-8 text-center">
          <p className="text-[13px] text-[color:var(--muted-foreground)]">Loading...</p>
        </div>
      ) : (
        <>
          {/* Pending Admins Section */}
          <div className="rounded-2xl border border-amber-200 dark:border-amber-700 bg-[color:var(--card)] shadow-sm overflow-hidden">
            <div className="px-5 py-4 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-700">
              <h2 className="text-[16px] font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-2">
                <Icon name="alert-triangle" className="h-5 w-5" />
                Pending Admin Requests ({pendingAdmins.length})
              </h2>
              <p className="text-[12px] text-amber-700 dark:text-amber-400 mt-1">
                Users who signed up with a studio email domain and are awaiting approval.
              </p>
            </div>

            {pendingAdmins.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <Icon name="check-circle" className="h-8 w-8 mx-auto mb-2 text-emerald-500" />
                <p className="text-[13px] text-[color:var(--muted-foreground)]">
                  No pending admin requests. All caught up!
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[color:var(--border)]">
                {pendingAdmins.map(admin => (
                  <div key={admin.id} className="px-5 py-4 flex items-center justify-between">
                    <div>
                      <p className="text-[14px] font-medium text-[color:var(--foreground)]">
                        {admin.name || admin.email}
                      </p>
                      <p className="text-[12px] text-[color:var(--muted-foreground)]">{admin.email}</p>
                      <p className="text-[11px] text-[color:var(--muted-foreground)] mt-1">
                        Requested {new Date(admin.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleApprove(admin.id)}
                        disabled={actionLoading === admin.id}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-emerald-500 text-white text-[13px] font-medium hover:bg-emerald-600 transition disabled:opacity-50"
                      >
                        {actionLoading === admin.id ? (
                          <Icon name="loader" className="h-4 w-4 animate-spin" />
                        ) : (
                          <Icon name="check" className="h-4 w-4" />
                        )}
                        Approve
                      </button>
                      <button
                        onClick={() => handleReject(admin.id)}
                        disabled={actionLoading === admin.id}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-[color:var(--border)] text-[color:var(--foreground)] text-[13px] hover:bg-[color:var(--accent)] transition disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Current Admins Section */}
          <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-[color:var(--border)]">
              <h2 className="text-[16px] font-semibold text-[color:var(--foreground)] flex items-center gap-2">
                <Icon name="shield" className="h-5 w-5 text-emerald-500" />
                Current Admins ({admins.length})
              </h2>
              <p className="text-[12px] text-[color:var(--muted-foreground)] mt-1">
                Users with full studio access.
              </p>
            </div>

            {admins.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="text-[13px] text-[color:var(--muted-foreground)]">No admins yet.</p>
              </div>
            ) : (
              <div className="divide-y divide-[color:var(--border)]">
                {admins.map(admin => (
                  <div key={admin.id} className="px-5 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-[color:var(--accent)] flex items-center justify-center text-[14px] font-semibold text-[color:var(--foreground)]">
                        {(admin.name || admin.email)[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-[14px] font-medium text-[color:var(--foreground)] flex items-center gap-2">
                          {admin.name || admin.email}
                          {admin.isSuperAdmin && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">
                              Super Admin
                            </span>
                          )}
                        </p>
                        <p className="text-[12px] text-[color:var(--muted-foreground)]">{admin.email}</p>
                      </div>
                    </div>
                    {!admin.isSuperAdmin && (
                      <button
                        onClick={() => handleDemote(admin.id)}
                        disabled={actionLoading === admin.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-red-200 text-red-600 dark:border-red-700 dark:text-red-400 text-[12px] hover:bg-red-50 dark:hover:bg-red-900/20 transition disabled:opacity-50"
                      >
                        {actionLoading === admin.id ? (
                          <Icon name="loader" className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Icon name="user-minus" className="h-3.5 w-3.5" />
                        )}
                        Demote
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
