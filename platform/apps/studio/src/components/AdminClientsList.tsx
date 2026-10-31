import React from "react";
import { Icon } from "./Icon";
import { useStudioClients } from "../lib/hooks";

interface AdminClientsListProps {
  onNavigate: (route: string) => void;
}

const statusStyles: Record<
  string,
  { label: string; className: string }
> = {
  ACTIVE: {
    label: "Active",
    className: "bg-emerald-50 border-emerald-200 text-emerald-800",
  },
  PAUSED: {
    label: "Paused",
    className: "bg-amber-50 border-amber-200 text-amber-800",
  },
  CANCELED: {
    label: "Canceled",
    className: "bg-red-50 border-red-200 text-red-800",
  },
  PAST_DUE: {
    label: "Past due",
    className: "bg-orange-50 border-orange-200 text-orange-800",
  },
};

export const AdminClientsList: React.FC<AdminClientsListProps> = ({
  onNavigate,
}) => {
  const { data: clients, loading, error, refetch } = useStudioClients();
  const [statusFilter, setStatusFilter] = React.useState<string>("all");

  const filteredClients = React.useMemo(() => {
    if (!clients) return [];
    if (statusFilter === "all") return clients;
    return clients.filter(
      (client) => client.subscriptionStatus === statusFilter
    );
  }, [clients, statusFilter]);

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-8">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">
            Studio
          </p>
          <h2 className="text-[22px] tracking-tight font-semibold">Clients</h2>
        </div>
        <button
          onClick={() => refetch()}
          className="inline-flex items-center px-4 py-2 rounded-full bg-[color:var(--card)] text-[color:var(--foreground)] text-[13px] font-medium border border-[color:var(--border)] hover:bg-[color:var(--accent)] transition"
        >
          <Icon name="loader" className="h-4 w-4 mr-1.5" />
          Refresh
        </button>
      </header>

      <div className="flex items-center gap-3 mb-4 text-[12px]">
        <div className="inline-flex items-center rounded-full bg-[color:var(--card)] border border-[color:var(--border)] p-1">
          {[
            { id: "all", label: "All" },
            { id: "ACTIVE", label: "Active" },
            { id: "PAUSED", label: "Paused" },
            { id: "CANCELED", label: "Canceled" },
          ].map((filter) => (
            <button
              key={filter.id}
              onClick={() => setStatusFilter(filter.id)}
              className={`px-3 py-1.5 rounded-full transition ${
                statusFilter === filter.id
                  ? "bg-[color:var(--background)] font-medium text-[color:var(--foreground)] shadow-sm"
                  : "text-[color:var(--muted-foreground)] hover:bg-[color:var(--accent)]/60"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] shadow-sm">
        <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-4 px-4 py-2 border-b border-[color:var(--border)] bg-[color:var(--background)]/60 text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
          <span>Client</span>
          <span>Plan</span>
          <span>Queued</span>
          <span>Active</span>
          <span>Status</span>
        </div>

        {loading ? (
          <div className="px-4 py-12 text-center text-[13px] text-neutral-500">
            Loading clients…
          </div>
        ) : error ? (
          <div className="px-4 py-12 text-center text-[13px] text-red-500">
            Failed to load clients.{" "}
            <button
              onClick={() => refetch()}
              className="text-[color:var(--primary)] underline-offset-2 underline"
            >
              Retry
            </button>
          </div>
        ) : filteredClients.length === 0 ? (
          <div className="px-4 py-12 text-center text-[13px] text-neutral-500">
            No clients match this filter.
          </div>
        ) : (
          <div className="divide-y divide-[color:var(--border)]">
            {filteredClients.map((client) => {
              const status = statusStyles[client.subscriptionStatus] || {
                label: client.subscriptionStatus,
                className: "bg-neutral-200 border-neutral-300 text-neutral-700",
              };

              return (
                <div
                  key={client.id}
                  onClick={() => onNavigate(`/studio/clients/${client.id}`)}
                className="px-4 py-3 hover:bg-[color:var(--accent)] transition cursor-pointer grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-4 items-center text-[13px]"
                >
                  <div>
                    <p className="font-medium text-[color:var(--foreground)]">{client.name}</p>
                    <p className="text-[12px] text-neutral-500 md:hidden">
                      {client.planCode} · {client.activeTaskCount} active
                    </p>
                  </div>
                  <div className="hidden md:block text-neutral-600 uppercase tracking-wide text-[12px]">
                    {client.planCode}
                  </div>
                  <div className="hidden md:block text-neutral-600">
                    {client.queuedTaskCount} queued
                  </div>
                  <div className="hidden md:block text-neutral-600">
                    {client.activeTaskCount} active
                  </div>
                  <div>
                    <span
                      className={`inline-flex items-center h-6 px-3 rounded-full text-[11px] border ${status.className}`}
                    >
                      {status.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
