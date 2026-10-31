import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/ai/langsmith-ai', () => ({
  generateObject: vi.fn(),
  generateText: vi.fn(),
  streamText: vi.fn(),
  embed: vi.fn(),
  embedMany: vi.fn(),
}))

describe('structured generation routing errors', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('throws a typed routing error instead of falling back to the same model family', async () => {
    const { generateObject } = await import('@/lib/ai/langsmith-ai')
    const { generateStructuredOutput, StructuredGenerationRoutingError } = await import('@/lib/ai/ai-sdk-client')

    ;(generateObject as unknown as { mockRejectedValue: (value: unknown) => void }).mockRejectedValue(
      new Error('No endpoints found that can handle the requested parameters. To learn more about provider routing, visit: https://openrouter.ai/docs/guides/routing/provider-selection'),
    )

    await expect(
      generateStructuredOutput({
        prompt: 'Return an object',
        schema: {
          parse: (value: unknown) => value,
        } as never,
      }),
    ).rejects.toBeInstanceOf(StructuredGenerationRoutingError)
  })

  it('falls back to plain text page generation without temperature and validates the JSON', async () => {
    const { generateObject, generateText } = await import('@/lib/ai/langsmith-ai')
    const { generatePageBlocks } = await import('@/lib/ai/ai-sdk-client')

    ;(generateObject as unknown as { mockRejectedValue: (value: unknown) => void }).mockRejectedValue(
      new Error('No endpoints found that can handle the requested parameters. To learn more about provider routing, visit: https://openrouter.ai/docs/guides/routing/provider-selection'),
    )
    ;(generateText as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue({
      text: JSON.stringify({
        blocks: [
          {
            type: 'hero',
            headline: 'Launch faster',
            subheadline: 'Stay compliant',
            content: '',
            items: [],
            ctaText: 'Book demo',
            ctaUrl: '/demo',
            imageUrl: '',
            testimonials: [],
            stats: [],
          },
        ],
      }),
    })

    const result = await generatePageBlocks(
      'Growth leaders',
      'Drive pipeline',
      'AI GTM system',
      'Book demo',
      ['Generate compliant campaigns'],
    )

    expect(result.blocks).toHaveLength(1)
    expect(result.blocks[0]?.type).toBe('hero')
    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        model: expect.any(String),
        prompt: expect.stringContaining('Growth leaders'),
      }),
    )
    expect((generateText as unknown as { mock: { calls: Array<Array<Record<string, unknown>>> } }).mock.calls[0]?.[0]).not.toHaveProperty('temperature')
  })

  it('tries the next text model when the first fallback model is rejected by provider routing', async () => {
    const { generateObject, generateText } = await import('@/lib/ai/langsmith-ai')
    const { generatePageBlocks, MODELS } = await import('@/lib/ai/ai-sdk-client')

    ;(generateObject as unknown as { mockRejectedValue: (value: unknown) => void }).mockRejectedValue(
      new Error('No endpoints found that can handle the requested parameters. To learn more about provider routing, visit: https://openrouter.ai/docs/guides/routing/provider-selection'),
    )
    ;(generateText as unknown as { mockRejectedValueOnce: (value: unknown) => unknown; mockResolvedValueOnce: (value: unknown) => unknown }).mockRejectedValueOnce(
      new Error('No endpoints found that can handle the requested parameters. To learn more about provider routing, visit: https://openrouter.ai/docs/guides/routing/provider-selection'),
    ).mockResolvedValueOnce({
      text: JSON.stringify({
        blocks: [
          {
            type: 'cta',
            headline: 'Ready now',
            subheadline: '',
            content: '',
            items: [],
            ctaText: 'Start',
            ctaUrl: '#',
            imageUrl: '',
            testimonials: [],
            stats: [],
          },
        ],
      }),
    })

    const result = await generatePageBlocks(
      'Growth leaders',
      'Drive pipeline',
      'AI GTM system',
      'Book demo',
      ['Generate compliant campaigns'],
    )

    expect(result.blocks[0]?.type).toBe('cta')
    expect((generateText as unknown as { mock: { calls: Array<Array<Record<string, unknown>>> } }).mock.calls[0]?.[0]?.model).toBe(MODELS.BALANCED)
    expect((generateText as unknown as { mock: { calls: Array<Array<Record<string, unknown>>> } }).mock.calls[1]?.[0]?.model).toBe(MODELS.FAST)
  })
})
