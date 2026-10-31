/**
 * Multi-Language Support (Phase 1.4)
 * 
 * Support for import { Database } from '@/lib/supabase/types'


95+ languages in content generation.
 */

import { createServiceClient } from '@/lib/supabase/service'

export interface Language {
  code: string
  name: string
  nativeName: string
  direction: 'ltr' | 'rtl'
  tier: 'premium' | 'standard' | 'beta'
}

// Language map with all supported languages
export const LANGUAGE_MAP: Record<string, Language> = {
  // Tier 1: Premium (Best support)
  en: { code: 'en', name: 'English', nativeName: 'English', direction: 'ltr', tier: 'premium' },
  es: { code: 'es', name: 'Spanish', nativeName: 'Español', direction: 'ltr', tier: 'premium' },
  fr: { code: 'fr', name: 'French', nativeName: 'Français', direction: 'ltr', tier: 'premium' },
  de: { code: 'de', name: 'German', nativeName: 'Deutsch', direction: 'ltr', tier: 'premium' },
  pt: { code: 'pt', name: 'Portuguese', nativeName: 'Português', direction: 'ltr', tier: 'premium' },
  it: { code: 'it', name: 'Italian', nativeName: 'Italiano', direction: 'ltr', tier: 'premium' },
  nl: { code: 'nl', name: 'Dutch', nativeName: 'Nederlands', direction: 'ltr', tier: 'premium' },
  ja: { code: 'ja', name: 'Japanese', nativeName: '日本語', direction: 'ltr', tier: 'premium' },
  ko: { code: 'ko', name: 'Korean', nativeName: '한국어', direction: 'ltr', tier: 'premium' },
  zh: { code: 'zh', name: 'Chinese (Simplified)', nativeName: '简体中文', direction: 'ltr', tier: 'premium' },
  'zh-TW': { code: 'zh-TW', name: 'Chinese (Traditional)', nativeName: '繁體中文', direction: 'ltr', tier: 'premium' },
  
  // Tier 2: Standard
  ar: { code: 'ar', name: 'Arabic', nativeName: 'العربية', direction: 'rtl', tier: 'standard' },
  he: { code: 'he', name: 'Hebrew', nativeName: 'עברית', direction: 'rtl', tier: 'standard' },
  hi: { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', direction: 'ltr', tier: 'standard' },
  ru: { code: 'ru', name: 'Russian', nativeName: 'Русский', direction: 'ltr', tier: 'standard' },
  pl: { code: 'pl', name: 'Polish', nativeName: 'Polski', direction: 'ltr', tier: 'standard' },
  tr: { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', direction: 'ltr', tier: 'standard' },
  sv: { code: 'sv', name: 'Swedish', nativeName: 'Svenska', direction: 'ltr', tier: 'standard' },
  no: { code: 'no', name: 'Norwegian', nativeName: 'Norsk', direction: 'ltr', tier: 'standard' },
  da: { code: 'da', name: 'Danish', nativeName: 'Dansk', direction: 'ltr', tier: 'standard' },
  fi: { code: 'fi', name: 'Finnish', nativeName: 'Suomi', direction: 'ltr', tier: 'standard' },
  cs: { code: 'cs', name: 'Czech', nativeName: 'Čeština', direction: 'ltr', tier: 'standard' },
  el: { code: 'el', name: 'Greek', nativeName: 'Ελληνικά', direction: 'ltr', tier: 'standard' },
  hu: { code: 'hu', name: 'Hungarian', nativeName: 'Magyar', direction: 'ltr', tier: 'standard' },
  ro: { code: 'ro', name: 'Romanian', nativeName: 'Română', direction: 'ltr', tier: 'standard' },
  th: { code: 'th', name: 'Thai', nativeName: 'ไทย', direction: 'ltr', tier: 'standard' },
  vi: { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt', direction: 'ltr', tier: 'standard' },
  id: { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia', direction: 'ltr', tier: 'standard' },
  ms: { code: 'ms', name: 'Malay', nativeName: 'Bahasa Melayu', direction: 'ltr', tier: 'standard' },
  tl: { code: 'tl', name: 'Filipino', nativeName: 'Filipino', direction: 'ltr', tier: 'standard' },
  uk: { code: 'uk', name: 'Ukrainian', nativeName: 'Українська', direction: 'ltr', tier: 'standard' },
  
  // Tier 3: Beta (more languages...)
  af: { code: 'af', name: 'Afrikaans', nativeName: 'Afrikaans', direction: 'ltr', tier: 'beta' },
  sw: { code: 'sw', name: 'Swahili', nativeName: 'Kiswahili', direction: 'ltr', tier: 'beta' },
  bn: { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', direction: 'ltr', tier: 'beta' },
  ta: { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', direction: 'ltr', tier: 'beta' },
  te: { code: 'te', name: 'Telugu', nativeName: 'తెలుగు', direction: 'ltr', tier: 'beta' },
  ur: { code: 'ur', name: 'Urdu', nativeName: 'اردو', direction: 'rtl', tier: 'beta' },
  fa: { code: 'fa', name: 'Persian', nativeName: 'فارسی', direction: 'rtl', tier: 'beta' },
}

/**
 * Get language context for AI prompts
 */
export function getLanguageContext(languageCode: string): string {
  const lang = LANGUAGE_MAP[languageCode] || LANGUAGE_MAP.en
  
  return `Generate all content in ${lang.name} (${lang.nativeName}).
Ensure cultural appropriateness and natural phrasing for native ${lang.name} speakers.
Text direction: ${lang.direction === 'rtl' ? 'right-to-left' : 'left-to-right'}.
${lang.tier === 'beta' ? 'Note: This language may require native speaker review for nuance.' : ''}`
}

/**
 * Get language by code
 */
export function getLanguage(code: string): Language | undefined {
  return LANGUAGE_MAP[code]
}

/**
 * Get all supported languages
 */
export function getAllLanguages(): Language[] {
  return Object.values(LANGUAGE_MAP)
}

/**
 * Get languages by tier
 */
export function getLanguagesByTier(tier: 'premium' | 'standard' | 'beta'): Language[] {
  return Object.values(LANGUAGE_MAP).filter(lang => lang.tier === tier)
}

/**
 * Get RTL languages
 */
export function getRTLLanguages(): Language[] {
  return Object.values(LANGUAGE_MAP).filter(lang => lang.direction === 'rtl')
}

/**
 * Track language usage for analytics
 */
export async function trackLanguageUsage(
  workspaceId: string,
  languageCode: string,
  contentType: string
): Promise<void> {
  const supabase = createServiceClient()
  
  try {
    const { error } = await supabase.rpc('increment_language_usage', {
      p_workspace_id: workspaceId,
      p_language_code: languageCode,
      p_content_type: contentType,
    })
    if (error) {
      console.warn('Failed to track language usage:', error.message)
    }
  } catch {
    // Non-critical, log and continue
    console.warn('Failed to track language usage')
  }
}

/**
 * Get language usage stats for a workspace
 */
export async function getLanguageUsageStats(workspaceId: string): Promise<Array<{
  language_code: string
  language_name: string
  generation_count: number
  last_used_at: string
}>> {
  const supabase = createServiceClient()
  
  const { data, error } = await supabase
    .from('language_usage_stats')
    .select('language_code, generation_count, last_used_at')
    .eq('workspace_id', workspaceId)
    .order('generation_count', { ascending: false })

  if (error) {
    console.error('Failed to fetch language usage stats:', error)
    return []
  }

  return (data || []).map(stat => ({
    ...stat,
    language_name: LANGUAGE_MAP[stat.language_code]?.name || stat.language_code,
  }))
}

/**
 * Validate language code
 */
export function isValidLanguage(code: string): boolean {
  return code in LANGUAGE_MAP
}

/**
 * Get language display name
 */
export function getLanguageDisplayName(code: string, showNative = false): string {
  const lang = LANGUAGE_MAP[code]
  if (!lang) return code
  return showNative ? `${lang.name} (${lang.nativeName})` : lang.name
}

/**
 * Get language flag emoji (approximation using regional indicators)
 */
export function getLanguageFlag(code: string): string {
  const countryCodeMap: Record<string, string> = {
    en: 'US', es: 'ES', fr: 'FR', de: 'DE', pt: 'PT', it: 'IT', nl: 'NL',
    ja: 'JP', ko: 'KR', zh: 'CN', 'zh-TW': 'TW', ar: 'SA', he: 'IL',
    hi: 'IN', ru: 'RU', pl: 'PL', tr: 'TR', sv: 'SE', no: 'NO', da: 'DK',
    fi: 'FI', cs: 'CZ', el: 'GR', hu: 'HU', ro: 'RO', th: 'TH', vi: 'VN',
    id: 'ID', ms: 'MY', tl: 'PH', uk: 'UA',
  }
  
  const countryCode = countryCodeMap[code]
  if (!countryCode) return '🌐'
  
  // Convert country code to flag emoji using regional indicators
  const codePoints = [...countryCode].map(
    char => 0x1F1E6 + char.charCodeAt(0) - 65
  )
  return String.fromCodePoint(...codePoints)
}
