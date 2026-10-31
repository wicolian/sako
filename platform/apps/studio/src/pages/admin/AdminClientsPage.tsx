import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { apiFetch } from '../../lib/http';
import { analytics } from '../../lib/analytics';

interface CreateClientForm {
  name: string;
  slug: string;
  ownerEmail: string;
  basePlanCode: string;
  customActiveTaskLimit?: number;
  customTatSeconds?: number;
}

interface Workspace {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  subscription?: {
    status: string;
    planCode: string;
  };
  planOverride?: {
    basePlanCode: string;
    customActiveTaskLimit?: number;
    customTatSeconds?: number;
  };
}

export const AdminClientsPage: React.FC = () => {
  const navigate = useNavigate();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [form, setForm] = useState<CreateClientForm>({
    name: '',
    slug: '',
    ownerEmail: '',
    basePlanCode: 'CORE',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Track page open
  useEffect(() => {
    analytics.track('AdminClientsOpened', {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await apiFetch<{ id: string; name: string; slug: string }>('/admin/workspaces', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          slug: form.slug || undefined,
          ownerEmail: form.ownerEmail,
          basePlanCode: form.basePlanCode,
          customActiveTaskLimit: form.customActiveTaskLimit || undefined,
          customTatSeconds: form.customTatSeconds ? form.customTatSeconds * 3600 : undefined, // Convert hours to seconds
        }),
      });

      analytics.enterpriseClientCreated(response.id, form.basePlanCode);
      setSuccess(`Enterprise client "${response.name}" created successfully!`);
      setShowCreateForm(false);
      setForm({
        name: '',
        slug: '',
        ownerEmail: '',
        basePlanCode: 'CORE',
      });
    } catch (err: any) {
      setError(err.message || 'Failed to create enterprise client');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">Admin</p>
          <h1 className="text-xl font-semibold text-[color:var(--foreground)]">Enterprise Clients</h1>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[color:var(--primary)] text-[color:var(--primary-foreground)] text-[13px] font-medium hover:opacity-90 transition"
        >
          <Icon name="plus" className="h-4 w-4" />
          Create Enterprise Client
        </button>
      </header>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-700 px-4 py-3 text-[13px] text-red-900 dark:text-red-200">
          <strong>Error:</strong> {error}
        </div>
      )}

      {success && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-700 px-4 py-3 text-[13px] text-emerald-900 dark:text-emerald-200">
          {success}
        </div>
      )}

      {showCreateForm && (
        <div className="bg-[color:var(--card)] rounded-2xl border border-[color:var(--border)] shadow-sm p-6">
          <h2 className="text-[15px] font-semibold mb-4 text-[color:var(--foreground)]">Create Enterprise Client</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
                  Workspace Name *
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Acme Corp"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[color:var(--border)] bg-[color:var(--accent)] text-[13px] text-[color:var(--foreground)] outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
                  Slug (optional)
                </label>
                <input
                  type="text"
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  placeholder="acme-corp"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[color:var(--border)] bg-[color:var(--accent)] text-[13px] text-[color:var(--foreground)] outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
                Owner Email *
              </label>
              <input
                type="email"
                required
                value={form.ownerEmail}
                onChange={(e) => setForm({ ...form, ownerEmail: e.target.value })}
                placeholder="owner@acme.com"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[color:var(--border)] bg-[color:var(--accent)] text-[13px] text-[color:var(--foreground)] outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
              />
              <p className="text-[11px] text-[color:var(--muted-foreground)]">
                This user will be set as the workspace owner. If they don't exist, a placeholder account will be created.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
                Base Plan *
              </label>
              <select
                required
                value={form.basePlanCode}
                onChange={(e) => setForm({ ...form, basePlanCode: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] text-[13px] text-[color:var(--foreground)] outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
              >
                <option value="CORE">Core</option>
                <option value="OPS">Ops Base</option>
                <option value="ENTERPRISE">Enterprise</option>
              </select>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
                  Custom Active Task Limit (optional)
                </label>
                <input
                  type="number"
                  min={1}
                  value={form.customActiveTaskLimit || ''}
                  onChange={(e) => setForm({ ...form, customActiveTaskLimit: e.target.value ? parseInt(e.target.value) : undefined })}
                  placeholder="e.g. 5"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[color:var(--border)] bg-[color:var(--accent)] text-[13px] text-[color:var(--foreground)] outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
                  Custom TAT Hours (optional)
                </label>
                <input
                  type="number"
                  min={1}
                  value={form.customTatSeconds || ''}
                  onChange={(e) => setForm({ ...form, customTatSeconds: e.target.value ? parseInt(e.target.value) : undefined })}
                  placeholder="e.g. 24"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[color:var(--border)] bg-[color:var(--accent)] text-[13px] text-[color:var(--foreground)] outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-[color:var(--border)]">
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 rounded-full border border-[color:var(--border)] bg-[color:var(--card)] text-[13px] text-[color:var(--foreground)] hover:bg-[color:var(--accent)] transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 rounded-full bg-[color:var(--primary)] text-[color:var(--primary-foreground)] text-[13px] font-medium hover:opacity-90 transition disabled:opacity-50"
              >
                {submitting ? 'Creating...' : 'Create Enterprise Client'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-[color:var(--card)] rounded-2xl border border-[color:var(--border)] shadow-sm p-6">
        <p className="text-[13px] text-[color:var(--muted-foreground)]">
          Enterprise clients are created with manual billing (no Stripe). Use the Admin &gt; Clients view to see all clients and manage their plan overrides.
        </p>
        <button
          onClick={() => navigate('/studio/clients')}
          className="mt-4 inline-flex items-center gap-2 text-[13px] text-[color:var(--primary)] hover:underline"
        >
          View all clients →
        </button>
      </div>
    </div>
  );
};

export default AdminClientsPage;

