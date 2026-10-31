/**
 * Mentions Parser
 * 
 * Parse @mentions from comment content and handle notifications.
 */

export interface ParsedMention {
  type: 'user'
  id: string
  name: string
  startIndex: number
  endIndex: number
}

export interface MentionableUser {
  id: string
  email: string
  name?: string
  avatar_url?: string
}

/**
 * Parse @mentions from text content
 * Format: @[User Name](user:uuid)
 */
export function parseMentions(content: string): ParsedMention[] {
  const mentions: ParsedMention[] = []
  const mentionRegex = /@\[([^\]]+)\]\(user:([a-f0-9-]+)\)/gi

  let match
  while ((match = mentionRegex.exec(content)) !== null) {
    mentions.push({
      type: 'user',
      name: match[1],
      id: match[2],
      startIndex: match.index,
      endIndex: match.index + match[0].length,
    })
  }

  return mentions
}

/**
 * Extract just the user IDs from mentions
 */
export function extractMentionIds(content: string): string[] {
  const mentions = parseMentions(content)
  return [...new Set(mentions.map((m) => m.id))]
}

/**
 * Convert mention markup to display text
 * @[User Name](user:uuid) -> @User Name
 */
export function mentionsToDisplayText(content: string): string {
  return content.replace(/@\[([^\]]+)\]\(user:[a-f0-9-]+\)/gi, '@$1')
}

/**
 * Convert @username to mention markup
 * Used when user types @name and selects from dropdown
 */
export function createMentionMarkup(user: MentionableUser): string {
  const displayName = user.name || user.email.split('@')[0]
  return `@[${displayName}](user:${user.id})`
}

/**
 * Check if cursor is in a mention position (after @)
 */
export function getMentionSearchQuery(
  content: string,
  cursorPosition: number
): string | null {
  // Look backwards from cursor for @
  const beforeCursor = content.slice(0, cursorPosition)
  const atIndex = beforeCursor.lastIndexOf('@')

  if (atIndex === -1) return null

  // Check if there's a space between @ and cursor
  const afterAt = beforeCursor.slice(atIndex + 1)
  if (afterAt.includes(' ') || afterAt.includes('\n')) return null

  // Check if this @ is part of an existing mention
  const mentionCheck = content.slice(atIndex)
  if (mentionCheck.startsWith('@[')) return null

  return afterAt
}

/**
 * Insert mention at cursor position, replacing the @query
 */
export function insertMention(
  content: string,
  cursorPosition: number,
  user: MentionableUser
): { newContent: string; newCursorPosition: number } {
  const beforeCursor = content.slice(0, cursorPosition)
  const atIndex = beforeCursor.lastIndexOf('@')

  if (atIndex === -1) {
    return { newContent: content, newCursorPosition: cursorPosition }
  }

  const beforeAt = content.slice(0, atIndex)
  const afterCursor = content.slice(cursorPosition)
  const mention = createMentionMarkup(user)

  const newContent = beforeAt + mention + ' ' + afterCursor
  const newCursorPosition = beforeAt.length + mention.length + 1

  return { newContent, newCursorPosition }
}

/**
 * Render mentions as styled spans for display
 * Returns HTML string with mention spans
 */
export function renderMentionsAsHtml(content: string): string {
  return content.replace(
    /@\[([^\]]+)\]\(user:([a-f0-9-]+)\)/gi,
    '<span class="mention" data-user-id="$2">@$1</span>'
  )
}

/**
 * Filter mentionable users based on search query
 */
export function filterMentionableUsers(
  users: MentionableUser[],
  query: string
): MentionableUser[] {
  const lowerQuery = query.toLowerCase()

  return users.filter((user) => {
    const name = user.name?.toLowerCase() || ''
    const email = user.email.toLowerCase()
    return name.includes(lowerQuery) || email.includes(lowerQuery)
  })
}

/**
 * Get notification message for a mention
 */
export function getMentionNotificationMessage(
  mentionerName: string,
  assetName: string
): string {
  return `${mentionerName} mentioned you in a comment on "${assetName}"`
}

/**
 * Get notification message for a reply
 */
export function getReplyNotificationMessage(
  replierName: string,
  assetName: string
): string {
  return `${replierName} replied to your comment on "${assetName}"`
}

/**
 * Get notification message for resolution
 */
export function getResolveNotificationMessage(
  resolverName: string,
  assetName: string
): string {
  return `${resolverName} resolved a comment thread on "${assetName}"`
}
