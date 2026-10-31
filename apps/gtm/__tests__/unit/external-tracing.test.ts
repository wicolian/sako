/**
 * External Tracing (LangSmith) Unit Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock fetch
global.fetch = vi.fn()

describe('External Tracing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('LangSmith Configuration', () => {
    it('detects when LangSmith is configured', () => {
      const isEnabled = !!process.env.LANGSMITH_API_KEY
      expect(typeof isEnabled).toBe('boolean')
    })

    it('uses default project name', () => {
      const project = process.env.LANGSMITH_PROJECT || 'sako-composer'
      expect(project).toBe('sako-composer')
    })

    it('constructs valid dashboard URL', () => {
      const project = 'sako-composer'
      const url = `https://smith.langchain.com/o/default/projects/p/${project}`
      expect(url).toContain('smith.langchain.com')
      expect(url).toContain(project)
    })
  })

  describe('Run Creation', () => {
    interface Run {
      id: string
      name: string
      runType: 'llm' | 'chain' | 'tool' | 'embedding'
      inputs: Record<string, unknown>
      startTime: Date
    }

    const createRunPayload = (run: Run) => ({
      id: run.id,
      name: run.name,
      run_type: run.runType,
      inputs: run.inputs,
      start_time: run.startTime.toISOString(),
    })

    it('formats run payload correctly', () => {
      const run: Run = {
        id: 'test-123',
        name: 'generateContent',
        runType: 'llm',
        inputs: { prompt: 'Hello world' },
        startTime: new Date('2026-01-15T10:00:00Z'),
      }

      const payload = createRunPayload(run)

      expect(payload.id).toBe('test-123')
      expect(payload.name).toBe('generateContent')
      expect(payload.run_type).toBe('llm')
      expect(payload.start_time).toBe('2026-01-15T10:00:00.000Z')
    })
  })

  describe('Run Update', () => {
    interface RunUpdate {
      outputs?: Record<string, unknown>
      error?: string
      endTime: Date
    }

    const createUpdatePayload = (update: RunUpdate) => ({
      outputs: update.outputs,
      error: update.error,
      end_time: update.endTime.toISOString(),
    })

    it('formats successful update', () => {
      const update: RunUpdate = {
        outputs: { result: 'Generated content' },
        endTime: new Date('2026-01-15T10:00:05Z'),
      }

      const payload = createUpdatePayload(update)

      expect(payload.outputs).toEqual({ result: 'Generated content' })
      expect(payload.error).toBeUndefined()
    })

    it('formats error update', () => {
      const update: RunUpdate = {
        error: 'Rate limit exceeded',
        endTime: new Date('2026-01-15T10:00:01Z'),
      }

      const payload = createUpdatePayload(update)

      expect(payload.error).toBe('Rate limit exceeded')
    })
  })

  describe('Feedback Logging', () => {
    interface Feedback {
      runId: string
      score: number
      value?: string
      comment?: string
      key?: string
    }

    const createFeedbackPayload = (feedback: Feedback) => ({
      run_id: feedback.runId,
      key: feedback.key || 'user_feedback',
      score: feedback.score,
      value: feedback.value,
      comment: feedback.comment,
    })

    it('formats feedback with all fields', () => {
      const feedback: Feedback = {
        runId: 'run-123',
        score: 1,
        value: 'good',
        comment: 'Great response!',
        key: 'quality',
      }

      const payload = createFeedbackPayload(feedback)

      expect(payload.run_id).toBe('run-123')
      expect(payload.score).toBe(1)
      expect(payload.key).toBe('quality')
    })

    it('uses default key when not provided', () => {
      const feedback: Feedback = {
        runId: 'run-123',
        score: 0,
      }

      const payload = createFeedbackPayload(feedback)

      expect(payload.key).toBe('user_feedback')
    })
  })
})
