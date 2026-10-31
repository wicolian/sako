export type TaskStatus = 'QUEUED' | 'IN_PROGRESS' | 'IN_REVIEW' | 'COMPLETED' | 'PAUSED';
export type TaskCategory = 'DESIGN' | 'MOTION' | 'STRATEGY' | 'WEB';
export type TaskPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'RUSH';
export type AssetType = 'VIDEO' | 'IMAGE' | 'PDF' | 'FIGMA' | 'LOTTIE';

export interface Brand {
  id: string;
  name: string;
  shortName: string;
  primaryColor: string;
  secondaryColor: string;
  typography: string;
  tone: string[];
  isDefault: boolean;
}

export interface TaskAsset {
  id: string;
  type: AssetType;
  name: string;
  url?: string;
  thumbnail?: string;
  isDeliverable?: boolean;
}

export interface TimecodedComment {
  id: string;
  timecode: string; // e.g., "00:12"
  author: string;
  avatar?: string;
  content: string;
  timestamp: string;
}

export interface PinnedComment {
  id: string;
  pinNumber: number;
  x: number; // position percentage
  y: number; // position percentage
  author: string;
  avatar?: string;
  content: string;
  tag?: string; // e.g., "hero section", "CTA"
  timestamp: string;
}

export interface Revision {
  id: string;
  number: number;
  status: 'requested' | 'in-progress' | 'completed';
  requestedBy?: string;
  requestedAt: string;
  summary?: string;
  isMajor?: boolean;
}

export interface Task {
  id: string;
  workspaceId?: string;
  title: string;
  brandId: string;
  category: TaskCategory;
  status: TaskStatus;
  priority: TaskPriority;
  createdAt: string;
  dueDate: string;
  estimatedDays: number;
  hoursLeft?: number;
  totalHours?: number;
  commentCount: number;
  revisionNumber: number;
  brief?: string;
  description?: string;
  goals?: string[];
  targetAudience?: string;
  deliverables?: string[];
  requirements?: string[];
  tags?: string[];
  assets?: TaskAsset[];
  timecodedComments?: TimecodedComment[];
  pinnedComments?: PinnedComment[];
  revisions?: Revision[];
  linkedCallId?: string;
  attachments?: Array<{ id: string; url: string; kind: string; createdAt: string }>;
  workspace?: { id: string; name: string };
  brand?: { id: string; name: string };
  structuredBriefJson?: {
    goal?: string;
    audience?: string;
    funnelStage?: string;
    primaryAssetType?: string;
    keyMessage?: string;
    tone?: string;
    sections?: string[];
  };
  referenceLinksJson?: Array<{ url: string; type?: string }>;

  // AI Estimator fields
  estimatedEffortHours?: number;
  displaySlaHours?: number;
  fits48hWindow?: boolean;
  flagForAdminReview?: boolean;
  aiEligible?: boolean;
  aiIneligibleReason?: string;
  useAI?: boolean;

  // SLA pause fields (for client wait time tracking)
  inReviewAt?: string;
  totalClientWaitSeconds?: number;

  // Computed SLA fields (from backend)
  computedSlaHours?: number;
  slaRemainingSeconds?: number;
  slaElapsedSeconds?: number;
  slaIsLate?: boolean;
  slaStatus?: 'ON_TRACK' | 'AT_RISK' | 'LATE';
  isWaitingOnClient?: boolean;
  estimateSnapshots?: Array<{
    id: string;
    estimatedEffortHours: number;
    displaySlaHours: number;
    fits48hWindow: boolean;
    createdAt: string;
  }>;
  
  // Composer integration fields
  source?: ComposerSource;
  composerDraftId?: string;
  composerExportUrl?: string;
}

export type CommentKind = 'COMMENT' | 'REVISION_REQUEST';

export interface TaskComment {
  id: string;
  taskId: string;
  authorId?: string;
  body: string;
  kind: CommentKind;
  createdAt: string;
  authorRole?: string;
  authorName?: string;
  author?: {
    id: string;
    name?: string;
    email: string;
    role?: string;
  };
}

export interface Event {
  id: string;
  title: string;
  date: string;
  time?: string;
  type: 'call' | 'review' | 'checkpoint';
  isAsync?: boolean;
}

export interface Comment {
  id: string;
  taskId: string;
  author: string;
  authorRole: string;
  content: string;
  timestamp: string;
  avatar?: string;
  isSystemMessage?: boolean;
  edited?: boolean;
}

export interface Workspace {
  id: string;
  name: string;
  plan: string;
  dayCredits: number;
  dayCreditsTotal: number;
  aiCredits: number;
  aiCreditsTotal: number;
  activeSlots: number;
  billingPeriodStart: string;
  billingPeriodEnd: string;
}

export type WorkspaceRole = 'OWNER' | 'ADMIN' | 'MEMBER';

export interface AuthResponse {
  token: string;
  user: {
    id: string;
    email: string;
    name?: string | null;
  };
  workspace: {
    id: string;
    name: string;
    slug: string;
  };
  membership: {
    role: WorkspaceRole;
  };
}

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

export type StudioUserRole = 'CLIENT' | 'PENDING_ADMIN' | 'ADMIN';

export interface StudioUser {
  id: string;
  email: string;
  name?: string | null;
  role: StudioUserRole;
  isSuperAdmin?: boolean;
  createdAt?: string;
}

export interface CurrentUser extends StudioUser {
  isSuperAdmin: boolean;
  workspaces: Array<{
    id: string;
    name: string;
    slug: string;
    role: string;
  }>;
}

export interface PendingAdminUser extends StudioUser {
  role: 'PENDING_ADMIN';
}

// ========================================
// AI DRAFT TYPES
// Note: Composer generation is now handled by external sako-composer app.
// These types are kept for displaying AI draft info on tasks.
// ========================================

export type AiDraftType = 'LANDING_PAGE' | 'AD_CREATIVE' | 'BANNER';
export type AiDraftStatus = 'NONE' | 'PENDING' | 'READY' | 'FAILED';
export type ComposerSource = 'TASK' | 'COMPOSER_STANDALONE';

export interface AiDraft {
  id: string;
  workspaceId: string;
  taskId?: string;
  brandId: string;
  
  type: AiDraftType;
  status: AiDraftStatus;
  
  previewImageUrl?: string;
  html?: string;
  designJson?: any;
  reasoning?: string[];
  variantLabel?: string;
  primaryHeadline?: string;
  mainCta?: string;
  
  isSelected: boolean;
  selectedAt?: string;
  
  createdAt: string;
  updatedAt: string;
}
