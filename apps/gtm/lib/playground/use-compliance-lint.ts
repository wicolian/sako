/**
 * Real-time Compliance Linting Hook
 * 
 * Provides real-time validation of claims as users edit content
 * in the Playground or any rich text editor.
 */

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { debounce } from '@/lib/utils'

export interface ClaimViolation {
  id: string
  text: string
  reasonCode: string
  message: string
  severity: 'error' | 'warning' | 'info'
  requiredEvidenceTier?: 'A' | 'B' | 'C'
  suggestedRewrite?: string
  position?: {
    start: number
    end: number
  }
}

export interface ComplianceLintResult {
  violations: ClaimViolation[]
  trustScore: number
  isValid: boolean
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
}

export interface UseComplianceLintOptions {
  debounceMs?: number
  validateOnMount?: boolean
  workspaceId?: string
}

/**
 * Hook for real-time compliance linting
 */
export function useComplianceLint(
  content: string,
  options: UseComplianceLintOptions = {}
) {
  const { debounceMs = 500, validateOnMount = false, workspaceId } = options

  const [violations, setViolations] = useState<ClaimViolation[]>([])
  const [trustScore, setTrustScore] = useState(100)
  const [isValidating, setIsValidating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const abortControllerRef = useRef<AbortController | null>(null)

  const validate = useCallback(
    async (text: string) => {
      if (!text.trim()) {
        setViolations([])
        setTrustScore(100)
        return
      }

      // Cancel any pending request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }

      abortControllerRef.current = new AbortController()
      setIsValidating(true)
      setError(null)

      try {
        const response = await fetch('/api/claims/validate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(workspaceId && { 'x-workspace-id': workspaceId }),
          },
          body: JSON.stringify({ text }),
          signal: abortControllerRef.current.signal,
        })

        if (!response.ok) {
          throw new Error('Validation failed')
        }

        const result: ComplianceLintResult = await response.json()
        setViolations(result.violations)
        setTrustScore(result.trustScore)
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          // Request was cancelled, ignore
          return
        }
        setError(err instanceof Error ? err.message : 'Validation error')
      } finally {
        setIsValidating(false)
      }
    },
    [workspaceId]
  )

  // Debounced validation
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedValidate = useCallback(
    debounce((text: string) => validate(text), debounceMs),
    [validate, debounceMs]
  )

  // Validate when content changes
  useEffect(() => {
    debouncedValidate(content)
    
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [content, debouncedValidate])

  // Optional validation on mount
  useEffect(() => {
    if (validateOnMount && content) {
      validate(content)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validateOnMount])

  // Calculate risk level from trust score
  const riskLevel = trustScore >= 80 ? 'low' 
    : trustScore >= 60 ? 'medium'
    : trustScore >= 40 ? 'high'
    : 'critical'

  return {
    violations,
    trustScore,
    riskLevel,
    isValidating,
    error,
    isValid: violations.filter(v => v.severity === 'error').length === 0,
    // Manual validation trigger
    revalidate: () => validate(content),
  }
}

/**
 * Hook for batch compliance checking
 */
export function useBatchComplianceLint(
  claims: Array<{ id: string; text: string }>,
  options: UseComplianceLintOptions = {}
) {
  const [results, setResults] = useState<Map<string, ComplianceLintResult>>(new Map())
  const [isValidating, setIsValidating] = useState(false)

  const validate = useCallback(async () => {
    if (claims.length === 0) {
      setResults(new Map())
      return
    }

    setIsValidating(true)

    try {
      const response = await fetch('/api/claims/validate/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claims }),
      })

      if (!response.ok) {
        throw new Error('Batch validation failed')
      }

      const data = await response.json()
      const newResults = new Map<string, ComplianceLintResult>()

      for (const [id, result] of Object.entries(data.results)) {
        newResults.set(id, result as ComplianceLintResult)
      }

      setResults(newResults)
    } catch (error) {
      console.error('Batch validation error:', error)
    } finally {
      setIsValidating(false)
    }
  }, [claims])

  useEffect(() => {
    const debouncedValidate = debounce(validate, options.debounceMs || 500)
    debouncedValidate()
    return () => {
      // Cleanup
    }
  }, [claims, options.debounceMs, validate])

  // Overall stats
  const totalViolations = Array.from(results.values())
    .reduce((sum, r) => sum + r.violations.length, 0)
  
  const avgTrustScore = results.size > 0
    ? Array.from(results.values()).reduce((sum, r) => sum + r.trustScore, 0) / results.size
    : 100

  return {
    results,
    isValidating,
    totalViolations,
    avgTrustScore: Math.round(avgTrustScore),
    revalidate: validate,
  }
}

/**
 * Trust Score display color helper
 */
export function getTrustScoreColor(score: number): string {
  if (score >= 80) return 'text-green-500'
  if (score >= 60) return 'text-yellow-500'
  if (score >= 40) return 'text-orange-500'
  return 'text-red-500'
}

/**
 * Trust Score background color helper
 */
export function getTrustScoreBg(score: number): string {
  if (score >= 80) return 'bg-green-500/10'
  if (score >= 60) return 'bg-yellow-500/10'
  if (score >= 40) return 'bg-orange-500/10'
  return 'bg-red-500/10'
}

/**
 * Get severity badge color
 */
export function getSeverityColor(severity: ClaimViolation['severity']): string {
  switch (severity) {
    case 'error':
      return 'bg-destructive/10 text-red-800  '
    case 'warning':
      return 'bg-amber-500/10 text-yellow-800  '
    case 'info':
      return 'bg-blue-500/10 text-blue-800  '
    default:
      return 'bg-muted text-foreground  '
  }
}
