'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, Plus, Check, AlertTriangle, Link2, Loader2, X, FileText, Globe, Hash } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'
import type { Campaign, Message, Evidence } from '@/lib/supabase/types'

interface MessagesTabProps {
  campaign: Campaign
  messages: Message[]
}

interface MessageEvidence {
  evidence_id: string
  evidence: Evidence
}

const statusIcons = {
  approved: Check,
  needs_evidence: AlertTriangle,
  blocked: AlertTriangle,
}

const statusColors: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  approved: 'default',
  needs_evidence: 'secondary',
  blocked: 'destructive',
}

import { EmptyState } from '@/components/ui/empty-state'

export function MessagesTab({ campaign, messages }: MessagesTabProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [generating, setGenerating] = useState(false)
  const [evidence, setEvidence] = useState<Evidence[]>([])
  const [linkedEvidence, setLinkedEvidence] = useState<Record<string, MessageEvidence[]>>({})
  const [linkingMessage, setLinkingMessage] = useState<Message | null>(null)
  const [linking, setLinking] = useState(false)

  useEffect(() => {
    loadEvidence()
    loadLinkedEvidence()
  }, [])

  const loadEvidence = async () => {
    try {
      const res = await fetch('/api/evidence')
      if (res.ok) {
        const data = await res.json()
        setEvidence(data)
      }
    } catch (error) {
      console.error('Failed to load evidence:', error)
    }
  }

  const loadLinkedEvidence = async () => {
    try {
      const res = await fetch(`/api/messages/${campaign.id}/evidence`)
      if (res.ok) {
        const data = await res.json()
        // Group by message_id
        const grouped: Record<string, MessageEvidence[]> = {}
        for (const item of data) {
          if (!grouped[item.message_id]) {
            grouped[item.message_id] = []
          }
          grouped[item.message_id].push(item)
        }
        setLinkedEvidence(grouped)
      }
    } catch (error) {
      console.error('Failed to load linked evidence:', error)
    }
  }

  const linkEvidence = async (evidenceId: string) => {
    if (!linkingMessage) return
    setLinking(true)
    try {
      const res = await fetch('/api/messages/evidence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message_id: linkingMessage.id,
          evidence_id: evidenceId,
        }),
      })
      if (res.ok) {
        toast({ title: 'Linked!', description: 'Evidence linked to message.' })
        await loadLinkedEvidence()
        setLinkingMessage(null)
        router.refresh()
      }
    } catch (error) {
      console.error('Failed to link evidence:', error)
      toast({ title: 'Error', description: 'Failed to link evidence.', variant: 'destructive' })
    } finally {
      setLinking(false)
    }
  }

  const unlinkEvidence = async (messageId: string, evidenceId: string) => {
    try {
      await fetch('/api/messages/evidence', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message_id: messageId, evidence_id: evidenceId }),
      })
      await loadLinkedEvidence()
      router.refresh()
    } catch (error) {
      console.error('Failed to unlink evidence:', error)
    }
  }

  const generateMessages = async () => {
    setGenerating(true)
    try {
      const res = await fetch(`/api/ai/generate-messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId: campaign.id,
          audience: campaign.audience,
          goal: campaign.goal,
          offer: campaign.offer,
          cta: campaign.cta,
        }),
      })
      if (res.ok) {
        toast({ title: 'Messages generated', description: 'Key messages are ready.' })
        router.refresh()
      } else {
        const err = await res.json().catch(() => ({}))
        toast({
          title: 'Generation failed',
          description: (err as { error?: string })?.error ?? `Server returned ${res.status}`,
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Failed to generate messages:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to generate messages',
        variant: 'destructive',
      })
    } finally {
      setGenerating(false)
    }
  }

  const groupedMessages = {
    headline: messages.filter((m) => m.type === 'headline'),
    supporting: messages.filter((m) => m.type === 'supporting'),
    cta: messages.filter((m) => m.type === 'cta'),
    disclaimer: messages.filter((m) => m.type === 'disclaimer'),
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold">Key Messages</h2>
          <p className="text-sm text-muted-foreground">
            AI-generated messages based on your campaign brief
          </p>
        </div>
        <Button onClick={generateMessages} disabled={generating}>
          {generating ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4 mr-2" />
          )}
          {messages.length > 0 ? 'Regenerate' : 'Generate Messages'}
        </Button>
      </div>

      {messages.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="No messages yet"
          description="Generate AI-powered messages based on your campaign brief to get started."
          action={{
            label: generating ? 'Generating...' : 'Generate Messages',
            onClick: generateMessages,
            icon: generating ? Loader2 : Sparkles
          }}
        />
      ) : (
        <div className="space-y-6">
          {/* Headlines */}
          {groupedMessages.headline.length > 0 && (
            <section>
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
                Headlines
              </h3>
              <div className="space-y-2">
                {groupedMessages.headline.map((message) => (
                  <MessageCard 
                    key={message.id} 
                    message={message}
                    linkedEvidence={linkedEvidence[message.id] || []}
                    onLink={() => setLinkingMessage(message)}
                    onUnlink={(evidenceId) => unlinkEvidence(message.id, evidenceId)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Supporting Messages */}
          {groupedMessages.supporting.length > 0 && (
            <section>
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
                Supporting Points
              </h3>
              <div className="space-y-2">
                {groupedMessages.supporting.map((message) => (
                  <MessageCard 
                    key={message.id} 
                    message={message}
                    linkedEvidence={linkedEvidence[message.id] || []}
                    onLink={() => setLinkingMessage(message)}
                    onUnlink={(evidenceId) => unlinkEvidence(message.id, evidenceId)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* CTAs */}
          {groupedMessages.cta.length > 0 && (
            <section>
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
                Calls to Action
              </h3>
              <div className="space-y-2">
                {groupedMessages.cta.map((message) => (
                  <MessageCard 
                    key={message.id} 
                    message={message}
                    linkedEvidence={linkedEvidence[message.id] || []}
                    onLink={() => setLinkingMessage(message)}
                    onUnlink={(evidenceId) => unlinkEvidence(message.id, evidenceId)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Disclaimers */}
          {groupedMessages.disclaimer.length > 0 && (
            <section>
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
                Disclaimers
              </h3>
              <div className="space-y-2">
                {groupedMessages.disclaimer.map((message) => (
                  <MessageCard 
                    key={message.id} 
                    message={message}
                    linkedEvidence={linkedEvidence[message.id] || []}
                    onLink={() => setLinkingMessage(message)}
                    onUnlink={(evidenceId) => unlinkEvidence(message.id, evidenceId)}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Link Evidence Dialog */}
      <Dialog open={!!linkingMessage} onOpenChange={(open) => !open && setLinkingMessage(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link Evidence</DialogTitle>
            <DialogDescription>
              Select evidence to support this message
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-80 overflow-auto space-y-2">
            {evidence.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No evidence in your library. Add evidence first.
              </p>
            ) : (
              evidence.map((item) => {
                const isLinked = linkingMessage && linkedEvidence[linkingMessage.id]?.some(
                  (e) => e.evidence_id === item.id
                ) || false
                return (
                  <button
                    key={item.id}
                    onClick={() => !isLinked && linkEvidence(item.id)}
                    disabled={linking || !!isLinked}
                    className={`w-full text-left p-3 border rounded-lg transition-colors ${
                      isLinked
                        ? 'bg-primary/5 border-primary/20 opacity-50'
                        : 'hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded flex items-center justify-center ${
                        item.type === 'url' ? 'bg-blue-500/10 dark:bg-blue-500/20 text-blue-500 ' :
                        item.type === 'metric' ? 'bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {item.type === 'url' ? <Globe className="w-4 h-4" /> :
                         item.type === 'metric' ? <Hash className="w-4 h-4" /> :
                         <FileText className="w-4 h-4" />}
                      </div>
                      <div>
                        <div className="text-sm font-medium">{item.title}</div>
                        <div className="text-xs text-muted-foreground capitalize">{item.type}</div>
                      </div>
                      {isLinked && (
                        <Badge variant="default" className="ml-auto text-xs">Linked</Badge>
                      )}
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

interface MessageCardProps {
  message: Message
  linkedEvidence: MessageEvidence[]
  onLink: () => void
  onUnlink: (evidenceId: string) => void
}

function MessageCard({ message, linkedEvidence, onLink, onUnlink }: MessageCardProps) {
  const StatusIcon = statusIcons[message.status]

  return (
    <div className="flex items-start gap-4 p-4 border rounded-lg bg-card">
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
          message.status === 'approved'
            ? 'bg-primary/20 text-primary'
            : message.status === 'needs_evidence'
            ? 'bg-amber-500/10 dark:bg-amber-500/20 text-amber-500 '
            : 'bg-destructive/20 text-destructive'
        }`}
      >
        <StatusIcon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm">{message.text}</p>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <Badge variant={statusColors[message.status]} className="text-xs">
            {message.status.replace('_', ' ')}
          </Badge>
          {message.risk_tags?.map((tag) => (
            <Badge key={tag} variant="outline" className="text-xs">
              {tag}
            </Badge>
          ))}
          {linkedEvidence.map((item) => (
            <Badge 
              key={item.evidence_id} 
              variant="secondary" 
              className="text-xs flex items-center gap-1"
            >
              <Link2 className="w-3 h-3" />
              {item.evidence?.title || 'Evidence'}
              <button onClick={() => onUnlink(item.evidence_id)} className="hover:text-destructive">
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      </div>
      <Button variant="ghost" size="sm" onClick={onLink}>
        <Link2 className="w-4 h-4" />
      </Button>
    </div>
  )
}
