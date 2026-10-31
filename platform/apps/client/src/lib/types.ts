// Types aligned with backend API (Prisma schema + API DTOs)

// ========================================
// ENUMS (matching Prisma)
// ========================================

export type PlanCode = 'CORE' | 'OPS' | 'ENTERPRISE' | 'COMPOSER_FREE' | 'COMPOSER_PRO';
export type SubscriptionStatus = 'ACTIVE' | 'PAUSED' | 'CANCELED' | 'PAST_DUE' | 'CANCEL_AT_PERIOD_END';
export type TaskStatus = 'QUEUED' | 'IN_PROGRESS' | 'IN_REVIEW' | 'COMPLETED' | 'PAUSED';
export type TaskCategory = 'DESIGN' | 'MOTION';
export type CommentKind = 'COMMENT' | 'REVISION_REQUEST' | 'ADMIN_DECISION';
export type WorkspaceRole = 'OWNER' | 'SUBMITTER' | 'MEMBER' | 'VIEWER';

// Legacy types for component compatibility (lowercase)
export type TaskStatusLegacy = 'queued' | 'in-progress' | 'in-review' | 'completed' | 'paused';
export type TaskCategoryLegacy = 'design' | 'motion' | 'strategy' | 'web';
export type TaskPriority = 'low' | 'normal' | 'high' | 'rush';
export type AssetType = 'video' | 'image' | 'pdf' | 'figma' | 'lottie';

// ========================================
// BRAND
// ========================================

export interface BrandColorsJson {
  primary?: string;
  secondary?: string;
  accent?: string;
  gradients?: Array<{ from: string; to: string; direction?: string }>;
  neutrals?: string[];
  backgrounds?: string[];
}

export interface BrandTypographyJson {
  headingFont?: string;
  bodyFont?: string;
  scale?: 'small' | 'medium' | 'large';
  weights?: number[];
  headingSizes?: { h1?: string; h2?: string; h3?: string; h4?: string };
}

export interface BrandProfileJson {
  heroStyle?: 'centered' | 'split' | 'fullwidth' | 'minimal';
  gridPreferences?: 'standard' | 'asymmetric' | 'masonry';
  ctaStyle?: 'solid' | 'outline' | 'gradient' | 'minimal';
  imageStyle?: 'rounded' | 'sharp' | 'circular';
  spacing?: 'tight' | 'normal' | 'spacious';
  layoutNotes?: string;
}

export interface Brand {
  id: string;
  workspaceId: string;
  name: string;
  
  // Direct color fields
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  
  // Extended JSON fields for Composer
  colorsJson?: BrandColorsJson;
  typographyJson?: BrandTypographyJson;
  brandProfileJson?: BrandProfileJson;
  
  // Tone and voice
  toneTags: string[];
  voiceGuidelines?: string;
  guidelines?: string;
  
  // Asset URLs
  logoUrl?: string;
  guidelineUrl?: string;
  
  createdAt: string;
  updatedAt: string;

  // Legacy fields for component compatibility
  shortName?: string;
  typography?: string;
  tone?: string[];
  isDefault?: boolean;
}

export interface StructuredBrief {
  goal: string;
  audience: string;
  funnelStage: "top" | "middle" | "bottom" | "unknown";
  primaryAssetType: "landing_page" | "social" | "email" | "deck" | "video" | "other";
  keyMessage: string;
  tone?: string;
  sections?: string[];
}

// ========================================
// TASK
// ========================================

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

export interface TaskRevision {
  id: string;
  taskId: string;
  authorId?: string;
  revisionIndex: number;
  payloadJson?: any;
  createdAt: string;
}

export interface Attachment {
  id: string;
  taskId: string;
  url: string;
  kind: string; // "REFERENCE" | "DELIVERABLE"
  createdAt: string;
}

export interface Task {
  id: string;
  workspaceId: string;
  brandId?: string;
  title: string;
  description: string;
  category: TaskCategory;
  status: TaskStatus;
  createdById?: string;
  assignedToId?: string;
  assignedTo?: {
    id: string;
    name?: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
  inProgressAt?: string;
  completedAt?: string;
  slaSeconds: number;
  revisionNumber: number;
  externalSource?: string;
  externalId?: string;
  slackChannelId?: string;
  slackThreadTs?: string;

  // AI Estimator fields
  estimatedEffortHours?: number;
  displaySlaHours?: number;
  fits48hWindow?: boolean;
  flagForAdminReview?: boolean;
  aiEligible?: boolean;
  aiIneligibleReason?: string;
  useAI?: boolean;

  // Composer fields
  aiDraftRequested?: boolean;
  aiDraftStatus?: AiDraftStatus;
  aiDraftSelectedId?: string;
  source?: ComposerSource;

  // AI / Structured Brief fields
  structuredBriefJson?: StructuredBrief;
  referenceLinksJson?: any;
  deliverablesJson?: any;

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

  // Relations (when included)
  brand?: Brand | { id: string; name: string }; // Simplified brand in list view
  comments?: TaskComment[];
  revisions?: TaskRevision[];
  attachments?: Attachment[];
  estimateSnapshots?: TaskEstimateSnapshot[];

  // Count fields (from Prisma _count)
  _count?: {
    comments?: number;
    attachments?: number;
  };

  // Legacy fields for component compatibility
  dueDate?: string;
  estimatedDays?: number;
  hoursLeft?: number;
  totalHours?: number;
  commentCount?: number;
  priority?: TaskPriority;
  brief?: string;
  goals?: string[];
  targetAudience?: string;
  deliverables?: string[];
  requirements?: string[];
  tags?: string[];
  assets?: TaskAsset[];
  timecodedComments?: TimecodedComment[];
  pinnedComments?: PinnedComment[];
  linkedCallId?: string;
}

// Legacy types for component compatibility
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
  timecode: string;
  author: string;
  avatar?: string;
  content: string;
  timestamp: string;
}

export interface PinnedComment {
  id: string;
  pinNumber: number;
  /**
   * Pin position as a percentage of the image width (0–100).
   * Stored in the same normalized space as review annotations.
   */
  x: number;
  /**
   * Pin position as a percentage of the image height (0–100).
   */
  y: number;
  author: string;
  avatar?: string;
  content: string;
  tag?: string;
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

// ========================================
// WORKSPACE & SUBSCRIPTION
// ========================================

export interface Plan {
  id: string;
  code: PlanCode;
  name: string;
  activeTaskLimit: number;
  allowedCategories: TaskCategory[];
  priceMonthly: number;
  priceAnnual: number;
}

export interface Subscription {
  id: string;
  workspaceId: string;
  status: SubscriptionStatus;
  stripeSubscriptionId?: string;
  planCode: PlanCode;
  mode?: string; // DEPRECATED: No longer used. CORE includes both Design + Motion.
  activeTaskLimit?: number;
  slaSeconds?: number;
  billingPeriodStart?: string;
  billingPeriodEnd?: string;
  cancelAt?: string;
  pausedAt?: string; // When subscription was paused
  pauseReason?: string; // Reason for pause
  totalPausedSeconds?: number; // Accumulated paused time in seconds
  createdAt: string;
  updatedAt: string;
}

export interface DayCredit {
  id: string;
  workspaceId: string;
  totalCredits: number;
  usedCredits: number;
  periodStart: string;
  periodEnd: string;
}

export interface SlackIntegration {
  id: string;
  workspaceId: string;
  slackTeamId: string;
  defaultChannel?: string | null;
  createdAt: string;
}

export interface AICredit {
  id: string;
  workspaceId: string;
  totalCredits: number;
  usedCredits: number;
  periodStart: string;
  periodEnd: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  hasOnboarded?: boolean;
  createdAt: string;
  updatedAt: string;

  // Relations (when included)
  plan?: Plan;
  subscription?: Subscription;
  dayCredit?: DayCredit;
  aiCredit?: AICredit;
  slackIntegration?: SlackIntegration | null;

  // Derived fields from API
  effectiveActiveTaskLimit?: number;
  effectiveSlaSeconds?: number;
  taskCounts?: {
    total: number;
    queued: number;
    inProgress: number;
    inReview: number;
    completed: number;
  };

  // Legacy fields for component compatibility
  dayCredits?: number;
  dayCreditsTotal?: number;
  aiCredits?: number;
  aiCreditsTotal?: number;
  activeSlots?: number;
  billingPeriodStart?: string;
  billingPeriodEnd?: string;
}

export interface SubscriptionSummary {
  subscription: Subscription;
  plan: Plan;
  effectiveActiveTaskLimit: number;
  effectiveSlaSeconds: number;
}

// ========================================
// OTHER
// ========================================

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

// ========================================
// TASK ESTIMATOR
// ========================================

export interface TaskEstimatorResponse {
  estimatedEffortHours: number;
  displaySlaHours: number;
  complexity: 'simple' | 'complex' | 'unsupported';
  complexityScore: number;
  isAiSupported: boolean;
  unsupportedReason: string | null;
  fits48hWindow: boolean;
  flagForAdminReview: boolean;
  flagReason: string | null;
  recommendedSplitCount: number;
  suggestedSubtasks: string[];
  missingInfoQuestions: string[];
  aiHelpRecommended: boolean;
  aiHelpReason: string;
  reasoning: string;
}

// Snapshot of estimator result stored with task
export interface TaskEstimateSnapshot {
  id: string;
  taskId?: string;
  complexity: 'simple' | 'complex' | 'unsupported';
  complexityScore: number;
  isAiSupported: boolean;
  fits48hWindow: boolean;
  flagForAdminReview: boolean;
  flagReason?: string;
  recommendedSplitCount: number;
  suggestedSubtasksJson?: string[];
  missingInfoJson?: string[];
  aiHelpRecommended: boolean;
  aiHelpReason: string;
  reasoning: string;
  estimatedEffortHoursRaw: number;
  displaySlaHoursRaw: number;
  createdAt: string;
}

// ========================================
// AUTH
// ========================================

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

// ========================================
// AI DRAFT TYPES
// Note: Composer generation is now handled by external sako-composer app.
// These types are kept for displaying AI draft info on tasks.
// ========================================

export type AiDraftType = 'LANDING_PAGE' | 'AD_CREATIVE' | 'BANNER';
export type AiDraftStatus = 'NONE' | 'PENDING' | 'READY' | 'FAILED';
export type ComposerSource = 'TASK' | 'COMPOSER_STANDALONE';

export interface DesignJsonSection {
  type: 'hero' | 'features' | 'testimonials' | 'pricing' | 'cta' | 'footer' | 'custom';
  name: string;
  content?: {
    headline?: string;
    subheadline?: string;
    body?: string;
    ctaText?: string;
    ctaUrl?: string;
    items?: Array<{
      title?: string;
      description?: string;
      icon?: string;
    }>;
  };
  style?: {
    backgroundColor?: string;
    textColor?: string;
    layout?: string;
  };
}

export interface DesignJson {
  version: string;
  assetType: AiDraftType;
  sections: DesignJsonSection[];
  metadata: {
    primaryHeadline?: string;
    mainCta?: string;
    colorScheme?: 'light' | 'dark';
    estimatedHeight?: number;
  };
}

export interface AiDraft {
  id: string;
  workspaceId: string;
  taskId?: string;
  brandId: string;
  
  type: AiDraftType;
  status: AiDraftStatus;
  
  // Generated content
  previewImageUrl?: string;
  html?: string;
  designJson?: DesignJson;
  reasoning?: string[];
  variantLabel?: string;
  primaryHeadline?: string;
  mainCta?: string;
  
  // Selection
  isSelected: boolean;
  selectedAt?: string;
  
  createdAt: string;
  updatedAt: string;
}
