import React, { useMemo } from "react";
import { Icon } from "./Icon";
import { useStudioClientDetail } from "../lib/hooks";

interface AdminClientDetailProps {
  workspaceId: string;
  onNavigate: (route: string) => void;
}

const subscriptionBadge: Record<
  string,
  { label: string; className: string }
> = {
  ACTIVE: {
    label: "Active",
    className: "bg-emerald-100 border border-emerald-300 text-emerald-700",
  },
  PAUSED: {
    label: "Paused",
    className: "bg-amber-100 border border-amber-300 text-amber-800",
  },
  CANCELED: {
    label: "Canceled",
    className: "bg-red-100 border border-red-300 text-red-700",
  },
  PAST_DUE: {
    label: "Past due",
    className: "bg-orange-100 border border-orange-300 text-orange-700",
  },
};

const taskStatusPills: Record<string, { label: string; className: string }> = {
  QUEUED: {
    label: "Queued",
    className: "bg-[color:var(--muted)]/60 text-[color:var(--foreground)]",
  },
  IN_PROGRESS: {
    label: "In progress",
    className: "bg-[color:var(--primary)]/15 text-[color:var(--primary)]",
  },
  IN_REVIEW: {
    label: "In review",
    className: "bg-amber-100 text-amber-800",
  },
  COMPLETED: {
    label: "Completed",
    className: "bg-emerald-100 text-emerald-800",
  },
  PAUSED: {
    label: "Paused",
    className: "bg-neutral-200 text-neutral-700",
  },
};

const formatDate = (value?: string) => {
  if (!value) return "N/A";
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
};

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export const AdminClientDetail: React.FC<AdminClientDetailProps> = ({
  workspaceId,
  onNavigate,
}) => {
  const { data, loading, error, refetch } = useStudioClientDetail(workspaceId);

  // Always compute recentTasks/brandChips via hooks BEFORE any early returns,
  // so the hook order stays consistent between renders.
  const recentTasks = data?.recentTasks ?? [];

  const brandChips = useMemo(() => {
    const counts = new Map<string, number>();
    recentTasks.forEach((task) => {
      if (task.brand?.name) {
        counts.set(task.brand.name, (counts.get(task.brand.name) || 0) + 1);
      }
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, count]) => ({ name, count }));
  }, [recentTasks]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-[13px] text-[color:var(--muted-foreground)]">
        Loading client…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
        <p className="text-[13px] text-red-400">
          {error?.message || "Client not found."}
        </p>
        <button
          onClick={() => refetch()}
          className="inline-flex items-center gap-1 px-4 py-2 rounded-full border border-[color:var(--border)] text-[12px] text-[color:var(--foreground)] hover:bg-[color:var(--accent)]"
        >
          <Icon name="loader" className="h-3.5 w-3.5" />
          Retry
        </button>
      </div>
    );
  }

  const { workspace, plan, subscription, taskCounts, credits } = data;

  const planLabel = plan?.name ?? subscription?.planCode ?? "Plan";
  const statusMeta =
    subscriptionBadge[subscription?.status ?? ""] ??
    subscriptionBadge.ACTIVE;
  const activeSlots =
    subscription?.activeTaskLimit ?? plan?.activeTaskLimit ?? 0;

  const dayCredit = credits?.dayCredits?.[0];
  const aiCredit = credits?.aiCredits?.[0];

  const inProgressTasks =
    recentTasks.filter((task) => task.status === "IN_PROGRESS") ?? [];
  const inReviewTasks =
    recentTasks.filter((task) => task.status === "IN_REVIEW") ?? [];

  return (
    <div className="max-w-[1600px] mx-auto px-6 py-6 space-y-6">
      <button
        onClick={() => onNavigate("/studio/clients")}
        className="inline-flex items-center gap-1 text-[12px] text-[color:var(--muted-foreground)] hover:text-[color:var(--primary)]"
      >
        <Icon name="chevron-right" className="h-3 w-3 rotate-180" />
        Back to clients
      </button>

      <header className="bg-[color:var(--card)] border border-[color:var(--border)] rounded-xl p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-[color:var(--primary)] text-[color:var(--primary-foreground)] font-bold flex items-center justify-center">
              {workspace.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h1 className="text-[20px] font-semibold text-[color:var(--foreground)]">
                {workspace.name}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-[color:var(--accent)] text-[11px] text-[color:var(--accent-foreground)] uppercase tracking-wide">
                  {planLabel}
                </span>
                <span
                  className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] ${statusMeta.className}`}
                >
                  {statusMeta.label}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[color:var(--accent)] border border-[color:var(--border)] text-[12px] text-[color:var(--foreground)] hover:bg-[color:var(--accent)]/80 transition"
          >
            <Icon name="loader" className="h-3.5 w-3.5" />
            Refresh data
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[12px]">
          {[
            { label: "Queued", value: taskCounts.queued },
            { label: "In progress", value: taskCounts.inProgress },
            { label: "In review", value: taskCounts.inReview },
            { label: "Completed", value: taskCounts.completed },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-lg border border-[color:var(--border)] bg-[color:var(--background)]/60 px-3 py-2"
            >
              <p className="uppercase text-[10px] tracking-[0.16em] text-[color:var(--muted-foreground)]">
                {stat.label}
              </p>
              <p className="text-[18px] font-semibold text-[color:var(--foreground)]">
                {stat.value}
              </p>
            </div>
          ))}
        </div>
      </header>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_360px] gap-6">
        <div className="space-y-6">
          <div className="bg-[color:var(--card)] border border-[color:var(--border)] rounded-xl p-5 space-y-4">
            <h3 className="text-[14px] font-semibold text-[color:var(--foreground)]">
              Subscription & credits
            </h3>

            <div className="grid grid-cols-2 gap-4 text-[12px]">
              <div>
                <p className="text-[color:var(--muted-foreground)] text-[11px] mb-1">Active slots</p>
                <p className="text-[color:var(--foreground)] font-medium">{activeSlots}</p>
              </div>
              <div>
                <p className="text-[color:var(--muted-foreground)] text-[11px] mb-1">Timezone</p>
                <p className="text-[color:var(--foreground)] font-medium">
                  {workspace.timezone}
                </p>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2 text-[11px] text-[color:var(--muted-foreground)]">
                <span>Day credits</span>
                <span className="text-[color:var(--foreground)]">
                  {dayCredit
                    ? `${dayCredit.remaining} / ${dayCredit.total}`
                    : "N/A"}
                </span>
              </div>
              <div className="h-2 bg-[color:var(--muted)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[color:var(--primary)]"
                  style={{
                    width: `${dayCredit?.total ? (dayCredit.remaining / dayCredit.total) * 100 : 0}%`,
                  }}
                />
              </div>
              {dayCredit && (
                <p className="text-[10px] text-[color:var(--muted-foreground)] mt-1">
                  Renews {formatDate(dayCredit.periodEnd)}
                </p>
              )}
            </div>

            <div className="pt-3 border-t border-dashed border-[color:var(--border)]">
              <div className="flex items-center justify-between mb-2 text-[11px] text-[color:var(--muted-foreground)]">
                <span>AI credits</span>
                <span className="text-[color:var(--foreground)]">
                  {aiCredit
                    ? `${aiCredit.remaining} / ${aiCredit.total}`
                    : "N/A"}
                </span>
              </div>
              <div className="h-2 bg-[color:var(--muted)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[color:var(--primary)]/70"
                  style={{
                    width: `${aiCredit?.total ? (aiCredit.remaining / aiCredit.total) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          </div>

          <TaskListSection
            title="Active tasks"
            subtitle={`${inProgressTasks.length} in progress`}
            tasks={inProgressTasks}
            onNavigate={onNavigate}
          />

          <TaskListSection
            title="In review"
            subtitle={`${inReviewTasks.length} awaiting approval`}
            tasks={inReviewTasks}
            onNavigate={onNavigate}
            highlight="review"
          />

          {brandChips.length > 0 && (
            <div className="bg-[color:var(--card)] border border-[color:var(--border)] rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-[14px] font-semibold text-[color:var(--foreground)]">
                  Brands appearing in recent work
                </h3>
                <span className="text-[11px] text-[color:var(--muted-foreground)]">
                  {brandChips.length} brands
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {brandChips.map((brand) => (
                  <span
                    key={brand.name}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[color:var(--accent)] border border-[color:var(--border)] text-[11px] text-[color:var(--accent-foreground)]"
                  >
                    {brand.name}
                    <span className="text-[color:var(--primary)] text-[10px]">
                      {brand.count}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-[color:var(--card)] border border-[color:var(--border)] rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[14px] font-semibold text-[color:var(--foreground)]">
                Recent activity
              </h3>
              <span className="text-[11px] text-[color:var(--muted-foreground)]">
                Last {Math.min(recentTasks.length, 4)} events
              </span>
            </div>
            <div className="space-y-3">
              {(recentTasks ?? []).slice(0, 4).map((task) => {
                const meta =
                  taskStatusPills[task.status] || taskStatusPills.QUEUED;
                return (
                  <div key={task.id} className="flex gap-3">
                    <div className="h-6 w-6 rounded-full bg-[color:var(--muted)] flex items-center justify-center flex-shrink-0">
                      <Icon name="check" className="h-3 w-3 text-[color:var(--primary)]" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[12px] text-[color:var(--foreground)]">
                        {task.title}
                      </p>
                      <p className="text-[11px] text-[color:var(--muted-foreground)]">
                        {task.brand?.name ?? "No brand"} ·{" "}
                        {formatDateTime(task.updatedAt)}
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] ${meta.className}`}
                    >
                      {meta.label}
                    </span>
                  </div>
                );
              })}
              {(!recentTasks || recentTasks.length === 0) && (
                <p className="text-[11px] text-[color:var(--muted-foreground)] text-center py-4">
                  No recent activity recorded.
                </p>
              )}
            </div>
          </div>


          <div className="bg-[color:var(--card)] border border-[color:var(--border)] rounded-xl p-5 space-y-2">
            <h3 className="text-[14px] font-semibold text-[color:var(--foreground)] mb-3">
              Quick actions
            </h3>
            <button
              onClick={() => onNavigate(`/studio/billing?workspaceId=${workspaceId}`)}
              className="w-full inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[color:var(--accent)] border border-[color:var(--border)] text-[12px] text-[color:var(--accent-foreground)] hover:bg-[color:var(--accent)]/80 transition"
            >
              <Icon name="credit-card" className="h-3.5 w-3.5" />
              View billing
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface TaskListSectionProps {
  title: string;
  subtitle: string;
  tasks: any[];
  highlight?: "review";
  onNavigate: (route: string) => void;
}

const TaskListSection: React.FC<TaskListSectionProps> = ({
  title,
  subtitle,
  tasks,
  highlight,
  onNavigate,
}) => (
  <div className="bg-[#1a1a1a] border border-[#2d2d2d] rounded-xl p-5 space-y-3">
    <div className="flex items-center justify-between">
      <h3 className="text-[14px] font-semibold text-neutral-50">{title}</h3>
      <span className="text-[11px] text-[#afafaf]">{subtitle}</span>
    </div>
    <div className="space-y-2">
      {tasks.map((task) => (
        <div
          key={task.id}
          onClick={() => onNavigate(`/studio/tasks/${task.id}`)}
          className={`flex items-center justify-between bg-[color:var(--card)] border border-[color:var(--border)] rounded-lg p-3 transition cursor-pointer ${highlight === "review" ? "hover:border-amber-500" : "hover:border-[color:var(--ring)]"
            }`}
        >
          <div className="flex-1 min-w-0">
            <p className="text-[12px] text-neutral-50 mb-1 truncate">
              {task.title}
            </p>
            <div className="flex items-center gap-2 text-[10px] text-[#afafaf]">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#3d3d3d] text-neutral-50 capitalize">
                {task.category?.toLowerCase()}
              </span>
              {task.brand?.name && (
                <span className="text-[#afafaf]">{task.brand.name}</span>
              )}
            </div>
          </div>
          <Icon
            name={highlight === "review" ? "info" : "external-link"}
            className={`h-4 w-4 ${highlight === "review" ? "text-amber-400" : "text-[#9ae83e]"
              } flex-shrink-0`}
          />
        </div>
      ))}
      {tasks.length === 0 && (
        <div className="text-center py-6">
          <Icon
            name={highlight === "review" ? "check" : "info"}
            className="h-8 w-8 text-[#3d3d3d] mx-auto mb-2"
          />
          <p className="text-[11px] text-[#afafaf]">
            {highlight === "review"
              ? "Nothing awaiting review"
              : "No tasks in this lane"}
          </p>
        </div>
      )}
    </div>
  </div>
);


