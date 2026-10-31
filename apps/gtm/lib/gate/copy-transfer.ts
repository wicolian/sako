/**
 * Copy Transfer - Session storage utilities for gate-to-kit flow
 * 
 * Stores validated copy in sessionStorage so it can be retrieved
 * after signup and pre-fill the kit wizard.
 */

import type { ValidationResults } from '@/components/gate/results-display'

const GATE_COPY_KEY = 'sako_gate_copy'
const GATE_INDUSTRY_KEY = 'sako_gate_industry'
const GATE_RESULTS_KEY = 'sako_gate_results'
const GATE_TIMESTAMP_KEY = 'sako_gate_timestamp'

// Data expires after 1 hour
const EXPIRY_MS = 60 * 60 * 1000

export interface GateCopyData {
  copy: string
  industry: string
  results: ValidationResults | null
  timestamp: number
}

/**
 * Store validated copy for transfer to kit wizard
 */
export function storeGateCopy(
  copy: string,
  industry: string,
  results: ValidationResults | null
): void {
  if (typeof window === 'undefined') return
  
  try {
    sessionStorage.setItem(GATE_COPY_KEY, copy)
    sessionStorage.setItem(GATE_INDUSTRY_KEY, industry)
    sessionStorage.setItem(GATE_RESULTS_KEY, JSON.stringify(results))
    sessionStorage.setItem(GATE_TIMESTAMP_KEY, Date.now().toString())
  } catch (error) {
    console.warn('Failed to store gate copy:', error)
  }
}

/**
 * Retrieve stored gate copy data
 * Returns null if data doesn't exist or has expired
 */
export function retrieveGateCopy(): GateCopyData | null {
  if (typeof window === 'undefined') return null
  
  try {
    const copy = sessionStorage.getItem(GATE_COPY_KEY)
    const industry = sessionStorage.getItem(GATE_INDUSTRY_KEY)
    const resultsStr = sessionStorage.getItem(GATE_RESULTS_KEY)
    const timestampStr = sessionStorage.getItem(GATE_TIMESTAMP_KEY)
    
    if (!copy || !industry || !timestampStr) {
      return null
    }
    
    const timestamp = parseInt(timestampStr, 10)
    
    // Check if data has expired
    if (Date.now() - timestamp > EXPIRY_MS) {
      clearGateCopy()
      return null
    }
    
    const results = resultsStr ? JSON.parse(resultsStr) : null
    
    return {
      copy,
      industry,
      results,
      timestamp,
    }
  } catch (error) {
    console.warn('Failed to retrieve gate copy:', error)
    return null
  }
}

/**
 * Clear stored gate copy data
 */
export function clearGateCopy(): void {
  if (typeof window === 'undefined') return
  
  try {
    sessionStorage.removeItem(GATE_COPY_KEY)
    sessionStorage.removeItem(GATE_INDUSTRY_KEY)
    sessionStorage.removeItem(GATE_RESULTS_KEY)
    sessionStorage.removeItem(GATE_TIMESTAMP_KEY)
  } catch (error) {
    console.warn('Failed to clear gate copy:', error)
  }
}

/**
 * Check if there's stored gate copy data (without retrieving it)
 */
export function hasGateCopy(): boolean {
  if (typeof window === 'undefined') return false
  
  try {
    const timestampStr = sessionStorage.getItem(GATE_TIMESTAMP_KEY)
    if (!timestampStr) return false
    
    const timestamp = parseInt(timestampStr, 10)
    
    // Check if data has expired
    if (Date.now() - timestamp > EXPIRY_MS) {
      clearGateCopy()
      return false
    }
    
    return !!sessionStorage.getItem(GATE_COPY_KEY)
  } catch {
    return false
  }
}

/**
 * Extract key information from validation results for kit brief
 */
export function extractBriefFromGateCopy(data: GateCopyData): {
  audience: string
  offer: string
  claims: string[]
} {
  // Extract audience and offer from the copy (simple heuristics)
  const copy = data.copy
  
  // Try to detect audience mentions
  const audiencePatterns = [
    /for\s+([\w\s]+?)\s+teams/i,
    /for\s+([\w\s]+?)\s+companies/i,
    /for\s+([\w\s]+?)\s+businesses/i,
    /designed\s+for\s+([\w\s]+)/i,
    /built\s+for\s+([\w\s]+)/i,
  ]
  
  let audience = ''
  for (const pattern of audiencePatterns) {
    const match = copy.match(pattern)
    if (match) {
      audience = match[1].trim()
      break
    }
  }
  
  // Extract offer from first sentence or headline-like text
  const sentences = copy.split(/[.!?]+/).filter(s => s.trim().length > 10)
  const offer = sentences[0]?.trim() || ''
  
  // Get approved claims from results
  const claims = data.results?.results
    ?.filter(r => r.status === 'approved')
    ?.map(r => r.text) || []
  
  return {
    audience,
    offer,
    claims,
  }
}
