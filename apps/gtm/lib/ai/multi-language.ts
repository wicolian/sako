/**
 * Multi-Language Content Generation (Phase 2.3)
 * 
 * Native-quality translation and locale-aware content.
 */

import { generateText, generateObject } from '@/lib/ai/langsmith-ai'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'
import { MODELS } from '@/lib/ai/ai-sdk-client'

export interface SupportedLanguage {
  code: string
  name: string
  nativeName: string
  direction: 'ltr' | 'rtl'
  region?: string
  tier?: 'premium' | 'standard' | 'beta'
}

export interface TranslationResult {
  sourceLanguage: string
  targetLanguage: string
  sourceText: string
  translatedText: string
  adaptations: string[]
  confidence: number
}

export interface LocalizedContent {
  id: string
  campaignId: string
  language: string
  locale: string
  headline?: string
  subheadline?: string
  body?: string
  cta?: string
  metadata?: Record<string, unknown>
  isGenerated: boolean
  isApproved: boolean
  createdAt: string
}

// Supported languages (95+)
export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  // Tier 1: Premium (Best support)
  { code: 'en', name: 'English', nativeName: 'English', direction: 'ltr', tier: 'premium' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', direction: 'ltr', tier: 'premium' },
  { code: 'fr', name: 'French', nativeName: 'Français', direction: 'ltr', tier: 'premium' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', direction: 'ltr', tier: 'premium' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', direction: 'ltr', tier: 'premium' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', direction: 'ltr', tier: 'premium' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands', direction: 'ltr', tier: 'premium' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', direction: 'ltr', tier: 'premium' },
  { code: 'ko', name: 'Korean', nativeName: '한국어', direction: 'ltr', tier: 'premium' },
  { code: 'zh', name: 'Chinese (Simplified)', nativeName: '简体中文', direction: 'ltr', tier: 'premium' },
  { code: 'zh-TW', name: 'Chinese (Traditional)', nativeName: '繁體中文', direction: 'ltr', tier: 'premium' },
  
  // Tier 2: Standard
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', direction: 'rtl', tier: 'standard' },
  { code: 'he', name: 'Hebrew', nativeName: 'עברית', direction: 'rtl', tier: 'standard' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', direction: 'ltr', tier: 'standard' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', direction: 'ltr', tier: 'standard' },
  { code: 'pl', name: 'Polish', nativeName: 'Polski', direction: 'ltr', tier: 'standard' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', direction: 'ltr', tier: 'standard' },
  { code: 'sv', name: 'Swedish', nativeName: 'Svenska', direction: 'ltr', tier: 'standard' },
  { code: 'no', name: 'Norwegian', nativeName: 'Norsk', direction: 'ltr', tier: 'standard' },
  { code: 'da', name: 'Danish', nativeName: 'Dansk', direction: 'ltr', tier: 'standard' },
  { code: 'fi', name: 'Finnish', nativeName: 'Suomi', direction: 'ltr', tier: 'standard' },
  { code: 'cs', name: 'Czech', nativeName: 'Čeština', direction: 'ltr', tier: 'standard' },
  { code: 'el', name: 'Greek', nativeName: 'Ελληνικά', direction: 'ltr', tier: 'standard' },
  { code: 'hu', name: 'Hungarian', nativeName: 'Magyar', direction: 'ltr', tier: 'standard' },
  { code: 'ro', name: 'Romanian', nativeName: 'Română', direction: 'ltr', tier: 'standard' },
  { code: 'th', name: 'Thai', nativeName: 'ไทย', direction: 'ltr', tier: 'standard' },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt', direction: 'ltr', tier: 'standard' },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia', direction: 'ltr', tier: 'standard' },
  { code: 'ms', name: 'Malay', nativeName: 'Bahasa Melayu', direction: 'ltr', tier: 'standard' },
  { code: 'tl', name: 'Filipino', nativeName: 'Filipino', direction: 'ltr', tier: 'standard' },
  { code: 'uk', name: 'Ukrainian', nativeName: 'Українська', direction: 'ltr', tier: 'standard' },
  { code: 'bg', name: 'Bulgarian', nativeName: 'Български', direction: 'ltr', tier: 'standard' },
  { code: 'hr', name: 'Croatian', nativeName: 'Hrvatski', direction: 'ltr', tier: 'standard' },
  { code: 'sk', name: 'Slovak', nativeName: 'Slovenčina', direction: 'ltr', tier: 'standard' },
  { code: 'sl', name: 'Slovenian', nativeName: 'Slovenščina', direction: 'ltr', tier: 'standard' },
  { code: 'sr', name: 'Serbian', nativeName: 'Српски', direction: 'ltr', tier: 'standard' },
  { code: 'lt', name: 'Lithuanian', nativeName: 'Lietuvių', direction: 'ltr', tier: 'standard' },
  { code: 'lv', name: 'Latvian', nativeName: 'Latviešu', direction: 'ltr', tier: 'standard' },
  { code: 'et', name: 'Estonian', nativeName: 'Eesti', direction: 'ltr', tier: 'standard' },
  { code: 'ca', name: 'Catalan', nativeName: 'Català', direction: 'ltr', tier: 'standard' },
  { code: 'eu', name: 'Basque', nativeName: 'Euskara', direction: 'ltr', tier: 'standard' },
  { code: 'gl', name: 'Galician', nativeName: 'Galego', direction: 'ltr', tier: 'standard' },
  
  // Tier 3: Beta (Good but may need review)
  { code: 'af', name: 'Afrikaans', nativeName: 'Afrikaans', direction: 'ltr', tier: 'beta' },
  { code: 'sw', name: 'Swahili', nativeName: 'Kiswahili', direction: 'ltr', tier: 'beta' },
  { code: 'am', name: 'Amharic', nativeName: 'አማርኛ', direction: 'ltr', tier: 'beta' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', direction: 'ltr', tier: 'beta' },
  { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી', direction: 'ltr', tier: 'beta' },
  { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ', direction: 'ltr', tier: 'beta' },
  { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം', direction: 'ltr', tier: 'beta' },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी', direction: 'ltr', tier: 'beta' },
  { code: 'pa', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ', direction: 'ltr', tier: 'beta' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', direction: 'ltr', tier: 'beta' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు', direction: 'ltr', tier: 'beta' },
  { code: 'ur', name: 'Urdu', nativeName: 'اردو', direction: 'rtl', tier: 'beta' },
  { code: 'fa', name: 'Persian', nativeName: 'فارسی', direction: 'rtl', tier: 'beta' },
  { code: 'ne', name: 'Nepali', nativeName: 'नेपाली', direction: 'ltr', tier: 'beta' },
  { code: 'si', name: 'Sinhala', nativeName: 'සිංහල', direction: 'ltr', tier: 'beta' },
  { code: 'my', name: 'Burmese', nativeName: 'မြန်မာ', direction: 'ltr', tier: 'beta' },
  { code: 'km', name: 'Khmer', nativeName: 'ខ្មែរ', direction: 'ltr', tier: 'beta' },
  { code: 'lo', name: 'Lao', nativeName: 'ລາວ', direction: 'ltr', tier: 'beta' },
  { code: 'mn', name: 'Mongolian', nativeName: 'Монгол', direction: 'ltr', tier: 'beta' },
  { code: 'ka', name: 'Georgian', nativeName: 'ქართული', direction: 'ltr', tier: 'beta' },
  { code: 'hy', name: 'Armenian', nativeName: 'Հdelays', direction: 'ltr', tier: 'beta' },
  { code: 'az', name: 'Azerbaijani', nativeName: 'Azərbaycan', direction: 'ltr', tier: 'beta' },
  { code: 'kk', name: 'Kazakh', nativeName: 'Қазақ', direction: 'ltr', tier: 'beta' },
  { code: 'uz', name: 'Uzbek', nativeName: "O'zbek", direction: 'ltr', tier: 'beta' },
  { code: 'is', name: 'Icelandic', nativeName: 'Íslenska', direction: 'ltr', tier: 'beta' },
  { code: 'mt', name: 'Maltese', nativeName: 'Malti', direction: 'ltr', tier: 'beta' },
  { code: 'cy', name: 'Welsh', nativeName: 'Cymraeg', direction: 'ltr', tier: 'beta' },
  { code: 'ga', name: 'Irish', nativeName: 'Gaeilge', direction: 'ltr', tier: 'beta' },
  { code: 'gd', name: 'Scottish Gaelic', nativeName: 'Gàidhlig', direction: 'ltr', tier: 'beta' },
  { code: 'sq', name: 'Albanian', nativeName: 'Shqip', direction: 'ltr', tier: 'beta' },
  { code: 'mk', name: 'Macedonian', nativeName: 'Македонски', direction: 'ltr', tier: 'beta' },
  { code: 'bs', name: 'Bosnian', nativeName: 'Bosanski', direction: 'ltr', tier: 'beta' },
  { code: 'lb', name: 'Luxembourgish', nativeName: 'Lëtzebuergesch', direction: 'ltr', tier: 'beta' },
  { code: 'be', name: 'Belarusian', nativeName: 'Беларуская', direction: 'ltr', tier: 'beta' },
  { code: 'zu', name: 'Zulu', nativeName: 'IsiZulu', direction: 'ltr', tier: 'beta' },
  { code: 'xh', name: 'Xhosa', nativeName: 'IsiXhosa', direction: 'ltr', tier: 'beta' },
  { code: 'yo', name: 'Yoruba', nativeName: 'Yorùbá', direction: 'ltr', tier: 'beta' },
  { code: 'ig', name: 'Igbo', nativeName: 'Igbo', direction: 'ltr', tier: 'beta' },
  { code: 'ha', name: 'Hausa', nativeName: 'Hausa', direction: 'ltr', tier: 'beta' },
  { code: 'so', name: 'Somali', nativeName: 'Soomaali', direction: 'ltr', tier: 'beta' },
  { code: 'rw', name: 'Kinyarwanda', nativeName: 'Ikinyarwanda', direction: 'ltr', tier: 'beta' },
  { code: 'sn', name: 'Shona', nativeName: 'ChiShona', direction: 'ltr', tier: 'beta' },
  { code: 'mg', name: 'Malagasy', nativeName: 'Malagasy', direction: 'ltr', tier: 'beta' },
  { code: 'eo', name: 'Esperanto', nativeName: 'Esperanto', direction: 'ltr', tier: 'beta' },
  { code: 'la', name: 'Latin', nativeName: 'Latina', direction: 'ltr', tier: 'beta' },
  { code: 'jv', name: 'Javanese', nativeName: 'Basa Jawa', direction: 'ltr', tier: 'beta' },
  { code: 'su', name: 'Sundanese', nativeName: 'Basa Sunda', direction: 'ltr', tier: 'beta' },
  { code: 'haw', name: 'Hawaiian', nativeName: 'ʻŌlelo Hawaiʻi', direction: 'ltr', tier: 'beta' },
  { code: 'mi', name: 'Maori', nativeName: 'Te Reo Māori', direction: 'ltr', tier: 'beta' },
  { code: 'sm', name: 'Samoan', nativeName: 'Gagana Samoa', direction: 'ltr', tier: 'beta' },
]

const translationSchema = z.object({
  translated_text: z.string(),
  cultural_adaptations: z.array(z.string()).describe('Cultural adaptations made'),
  localization_notes: z.array(z.string()).describe('Notes for localizers'),
  confidence_score: z.number().min(0).max(100),
})

const bulkTranslationSchema = z.object({
  translations: z.array(z.object({
    field: z.string(),
    original: z.string(),
    translated: z.string(),
    notes: z.string().optional(),
  })),
  overall_notes: z.string(),
})

/**
 * Translate marketing content with cultural adaptation
 */
export async function translateContent(
  sourceText: string,
  targetLanguage: string,
  options?: {
    sourceLanguage?: string
    industry?: string
    tone?: string
    glossary?: Record<string, string>
    preservePlaceholders?: boolean
  }
): Promise<TranslationResult> {
  const targetLang = SUPPORTED_LANGUAGES.find(l => l.code === targetLanguage)
  
  if (!targetLang) {
    throw new Error(`Unsupported language: ${targetLanguage}`)
  }

  const glossaryContext = options?.glossary
    ? `\n\nGlossary (use these exact translations):\n${Object.entries(options.glossary).map(([k, v]) => `- "${k}" → "${v}"`).join('\n')}`
    : ''

  const { object } = await generateObject({
    model: MODELS.CREATIVE,
    schema: translationSchema,
    system: `You are an expert marketing translator specializing in ${targetLang.name} (${targetLang.nativeName}).

Your goal is to create native-quality marketing translations that:
- Sound natural to native ${targetLang.name} speakers
- Preserve marketing impact and persuasion
- Adapt cultural references appropriately
- Maintain the original tone and intent
- Use market-appropriate terminology

${options?.industry ? `Industry context: ${options.industry}` : ''}
${options?.tone ? `Tone to maintain: ${options.tone}` : ''}
${options?.preservePlaceholders ? 'Preserve placeholders like {{name}}, {variable}, or %s exactly as they appear.' : ''}
${glossaryContext}

Important: This is marketing translation, not literal translation. Adapt idioms, metaphors, and cultural references to work in the target market.`,
    prompt: `Translate this marketing content from ${options?.sourceLanguage || 'English'} to ${targetLang.name}:\n\n${sourceText}`,
    temperature: 0.5,
  })

  const result = object as { translated_text: string; cultural_adaptations: string[]; confidence_score: number }
  return {
    sourceLanguage: options?.sourceLanguage || 'en',
    targetLanguage,
    sourceText,
    translatedText: result.translated_text,
    adaptations: result.cultural_adaptations,
    confidence: result.confidence_score,
  }
}

/**
 * Translate multiple content fields at once
 */
export async function translateCampaignContent(
  content: {
    headline?: string
    subheadline?: string
    body?: string
    cta?: string
    [key: string]: string | undefined
  },
  targetLanguage: string,
  options?: {
    sourceLanguage?: string
    industry?: string
    tone?: string
    glossary?: Record<string, string>
  }
): Promise<Record<string, string>> {
  const targetLang = SUPPORTED_LANGUAGES.find(l => l.code === targetLanguage)
  
  if (!targetLang) {
    throw new Error(`Unsupported language: ${targetLanguage}`)
  }

  const fields = Object.entries(content)
    .filter(([_, value]) => value)
    .map(([field, value]) => `${field}: "${value}"`)
    .join('\n')

  const glossaryContext = options?.glossary
    ? `\n\nGlossary:\n${Object.entries(options.glossary).map(([k, v]) => `- "${k}" → "${v}"`).join('\n')}`
    : ''

  const { object } = await generateObject({
    model: MODELS.CREATIVE,
    schema: bulkTranslationSchema,
    system: `You are an expert marketing translator for ${targetLang.name}.

Translate all the following marketing content fields, maintaining:
- Consistent terminology across all fields
- Appropriate length for each field type (headlines should be punchy, CTAs should be action-oriented)
- Native-quality fluency
${options?.industry ? `\nIndustry: ${options.industry}` : ''}
${options?.tone ? `\nTone: ${options.tone}` : ''}
${glossaryContext}`,
    prompt: `Translate these marketing content fields to ${targetLang.name}:\n\n${fields}`,
    temperature: 0.5,
  })

  // Convert to simple key-value result
  const resultObj = object as { translations: { field: string; translated: string }[] }
  const result: Record<string, string> = {}
  for (const translation of resultObj.translations) {
    result[translation.field] = translation.translated
  }

  return result
}

/**
 * Save localized content for a campaign
 */
export async function saveLocalizedContent(
  campaignId: string,
  language: string,
  locale: string,
  content: {
    headline?: string
    subheadline?: string
    body?: string
    cta?: string
    metadata?: Record<string, unknown>
  },
  isGenerated: boolean = true
): Promise<LocalizedContent | null> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('campaign_localizations')
    .upsert({
      campaign_id: campaignId,
      language,
      locale,
      headline: content.headline,
      subheadline: content.subheadline,
      body: content.body,
      cta: content.cta,
      metadata: content.metadata,
      is_generated: isGenerated,
      is_approved: false,
    }, { onConflict: 'campaign_id,locale' })
    .select()
    .single()

  if (error) {
    console.error('Failed to save localized content:', error)
    return null
  }

  return {
    id: data.id,
    campaignId: data.campaign_id,
    language: data.language,
    locale: data.locale,
    headline: data.headline,
    subheadline: data.subheadline,
    body: data.body,
    cta: data.cta,
    metadata: data.metadata,
    isGenerated: data.is_generated,
    isApproved: data.is_approved,
    createdAt: data.created_at,
  }
}

/**
 * Get localized content for a campaign
 */
export async function getCampaignLocalizations(campaignId: string): Promise<LocalizedContent[]> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('campaign_localizations')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('locale')

  if (error) {
    console.error('Failed to get localizations:', error)
    return []
  }

  return (data || []).map(d => ({
    id: d.id,
    campaignId: d.campaign_id,
    language: d.language,
    locale: d.locale,
    headline: d.headline,
    subheadline: d.subheadline,
    body: d.body,
    cta: d.cta,
    metadata: d.metadata,
    isGenerated: d.is_generated,
    isApproved: d.is_approved,
    createdAt: d.created_at,
  }))
}

/**
 * Generate content in multiple languages at once
 */
export async function generateMultilingualContent(
  prompt: string,
  targetLanguages: string[],
  options?: {
    industry?: string
    tone?: string
  }
): Promise<Record<string, string>> {
  // First generate in English
  const { text: englishContent } = await generateText({
    model: MODELS.CREATIVE,
    system: `You are a marketing copywriter.
${options?.industry ? `Industry: ${options.industry}` : ''}
${options?.tone ? `Tone: ${options.tone}` : ''}`,
    prompt,
    temperature: 0.7,
  })

  // Then translate to all target languages in parallel
  const translations = await Promise.all(
    targetLanguages
      .filter(lang => lang !== 'en')
      .map(async lang => {
        const result = await translateContent(englishContent, lang, options)
        return { lang, text: result.translatedText }
      })
  )

  // Build result object
  const result: Record<string, string> = { en: englishContent }
  for (const { lang, text } of translations) {
    result[lang] = text
  }

  return result
}

/**
 * Detect content language
 */
export async function detectLanguage(text: string): Promise<{
  language: string
  confidence: number
}> {
  const { object } = await generateObject({
    model: MODELS.FAST,
    schema: z.object({
      language_code: z.string(),
      language_name: z.string(),
      confidence: z.number().min(0).max(100),
    }),
    system: 'Detect the language of the given text.',
    prompt: `What language is this text written in?\n\n"${text.substring(0, 500)}"`,
    temperature: 0.1,
  })

  const result = object as { language_code: string; confidence: number }
  return {
    language: result.language_code,
    confidence: result.confidence,
  }
}

/**
 * Get available languages for a workspace
 */
export async function getWorkspaceLanguages(workspaceId: string): Promise<string[]> {
  const supabase = createServiceClient()

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('settings')
    .eq('id', workspaceId)
    .single()

  const settings = (workspace?.settings || {}) as Record<string, unknown>
  const enabledLanguages = settings.enabled_languages as string[] | undefined

  return enabledLanguages || ['en']
}

/**
 * Check if a language is supported
 */
export function isLanguageSupported(languageCode: string): boolean {
  return SUPPORTED_LANGUAGES.some(l => l.code === languageCode)
}

/**
 * Get language info
 */
export function getLanguageInfo(languageCode: string): SupportedLanguage | undefined {
  return SUPPORTED_LANGUAGES.find(l => l.code === languageCode)
}
