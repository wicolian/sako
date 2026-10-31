import React, { useState, useEffect } from 'react';
import { Icon } from '../../components/Icon';
import { apiFetch } from '../../lib/http';
import { analytics } from '../../lib/analytics';

interface User {
  id: string;
  email: string;
  name: string | null;
  role: 'CLIENT' | 'PENDING_ADMIN' | 'ADMIN';
  isSuperAdmin: boolean;
  createdAt: string;
  memberships?: Array<{
    workspace: {
      id: string;
      name: string;
      slug: string;
    };
    role: string;
  }>;
}

interface AdminUsersPageProps {
  isSuperAdmin?: boolean;
}

export const AdminUsersPage: React.FC<AdminUsersPageProps> = ({ isSuperAdmin = false }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [pendingAdmins, setPendingAdmins] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const [usersRes, pendingRes] = await Promise.all([
        apiFetch<{ users: User[] }>(`/admin/users${roleFilter ? `?role=${roleFilter}` : ''}`),
        apiFetch<{ pendingAdmins: User[] }>('/admin/users/pending-admins'),
      ]);
      setUsers(usersRes.users);
      setPendingAdmins(pendingRes.pendingAdmins);
    } catch (err: any) {
      setError(err.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [roleFilter]);

  // Track page open (once on mount)
  useEffect(() => {
    analytics.track('AdminUsersOpened', {});
  }, []);

  const handlePromote = async (userId: string) => {
    if (!confirm('Are you sure you want to promote this user to Admin?')) return;
    
    setActionLoading(userId);
    try {
      await apiFetch(`/admin/users/${userId}/promote`, { method: 'POST' });
      analytics.adminPromoted(userId);
      await fetchUsers();
    } catch (err: any) {
      setError(err.message || 'Failed to promote user');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDemote = async (userId: string) => {
    if (!confirm('Are you sure you want to demote this admin to Client?')) return;
    
    setActionLoading(userId);
    try {
      await apiFetch(`/admin/users/${userId}/demote`, { method: 'POST' });
      await fetchUsers();
    } catch (err: any) {
      setError(err.message || 'Failed to demote user');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectPending = async (userId: string) => {
    if (!confirm('Are you sure you want to reject this pending admin request?')) return;
    
    setActionLoading(userId);
    try {
      await apiFetch(`/admin/users/${userId}/reject-pending`, { method: 'POST' });
      await fetchUsers();
    } catch (err: any) {
      setError(err.message || 'Failed to reject pending admin');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteForTesting = async (user: User) => {
    const confirmed = confirm(
      `⚠️ DELETE USER FOR TESTING\n\n` +
      `This will permanently delete:\n` +
      `• User: ${user.email}\n` +
      `• All owned workspaces and their data\n` +
      `• Cancel all Stripe subscriptions\n\n` +
      `Clerk account will be preserved (email can be reused).\n\n` +
      `Are you sure?`
    );
    if (!confirmed) return;

    setActionLoading(user.id);
    try {
      const result = await apiFetch<{ success: boolean; message: string; summary: any }>(
        `/admin/users/${user.id}/cleanup-for-testing`,
        { method: 'DELETE' }
      );
      
      if (result.success) {
        alert(`✅ ${result.message}\n\nDeleted ${result.summary.workspacesDeleted.length} workspace(s)\nCancelled ${result.summary.stripeSubscriptionsCancelled.length} subscription(s)`);
      } else {
        alert(`⚠️ ${result.message}`);
      }
      
      await fetchUsers();
    } catch (err: any) {
      setError(err.message || 'Failed to delete user');
    } finally {
      setActionLoading(null);
    }
  };

  const getRoleBadge = (role: string, isSuperAdmin: boolean) => {
    if (isSuperAdmin) {
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
    }
    switch (role) {
      case 'ADMIN':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300';
      case 'PENDING_ADMIN':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
      default:
        return 'bg-[color:var(--muted)] text-[color:var(--foreground)]';
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">Admin</p>
          <h1 className="text-xl font-semibold text-[color:var(--foreground)]">User Management</h1>
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] text-[13px]"
        >
          <option value="">All Roles</option>
          <option value="CLIENT">Clients</option>
          <option value="PENDING_ADMIN">Pending Admins</option>
          <option value="ADMIN">Admins</option>
        </select>
      </header>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-700 px-4 py-3 text-[13px] text-red-900 dark:text-red-200">
          <strong>Error:</strong> {error}
          <button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
        </div>
      )}

      {/* Pending Admins Section */}
      {pendingAdmins.length > 0 && (
        <div className="bg-[color:var(--card)] rounded-2xl border border-amber-200 dark:border-amber-700 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-700">
            <h2 className="text-[14px] font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-2">
              <Icon name="alert-triangle" className="h-4 w-4" />
              Pending Admin Requests ({pendingAdmins.length})
            </h2>
          </div>
          <div className="divide-y divide-[color:var(--border)]">
            {pendingAdmins.map(user => (
              <div key={user.id} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-[13px] font-medium text-[color:var(--foreground)]">{user.name || user.email}</p>
                  <p className="text-[12px] text-[color:var(--muted-foreground)]">{user.email}</p>
                </div>
                {isSuperAdmin && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handlePromote(user.id)}
                      disabled={actionLoading === user.id}
                      className="px-3 py-1.5 rounded-full bg-emerald-500 text-white text-[12px] font-medium hover:bg-emerald-600 transition disabled:opacity-50"
                    >
                      {actionLoading === user.id ? '...' : 'Approve'}
                    </button>
                    <button
                      onClick={() => handleRejectPending(user.id)}
                      disabled={actionLoading === user.id}
                      className="px-3 py-1.5 rounded-full border border-[color:var(--border)] text-[12px] hover:bg-[color:var(--accent)] transition disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All Users Table */}
      <div className="bg-[color:var(--card)] rounded-2xl border border-[color:var(--border)] shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-[color:var(--border)]">
          <h2 className="text-[14px] font-semibold text-[color:var(--foreground)]">All Users</h2>
        </div>
        {loading ? (
          <div className="px-4 py-8 text-center text-[13px] text-[color:var(--muted-foreground)]">
            Loading users...
          </div>
        ) : users.length === 0 ? (
          <div className="px-4 py-8 text-center text-[13px] text-[color:var(--muted-foreground)]">
            No users found
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[color:var(--border)] bg-[color:var(--accent)]/50">
                  <th className="px-4 py-2 text-left font-medium text-[color:var(--muted-foreground)]">User</th>
                  <th className="px-4 py-2 text-left font-medium text-[color:var(--muted-foreground)]">Role</th>
                  <th className="px-4 py-2 text-left font-medium text-[color:var(--muted-foreground)]">Workspaces</th>
                  <th className="px-4 py-2 text-left font-medium text-[color:var(--muted-foreground)]">Joined</th>
                  {isSuperAdmin && <th className="px-4 py-2 text-right font-medium text-[color:var(--muted-foreground)]">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--border)]">
                {users.map(user => (
                  <tr key={user.id} className="hover:bg-[color:var(--accent)]/30 transition">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-[color:var(--foreground)]">{user.name || '—'}</p>
                        <p className="text-[12px] text-[color:var(--muted-foreground)]">{user.email}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] ${getRoleBadge(user.role, user.isSuperAdmin)}`}>
                        {user.isSuperAdmin ? 'Super Admin' : user.role.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[color:var(--muted-foreground)]">
                      {user.memberships?.length || 0} workspace(s)
                    </td>
                    <td className="px-4 py-3 text-[color:var(--muted-foreground)]">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    {isSuperAdmin && (
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {!user.isSuperAdmin && (
                            <>
                              {user.role === 'ADMIN' ? (
                                <button
                                  onClick={() => handleDemote(user.id)}
                                  disabled={actionLoading === user.id}
                                  className="px-3 py-1.5 rounded-full border border-[color:var(--border)] text-[12px] hover:bg-[color:var(--accent)] transition disabled:opacity-50"
                                >
                                  {actionLoading === user.id ? '...' : 'Demote'}
                                </button>
                              ) : user.role === 'CLIENT' ? (
                                <button
                                  onClick={() => handlePromote(user.id)}
                                  disabled={actionLoading === user.id}
                                  className="px-3 py-1.5 rounded-full bg-[color:var(--primary)] text-[color:var(--primary-foreground)] text-[12px] font-medium hover:opacity-90 transition disabled:opacity-50"
                                >
                                  {actionLoading === user.id ? '...' : 'Promote'}
                                </button>
                              ) : null}
                              {/* Delete for Testing - only show for non-admin users */}
                              {user.role === 'CLIENT' && (
                                <button
                                  onClick={() => handleDeleteForTesting(user)}
                                  disabled={actionLoading === user.id}
                                  className="px-3 py-1.5 rounded-full border border-red-300 text-red-600 dark:border-red-700 dark:text-red-400 text-[12px] hover:bg-red-50 dark:hover:bg-red-900/20 transition disabled:opacity-50"
                                  title="Delete user and all data (for testing)"
                                >
                                  {actionLoading === user.id ? '...' : 'Delete'}
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminUsersPage;

