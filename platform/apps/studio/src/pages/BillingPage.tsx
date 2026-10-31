import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { StudioPlaceholder } from '../components/StudioPlaceholder';
import { features } from '../config/features';
import { useStudioClients } from '../lib/hooks';
import { BillingDebug, fetchBillingDebug } from '../lib/api';
import { ApiError } from '../lib/http';

export const StudioBillingPage: React.FC = () => {
  const navigate = useNavigate();
  const { data: clients, loading: clientsLoading } = useStudioClients();
  const [workspaceId, setWorkspaceId] = useState('');
  const [billingData, setBillingData] = useState<BillingDebug | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);

  if (!features.studioBillingInspector) {
    return (
      <StudioPlaceholder
        title="Billing"
        subtitle="Studio"
        onNavigate={(route) => navigate(route)}
        message="billing inspector will live here soon. for now, use the Stripe dashboard directly."
      />
    );
  }

  const formatDate = (value?: string | null) =>
    value ? new Date(value).toLocaleString() : '—';

  const handleLoad = async () => {
    if (!workspaceId) {
      setError('select a workspace first.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await fetchBillingDebug(workspaceId);
      setBillingData(data);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.body?.message || err.message
          : 'failed to load billing data';
      setError(message);
      setBillingData(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-8 space-y-6">
      <header className="mb-2">
        <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">studio</p>
        <h2 className="text-[22px] tracking-tight font-semibold text-[color:var(--foreground)]">Billing inspector</h2>
        <p className="text-[13px] text-[color:var(--muted-foreground)] mt-2">
          view the subscription, Stripe sync state, and current credit balances for any workspace.
        </p>
      </header>

      <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-4 md:p-5 space-y-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1">
            <label className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)] block mb-1">
              Workspace
            </label>
            <select
              className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]"
              value={workspaceId}
              onChange={(e) => setWorkspaceId(e.target.value)}
              disabled={clientsLoading}
            >
              <option value="">{clientsLoading ? 'Loading workspaces…' : 'Select workspace'}</option>
              {clients?.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name} ({client.slug})
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={handleLoad}
              disabled={!workspaceId || loading}
              className="inline-flex items-center justify-center rounded-full border border-[color:var(--border)] bg-[color:var(--background)] px-4 py-2 text-[13px] font-medium hover:bg-[color:var(--accent)]/60 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Loading…' : 'Inspect billing'}
            </button>
          </div>
        </div>
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
            {error}
          </div>
        )}
      </section>

      {billingData && (
        <>
          {/* ... existing debug sections ... */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">Subscription</p>
                  <h3 className="text-[15px] font-semibold text-[color:var(--foreground)]">
                    {billingData.subscription.planCode}
                  </h3>
                </div>
                <span
                  className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] border ${billingData.subscription.status === 'ACTIVE'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                      : billingData.subscription.status === 'PAUSED'
                        ? 'bg-amber-50 border-amber-200 text-amber-700'
                        : 'bg-red-50 border-red-200 text-red-700'
                    }`}
                >
                  {billingData.subscription.status}
                </span>
              </div>
              <dl className="text-[13px] text-[color:var(--muted-foreground)] space-y-1.5">
                <div className="flex justify-between gap-2">
                  <dt>Workspace</dt>
                  <dd className="text-[color:var(--foreground)] font-medium">
                    {billingData.workspace.name || billingData.workspace.id}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>Stripe sub id</dt>
                  <dd className="text-[color:var(--foreground)]">{billingData.subscription.stripeSubscriptionId || '—'}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>Current period</dt>
                  <dd className="text-[color:var(--foreground)]">
                    {formatDate(billingData.subscription.billingPeriodStart)} → {formatDate(billingData.subscription.billingPeriodEnd)}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>Next cancel at</dt>
                  <dd className="text-[color:var(--foreground)]">{formatDate(billingData.subscription.cancelAt)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>Active slot limit</dt>
                  <dd className="text-[color:var(--foreground)]">
                    {billingData.subscription.activeTaskLimit ?? '—'}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>SLA (hours)</dt>
                  <dd className="text-[color:var(--foreground)]">
                    {billingData.subscription.slaSeconds
                      ? Math.round(billingData.subscription.slaSeconds / 3600)
                      : '—'}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-4 space-y-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">Credits snapshot</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[13px]">
                <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--background)]/60 p-3 space-y-1">
                  <p className="text-[12px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">Day credits</p>
                  <p className="text-[18px] font-semibold text-[color:var(--foreground)]">
                    {billingData.dayCredits ? `${billingData.dayCredits.remaining}/${billingData.dayCredits.totalCredits}` : '—'}
                  </p>
                  <p className="text-[11px] text-[color:var(--muted-foreground)]">
                    period ends {formatDate(billingData.dayCredits?.periodEnd)}
                  </p>
                </div>
                <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--background)]/60 p-3 space-y-1">
                  <p className="text-[12px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">AI credits</p>
                  <p className="text-[18px] font-semibold text-[color:var(--foreground)]">
                    {billingData.aiCredits ? `${billingData.aiCredits.remaining}/${billingData.aiCredits.totalCredits}` : '—'}
                  </p>
                  <p className="text-[11px] text-[color:var(--muted-foreground)]">
                    period ends {formatDate(billingData.aiCredits?.periodEnd)}
                  </p>
                </div>
              </div>
              <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--background)]/60 p-3">
                <p className="text-[12px] font-semibold text-[color:var(--foreground)]">Burn eligibility</p>
                <p className={`text-[12px] ${billingData.burnEligibility.isEligible ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {billingData.burnEligibility.isEligible ? 'Eligible to burn today' : `Blocked: ${billingData.burnEligibility.reason || 'unknown reason'}`}
                </p>
                <p className="text-[11px] text-[color:var(--muted-foreground)]">
                  Last burn at {formatDate(billingData.burnEligibility.lastBurnAt)}
                </p>
              </div>
              <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--background)]/60 p-3 flex items-center justify-between text-[12px]">
                <div>
                  <p className="font-semibold text-[color:var(--foreground)]">Stripe sync</p>
                  <p className="text-[color:var(--muted-foreground)]">
                    {billingData.sync.statusMatch ? 'Stripe + DB are aligned' : 'Status mismatch'}
                  </p>
                </div>
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full border text-[11px] ${billingData.sync.workspaceLocked ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  }`}>
                  {billingData.sync.workspaceLocked ? 'Locked' : 'Unlocked'}
                </span>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">Raw debug payload</p>
                <p className="text-[12px] text-[color:var(--muted-foreground)]">Use this when syncing with Stripe support.</p>
              </div>
              <button
                onClick={() => setShowRaw((prev) => !prev)}
                className="inline-flex items-center gap-1 rounded-full border border-[color:var(--border)] bg-[color:var(--background)]/70 px-3 py-1.5 text-[12px] hover:bg-[color:var(--accent)]/60 transition"
              >
                {showRaw ? 'Hide raw JSON' : 'Show raw JSON'}
              </button>
            </div>
            {showRaw && (
              <pre className="text-[11px] whitespace-pre-wrap bg-[color:var(--background)]/80 rounded-xl border border-[color:var(--border)] px-3 py-3 overflow-x-auto">
                {JSON.stringify(billingData, null, 2)}
              </pre>
            )}
          </section>
        </>
      )}

      <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] overflow-hidden">
        <div className="px-4 py-3 border-b border-[color:var(--border)] bg-[color:var(--muted)]/30">
          <h3 className="text-[14px] font-semibold text-[color:var(--foreground)]">All Workspaces Overview</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="bg-[color:var(--muted)]/20 text-[color:var(--muted-foreground)] text-[11px] uppercase tracking-wider text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Workspace</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Day Credits (Used/Total)</th>
                <th className="px-4 py-3 font-medium">AI Credits (Used/Total)</th>
                <th className="px-4 py-3 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--border)]">
              {clientsLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-[color:var(--muted-foreground)]">
                    Loading workspaces...
                  </td>
                </tr>
              ) : clients?.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-[color:var(--muted-foreground)]">
                    No workspaces found.
                  </td>
                </tr>
              ) : (
                clients?.map((client) => (
                  <tr key={client.id} className="hover:bg-[color:var(--muted)]/10 transition">
                    <td className="px-4 py-3 font-medium text-[color:var(--foreground)]">
                      {client.name}
                      <span className="block text-[11px] text-[color:var(--muted-foreground)] font-normal">{client.slug}</span>
                    </td>
                    <td className="px-4 py-3 text-[color:var(--muted-foreground)]">{client.planCode}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] border ${client.subscriptionStatus === 'ACTIVE'
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                          : client.subscriptionStatus === 'PAUSED'
                            ? 'bg-amber-50 border-amber-200 text-amber-700'
                            : 'bg-red-50 border-red-200 text-red-700'
                        }`}>
                        {client.subscriptionStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[color:var(--foreground)]">
                      {client.dayCredits ? `${client.dayCredits.used} / ${client.dayCredits.total}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-[color:var(--foreground)]">
                      {client.aiCredits ? `${client.aiCredits.used} / ${client.aiCredits.total}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => {
                          setWorkspaceId(client.id);
                          // Ideally scroll to top or trigger load
                          // handleLoad is dependent on workspaceId state which is async
                          // So we just set it, and the user can click "Inspect" or we can useEffect
                        }}
                        className="text-[11px] font-medium text-[color:var(--primary)] hover:underline"
                      >
                        Select
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
