import { describe, expect, it } from 'vitest'

import { detectAdjectiveStacks, detectSlop, extractNewClaims } from '@/lib/ai/anti-slop'

describe('anti-slop utilities', () => {
  it('flags known bad phrases', () => {
    const text = `In today's fast-paced world, we're excited to announce a revolutionary platform that will unlock your potential.`

    const violations = detectSlop(text)

    expect(violations.map((violation) => violation.phrase.toLowerCase())).toEqual(
      expect.arrayContaining([
        expect.stringContaining("in today's fast-paced world"),
        expect.stringContaining('excited to announce'),
        expect.stringContaining('revolutionary'),
        expect.stringContaining('unlock your potential'),
      ])
    )
  })

  it('allows grounded copy without false positives', () => {
    const text = `Engineering teams use one deploy pipeline for staging and production. See how Linear reduced release overhead with a tighter feedback loop.`

    expect(detectSlop(text)).toEqual([])
  })

  it('extracts new claim markers from generated text', () => {
    const text = `Built for teams that need faster reviews. [NEW_CLAIM]Cuts triage time by 28%.[/note]`

    expect(extractNewClaims(text)).toEqual(['Cuts triage time by 28%.'])
  })

  it('detects adjective stacks', () => {
    const text = `A powerful, flexible, and intuitive workspace for product teams.`

    expect(detectAdjectiveStacks(text)).toEqual(['powerful, flexible, and intuitive'])
  })

  it('respects allow-listed soft phrases when the brand uses them', () => {
    const text = `A seamless approval path for every launch.`

    expect(detectSlop(text, ['seamless approval path'])).toEqual([])
  })
})
