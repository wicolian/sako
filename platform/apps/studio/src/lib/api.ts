// API client functions for Sako client app

import { apiFetch } from "./http";
import {
  Task,
  TaskCategory,
  TaskStatus,
  TaskComment,
  CommentKind,
  Brand,
  Workspace,
  SubscriptionSummary,
  AuthResponse,
  CurrentUser,
  PendingAdminUser,
  StudioUserRole,
} from "./types";

interface WorkspaceApiResponse {
  workspace: {
    id: string;
    name: string;
    slug: string;
    timezone: string;
  };
  plan: Workspace["plan"];
  subscription: Workspace["subscription"];
  derived: {
    activeTaskLimit: number;
    effectiveSlaSeconds: number;
  };
  counts: {
    activeTasks: number;
    queuedTasks: number;
  };
  credits: {
    dayCredits: Array<{
      total: number;
      used: number;
      remaining: number;
      periodEnd: string;
    }>;
    aiCredits: Array<{
      total: number;
      used: number;
      remaining: number;
      periodEnd: string;
    }>;
  };
}

// ========================================
// AUTH
// ========================================

export interface LoginPayload {
  email: string;
  workspaceSlug: string;
  name?: string;
  password?: string;
}

export async function login(payload: LoginPayload): Promise<AuthResponse> {
  return apiFetch<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
    skipAuth: true,
    skipWorkspace: true,
  });
}

// ========================================
// USER
// ========================================

export async function fetchCurrentUser(): Promise<CurrentUser> {
  return apiFetch<CurrentUser>("/users/me");
}

// ========================================
// WORKSPACE
// ========================================

export async function fetchWorkspace(): Promise<Workspace> {
  const response = await apiFetch<WorkspaceApiResponse>("/workspace/me");
  const latestDayCredit = response.credits.dayCredits[0];
  const latestAiCredit = response.credits.aiCredits[0];

  return {
    id: response.workspace.id,
    name: response.workspace.name,
    plan: response.plan?.name ?? response.subscription?.planCode ?? "Plan",
    dayCredits: latestDayCredit ? latestDayCredit.remaining : 0,
    dayCreditsTotal: latestDayCredit ? latestDayCredit.total : 0,
    aiCredits: latestAiCredit ? latestAiCredit.remaining : 0,
    aiCreditsTotal: latestAiCredit ? latestAiCredit.total : 0,
    activeSlots: response.derived.activeTaskLimit,
    billingPeriodStart: latestDayCredit?.periodEnd ?? "",
    billingPeriodEnd: latestDayCredit?.periodEnd ?? "",
  };
}

export async function fetchBrandOptions(): Promise<Array<{
  id: string;
  name: string;
  toneTags: string[];
  primaryColor?: string;
}>> {
  return apiFetch("/workspace/brands/options");
}

// ========================================
// TASKS
// ========================================

export interface TaskQueryParams {
  status?: TaskStatus;
  search?: string;
  limit?: number;
  cursor?: string;
}

export interface PaginatedTasksResponse {
  items: Task[];
  nextCursor: string | null;
  hasMore: boolean;
}

export async function fetchTasks(params?: TaskQueryParams): Promise<Task[]> {
  const query = new URLSearchParams();
  if (params?.status) query.set("status", params.status);
  if (params?.search) query.set("search", params.search);
  if (params?.limit) query.set("limit", params.limit.toString());
  if (params?.cursor) query.set("cursor", params.cursor);

  const queryString = query.toString();
  const response = await apiFetch<PaginatedTasksResponse>(`/tasks${queryString ? `?${queryString}` : ""}`);
  // Return just the items array for backward compatibility
  return response.items;
}

export async function fetchTask(id: string): Promise<Task> {
  // Studio view can fetch cross-workspace without x-workspace-id
  return apiFetch<Task>(`/studio/tasks/${id}`, { skipWorkspace: true });
}

export interface CreateTaskPayload {
  title: string;
  description: string;
  category: TaskCategory;
  brandId?: string;
  useAI?: boolean;
}

export async function createTask(payload: CreateTaskPayload): Promise<Task> {
  return apiFetch<Task>("/tasks", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export interface UpdateTaskPayload {
  title?: string;
  description?: string;
  category?: TaskCategory;
  brandId?: string;
}

export async function updateTask(
  id: string,
  payload: UpdateTaskPayload
): Promise<Task> {
  return apiFetch<Task>(`/tasks/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function completeTask(id: string): Promise<Task> {
  return apiFetch<Task>(`/tasks/${id}/complete`, {
    method: "POST",
  });
}

// ========================================
// TASK COMMENTS
// ========================================

export interface CreateCommentPayload {
  body: string;
  kind?: CommentKind;
}

export async function addTaskComment(
  taskId: string,
  payload: CreateCommentPayload
): Promise<TaskComment> {
  return apiFetch<TaskComment>(`/tasks/${taskId}/comments`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchTaskComments(
  taskId: string,
  kind?: CommentKind
): Promise<TaskComment[]> {
  const query = kind ? `?kind=${kind}` : "";
  return apiFetch<TaskComment[]>(`/tasks/${taskId}/comments${query}`);
}

// ========================================
// BRANDS
// ========================================

export async function fetchBrands(): Promise<Brand[]> {
  return apiFetch<Brand[]>("/brands");
}

export async function fetchBrand(id: string): Promise<Brand> {
  return apiFetch<Brand>(`/brands/${id}`);
}

export interface CreateBrandPayload {
  name: string;
  colorsJson?: any;
  typographyJson?: any;
  toneTags?: string[];
  guidelines?: string;
}

export async function createBrand(payload: CreateBrandPayload): Promise<Brand> {
  return apiFetch<Brand>("/brands", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export interface UpdateBrandPayload {
  name?: string;
  colorsJson?: any;
  typographyJson?: any;
  toneTags?: string[];
  guidelines?: string;
}

export async function updateBrand(
  id: string,
  payload: UpdateBrandPayload
): Promise<Brand> {
  return apiFetch<Brand>(`/brands/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteBrand(id: string): Promise<void> {
  return apiFetch<void>(`/brands/${id}`, {
    method: "DELETE",
  });
}

// ========================================
// SUBSCRIPTION
// ========================================

export async function fetchSubscriptionSummary(): Promise<SubscriptionSummary> {
  return apiFetch<SubscriptionSummary>("/subscription");
}

export interface PauseSubscriptionPayload {
  reason?: string;
}

export async function pauseSubscription(
  payload: PauseSubscriptionPayload
): Promise<SubscriptionSummary> {
  return apiFetch<SubscriptionSummary>("/subscription/pause", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export interface ResumeSubscriptionPayload {
  note?: string;
}

export async function resumeSubscription(
  payload: ResumeSubscriptionPayload
): Promise<SubscriptionSummary> {
  return apiFetch<SubscriptionSummary>("/subscription/resume", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export interface CancelSubscriptionPayload {
  reason?: string;
}

export async function cancelSubscription(
  payload: CancelSubscriptionPayload
): Promise<SubscriptionSummary> {
  return apiFetch<SubscriptionSummary>("/subscription/cancel", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export interface UncancelSubscriptionPayload {
  note?: string;
}

export async function uncancelSubscription(
  payload: UncancelSubscriptionPayload
): Promise<SubscriptionSummary> {
  return apiFetch<SubscriptionSummary>("/subscription/uncancel", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ========================================
// STUDIO (Admin)
// ========================================

export interface StudioClient {
  id: string;
  name: string;
  slug: string;
  planCode: string;
  subscriptionStatus: string;
  activeTaskCount: number;
  queuedTaskCount: number;
  dayCredits?: {
    used: number;
    total: number;
  } | null;
  aiCredits?: {
    used: number;
    total: number;
  } | null;
}

export interface StudioClientDetail {
  workspace: {
    id: string;
    name: string;
    slug: string;
    timezone: string;
  };
  plan?: {
    id?: string;
    name?: string;
    code?: string;
    activeTaskLimit?: number;
  } | null;
  subscription?: {
    id?: string;
    status?: string;
    planCode?: string;
    activeTaskLimit?: number | null;
    slaSeconds?: number | null;
  } | null;
  credits?: {
    dayCredits: Array<{
      total: number;
      used: number;
      remaining: number;
      periodEnd: string;
    }>;
    aiCredits: Array<{
      total: number;
      used: number;
      remaining: number;
      periodEnd: string;
    }>;
  };
  taskCounts: {
    queued: number;
    inProgress: number;
    inReview: number;
    completed: number;
    paused: number;
  };
  recentTasks: Task[];
}

export async function fetchStudioClients(): Promise<StudioClient[]> {
  return apiFetch<StudioClient[]>("/studio/clients", { skipWorkspace: true });
}

export async function fetchStudioClientDetail(
  workspaceId: string
): Promise<StudioClientDetail> {
  return apiFetch<StudioClientDetail>(`/studio/clients/${workspaceId}`, { skipWorkspace: true });
}

export async function fetchStudioTasks(): Promise<Task[]> {
  return apiFetch<Task[]>("/studio/tasks", { skipWorkspace: true });
}

export interface StudioMetrics {
  tasksCompletedLast30Days: number;
  averageTurnaroundHours: number | null;
  firstPassAcceptanceRate: number | null;
}

export async function fetchStudioMetrics(): Promise<StudioMetrics> {
  return apiFetch<StudioMetrics>("/studio/metrics", { skipWorkspace: true });
}

export async function adminStartTask(taskId: string, workspaceId?: string): Promise<void> {
  return apiFetch<void>(`/admin/tasks/${taskId}/start`, {
    method: "POST",
    workspaceIdOverride: workspaceId,
  });
}

export async function adminMoveToReview(taskId: string, workspaceId?: string): Promise<void> {
  return apiFetch<void>(`/admin/tasks/${taskId}/review`, {
    method: "POST",
    workspaceIdOverride: workspaceId,
  });
}

export async function adminBurnCredits(): Promise<any> {
  return apiFetch<any>("/admin/credits/burn", {
    method: "POST",
  });
}

export interface BillingDebug {
  workspace: {
    id: string;
    name?: string | null;
    slug?: string | null;
  };
  subscription: {
    id: string;
    status: string;
    planCode: string;
    mode?: string | null;
    stripeSubscriptionId?: string | null;
    billingPeriodStart?: string | null;
    billingPeriodEnd?: string | null;
    cancelAt?: string | null;
    lastDayCreditBurnAt?: string | null;
    activeTaskLimit?: number | null;
    slaSeconds?: number | null;
  };
  dayCredits: {
    id: string;
    totalCredits: number;
    usedCredits: number;
    remaining: number;
    periodStart: string;
    periodEnd: string;
  } | null;
  aiCredits: {
    id: string;
    totalCredits: number;
    usedCredits: number;
    remaining: number;
    periodStart: string;
    periodEnd: string;
  } | null;
  burnEligibility: {
    isEligible: boolean;
    reason?: string;
    lastBurnAt?: string | null;
  };
  stripe: {
    id?: string;
    status?: string;
    currentPeriodStart?: string;
    currentPeriodEnd?: string;
    cancelAt?: string | null;
  } | null;
  sync: {
    hasStripeId: boolean;
    statusMatch: boolean;
    hasDayCredits: boolean;
    hasAiCredits: boolean;
    workspaceLocked: boolean;
  };
}

export async function fetchBillingDebug(
  workspaceId: string
): Promise<BillingDebug> {
  return apiFetch<BillingDebug>(`/stripe/debug/${workspaceId}`);
}

// ========================================
// ADMIN APPROVALS
// ========================================

export interface AdminApprovalResponse {
  success?: boolean;
  message?: string;
  user?: {
    id: string;
    email: string;
    name?: string | null;
    role: StudioUserRole;
  };
  error?: string;
}

export async function fetchPendingAdmins(): Promise<PendingAdminUser[]> {
  const pending = await apiFetch<Array<Omit<PendingAdminUser, "role">>>("/admin/pending-admins");
  return pending.map((user) => ({ ...user, role: "PENDING_ADMIN" }));
}

export async function approvePendingAdmin(userId: string): Promise<AdminApprovalResponse> {
  return apiFetch<AdminApprovalResponse>(`/admin/approve-admin/${userId}`, {
    method: "POST",
  });
}

export async function rejectPendingAdmin(userId: string): Promise<AdminApprovalResponse> {
  return apiFetch<AdminApprovalResponse>(`/admin/reject-admin/${userId}`, {
    method: "POST",
  });
}

// ========================================
// STUDIO AI INSIGHTS
// ========================================

export interface StudioAiSummary {
  totalTasks: number;
  tasksWithStructuredBrief: number;
  percentWithStructuredBrief: number;
  assetTypeBreakdown: Array<{ primaryAssetType: string; count: number }>;
  avgRevisionCount: number;
  estimatorStats: {
    sampleSize: number;
    averageEstimatedEffortHours: number;
    averageActualTurnaroundHours: number;
    averageAbsoluteErrorHours: number;
  };
}

export interface StudioAiEstimate {
  snapshotId: string;
  taskId: string | null;
  workspaceName: string;
  brandName: string | null;
  goal?: string;
  audience?: string;
  primaryAssetType?: string;
  estimatedEffortHours: number;
  actualTurnaroundHours?: number;
  revisionCount?: number;
  createdAt: string;
}

export async function fetchStudioAiSummary(): Promise<StudioAiSummary> {
  return apiFetch<StudioAiSummary>("/studio/ai/tasks-summary");
}

export async function fetchStudioAiEstimates(): Promise<StudioAiEstimate[]> {
  return apiFetch<StudioAiEstimate[]>("/studio/ai/recent-estimates");
}

// Note: Composer generation is now handled by the external sako-composer app.
// The gateway API routes (/composer/capabilities, /composer/brands, /composer/tasks/from-draft)
// are used by the external Composer app, not by this Studio app.
