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
  TaskEstimatorResponse,
  AuthResponse,
  Attachment,
  StructuredBrief,
} from "./types";

interface WorkspaceApiResponse {
  workspace: {
    id: string;
    name: string;
    slug: string;
    timezone: string;
    hasOnboarded?: boolean;
    createdAt: string;
    updatedAt: string;
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
  currentDayCredit: {
    total: number;
    used: number;
    remaining: number;
    periodStart: string;
    periodEnd: string;
  } | null;
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
// WORKSPACE
// ========================================

export async function fetchWorkspaceList(): Promise<Array<{ id: string; name: string; slug: string; role: string }>> {
  return apiFetch("/workspace/list", {
    skipWorkspace: true,
  });
}

// ========================================
// USER (ME)
// ========================================

export interface MeWorkspace {
  id: string;
  name: string;
  slug: string;
  role: 'OWNER' | 'SUBMITTER' | 'MEMBER' | 'VIEWER';
}

export interface MeResponse {
  id: string;
  email: string;
  name?: string;
  role: 'CLIENT' | 'PENDING_ADMIN' | 'ADMIN';
  isSuperAdmin: boolean;
  workspaces: MeWorkspace[];
}

export async function fetchMe(): Promise<MeResponse> {
  return apiFetch<MeResponse>("/users/me", {
    skipWorkspace: true,
  });
}

export async function fetchWorkspace(): Promise<Workspace> {
  const response = await apiFetch<WorkspaceApiResponse>("/workspace/me", {
    // Do NOT skip workspace header here, so we can request a specific one if set in localStorage
    // skipWorkspace: true, 
    // Actually, apiFetch injects the header automatically if it's not skipped.
    // So removing skipWorkspace: true will allow the header to be sent.
  });

  const currentDayCredit = response.currentDayCredit || response.credits.dayCredits[0];
  const latestAiCredit = response.credits.aiCredits[0];

  return {
    id: response.workspace.id,
    name: response.workspace.name,
    slug: response.workspace.slug,
    timezone: response.workspace.timezone,
    hasOnboarded: response.workspace.hasOnboarded,
    createdAt: response.workspace.createdAt,
    updatedAt: response.workspace.updatedAt,
    plan: response.plan ?? undefined,
    subscription: response.subscription ?? undefined,
    effectiveActiveTaskLimit: response.derived.activeTaskLimit,
    effectiveSlaSeconds: response.derived.effectiveSlaSeconds,
    taskCounts: {
      total: response.counts.activeTasks + response.counts.queuedTasks,
      queued: response.counts.queuedTasks,
      inProgress: response.counts.activeTasks,
      inReview: 0,
      completed: 0,
    },
    dayCredit: currentDayCredit
      ? {
        id: `${response.workspace.id}-day-credit`,
        workspaceId: response.workspace.id,
        totalCredits: currentDayCredit.total,
        usedCredits: currentDayCredit.used,
        periodStart: (currentDayCredit as any).periodStart || currentDayCredit.periodEnd, // Fallback if periodStart missing in legacy
        periodEnd: currentDayCredit.periodEnd,
      }
      : undefined,
    aiCredit: latestAiCredit
      ? {
        id: `${response.workspace.id}-ai-credit`,
        workspaceId: response.workspace.id,
        totalCredits: latestAiCredit.total,
        usedCredits: latestAiCredit.used,
        periodStart: (latestAiCredit as any).periodStart || latestAiCredit.periodEnd, // Legacy fallback
        periodEnd: latestAiCredit.periodEnd,
      }
      : undefined,
  };
}

export async function updateWorkspace(data: {
  name?: string;
  timezone?: string;
}): Promise<Workspace> {
  const response = await apiFetch<WorkspaceApiResponse>("/workspace/me", {
    method: "PATCH",
    body: JSON.stringify(data),
  });

  const currentDayCredit = response.currentDayCredit || response.credits.dayCredits[0];
  const latestAiCredit = response.credits.aiCredits[0];

  return {
    id: response.workspace.id,
    name: response.workspace.name,
    slug: response.workspace.slug,
    timezone: response.workspace.timezone,
    createdAt: response.workspace.createdAt,
    updatedAt: response.workspace.updatedAt,
    plan: response.plan,
    subscription: response.subscription,
    effectiveSlaSeconds: response.derived.effectiveSlaSeconds,
    activeTaskLimit: response.derived.activeTaskLimit,
    counts: {
      queued: response.counts.queuedTasks,
      inProgress: response.counts.activeTasks,
      inReview: 0,
      completed: 0,
    },
    dayCredit: currentDayCredit
      ? {
        id: `${response.workspace.id}-day-credit`,
        workspaceId: response.workspace.id,
        totalCredits: currentDayCredit.total,
        usedCredits: currentDayCredit.used,
        periodStart: (currentDayCredit as any).periodStart || currentDayCredit.periodEnd,
        periodEnd: currentDayCredit.periodEnd,
      }
      : undefined,
    aiCredit: latestAiCredit
      ? {
        id: `${response.workspace.id}-ai-credit`,
        workspaceId: response.workspace.id,
        totalCredits: latestAiCredit.total,
        usedCredits: latestAiCredit.used,
        periodStart: (latestAiCredit as any).periodStart || latestAiCredit.periodEnd,
        periodEnd: latestAiCredit.periodEnd,
      }
      : undefined,
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
  sort?: 'asc' | 'desc';
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
  if (params?.sort) query.set("sort", params.sort);

  const queryString = query.toString();
  const response = await apiFetch<PaginatedTasksResponse>(`/tasks${queryString ? `?${queryString}` : ""}`);
  // Return just the items array for backward compatibility
  return response.items;
}

export async function fetchTask(id: string): Promise<Task> {
  return apiFetch<Task>(`/tasks/${id}`);
}

export interface CreateTaskPayload {
  title: string;
  description: string;
  category: TaskCategory;
  brandId?: string;
  useAI?: boolean;
  structuredBriefJson?: StructuredBrief;
  referenceLinksJson?: any;
  deliverablesJson?: any;
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

export async function requestTaskRevision(taskId: string, feedback: string): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/tasks/${taskId}/request-revision`, {
    method: "POST",
    body: JSON.stringify({ feedback }),
  });
}

export async function deleteTask(id: string): Promise<void> {
  return apiFetch<void>(`/tasks/${id}`, {
    method: "DELETE",
  });
}

// ========================================
// TASK ATTACHMENTS
// ========================================

export async function uploadAttachment(taskId: string, file: File): Promise<Attachment> {
  const formData = new FormData();
  formData.append("file", file);

  return apiFetch<Attachment>(`/tasks/${taskId}/attachments`, {
    method: "POST",
    body: formData as any,
  });
}

export async function fetchAttachments(taskId: string): Promise<Attachment[]> {
  return apiFetch<Attachment[]>(`/tasks/${taskId}/attachments`);
}

export async function deleteAttachment(id: string): Promise<void> {
  return apiFetch<void>(`/attachments/${id}`, {
    method: "DELETE",
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
  description?: string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  notes?: string;
  colorsJson?: any;
  typographyJson?: any;
  brandProfileJson?: any;
  toneTags?: string[];
  voiceGuidelines?: string;
  guidelines?: string;
  logoUrl?: string;
  guidelineUrl?: string;
}

export async function updateBrand(
  id: string,
  payload: UpdateBrandPayload
): Promise<Brand> {
  // Pass payload directly - backend handles partial updates
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
// TASK ESTIMATOR
// ========================================

export interface EstimateTaskPayload {
  title: string;
  description: string;
  tags?: string[];
  category?: TaskCategory;
  brandId?: string;
  structuredBriefJson?: any;
}

export async function estimateTask(
  payload: EstimateTaskPayload
): Promise<TaskEstimatorResponse> {
  return apiFetch<TaskEstimatorResponse>("/tasks/estimate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ========================================
// STRIPE
// ========================================

export interface CreateCheckoutSessionPayload {
  planCode: string;
  billingInterval: 'MONTHLY' | 'YEARLY';
  successUrl: string;
  cancelUrl: string;
}

export async function createCheckoutSession(payload: CreateCheckoutSessionPayload): Promise<{ sessionId: string; url: string }> {
  return apiFetch<{ sessionId: string; url: string }>("/stripe/create-checkout-session", {
    method: "POST",
    body: JSON.stringify(payload),
    // Skip workspace header for new signups who don't have a workspace yet
    skipWorkspace: true,
  });
}

export async function createPortalSession(returnUrl?: string): Promise<{ url: string }> {
  return apiFetch<{ url: string }>("/stripe/create-portal-session", {
    method: "POST",
    body: JSON.stringify({ returnUrl }),
  });
}

// ========================================
// INTEGRATIONS
// ========================================

export async function startSlackOAuth(workspaceId: string): Promise<{ url: string }> {
  return apiFetch<{ url: string }>("/integrations/slack/oauth/start");
}

// Get Slack integration status
export async function getSlackStatus(): Promise<{
  connected: boolean;
  connectStatus?: 'CONNECTED' | 'NOT_CONNECTED' | 'CONNECT_PENDING';
  teamName?: string;
  defaultChannelId?: string;
  defaultChannelName?: string;
}> {
  return apiFetch('/integrations/slack/status');
}

// List available Slack channels
export async function listSlackChannels(params?: {
  cursor?: string;
  limit?: number;
}): Promise<{
  channels: Array<{ id: string; name: string; isPrivate: boolean; isMember?: boolean; isArchived?: boolean }>;
  nextCursor?: string;
  hasMore: boolean;
}> {
  const query = new URLSearchParams();
  if (params?.cursor) query.set('cursor', params.cursor);
  if (params?.limit) query.set('limit', params.limit.toString());
  return apiFetch(`/integrations/slack/channels?${query.toString()}`);
}

// Set default notification channel
export async function setSlackDefaultChannel(channelId: string): Promise<{
  success: boolean;
  channelId: string;
  channelName: string;
}> {
  return apiFetch('/integrations/slack/default-channel', {
    method: 'POST',
    body: JSON.stringify({ channelId }),
  });
}

// Send test message to configured channel
export async function sendSlackTestMessage(): Promise<{
  success: boolean;
  message?: string;
}> {
  return apiFetch('/integrations/slack/test', {
    method: 'POST',
  });
}

// ========================================
// METRICS
// ========================================

export interface WorkspaceMetrics {
  averageTurnaroundHours: number | null;
  tasksCompletedLast30Days: number;
  firstPassAcceptanceRate: number | null;
  revisionRate: number | null;
}

export async function fetchMetrics(): Promise<WorkspaceMetrics> {
  return apiFetch<WorkspaceMetrics>("/workspace/metrics", {
    method: "GET",
  });
}

// ========================================
// DASHBOARD (AGGREGATE)
// ========================================

export interface DashboardTask {
  id: string;
  title: string;
  status: string;
  category: string;
  revisionNumber: number;
  createdAt: string;
  inProgressAt: string | null;
  slaSeconds: number;
  slaRemainingSeconds: number | null;
  slaElapsedSeconds: number | null;
  slaIsLate: boolean;
  brand: { id: string; name: string } | null;
}

export interface DashboardDraft {
  id: string;
  title: string | null;
  category: string;
  lastEditedAt: string;
  createdAt: string;
}

export interface DashboardData {
  workspace: {
    id: string;
    name: string;
    slug: string;
    timezone: string;
    hasOnboarded?: boolean;
    createdAt: string;
    updatedAt: string;
  };
  plan: any;
  subscription: any;
  derived: {
    activeTaskLimit: number;
    effectiveSlaSeconds: number;
  };
  counts: {
    activeTasks: number;
    queuedTasks: number;
  };
  currentDayCredit: {
    total: number;
    used: number;
    remaining: number;
    periodStart: string;
    periodEnd: string;
  } | null;
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
  tasks: DashboardTask[];
  metrics: WorkspaceMetrics;
  creditForecast: CreditForecast;
  drafts: DashboardDraft[];
}

export async function fetchDashboardData(): Promise<DashboardData> {
  return apiFetch<DashboardData>("/workspace/dashboard");
}

// ========================================
// AI INTAKE
// ========================================

export interface IntakeRequest {
  description: string;
  title?: string;
  brandId?: string;
  context?: string;
  referenceLinks?: string[];
}

export interface IntakeResponse {
  goal: string;
  audience: string;
  funnelStage: "top" | "middle" | "bottom" | "unknown";
  primaryAssetType: "landing_page" | "social" | "email" | "deck" | "video" | "other";
  keyMessage: string;
  tone?: string;
  sections?: string[];
  deliverables: string[];
  missingInfoQuestions: string[];
}

export async function callIntakeAI(payload: IntakeRequest): Promise<IntakeResponse> {
  return apiFetch<IntakeResponse>("/ai/intake", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ========================================
// COMPOSER GATEWAY
// ========================================

export interface ComposerCapabilities {
  plan_code: string;
  plan_display_name: string;
  composer_credits: {
    type: 'METERED' | 'UNLIMITED';
    limit?: number;
    used: number;
    resets_at: string;
  };
  has_studio_access: boolean;
  can_send_to_studio: boolean;
  max_parallel_studio_tasks: number;
  can_copy_to_figma: boolean;
  can_publish_domain: boolean;
  has_motion: boolean;
  has_strategy: boolean;
  seats: number;
  day_credits?: {
    available: number;
    used: number;
    rollover_months: number;
  };
  workspace_id: string;
}

export async function fetchComposerCapabilities(): Promise<ComposerCapabilities> {
  return apiFetch<ComposerCapabilities>('/composer/capabilities', {
    skipWorkspace: false, // Will use x-workspace-id header
  });
}

// Note: Composer generation is now handled by the external sako-composer app.
// The gateway API routes (/composer/capabilities, /composer/brands, /composer/tasks/from-draft)
// are used by the external Composer app, not by this client.

// ========================================
// NOTIFICATION PREFERENCES
// ========================================

export type NotificationEventType =
  | 'TASK_CREATED'
  | 'TASK_IN_PROGRESS'
  | 'TASK_IN_REVIEW'
  | 'TASK_COMPLETED'
  | 'TASK_COMMENT'
  | 'REVISION_REQUESTED'
  | 'PAYMENT_FAILED'
  | 'SUBSCRIPTION_PAUSED'
  | 'SUBSCRIPTION_RESUMED'
  | 'SUBSCRIPTION_CANCELED'
  | 'WORKSPACE_INVITE'
  | 'MEMBER_JOINED'
  | 'MEMBER_REMOVED';

export interface NotificationPreference {
  eventType: NotificationEventType;
  emailEnabled: boolean;
  slackEnabled: boolean;
  inAppEnabled: boolean;
}

export async function fetchNotificationPreferences(): Promise<NotificationPreference[]> {
  return apiFetch<NotificationPreference[]>('/notifications/preferences', {
    skipWorkspace: true,
  });
}

export async function updateNotificationPreferences(
  preferences: NotificationPreference[]
): Promise<NotificationPreference[]> {
  return apiFetch<NotificationPreference[]>('/notifications/preferences', {
    method: 'PUT',
    body: JSON.stringify({ preferences }),
    skipWorkspace: true,
  });
}

// ========================================
// TASK DRAFTS
// ========================================

export interface TaskDraft {
  id: string;
  workspaceId: string;
  title: string | null;
  description: string | null;
  category: 'DESIGN' | 'MOTION';
  brandId: string | null;
  useAI: boolean;
  structuredBriefJson: any;
  referenceLinksJson: any;
  deliverablesJson: any;
  lastEditedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface SaveTaskDraftPayload {
  id?: string;
  title?: string;
  description?: string;
  category?: 'DESIGN' | 'MOTION';
  brandId?: string;
  useAI?: boolean;
  structuredBriefJson?: any;
  referenceLinksJson?: any;
  deliverablesJson?: any;
}

export async function listTaskDrafts(): Promise<TaskDraft[]> {
  return apiFetch<TaskDraft[]>('/tasks/drafts/list');
}

export async function saveTaskDraft(data: SaveTaskDraftPayload): Promise<TaskDraft> {
  return apiFetch<TaskDraft>('/tasks/drafts', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getTaskDraft(draftId: string): Promise<TaskDraft> {
  return apiFetch<TaskDraft>(`/tasks/drafts/${draftId}`);
}

export async function deleteTaskDraft(draftId: string): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/tasks/drafts/${draftId}`, {
    method: 'DELETE',
  });
}

export async function submitTaskDraft(draftId: string): Promise<any> {
  return apiFetch<any>(`/tasks/drafts/${draftId}/submit`, {
    method: 'POST',
  });
}

// ========================================
// DAY CREDIT HISTORY & FORECAST
// ========================================

export interface CreditHistoryPeriod {
  id: string;
  periodStart: string;
  periodEnd: string;
  totalCredits: number;
  usedCredits: number;
  remaining: number;
  rolloverCredits: number;
  avgDailyBurn: number;
  isCurrentPeriod: boolean;
}

export interface CreditHistory {
  history: CreditHistoryPeriod[];
  pauseInfo: {
    isPaused: boolean;
    pausedAt: string | null;
    totalPausedSeconds: number;
    pauseReason: string | null;
  } | null;
  summary: {
    currentPeriod: CreditHistoryPeriod | null;
    totalPeriodsTracked: number;
  };
}

export interface CreditForecast {
  hasCredit: boolean;
  message?: string;
  current?: {
    total: number;
    used: number;
    remaining: number;
    periodEnd: string;
  };
  forecast?: {
    dailyBurnRate: number;
    daysRemaining: number;
    projectedExhaustionDate: string;
    willLastUntilPeriodEnd: boolean;
    projectedUnusedAtPeriodEnd: number;
    periodDaysRemaining: number;
  };
  recommendations?: string[];
}

export async function fetchCreditHistory(): Promise<CreditHistory> {
  return apiFetch<CreditHistory>('/workspace/credits/history');
}

export async function fetchCreditForecast(): Promise<CreditForecast> {
  return apiFetch<CreditForecast>('/workspace/credits/forecast');
}

// ========================================
// COMPOSER INTEGRATION
// ========================================

export interface ComposerSsoToken {
  token: string;
  redirect_url: string;
}

/**
 * Get an SSO token for redirecting to Composer
 * The redirect_url includes the token as a query parameter
 */
export async function getComposerSsoToken(): Promise<ComposerSsoToken> {
  return apiFetch<ComposerSsoToken>('/composer/sso-token');
}
