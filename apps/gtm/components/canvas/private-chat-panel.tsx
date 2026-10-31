'use client'

/**
 * Private Chat Panel Component
 * 
 * Provides a slide-out panel for confidential workspace conversations
 * within Canvas projects. Supports real-time messaging.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  MessageSquare,
  Send,
  Plus,
  Users,
  MoreVertical,
  Archive,
  Trash2,
  Edit2,
  Check,
  X,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type { PrivateChat, PrivateChatMessage } from '@/lib/chat/private-chat'

interface PrivateChatPanelProps {
  workspaceId: string
  projectId?: string
  currentUserId: string
  workspaceMembers: Array<{
    id: string
    email: string
    name?: string
    avatar_url?: string
  }>
}

export function PrivateChatPanel({
  workspaceId,
  projectId,
  currentUserId,
  workspaceMembers,
}: PrivateChatPanelProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null)
  const [messageInput, setMessageInput] = useState('')
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const queryClient = useQueryClient()

  // Fetch chats
  const { data: chatsData, isLoading: chatsLoading } = useQuery({
    queryKey: ['private-chats', workspaceId, projectId],
    queryFn: async () => {
      const params = new URLSearchParams({ workspaceId })
      if (projectId) params.set('projectId', projectId)
      const res = await fetch(`/api/chat/private?${params}`)
      if (!res.ok) throw new Error('Failed to fetch chats')
      return res.json()
    },
    enabled: isOpen,
  })

  // Fetch messages for selected chat
  const { data: messagesData, isLoading: messagesLoading } = useQuery({
    queryKey: ['private-chat-messages', selectedChatId],
    queryFn: async () => {
      if (!selectedChatId) return { messages: [] }
      const res = await fetch(`/api/chat/private/messages?chatId=${selectedChatId}`)
      if (!res.ok) throw new Error('Failed to fetch messages')
      return res.json()
    },
    enabled: !!selectedChatId,
    refetchInterval: 5000, // Poll for new messages
  })

  // Create chat mutation
  const createChatMutation = useMutation({
    mutationFn: async (data: { name: string; participants: string[] }) => {
      const res = await fetch('/api/chat/private', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          projectId,
          name: data.name,
          participants: data.participants,
        }),
      })
      if (!res.ok) throw new Error('Failed to create chat')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['private-chats', workspaceId, projectId] })
    },
  })

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await fetch('/api/chat/private/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: selectedChatId, content }),
      })
      if (!res.ok) throw new Error('Failed to send message')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['private-chat-messages', selectedChatId] })
      setMessageInput('')
    },
  })

  // Edit message mutation
  const editMessageMutation = useMutation({
    mutationFn: async ({ messageId, content }: { messageId: string; content: string }) => {
      const res = await fetch('/api/chat/private/messages', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId, content }),
      })
      if (!res.ok) throw new Error('Failed to edit message')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['private-chat-messages', selectedChatId] })
      setEditingMessageId(null)
      setEditContent('')
    },
  })

  // Delete message mutation
  const deleteMessageMutation = useMutation({
    mutationFn: async (messageId: string) => {
      const res = await fetch(`/api/chat/private/messages?messageId=${messageId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to delete message')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['private-chat-messages', selectedChatId] })
    },
  })

  // Archive chat mutation
  const archiveChatMutation = useMutation({
    mutationFn: async (chatId: string) => {
      const res = await fetch('/api/chat/private', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, is_archived: true }),
      })
      if (!res.ok) throw new Error('Failed to archive chat')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['private-chats', workspaceId, projectId] })
      setSelectedChatId(null)
    },
  })

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messagesData?.messages])

  const handleSendMessage = useCallback(() => {
    if (!messageInput.trim() || !selectedChatId) return
    sendMessageMutation.mutate(messageInput.trim())
  }, [messageInput, selectedChatId, sendMessageMutation])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const getMemberInfo = (userId: string) => {
    return workspaceMembers.find(m => m.id === userId) || {
      id: userId,
      email: 'Unknown',
      name: 'Unknown User',
    }
  }

  const getInitials = (name?: string, email?: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    }
    return email?.slice(0, 2).toUpperCase() || '??'
  }

  const chats: PrivateChat[] = chatsData?.chats || []
  const messages: PrivateChatMessage[] = messagesData?.messages || []

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <MessageSquare className="h-4 w-4" />
          Private Chat
          {chats.length > 0 && (
            <Badge variant="secondary" className="ml-1">
              {chats.length}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[540px] p-0 flex flex-col">
        <SheetHeader className="p-4 border-b">
          <div className="flex items-center justify-between">
            <SheetTitle>Private Conversations</SheetTitle>
            <CreateChatDialog
              workspaceMembers={workspaceMembers}
              currentUserId={currentUserId}
              onCreateChat={(data) => createChatMutation.mutate(data)}
            />
          </div>
        </SheetHeader>

        <div className="flex flex-1 overflow-hidden">
          {/* Chat List */}
          <div className={cn(
            "w-full border-r transition-all",
            selectedChatId ? "w-1/3 hidden sm:block" : "w-full"
          )}>
            <ScrollArea className="h-full">
              {chatsLoading ? (
                <div className="p-4 space-y-3">
                  {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : chats.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p>No conversations yet</p>
                  <p className="text-sm mt-1">Start a private chat with your team</p>
                </div>
              ) : (
                <div className="divide-y">
                  {chats.map((chat) => (
                    <ChatListItem
                      key={chat.id}
                      chat={chat}
                      currentUserId={currentUserId}
                      workspaceMembers={workspaceMembers}
                      isSelected={selectedChatId === chat.id}
                      onClick={() => setSelectedChatId(chat.id)}
                      onArchive={() => archiveChatMutation.mutate(chat.id)}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Messages View */}
          {selectedChatId && (
            <div className={cn(
              "flex flex-col flex-1",
              selectedChatId ? "w-full sm:w-2/3" : "hidden"
            )}>
              {/* Chat Header */}
              <div className="p-3 border-b flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="sm:hidden"
                  onClick={() => setSelectedChatId(null)}
                >
                  ← Back
                </Button>
                <div className="flex-1">
                  <p className="font-medium text-sm">
                    {chats.find(c => c.id === selectedChatId)?.name || 'Chat'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {chats.find(c => c.id === selectedChatId)?.participants.length || 0} participants
                  </p>
                </div>
              </div>

              {/* Messages */}
              <ScrollArea className="flex-1 p-4">
                {messagesLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                      <Skeleton key={i} className="h-16 w-3/4" />
                    ))}
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    <p>No messages yet</p>
                    <p className="text-sm">Send the first message!</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((message) => {
                      const sender = getMemberInfo(message.user_id)
                      const isOwn = message.user_id === currentUserId
                      const isEditing = editingMessageId === message.id

                      return (
                        <div
                          key={message.id}
                          className={cn(
                            "flex gap-2",
                            isOwn && "flex-row-reverse"
                          )}
                        >
                          <Avatar className="h-8 w-8 shrink-0">
                            <AvatarImage src={sender.avatar_url} />
                            <AvatarFallback className="text-xs">
                              {getInitials(sender.name, sender.email)}
                            </AvatarFallback>
                          </Avatar>
                          <div className={cn(
                            "flex flex-col max-w-[70%]",
                            isOwn && "items-end"
                          )}>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs text-muted-foreground">
                                {sender.name || sender.email}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {new Date(message.created_at).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                              {message.is_edited && (
                                <span className="text-xs text-muted-foreground">(edited)</span>
                              )}
                            </div>
                            {message.message_type === 'system' ? (
                              <div className="text-xs text-muted-foreground italic">
                                {message.content}
                              </div>
                            ) : isEditing ? (
                              <div className="flex flex-col gap-2">
                                <Textarea
                                  value={editContent}
                                  onChange={(e) => setEditContent(e.target.value)}
                                  className="min-h-[60px]"
                                />
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => editMessageMutation.mutate({
                                      messageId: message.id,
                                      content: editContent,
                                    })}
                                  >
                                    <Check className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setEditingMessageId(null)
                                      setEditContent('')
                                    }}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="group relative">
                                <div className={cn(
                                  "rounded-lg px-3 py-2 text-sm",
                                  isOwn
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted"
                                )}>
                                  {message.content}
                                </div>
                                {isOwn && (
                                  <div className="absolute -right-12 top-0 hidden group-hover:flex gap-1">
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-6 w-6"
                                      onClick={() => {
                                        setEditingMessageId(message.id)
                                        setEditContent(message.content)
                                      }}
                                    >
                                      <Edit2 className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-6 w-6 text-destructive"
                                      onClick={() => deleteMessageMutation.mutate(message.id)}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </ScrollArea>

              {/* Message Input */}
              <div className="p-3 border-t">
                <div className="flex gap-2">
                  <Input
                    placeholder="Type a message..."
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={sendMessageMutation.isPending}
                  />
                  <Button
                    size="icon"
                    onClick={handleSendMessage}
                    disabled={!messageInput.trim() || sendMessageMutation.isPending}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

// Chat List Item Component
function ChatListItem({
  chat,
  currentUserId,
  workspaceMembers,
  isSelected,
  onClick,
  onArchive,
}: {
  chat: PrivateChat
  currentUserId: string
  workspaceMembers: Array<{ id: string; email: string; name?: string }>
  isSelected: boolean
  onClick: () => void
  onArchive: () => void
}) {
  const otherParticipants = chat.participants
    .filter(id => id !== currentUserId)
    .map(id => workspaceMembers.find(m => m.id === id))
    .filter(Boolean)

  const displayName = chat.name || (otherParticipants.length > 0
    ? otherParticipants.map(p => p?.name || p?.email).join(', ')
    : 'Chat')

  return (
    <div
      className={cn(
        "p-3 cursor-pointer hover:bg-muted/50 transition-colors flex items-center gap-3",
        isSelected && "bg-muted"
      )}
      onClick={onClick}
    >
      <div className="flex -space-x-2">
        {otherParticipants.slice(0, 2).map((participant, idx) => (
          <Avatar key={participant?.id || idx} className="h-8 w-8 border-2 border-background">
            <AvatarFallback className="text-xs">
              {(participant?.name || participant?.email || '?').slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        ))}
        {otherParticipants.length > 2 && (
          <Avatar className="h-8 w-8 border-2 border-background">
            <AvatarFallback className="text-xs">
              +{otherParticipants.length - 2}
            </AvatarFallback>
          </Avatar>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{displayName}</p>
        <p className="text-xs text-muted-foreground">
          {chat.participants.length} participants
        </p>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onArchive() }}>
            <Archive className="h-4 w-4 mr-2" />
            Archive
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

// Create Chat Dialog Component
function CreateChatDialog({
  workspaceMembers,
  currentUserId,
  onCreateChat,
}: {
  workspaceMembers: Array<{ id: string; email: string; name?: string }>
  currentUserId: string
  onCreateChat: (data: { name: string; participants: string[] }) => void
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([])

  const availableMembers = workspaceMembers.filter(m => m.id !== currentUserId)

  const handleCreate = () => {
    if (selectedParticipants.length === 0) return
    onCreateChat({
      name: name || `Chat with ${selectedParticipants.length} people`,
      participants: selectedParticipants,
    })
    setOpen(false)
    setName('')
    setSelectedParticipants([])
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="h-4 w-4 mr-1" />
          New Chat
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Start a Private Conversation</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Chat Name (optional)</Label>
            <Input
              placeholder="e.g., Marketing Team"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Add Participants</Label>
            <div className="border rounded-md max-h-48 overflow-y-auto">
              {availableMembers.map((member) => (
                <label
                  key={member.id}
                  className="flex items-center gap-3 p-3 hover:bg-muted cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedParticipants.includes(member.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedParticipants([...selectedParticipants, member.id])
                      } else {
                        setSelectedParticipants(selectedParticipants.filter(id => id !== member.id))
                      }
                    }}
                    className="rounded"
                  />
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>
                      {(member.name || member.email).slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">{member.name || member.email}</p>
                    {member.name && <p className="text-xs text-muted-foreground">{member.email}</p>}
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleCreate} disabled={selectedParticipants.length === 0}>
            Create Chat
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
