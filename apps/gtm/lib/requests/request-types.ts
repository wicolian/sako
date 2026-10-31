/**
 * Request OS Type Definitions
 * 
 * Types for the team request workflow system.
 */

// ============================================================================
// Asset Types
// ============================================================================

export type AssetType = 'landing_page' | 'ads' | 'emails' | 'deck' | 'social' | 'other'

export type Priority = 'urgent' | 'normal' | 'low'

export type RequestStatus = 'new' | 'in_progress' | 'review' | 'approved' | 'done' | 'cancelled'

export type RequestSource = 'app' | 'slack' | 'email' | 'api'

// ============================================================================
// Request Brief
// ============================================================================

export interface RequestBrief {
  /** Target audience description */
  audience?: string
  
  /** Main offer or value proposition */
  offer?: string
  
  /** Primary call-to-action */
  cta?: string
  
  /** Additional context or requirements */
  context?: string
  
  /** Reference URLs or links */
  references?: string[]
  
  /** Brand ID to use */
  brandId?: string
  
  /** Specific constraints */
  constraints?: {
    mustInclude?: string[]
    mustAvoid?: string[]
    deadline?: string
    budget?: string
  }
}

// ============================================================================
// Feedback
// ============================================================================

export interface FeedbackEntry {
  id: string
  userId: string
  userName: string
  content: string
  type: 'comment' | 'approval' | 'rejection' | 'change_request'
  createdAt: string
}

// ============================================================================
// Request
// ============================================================================

export interface Request {
  id: string
  workspaceId: string
  
  // People
  requesterId: string
  requesterName?: string
  assigneeId?: string
  assigneeName?: string
  
  // Request details
  assetType: AssetType
  title: string
  brief: RequestBrief
  
  // Timing
  priority: Priority
  dueDate?: string
  
  // Status
  status: RequestStatus
  
  // Generated kit
  kitId?: string
  
  // History
  feedback: FeedbackEntry[]
  
  // Source
  source: RequestSource
  sourceMetadata?: {
    slackChannelId?: string
    slackMessageTs?: string
    emailThreadId?: string
  }
  
  // Timestamps
  createdAt: string
  updatedAt: string
  completedAt?: string
}

// ============================================================================
// API Types
// ============================================================================

export interface CreateRequestInput {
  assetType: AssetType
  title: string
  brief: RequestBrief
  priority?: Priority
  dueDate?: string
  assigneeId?: string
  source?: RequestSource
  sourceMetadata?: Record<string, string>
}

export interface UpdateRequestInput {
  title?: string
  brief?: RequestBrief
  priority?: Priority
  dueDate?: string
  assigneeId?: string
  status?: RequestStatus
}

export interface AddFeedbackInput {
  content: string
  type: FeedbackEntry['type']
}

// ============================================================================
// List/Filter Types
// ============================================================================

export interface RequestFilters {
  status?: RequestStatus[]
  assetType?: AssetType[]
  priority?: Priority[]
  assigneeId?: string
  requesterId?: string
  search?: string
}

export interface RequestListOptions {
  filters?: RequestFilters
  sortBy?: 'created_at' | 'updated_at' | 'due_date' | 'priority'
  sortOrder?: 'asc' | 'desc'
  limit?: number
  offset?: number
}

export interface RequestStats {
  total: number
  byStatus: Record<RequestStatus, number>
  byPriority: Record<Priority, number>
  byAssetType: Record<AssetType, number>
  overdueCount: number
  avgCompletionTimeHours?: number
}
