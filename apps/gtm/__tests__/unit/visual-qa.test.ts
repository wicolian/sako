import { describe, expect, it } from 'vitest'

import { autoFixIssues, scoreDesignQuality } from '@/lib/templates/visual-qa'

describe('scoreDesignQuality', () => {
  it('penalizes common slop patterns', () => {
    const html = `
      <style>
        .hero { background: linear-gradient(135deg, #6366f1, #8b5cf6); }
        .card:hover { transform: translateY(-4px) scale(1.02); }
        .glass { backdrop-filter: blur(16px); }
      </style>
      <section class="hero">
        <h1>Launch faster 🚀</h1>
        <div class="glass">proof</div>
        <div class="window controls">
          <span class="w-3 h-3 rounded-full bg-red-500"></span>
          <span class="w-3 h-3 rounded-full bg-amber-500"></span>
          <span class="w-3 h-3 rounded-full bg-green-500"></span>
        </div>
      </section>
    `

    const score = scoreDesignQuality(html)

    expect(score.dimensions.restraint).toBeLessThan(0.8)
    expect(score.dimensions.brandFit).toBeLessThan(0.7)
    expect(score.issues.some((issue) => issue.category === 'restraint')).toBe(true)
    expect(score.issues.some((issue) => issue.category === 'brand-fit')).toBe(true)
  })

  it('auto-fixes safe restraint issues', () => {
    const html = `
      <style>
        .card:hover { transform: translateY(-2px); }
        .panel { backdrop-filter: blur(10px); }
      </style>
    `

    const score = scoreDesignQuality(html)
    const fixed = autoFixIssues(html, score.issues)

    expect(fixed).not.toContain('translateY')
    expect(fixed).not.toContain('backdrop-filter')
  })
})
