interface BannedPhraseRule {
  pattern: RegExp
  fix: string
  allowIfBrandUsesIt?: boolean
}

const BANNED_PHRASES: BannedPhraseRule[] = [
  { pattern: /in today['']?s (fast-paced|ever-changing|dynamic|digital|modern|competitive) (world|landscape|era|environment)/gi, fix: 'Remove entirely or state the specific context' },
  { pattern: /unlock (your|the|its) (potential|power|full|true)/gi, fix: 'State the specific benefit instead' },
  { pattern: /game[- ]chang(ing|er)/gi, fix: 'Describe the specific change' },
  { pattern: /revolutionary/gi, fix: 'Use a specific descriptor or remove' },
  { pattern: /cutting[- ]edge/gi, fix: 'Describe the specific technical advantage' },
  { pattern: /next[- ]gen(eration)?/gi, fix: 'Specify what makes it newer or better' },
  { pattern: /super ?charge/gi, fix: 'State the specific improvement' },
  { pattern: /turbo ?charge/gi, fix: 'State the specific improvement' },
  { pattern: /skyrocket/gi, fix: 'Use a specific metric instead' },
  { pattern: /\bseamless(ly)?\b/gi, fix: 'Describe the specific integration or experience', allowIfBrandUsesIt: true },
  { pattern: /\bleverage\b/gi, fix: 'Use "use" or describe the specific action', allowIfBrandUsesIt: true },
  { pattern: /\bempower(ing|s|ed)?\b/gi, fix: 'State what the user can specifically do' },
  { pattern: /navigate the complexit(y|ies)/gi, fix: 'Name the specific complexity being solved' },
  { pattern: /at the forefront/gi, fix: 'Remove or describe the specific position' },
  { pattern: /one[- ]stop[- ]shop/gi, fix: 'List the specific capabilities instead' },
  { pattern: /all[- ]in[- ]one solution/gi, fix: 'Describe the specific integration benefit' },
  { pattern: /it['']?s not just .+, it['']?s .+/gi, fix: 'Rewrite without the formulaic structure' },
  { pattern: /but what if there was a better way/gi, fix: 'Remove immediately recognizable AI filler' },
  { pattern: /let['']?s face it/gi, fix: 'Remove or state the fact directly' },
  { pattern: /here['']?s the thing/gi, fix: 'Remove and get to the point' },
  { pattern: /buckle up/gi, fix: 'Remove' },
  { pattern: /deep[- ]?dive/gi, fix: 'Use "analysis" or remove' },
  { pattern: /^imagine /gim, fix: 'Start with a fact or outcome instead' },
  { pattern: /hope this (email )?finds you well/gi, fix: 'Remove' },
  { pattern: /just checking in/gi, fix: 'State the specific reason for the email' },
  { pattern: /excited to (share|announce)/gi, fix: 'Just share the news directly' },
  { pattern: /🚀/g, fix: 'Remove rocket emoji' },
  { pattern: /💡/g, fix: 'Remove lightbulb emoji' },
  { pattern: /\b10x\b/gi, fix: 'Use a specific, defensible metric or remove' },
]

export interface SlopViolation {
  phrase: string
  location: number
  fix: string
  severity: 'hard' | 'soft'
}

export function detectSlop(text: string, brandAllowList?: string[]): SlopViolation[] {
  const violations: SlopViolation[] = []

  for (const rule of BANNED_PHRASES) {
    const regex = new RegExp(rule.pattern.source, rule.pattern.flags)
    let match: RegExpExecArray | null

    while ((match = regex.exec(text)) !== null) {
      const matchedText = match[0]

      if (
        rule.allowIfBrandUsesIt &&
        brandAllowList?.some((allowed) => {
          const normalizedAllowed = allowed.toLowerCase()
          const normalizedMatch = matchedText.toLowerCase()
          return normalizedAllowed.includes(normalizedMatch) || normalizedMatch.includes(normalizedAllowed)
        })
      ) {
        continue
      }

      violations.push({
        phrase: matchedText,
        location: match.index,
        fix: rule.fix,
        severity: rule.allowIfBrandUsesIt ? 'soft' : 'hard',
      })
    }
  }

  return violations
}

export function extractNewClaims(text: string): string[] {
  const matches = text.matchAll(/\[NEW_CLAIM\]\s*([\s\S]*?)(?=\[\/?[A-Z_]+\]|$)/gi)
  return Array.from(matches, (match) => match[1]?.trim()).filter(Boolean) as string[]
}

export function detectAdjectiveStacks(text: string): string[] {
  const pattern = /\b(\w+), (\w+),? and (\w+)\b/gi
  const stacks: string[] = []
  let match: RegExpExecArray | null

  const marketingAdjectives = new Set([
    'powerful',
    'flexible',
    'intuitive',
    'robust',
    'scalable',
    'reliable',
    'innovative',
    'comprehensive',
    'efficient',
    'effective',
    'dynamic',
    'advanced',
    'smart',
    'modern',
    'simple',
    'elegant',
    'beautiful',
    'fast',
    'secure',
    'automated',
    'intelligent',
    'seamless',
    'streamlined',
  ])

  while ((match = pattern.exec(text)) !== null) {
    const adjectives = [match[1], match[2], match[3]].map((value) => value.toLowerCase())
    if (adjectives.filter((value) => marketingAdjectives.has(value)).length >= 2) {
      stacks.push(match[0])
    }
  }

  return stacks
}
