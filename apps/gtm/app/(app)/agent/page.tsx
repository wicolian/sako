'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Send, Square, Plus, Sparkles,
  MessageSquare, Loader2, Bot, User, Zap, Gauge,
  AlertCircle, Wrench, Globe, FileText, Layers, Palette,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { ToolResultRenderer } from '@/components/agent/tool-result-renderer'

interface ChatSession {
  id: string
  title: string
  updatedAt: Date
  archived: boolean
}

const MODEL_OPTIONS = [
  { id: 'fast', label: 'Fast', icon: Zap, description: 'Quick responses' },
  { id: 'balanced', label: 'Balanced', icon: Sparkles, description: 'Best quality' },
  { id: 'reasoning', label: 'Reasoning', icon: Gauge, description: 'Complex tasks' },
]

const SUGGESTIONS = [
  { text: 'Show me my campaigns', icon: Layers },
  { text: 'What claims need proof?', icon: FileText },
  { text: 'Import my website', icon: Globe },
  { text: "What's my brand info?", icon: Palette },
]

export default function AgentPage() {
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [loadingSessions, setLoadingSessions] = useState(true)
  const [modelPreference, setModelPreference] = useState('balanced')
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Array<{id: string, role: 'user' | 'assistant', content: string}>>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Fetch workspace ID on mount
  useEffect(() => {
    const fetchWorkspaceId = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        const { data } = await supabase
          .from('workspace_members')
          .select('workspace_id')
          .eq('user_id', user.id)
          .single()
        
        const workspaceData = data as { workspace_id: string } | null
        if (workspaceData?.workspace_id) {
          setWorkspaceId(workspaceData.workspace_id)
        }
      }
    }
    
    fetchWorkspaceId()
  }, [])

  useEffect(() => {
    // Load sessions from API
    const loadSessions = async () => {
      try {
        const res = await fetch('/api/chat')
        if (res.ok) {
          const data = await res.json()
          setSessions(data.sessions?.map((s: any) => ({
            id: s.id,
            title: s.title || 'Untitled Chat',
            updatedAt: new Date(s.updated_at),
            archived: s.is_archived,
          })) || [])
        }
      } catch (err) {
        console.error('Failed to load sessions:', err)
      } finally {
        setLoadingSessions(false)
      }
    }
    loadSessions()
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const startNewChat = () => {
    setCurrentSessionId(null)
    setMessages([])
    setInput('')
  }

  const loadSession = async (id: string) => {
    setCurrentSessionId(id)
    try {
      const res = await fetch(`/api/chat?sessionId=${id}`)
      if (res.ok) {
        const data = await res.json()
        if (data.session?.chat_messages) {
          setMessages(data.session.chat_messages.map((m: any) => ({
            id: m.id,
            role: m.role,
            content: m.content,
          })))
        }
      }
    } catch (err) {
      console.error('Failed to load session:', err)
    }
  }

  const handleSuggestion = (suggestion: string) => {
    setInput(suggestion)
    textareaRef.current?.focus()
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage = input.trim()
    setInput('')
    setError(null)

    // Add user message
    const userMessageObj = {
      id: Date.now().toString(),
      role: 'user' as const,
      content: userMessage,
    }
    setMessages(prev => [...prev, userMessageObj])
    setIsLoading(true)

    try {
      if (!workspaceId) {
        setError('Workspace not found. Please ensure you are logged in.')
        setIsLoading(false)
        return
      }

      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessageObj],
          modelPreference,
          workspaceId: workspaceId,
        }),
      })

      if (!response.ok) {
        throw new Error('Agent request failed')
      }

      // Use AI SDK's stream format
      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response stream')

      let assistantMessage = ''
      const assistantMessageObj = {
        id: (Date.now() + 1).toString(),
        role: 'assistant' as const,
        content: '',
      }
      setMessages(prev => [...prev, assistantMessageObj])

      const decoder = new TextDecoder()
      let buffer = ''
      
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('0:"')) {
            // Text delta format: 0:"text content"
            try {
              const textContent = line.slice(3, -1)
              // Unescape JSON string
              assistantMessage += JSON.parse('"' + textContent + '"')
              setMessages(prev => prev.map(msg =>
                msg.id === assistantMessageObj.id
                  ? { ...msg, content: assistantMessage }
                  : msg
              ))
            } catch {
              // Fallback: use raw content
              assistantMessage += line.slice(3, -1)
              setMessages(prev => prev.map(msg =>
                msg.id === assistantMessageObj.id
                  ? { ...msg, content: assistantMessage }
                  : msg
              ))
            }
          }
        }
      }
    } catch (err) {
      console.error('Agent error:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] bg-background text-foreground">
      {/* Sidebar */}
      <div className="flex w-72 shrink-0 flex-col border-r border-border/50 bg-card/10 backdrop-blur-sm">
        {/* New Chat */}
        <div className="p-4 border-b border-border/50">
          <Button onClick={startNewChat} className="w-full gap-2 bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 shadow-none h-10">
            <Plus className="h-4 w-4" />
            New Chat
          </Button>
        </div>

        {/* Sessions */}
        <div className="flex-1 overflow-y-auto p-3">
          {loadingSessions ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 animate-pulse rounded-lg bg-muted/50" />
              ))}
            </div>
          ) : sessions.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground flex flex-col items-center">
              <div className="w-12 h-12 bg-muted/30 rounded-xl flex items-center justify-center mb-3">
                <MessageSquare className="h-5 w-5 opacity-50" />
              </div>
              <p className="text-sm font-medium">No chats yet</p>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-3 mb-2 mt-2">Recent</div>
              {sessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => loadSession(session.id)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-all',
                    currentSessionId === session.id
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                  )}
                >
                  <MessageSquare className={cn("h-4 w-4 shrink-0", currentSessionId === session.id ? "opacity-100" : "opacity-50")} />
                  <span className="truncate">{session.title}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main */}
      <div className="flex flex-1 flex-col relative overflow-hidden bg-background">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none opacity-50" />
        
        {/* Header */}
        <div className="flex h-14 items-center justify-between border-b border-border/50 px-6 bg-card/40 backdrop-blur-xl z-10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <Bot className="h-5 w-5 text-primary" />
            </div>
            <span className="font-semibold tracking-tight text-foreground">Sako Agent</span>
          </div>

          {/* Model selector */}
          <div className="flex items-center gap-1 rounded-lg bg-muted/50 p-1 border border-border/50">
            {MODEL_OPTIONS.map((option) => (
              <button
                key={option.id}
                onClick={() => setModelPreference(option.id)}
                className={cn(
                  'flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-all',
                  modelPreference === option.id
                    ? 'bg-background text-foreground shadow-sm border border-border/50'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                )}
              >
                <option.icon className="h-3.5 w-3.5" />
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto relative z-10 scroll-smooth">
          {messages.length === 0 ? (
            <EmptyState onSuggestionClick={handleSuggestion} />
          ) : (
            <div className="mx-auto max-w-4xl space-y-8 px-6 py-10">
              <AnimatePresence mode="popLayout">
                {messages.map((message) => (
                  <ChatMessage key={message.id} message={message} />
                ))}
              </AnimatePresence>
              {isLoading && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-start gap-4 text-muted-foreground"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/20 border border-primary/30">
                    <Bot className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex items-center gap-3 mt-2">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span className="text-sm font-medium">Sako is thinking...</span>
                  </div>
                </motion.div>
              )}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-4 rounded-xl border border-destructive/50 bg-destructive/10 p-5 text-destructive max-w-2xl"
                >
                  <div className="w-10 h-10 rounded-full bg-destructive/20 flex items-center justify-center shrink-0">
                    <AlertCircle className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">Something went wrong</p>
                    <p className="text-xs opacity-90 mt-0.5">{error}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setError(null)} className="hover:bg-destructive/20 hover:text-destructive">
                    Dismiss
                  </Button>
                </motion.div>
              )}
              <div ref={messagesEndRef} className="h-4" />
            </div>
          )}
        </div>

        {/* Input */}
        <div className="p-4 md:p-6 bg-gradient-to-t from-background via-background/95 to-transparent relative z-10 pt-10">
          <form onSubmit={onSubmit} className="mx-auto max-w-3xl relative">
            <div className="relative rounded-2xl bg-card/50 backdrop-blur-xl border border-border/60 shadow-lg shadow-black/20 focus-within:ring-1 focus-within:ring-primary/50 focus-within:border-primary/50 transition-all">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask Sako to build a campaign, validate copy, or check brand status..."
                rows={1}
                className="min-h-[60px] max-h-[250px] resize-none pr-16 py-4 px-5 bg-transparent border-none focus-visible:ring-0 text-base"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    onSubmit(e)
                  }
                }}
              />
              <Button
                type="submit"
                size="icon"
                disabled={!input?.trim() || isLoading}
                className={cn(
                  'absolute right-3 bottom-3 h-10 w-10 rounded-xl transition-all shadow-sm',
                  !input?.trim() ? 'bg-muted/50 text-muted-foreground hover:bg-muted/50' : 'bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-105'
                )}
              >
                {isLoading ? (
                  <Square className="h-4 w-4 fill-current" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            <div className="text-center mt-3">
              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest">Powered by Sako Intelligence</span>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

interface ToolInvocation {
  toolName: string
  state: 'call' | 'result'
  result?: Record<string, unknown>
  args?: Record<string, unknown>
}

function ChatMessage({ message }: { message: { id: string; role: string; content: string; toolInvocations?: ToolInvocation[] } }) {
  const isUser = message.role === 'user'

  // Get appropriate icon for tool name
  const getToolIcon = (toolName: string) => {
    switch (toolName) {
      case 'listCampaigns':
      case 'createCampaign':
        return Layers
      case 'listClaims':
      case 'validateClaim':
        return FileText
      case 'getBrandInfo':
      case 'updateBrand':
        return Palette
      case 'importWebsite':
      case 'navigateTo':
        return Globe
      default:
        return Wrench
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('flex gap-4', isUser && 'flex-row-reverse')}
    >
      <div
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-sm border',
          isUser ? 'bg-muted/50 border-border/50' : 'bg-primary/20 border-primary/30 text-primary'
        )}
      >
        {isUser ? (
          <User className="h-5 w-5 text-foreground/70" />
        ) : (
          <Bot className="h-5 w-5" />
        )}
      </div>
      <div className={cn("flex-1 space-y-4", isUser ? "max-w-[75%]" : "max-w-[85%]")}>
        {/* Message content */}
        {message.content && (
          <div
            className={cn(
              'rounded-2xl px-6 py-4 text-[15px] leading-relaxed shadow-sm',
              isUser 
                ? 'bg-muted/50 border border-border/50 rounded-tr-sm text-foreground' 
                : 'bg-card border border-border/50 rounded-tl-sm text-foreground/90'
            )}
          >
            <div className="whitespace-pre-wrap font-sans">{message.content}</div>
          </div>
        )}
        
        {/* Tool invocations with rich rendering */}
        {message.toolInvocations && message.toolInvocations.length > 0 && (
          <div className="space-y-3">
            {message.toolInvocations.map((tool, index: number) => {
              const ToolIcon = getToolIcon(tool.toolName)
              
              return (
                <div key={index} className="space-y-2">
                  {/* Tool header - always show what's being called */}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium px-2 py-1 bg-muted/30 w-fit rounded-md border border-border/50">
                    <ToolIcon className="h-3.5 w-3.5 text-primary" />
                    <span>{formatToolName(tool.toolName)}</span>
                    {tool.state === 'call' && (
                      <Loader2 className="h-3 w-3 animate-spin ml-1 text-primary" />
                    )}
                  </div>
                  
                  {/* Tool result - rich rendering */}
                  {tool.state === 'result' && tool.result && (
                    <div className="mt-2">
                      <ToolResultRenderer 
                        toolName={tool.toolName} 
                        result={tool.result} 
                      />
                    </div>
                  )}
                  
                  {/* Loading state */}
                  {tool.state === 'call' && (
                    <div className="rounded-xl border border-border/50 bg-card/50 p-4 animate-pulse flex flex-col gap-2">
                      <div className="h-2 w-32 bg-muted-foreground/20 rounded-full" />
                      <div className="h-2 w-24 bg-muted-foreground/20 rounded-full" />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </motion.div>
  )
}

// Format tool name for display
function formatToolName(toolName: string): string {
  const names: Record<string, string> = {
    listCampaigns: 'Fetching campaigns...',
    listClaims: 'Fetching claims...',
    listEvidence: 'Fetching evidence...',
    getBrandInfo: 'Getting brand info...',
    updateBrand: 'Updating brand...',
    createCampaign: 'Creating campaign...',
    validateClaim: 'Validating claim...',
    generateLandingPage: 'Generating landing page...',
    generateAngles: 'Generating marketing angles...',
    searchTemplates: 'Searching templates...',
    navigateTo: 'Preparing navigation...',
    importWebsite: 'Preparing import...',
  }
  return names[toolName] || `Running ${toolName}...`
}

function EmptyState({ onSuggestionClick }: { onSuggestionClick: (s: string) => void }) {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="max-w-2xl px-6 text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-emerald-400 shadow-[0_0_40px_-10px_rgba(132,204,22,0.5)]"
        >
          <Bot className="h-10 w-10 text-primary-foreground" />
        </motion.div>
        <motion.h2
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="mb-3 text-3xl font-bold tracking-tight"
        >
          How can I help you today?
        </motion.h2>
        <motion.p
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mb-10 text-muted-foreground text-lg"
        >
          I can manage your campaigns, validate claims, generate content, and handle everything through conversation.
        </motion.p>
        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl mx-auto"
        >
          {SUGGESTIONS.map((suggestion) => (
            <Card 
              key={suggestion.text} 
              className="cursor-pointer transition-all bg-card/40 backdrop-blur border-border/50 hover:border-primary/50 hover:bg-primary/5 group"
              onClick={() => onSuggestionClick(suggestion.text)}
            >
              <CardContent className="p-5 flex items-center gap-4 text-left">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                  <suggestion.icon className="h-5 w-5" />
                </div>
                <p className="text-sm font-medium group-hover:text-primary transition-colors">{suggestion.text}</p>
              </CardContent>
            </Card>
          ))}
        </motion.div>
      </div>
    </div>
  )
}
