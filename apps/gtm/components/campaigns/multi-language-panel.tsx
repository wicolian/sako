'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Globe, Languages, Plus, Check, Copy, RefreshCw, ChevronDown, Sparkles, Flag, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

interface Translation {
  language: string
  languageNative: string
  code: string
  content: string
  culturalNotes?: string
  status: 'pending' | 'translating' | 'completed' | 'error'
}

interface MultiLanguagePanelProps {
  sourceContent: string
  sourceLanguage?: string
  campaignId?: string
  onTranslationComplete?: (translations: Translation[]) => void
}

const POPULAR_LANGUAGES = [
  { code: 'es', name: 'Spanish', native: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'French', native: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'German', native: 'Deutsch', flag: '🇩🇪' },
  { code: 'pt', name: 'Portuguese', native: 'Português', flag: '🇧🇷' },
  { code: 'it', name: 'Italian', native: 'Italiano', flag: '🇮🇹' },
  { code: 'ja', name: 'Japanese', native: '日本語', flag: '🇯🇵' },
  { code: 'ko', name: 'Korean', native: '한국어', flag: '🇰🇷' },
  { code: 'zh', name: 'Chinese', native: '中文', flag: '🇨🇳' },
  { code: 'ar', name: 'Arabic', native: 'العربية', flag: '🇸🇦' },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी', flag: '🇮🇳' },
  { code: 'nl', name: 'Dutch', native: 'Nederlands', flag: '🇳🇱' },
  { code: 'pl', name: 'Polish', native: 'Polski', flag: '🇵🇱' },
  { code: 'ru', name: 'Russian', native: 'Русский', flag: '🇷🇺' },
  { code: 'sv', name: 'Swedish', native: 'Svenska', flag: '🇸🇪' },
  { code: 'tr', name: 'Turkish', native: 'Türkçe', flag: '🇹🇷' },
]

export function MultiLanguagePanel({
  sourceContent,
  sourceLanguage = 'en',
  campaignId,
  onTranslationComplete,
}: MultiLanguagePanelProps) {
  const [translations, setTranslations] = useState<Translation[]>([])
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([])
  const [translating, setTranslating] = useState(false)
  const [showLanguageSelector, setShowLanguageSelector] = useState(false)
  const [expandedTranslation, setExpandedTranslation] = useState<string | null>(null)

  const toggleLanguage = (code: string) => {
    setSelectedLanguages(prev =>
      prev.includes(code)
        ? prev.filter(c => c !== code)
        : [...prev, code]
    )
  }

  const handleTranslate = async () => {
    if (selectedLanguages.length === 0 || !sourceContent) return

    setTranslating(true)

    // Initialize translations as pending
    const newTranslations = selectedLanguages.map(code => {
      const lang = POPULAR_LANGUAGES.find(l => l.code === code)!
      return {
        language: lang.name,
        languageNative: lang.native,
        code,
        content: '',
        status: 'pending' as const,
      }
    })
    setTranslations(newTranslations)

    // Translate each language
    for (const translation of newTranslations) {
      try {
        // Update status to translating
        setTranslations(prev =>
          prev.map(t =>
            t.code === translation.code
              ? { ...t, status: 'translating' as const }
              : t
          )
        )

        const response = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: sourceContent,
            target_language: translation.code,
            source_language: sourceLanguage,
            campaign_id: campaignId,
          }),
        })

        if (response.ok) {
          const data = await response.json()
          setTranslations(prev =>
            prev.map(t =>
              t.code === translation.code
                ? {
                    ...t,
                    content: data.translation,
                    culturalNotes: data.cultural_notes,
                    status: 'completed' as const,
                  }
                : t
            )
          )
        } else {
          setTranslations(prev =>
            prev.map(t =>
              t.code === translation.code
                ? { ...t, status: 'error' as const }
                : t
            )
          )
        }
      } catch {
        setTranslations(prev =>
          prev.map(t =>
            t.code === translation.code
              ? { ...t, status: 'error' as const }
              : t
          )
        )
      }
    }

    setTranslating(false)
    setSelectedLanguages([])
  }

  const copyToClipboard = useCallback(async (text: string) => {
    await navigator.clipboard.writeText(text)
  }, [])

  const removeTranslation = (code: string) => {
    setTranslations(prev => prev.filter(t => t.code !== code))
  }

  const retryTranslation = async (code: string) => {
    const lang = POPULAR_LANGUAGES.find(l => l.code === code)!

    setTranslations(prev =>
      prev.map(t =>
        t.code === code
          ? { ...t, status: 'translating' as const }
          : t
      )
    )

    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: sourceContent,
          target_language: code,
          source_language: sourceLanguage,
          campaign_id: campaignId,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setTranslations(prev =>
          prev.map(t =>
            t.code === code
              ? {
                  ...t,
                  content: data.translation,
                  culturalNotes: data.cultural_notes,
                  status: 'completed' as const,
                }
              : t
          )
        )
      } else {
        setTranslations(prev =>
          prev.map(t =>
            t.code === code
              ? { ...t, status: 'error' as const }
              : t
          )
        )
      }
    } catch {
      setTranslations(prev =>
        prev.map(t =>
          t.code === code
            ? { ...t, status: 'error' as const }
            : t
        )
      )
    }
  }

  const completedCount = translations.filter(t => t.status === 'completed').length
  const totalCount = translations.length
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe className="w-5 h-5 text-amber-400" />
          <h3 className="font-semibold">Multi-Language</h3>
        </div>
        <Badge variant="outline" className="bg-card border-border">
          {translations.length} languages
        </Badge>
      </div>

      {/* Language selector */}
      <div className="relative">
        <Button
          variant="outline"
          className="w-full justify-between bg-card border-border"
          onClick={() => setShowLanguageSelector(!showLanguageSelector)}
        >
          <span className="flex items-center gap-2">
            <Languages className="w-4 h-4" />
            {selectedLanguages.length > 0
              ? `${selectedLanguages.length} languages selected`
              : 'Select languages to translate'
            }
          </span>
          <ChevronDown className={cn(
            "w-4 h-4 transition-transform",
            showLanguageSelector && "rotate-180"
          )} />
        </Button>

        <AnimatePresence>
          {showLanguageSelector && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute z-10 w-full mt-2 p-4 rounded-lg bg-card border border-border shadow-xl"
            >
              <div className="grid grid-cols-3 gap-2 max-h-60 overflow-y-auto">
                {POPULAR_LANGUAGES.map((lang) => {
                  const isSelected = selectedLanguages.includes(lang.code)
                  const alreadyTranslated = translations.some(t => t.code === lang.code)

                  return (
                    <button
                      key={lang.code}
                      onClick={() => !alreadyTranslated && toggleLanguage(lang.code)}
                      disabled={alreadyTranslated}
                      className={cn(
                        "flex items-center gap-2 p-2 rounded-lg text-left text-sm transition-colors",
                        isSelected && "bg-amber-950/50 border border-amber-800",
                        !isSelected && !alreadyTranslated && "hover:bg-muted",
                        alreadyTranslated && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <span className="text-lg">{lang.flag}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{lang.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{lang.native}</p>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-amber-400" />}
                      {alreadyTranslated && <Check className="w-4 h-4 text-emerald-400" />}
                    </button>
                  )
                })}
              </div>

              <div className="flex items-center justify-end gap-2 mt-4 pt-4 border-t border-border">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowLanguageSelector(false)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    handleTranslate()
                    setShowLanguageSelector(false)
                  }}
                  disabled={selectedLanguages.length === 0 || translating}
                  className="bg-gradient-to-r from-amber-500 to-orange-500"
                >
                  <Sparkles className="w-4 h-4 mr-1" />
                  Translate {selectedLanguages.length > 0 && `(${selectedLanguages.length})`}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Progress bar during translation */}
      {translating && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Translating...</span>
            <span className="text-amber-400">{completedCount}/{totalCount}</span>
          </div>
          <Progress value={progress} className="h-2 bg-muted" />
        </div>
      )}

      {/* Translations list */}
      {translations.length > 0 && (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {translations.map((translation, index) => {
              const lang = POPULAR_LANGUAGES.find(l => l.code === translation.code)
              const isExpanded = expandedTranslation === translation.code

              return (
                <motion.div
                  key={translation.code}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: index * 0.05 }}
                  className={cn(
                    "rounded-lg border overflow-hidden",
                    translation.status === 'completed' && "bg-card border-border",
                    translation.status === 'translating' && "bg-amber-950/20 border-amber-800",
                    translation.status === 'error' && "bg-rose-950/20 border-rose-800",
                    translation.status === 'pending' && "bg-card/50 border-border"
                  )}
                >
                  {/* Header */}
                  <div
                    className="flex items-center justify-between p-3 cursor-pointer"
                    onClick={() => setExpandedTranslation(isExpanded ? null : translation.code)}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{lang?.flag}</span>
                      <div>
                        <p className="font-medium text-sm">{translation.language}</p>
                        <p className="text-xs text-muted-foreground">{translation.languageNative}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {translation.status === 'translating' && (
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        >
                          <RefreshCw className="w-4 h-4 text-amber-400" />
                        </motion.div>
                      )}
                      {translation.status === 'completed' && (
                        <Check className="w-4 h-4 text-emerald-400" />
                      )}
                      {translation.status === 'error' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            retryTranslation(translation.code)
                          }}
                        >
                          <RefreshCw className="w-4 h-4 text-rose-400" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          removeTranslation(translation.code)
                        }}
                      >
                        <X className="w-4 h-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>

                  {/* Expanded content */}
                  <AnimatePresence>
                    {isExpanded && translation.status === 'completed' && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="p-3 pt-0 space-y-3">
                          <Textarea
                            value={translation.content}
                            readOnly
                            className="h-32 bg-muted border-border text-sm"
                          />

                          {translation.culturalNotes && (
                            <div className="p-2 rounded bg-amber-950/30 border border-amber-800/50">
                              <p className="text-xs text-amber-300">
                                💡 {translation.culturalNotes}
                              </p>
                            </div>
                          )}

                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            onClick={() => copyToClipboard(translation.content)}
                          >
                            <Copy className="w-4 h-4 mr-2" />
                            Copy Translation
                          </Button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Empty state */}
      {translations.length === 0 && (
        <div className="text-center py-8">
          <Globe className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            Select languages above to translate your content
          </p>
        </div>
      )}
    </div>
  )
}
