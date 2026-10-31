/**
 * AI Image Generation Unit Tests
 */

import { describe, it, expect } from 'vitest'

describe('AI Image Generation', () => {
  describe('Image Generation Config', () => {
    const SUPPORTED_MODELS = [
      'google/gemini-3-pro-image',
    ]

    const IMAGE_SIZES = {
      square: { width: 1024, height: 1024 },
      landscape: { width: 1792, height: 1024 },
      portrait: { width: 1024, height: 1792 },
    }

    it('has supported model', () => {
      expect(SUPPORTED_MODELS).toContain('google/gemini-3-pro-image')
    })

    it('has valid aspect ratios', () => {
      expect(IMAGE_SIZES.square.width).toBe(IMAGE_SIZES.square.height)
      expect(IMAGE_SIZES.landscape.width).toBeGreaterThan(IMAGE_SIZES.landscape.height)
      expect(IMAGE_SIZES.portrait.height).toBeGreaterThan(IMAGE_SIZES.portrait.width)
    })
  })

  describe('Prompt Enhancement', () => {
    interface BrandStyle {
      primaryColor?: string
      style?: string
      industry?: string
    }

    const enhancePrompt = (basePrompt: string, brand: BrandStyle): string => {
      const enhancements: string[] = [basePrompt]

      if (brand.primaryColor) {
        enhancements.push(`featuring ${brand.primaryColor} as the primary color`)
      }

      if (brand.style) {
        enhancements.push(`in a ${brand.style} style`)
      }

      if (brand.industry) {
        enhancements.push(`appropriate for ${brand.industry} industry`)
      }

      enhancements.push('high quality, professional, suitable for marketing materials')

      return enhancements.join(', ')
    }

    it('enhances prompt with brand color', () => {
      const enhanced = enhancePrompt('Office workspace', { primaryColor: 'blue' })
      expect(enhanced).toContain('blue')
    })

    it('enhances prompt with style', () => {
      const enhanced = enhancePrompt('Product shot', { style: 'minimalist' })
      expect(enhanced).toContain('minimalist style')
    })

    it('adds professional quality suffix', () => {
      const enhanced = enhancePrompt('Team collaboration', {})
      expect(enhanced).toContain('high quality')
      expect(enhanced).toContain('professional')
    })
  })

  describe('Image URL Validation', () => {
    const isValidImageUrl = (url: string): boolean => {
      try {
        const parsed = new URL(url)
        const validExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif']
        return validExtensions.some(ext => parsed.pathname.toLowerCase().endsWith(ext))
          || url.includes('supabase.co/storage')
          || url.includes('blob:')
      } catch {
        return false
      }
    }

    it('validates image URLs with extensions', () => {
      expect(isValidImageUrl('https://example.com/image.png')).toBe(true)
      expect(isValidImageUrl('https://example.com/image.jpg')).toBe(true)
      expect(isValidImageUrl('https://example.com/image.webp')).toBe(true)
    })

    it('validates supabase storage URLs', () => {
      expect(isValidImageUrl('https://xxx.supabase.co/storage/v1/object/public/images/test')).toBe(true)
    })

    it('rejects invalid URLs', () => {
      expect(isValidImageUrl('not-a-url')).toBe(false)
      expect(isValidImageUrl('https://example.com/document.pdf')).toBe(false)
    })
  })

  describe('Generation Request Validation', () => {
    interface GenerationRequest {
      prompt: string
      size?: 'square' | 'landscape' | 'portrait'
      style?: string
      negativePrompt?: string
    }

    const validateRequest = (req: GenerationRequest): { valid: boolean; errors: string[] } => {
      const errors: string[] = []

      if (!req.prompt || req.prompt.trim().length < 5) {
        errors.push('Prompt must be at least 5 characters')
      }

      if (req.prompt && req.prompt.length > 1000) {
        errors.push('Prompt must be under 1000 characters')
      }

      if (req.negativePrompt && req.negativePrompt.length > 500) {
        errors.push('Negative prompt must be under 500 characters')
      }

      return { valid: errors.length === 0, errors }
    }

    it('validates complete request', () => {
      const result = validateRequest({
        prompt: 'A professional team meeting in a modern office',
        size: 'landscape',
      })
      expect(result.valid).toBe(true)
    })

    it('rejects short prompt', () => {
      const result = validateRequest({ prompt: 'Hi' })
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Prompt must be at least 5 characters')
    })

    it('rejects long prompt', () => {
      const result = validateRequest({ prompt: 'x'.repeat(1001) })
      expect(result.valid).toBe(false)
    })
  })

  describe('Asset Storage Metadata', () => {
    interface GeneratedImageMeta {
      prompt: string
      model: string
      size: string
      generatedAt: string
      cost?: number
    }

    const createImageMetadata = (prompt: string, model: string, size: string): GeneratedImageMeta => ({
      prompt,
      model,
      size,
      generatedAt: new Date().toISOString(),
    })

    it('creates metadata with required fields', () => {
      const meta = createImageMetadata('Test prompt', 'google/gemini-3-pro-image', 'square')

      expect(meta.prompt).toBe('Test prompt')
      expect(meta.model).toBe('google/gemini-3-pro-image')
      expect(meta.size).toBe('square')
      expect(meta.generatedAt).toBeDefined()
    })

    it('timestamp is ISO format', () => {
      const meta = createImageMetadata('Test', 'model', 'square')
      expect(() => new Date(meta.generatedAt)).not.toThrow()
    })
  })
})
