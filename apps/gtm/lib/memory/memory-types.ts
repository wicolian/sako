/**
 * Production Memory Type Definitions
 * 
 * Types for the self-improving content system.
 */

// ============================================================================
// Content Types
// ============================================================================

export type MemoryContentType = 'claim' | 'headline' | 'paragraph' | 'email' | 'ad' | 'social' | 'other'

export type MemoryStatus = 'pending' | 'approved' | 'rejected'

export type MemorySourceType = 'generated' | 'imported' | 'human'

// ============================================================================
// Memory Item
// ============================================================================

export interface MemoryItem {
  id: string
  workspaceId: string
  
  // Content
  contentType: MemoryContentType
  content: string
  contentHash: string
  
  // Embedding (optional - stored in DB)
  embedding?: number[]
  
  // Context
  context: {
    campaignId?: string
    brandId?: string
    audience?: string
    goal?: string
    tags?: string[]
  }
  
  // Feedback
  status: MemoryStatus
  feedbackScore: number
  feedbackReasons: string[]
  
  // Performance
  performance: {
    clicks?: number
    impressions?: number
    conversions?: number
    engagementRate?: number
    ctr?: number
  }
  
  // Source
  sourceType: MemorySourceType
  sourceId?: string
  
  // Timestamps
  createdAt: string
  updatedAt: string
  lastUsedAt?: string
}

// ============================================================================
// API Types
// ============================================================================

export interface CreateMemoryInput {
  contentType: MemoryContentType
  content: string
  context?: MemoryItem['context']
  sourceType?: MemorySourceType
  sourceId?: string
}

export interface UpdateMemoryInput {
  status?: MemoryStatus
  feedbackScore?: number
  feedbackReasons?: string[]
  performance?: MemoryItem['performance']
}

export interface MemorySearchInput {
  query: string
  contentType?: MemoryContentType
  status?: MemoryStatus
  limit?: number
}

export interface MemorySearchResult {
  item: MemoryItem
  similarity: number
}

// ============================================================================
// Stats Types
// ============================================================================

export interface MemoryStats {
  totalItems: number
  approvedItems: number
  rejectedItems: number
  avgFeedbackScore: number
  itemsByType: Record<MemoryContentType, number>
}

// ============================================================================
// Learning Signals
// ============================================================================

export interface LearningSignal {
  itemId: string
  signalType: 'approval' | 'rejection' | 'edit' | 'performance'
  score?: number
  reason?: string
  metadata?: Record<string, unknown>
}

/**
 * Content that should be learned from
 */
export interface LearnableContent {
  content: string
  contentType: MemoryContentType
  context: MemoryItem['context']
  sourceType: MemorySourceType
  sourceId?: string
}
