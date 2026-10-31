/**
 * Multi-Language Support Unit Tests
 * 
 * Tests for the language detection and translation system.
 */

import { describe, it, expect } from 'vitest'

describe('Multi-Language Support', () => {
  // =========================================================================
  // Language Configuration
  // =========================================================================

  describe('Language Configuration', () => {
    const PRIMARY_LANGUAGES = [
      { code: 'en', name: 'English', nativeName: 'English' },
      { code: 'es', name: 'Spanish', nativeName: 'Español' },
      { code: 'fr', name: 'French', nativeName: 'Français' },
      { code: 'de', name: 'German', nativeName: 'Deutsch' },
      { code: 'it', name: 'Italian', nativeName: 'Italiano' },
      { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
      { code: 'nl', name: 'Dutch', nativeName: 'Nederlands' },
      { code: 'pl', name: 'Polish', nativeName: 'Polski' },
      { code: 'ru', name: 'Russian', nativeName: 'Русский' },
      { code: 'ja', name: 'Japanese', nativeName: '日本語' },
      { code: 'ko', name: 'Korean', nativeName: '한국어' },
      { code: 'zh', name: 'Chinese', nativeName: '中文' },
      { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
      { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
      { code: 'tr', name: 'Turkish', nativeName: 'Türkçe' },
      { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt' },
      { code: 'th', name: 'Thai', nativeName: 'ไทย' },
      { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia' },
      { code: 'ms', name: 'Malay', nativeName: 'Bahasa Melayu' },
      { code: 'sv', name: 'Swedish', nativeName: 'Svenska' },
    ]

    it('has at least 20 primary languages', () => {
      expect(PRIMARY_LANGUAGES.length).toBeGreaterThanOrEqual(20)
    })

    it('all languages have required fields', () => {
      for (const lang of PRIMARY_LANGUAGES) {
        expect(lang.code).toBeDefined()
        expect(lang.name).toBeDefined()
        expect(lang.nativeName).toBeDefined()
        expect(lang.code.length).toBeLessThanOrEqual(5)
      }
    })

    it('language codes are unique', () => {
      const codes = PRIMARY_LANGUAGES.map(l => l.code)
      const uniqueCodes = new Set(codes)
      expect(uniqueCodes.size).toBe(codes.length)
    })
  })

  // =========================================================================
  // Language Detection
  // =========================================================================

  describe('Language Detection', () => {
    // Simple character-based detection for common scripts
    const detectLanguageScript = (text: string): string => {
      if (/[\u3040-\u309f\u30a0-\u30ff]/.test(text)) return 'japanese'
      // Check for CJK characters
      if (/[\u4e00-\u9fff]/.test(text)) return 'chinese'
      if (/[\uac00-\ud7af]/.test(text)) return 'korean'

      // Check for Arabic
      if (/[\u0600-\u06ff]/.test(text)) return 'arabic'

      // Check for Cyrillic
      if (/[\u0400-\u04ff]/.test(text)) return 'cyrillic'

      // Check for Thai
      if (/[\u0e00-\u0e7f]/.test(text)) return 'thai'

      // Default to Latin
      return 'latin'
    }

    it('detects Chinese characters', () => {
      expect(detectLanguageScript('这是中文')).toBe('chinese')
    })

    it('detects Japanese characters', () => {
      expect(detectLanguageScript('これは日本語です')).toBe('japanese')
    })

    it('detects Korean characters', () => {
      expect(detectLanguageScript('이것은 한국어입니다')).toBe('korean')
    })

    it('detects Arabic characters', () => {
      expect(detectLanguageScript('هذا نص عربي')).toBe('arabic')
    })

    it('detects Cyrillic characters', () => {
      expect(detectLanguageScript('Привет мир')).toBe('cyrillic')
    })

    it('detects Thai characters', () => {
      expect(detectLanguageScript('นี่คือภาษาไทย')).toBe('thai')
    })

    it('defaults to Latin for English', () => {
      expect(detectLanguageScript('This is English')).toBe('latin')
    })
  })

  // =========================================================================
  // RTL Support
  // =========================================================================

  describe('RTL Language Support', () => {
    const RTL_LANGUAGES = ['ar', 'he', 'fa', 'ur']

    const isRTL = (languageCode: string): boolean => {
      return RTL_LANGUAGES.includes(languageCode)
    }

    it('identifies Arabic as RTL', () => {
      expect(isRTL('ar')).toBe(true)
    })

    it('identifies Hebrew as RTL', () => {
      expect(isRTL('he')).toBe(true)
    })

    it('identifies Farsi as RTL', () => {
      expect(isRTL('fa')).toBe(true)
    })

    it('identifies Urdu as RTL', () => {
      expect(isRTL('ur')).toBe(true)
    })

    it('identifies English as LTR', () => {
      expect(isRTL('en')).toBe(false)
    })

    it('identifies Chinese as LTR', () => {
      expect(isRTL('zh')).toBe(false)
    })
  })

  // =========================================================================
  // Translation Request Formatting
  // =========================================================================

  describe('Translation Request', () => {
    interface TranslationRequest {
      text: string
      sourceLanguage: string
      targetLanguage: string
      context?: string
      preserveFormatting?: boolean
    }

    const validateTranslationRequest = (req: TranslationRequest): { valid: boolean; errors: string[] } => {
      const errors: string[] = []

      if (!req.text || req.text.trim().length === 0) {
        errors.push('Text is required')
      }

      if (!req.sourceLanguage) {
        errors.push('Source language is required')
      }

      if (!req.targetLanguage) {
        errors.push('Target language is required')
      }

      if (req.sourceLanguage === req.targetLanguage) {
        errors.push('Source and target languages must be different')
      }

      return { valid: errors.length === 0, errors }
    }

    it('validates complete request', () => {
      const result = validateTranslationRequest({
        text: 'Hello world',
        sourceLanguage: 'en',
        targetLanguage: 'es',
      })

      expect(result.valid).toBe(true)
    })

    it('rejects empty text', () => {
      const result = validateTranslationRequest({
        text: '',
        sourceLanguage: 'en',
        targetLanguage: 'es',
      })

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Text is required')
    })

    it('rejects missing source language', () => {
      const result = validateTranslationRequest({
        text: 'Hello',
        sourceLanguage: '',
        targetLanguage: 'es',
      })

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Source language is required')
    })

    it('rejects same source and target', () => {
      const result = validateTranslationRequest({
        text: 'Hello',
        sourceLanguage: 'en',
        targetLanguage: 'en',
      })

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Source and target languages must be different')
    })
  })

  // =========================================================================
  // Content Preservation
  // =========================================================================

  describe('Content Preservation', () => {
    // Patterns to preserve during translation
    const extractPreservables = (text: string): { placeholders: string[]; urls: string[]; variables: string[] } => {
      const placeholders: string[] = []
      const urls: string[] = []
      const variables: string[] = []

      // Extract URLs
      const urlRegex = /https?:\/\/[^\s]+/g
      const urlMatches = text.match(urlRegex)
      if (urlMatches) urls.push(...urlMatches)

      // Extract template variables like {{name}} or {name}
      const varRegex = /\{\{?\w+\}?\}/g
      const varMatches = text.match(varRegex)
      if (varMatches) variables.push(...varMatches)

      // Extract placeholders like %s or %d
      const phRegex = /%[sd]/g
      const phMatches = text.match(phRegex)
      if (phMatches) placeholders.push(...phMatches)

      return { placeholders, urls, variables }
    }

    it('extracts URLs', () => {
      const result = extractPreservables('Visit https://example.com for more info')
      expect(result.urls).toContain('https://example.com')
    })

    it('extracts template variables', () => {
      const result = extractPreservables('Hello {{name}}, welcome to {company}')
      expect(result.variables).toContain('{{name}}')
      expect(result.variables).toContain('{company}')
    })

    it('extracts printf placeholders', () => {
      const result = extractPreservables('Error code %d: %s')
      expect(result.placeholders).toContain('%d')
      expect(result.placeholders).toContain('%s')
    })

    it('handles text without preservables', () => {
      const result = extractPreservables('Simple text without special content')
      expect(result.urls).toHaveLength(0)
      expect(result.variables).toHaveLength(0)
      expect(result.placeholders).toHaveLength(0)
    })
  })

  // =========================================================================
  // Language Name Formatting
  // =========================================================================

  describe('Language Name Formatting', () => {
    const formatLanguageForUI = (code: string, name: string, nativeName: string): string => {
      if (name === nativeName) return name
      return `${name} (${nativeName})`
    }

    it('formats language with different native name', () => {
      const result = formatLanguageForUI('ja', 'Japanese', '日本語')
      expect(result).toBe('Japanese (日本語)')
    })

    it('formats language with same native name', () => {
      const result = formatLanguageForUI('en', 'English', 'English')
      expect(result).toBe('English')
    })

    it('formats Spanish correctly', () => {
      const result = formatLanguageForUI('es', 'Spanish', 'Español')
      expect(result).toBe('Spanish (Español)')
    })
  })
})
