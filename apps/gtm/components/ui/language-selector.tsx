'use client'

import { useState, useMemo } from 'react'
import { Check, ChevronsUpDown, Globe, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '@/lib/ai/multi-language'

interface LanguageSelectorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  showNativeName?: boolean
  showTierBadge?: boolean
  filterTiers?: Array<'premium' | 'standard' | 'beta'>
  className?: string
}

export function LanguageSelector({
  value,
  onChange,
  placeholder = 'Select language...',
  disabled = false,
  showNativeName = true,
  showTierBadge = false,
  filterTiers,
  className,
}: LanguageSelectorProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const languages = useMemo(() => {
    let filtered = SUPPORTED_LANGUAGES
    
    if (filterTiers && filterTiers.length > 0) {
      filtered = filtered.filter(l => l.tier && filterTiers.includes(l.tier))
    }
    
    if (search) {
      const searchLower = search.toLowerCase()
      filtered = filtered.filter(l => 
        l.name.toLowerCase().includes(searchLower) ||
        l.nativeName.toLowerCase().includes(searchLower) ||
        l.code.toLowerCase().includes(searchLower)
      )
    }
    
    return filtered
  }, [filterTiers, search])

  const grouped = useMemo(() => {
    const groups: Record<string, SupportedLanguage[]> = {
      premium: [],
      standard: [],
      beta: [],
    }
    
    for (const lang of languages) {
      const tier = lang.tier || 'standard'
      groups[tier].push(lang)
    }
    
    return groups
  }, [languages])

  const selectedLanguage = SUPPORTED_LANGUAGES.find(l => l.code === value)

  const formatLanguageLabel = (lang: SupportedLanguage) => {
    if (showNativeName && lang.nativeName !== lang.name) {
      return `${lang.name} (${lang.nativeName})`
    }
    return lang.name
  }

  const getTierLabel = (tier: string) => {
    switch (tier) {
      case 'premium': return 'Premium'
      case 'standard': return 'Standard'
      case 'beta': return 'Beta'
      default: return tier
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
          disabled={disabled}
        >
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
            {selectedLanguage ? (
              <span className="truncate">
                {formatLanguageLabel(selectedLanguage)}
              </span>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command shouldFilter={false}>
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              placeholder="Search languages..."
              className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <CommandList>
            <CommandEmpty>No language found.</CommandEmpty>
            
            {/* Premium Languages */}
            {grouped.premium.length > 0 && (
              <CommandGroup heading="Premium Languages">
                {grouped.premium.map((lang) => (
                  <CommandItem
                    key={lang.code}
                    value={lang.code}
                    onSelect={() => {
                      onChange(lang.code)
                      setOpen(false)
                      setSearch('')
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === lang.code ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="flex-1">{formatLanguageLabel(lang)}</span>
                    {lang.direction === 'rtl' && (
                      <Badge variant="outline" className="ml-2 text-[10px]">RTL</Badge>
                    )}
                    {showTierBadge && (
                      <Badge variant="secondary" className="ml-2 text-[10px]">
                        {getTierLabel(lang.tier || 'standard')}
                      </Badge>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            
            {/* Standard Languages */}
            {grouped.standard.length > 0 && (
              <>
                {grouped.premium.length > 0 && <CommandSeparator />}
                <CommandGroup heading="Standard Languages">
                  {grouped.standard.map((lang) => (
                    <CommandItem
                      key={lang.code}
                      value={lang.code}
                      onSelect={() => {
                        onChange(lang.code)
                        setOpen(false)
                        setSearch('')
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value === lang.code ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <span className="flex-1">{formatLanguageLabel(lang)}</span>
                      {lang.direction === 'rtl' && (
                        <Badge variant="outline" className="ml-2 text-[10px]">RTL</Badge>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
            
            {/* Beta Languages */}
            {grouped.beta.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Beta Languages">
                  {grouped.beta.map((lang) => (
                    <CommandItem
                      key={lang.code}
                      value={lang.code}
                      onSelect={() => {
                        onChange(lang.code)
                        setOpen(false)
                        setSearch('')
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value === lang.code ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <span className="flex-1">{formatLanguageLabel(lang)}</span>
                      {lang.direction === 'rtl' && (
                        <Badge variant="outline" className="ml-2 text-[10px]">RTL</Badge>
                      )}
                      <Badge variant="secondary" className="ml-2 text-[10px] bg-amber-500/10 text-amber-500">
                        Beta
                      </Badge>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

/**
 * Multi-language selector for selecting multiple target languages
 */
interface MultiLanguageSelectorProps {
  value: string[]
  onChange: (value: string[]) => void
  placeholder?: string
  disabled?: boolean
  maxSelections?: number
  className?: string
}

export function MultiLanguageSelector({
  value,
  onChange,
  placeholder = 'Select languages...',
  disabled = false,
  maxSelections = 10,
  className,
}: MultiLanguageSelectorProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const languages = useMemo(() => {
    if (!search) return SUPPORTED_LANGUAGES
    
    const searchLower = search.toLowerCase()
    return SUPPORTED_LANGUAGES.filter(l => 
      l.name.toLowerCase().includes(searchLower) ||
      l.nativeName.toLowerCase().includes(searchLower) ||
      l.code.toLowerCase().includes(searchLower)
    )
  }, [search])

  const selectedLanguages = SUPPORTED_LANGUAGES.filter(l => value.includes(l.code))

  const toggleLanguage = (code: string) => {
    if (value.includes(code)) {
      onChange(value.filter(v => v !== code))
    } else if (value.length < maxSelections) {
      onChange([...value, code])
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between min-h-[40px] h-auto", className)}
          disabled={disabled}
        >
          <div className="flex items-center gap-2 flex-wrap">
            <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
            {selectedLanguages.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {selectedLanguages.slice(0, 3).map(lang => (
                  <Badge key={lang.code} variant="secondary" className="text-xs">
                    {lang.name}
                  </Badge>
                ))}
                {selectedLanguages.length > 3 && (
                  <Badge variant="secondary" className="text-xs">
                    +{selectedLanguages.length - 3} more
                  </Badge>
                )}
              </div>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command shouldFilter={false}>
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              placeholder="Search languages..."
              className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="p-2 border-b text-xs text-muted-foreground">
            {value.length} of {maxSelections} selected
          </div>
          <CommandList className="max-h-[300px]">
            <CommandEmpty>No language found.</CommandEmpty>
            {languages.map((lang) => (
              <CommandItem
                key={lang.code}
                value={lang.code}
                onSelect={() => toggleLanguage(lang.code)}
              >
                <div
                  className={cn(
                    "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                    value.includes(lang.code)
                      ? "bg-primary text-primary-foreground"
                      : "opacity-50 [&_svg]:invisible"
                  )}
                >
                  <Check className="h-4 w-4" />
                </div>
                <span className="flex-1">{lang.name}</span>
                {lang.nativeName !== lang.name && (
                  <span className="text-xs text-muted-foreground">{lang.nativeName}</span>
                )}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
