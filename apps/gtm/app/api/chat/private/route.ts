import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { generateText } from '@/lib/ai/langsmith-ai'
import { getModel } from '@/lib/ai/model-router'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { PrivateChatManager, isParticipant } from '@/lib/chat/private-chat'
import { getWorkspaceContext } from '@/lib/workspace'

const CreateChatSchema = z.object({
  workspaceId: z.string().uuid(),
  projectId: z.string().uuid().optional(),
  name: z.string().trim().max(120).optional(),
  description: z.string().trim().max(1000).optional(),
  participants: z.array(z.string().uuid()).min(1),
})

const AIMessageSchema = z.object({
  projectId: z.string().uuid(),
  message: z.string().trim().min(1).max(10000),
  chatId: z.string().uuid().optional(),
})

const UpdateChatSchema = z.object({
  chatId: z.string().uuid(),
  name: z.string().trim().max(120).optional(),
  description: z.string().trim().max(1000).optional(),
  is_archived: z.boolean().optional(),
})

function isCreateChatPayload(value: unknown): value is z.infer<typeof CreateChatSchema> {
  if (!value || typeof value !== 'object') return false
  const payload = value as Record<string, unknown>
  return !!payload.workspaceId && Array.isArray(payload.participants)
}

function isAIMessagePayload(value: unknown): value is z.infer<typeof AIMessageSchema> {
  if (!value || typeof value !== 'object') return false
  const payload = value as Record<string, unknown>
  return typeof payload.projectId === 'string' && typeof payload.message === 'string'
}

async function resolveAiChatId(params: {
  projectId: string
  userId: string
  workspaceId: string
  explicitChatId?: string
}) {
  if (params.explicitChatId) {
    const canAccess = await isParticipant(params.explicitChatId, params.userId)
    if (!canAccess) {
      throw new Error('Access denied')
    }
    return params.explicitChatId
  }

  const supabase = await createServerSupabaseClient()

  const { data: existingChat } = await supabase
    .from('private_chats')
    .select('id')
    .eq('workspace_id', params.workspaceId)
    .eq('project_id', params.projectId)
    .contains('participants', [params.userId])
    .eq('is_archived', false)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existingChat?.id) {
    return existingChat.id
  }

  const created = await PrivateChatManager.createChat(params.userId, {
    workspaceId: params.workspaceId,
    projectId: params.projectId,
    name: 'Private AI Chat',
    participants: [params.userId],
  })

  return created.id
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { workspaceId } = getWorkspaceContext(request)
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId') || undefined
    const includeArchived = searchParams.get('includeArchived') === 'true'

    const chats = await PrivateChatManager.getChats(workspaceId, user.id, {
      projectId,
      includeArchived,
    })

    return NextResponse.json({ chats })
  } catch (error) {
    console.error('Failed to fetch private chats:', error)
    return NextResponse.json({ error: 'Failed to fetch chats' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    // Mode 1: create regular private chat
    if (isCreateChatPayload(body)) {
      const payload = CreateChatSchema.parse(body)
      const { workspaceId } = getWorkspaceContext(request)

      if (payload.workspaceId !== workspaceId) {
        return NextResponse.json({ error: 'Workspace mismatch' }, { status: 403 })
      }

      const chat = await PrivateChatManager.createChat(user.id, {
        workspaceId: payload.workspaceId,
        projectId: payload.projectId,
        name: payload.name,
        description: payload.description,
        participants: payload.participants,
      })

      return NextResponse.json({ chat }, { status: 201 })
    }

    // Mode 2: simple private AI chat
    if (isAIMessagePayload(body)) {
      const payload = AIMessageSchema.parse(body)
      const { workspaceId } = getWorkspaceContext(request)

      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('id, workspace_id, name, description')
        .eq('id', payload.projectId)
        .eq('workspace_id', workspaceId)
        .single()

      if (projectError || !project) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 })
      }

      const chatId = await resolveAiChatId({
        projectId: payload.projectId,
        userId: user.id,
        workspaceId,
        explicitChatId: payload.chatId,
      })

      const recentMessages = await PrivateChatManager.getMessages(chatId, { limit: 10 })

      const systemPrompt = `You are a helpful AI assistant for a marketing campaign platform.
You are having a private conversation with a user about their project.

Context:
Project: ${project.name}
${project.description ? `Description: ${project.description}` : ''}

Help with:
- Campaign strategy and ideas
- Content suggestions
- Audience targeting advice
- Marketing best practices
- Platform-specific implementation ideas

Keep responses concise and actionable.`

      const messages = [
        ...recentMessages.map((message) => ({
          role:
            message.message_type === 'ai_response'
              ? ('assistant' as const)
              : ('user' as const),
          content: message.content,
        })),
        { role: 'user' as const, content: payload.message },
      ]

      const model = await getModel('anthropic/claude-sonnet-4.6')
      const { text } = await generateText({
        model,
        system: systemPrompt,
        messages,
      })

      await PrivateChatManager.sendMessage(user.id, {
        chatId,
        content: payload.message,
        messageType: 'text',
      })

      await PrivateChatManager.sendMessage(user.id, {
        chatId,
        content: text,
        messageType: 'ai_response',
      })

      return NextResponse.json({ chatId, message: text })
    }

    return NextResponse.json(
      { error: 'Invalid payload. Expected chat creation or AI message fields.' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Private chat POST error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || 'Invalid request' },
        { status: 400 }
      )
    }

    return NextResponse.json({ error: 'Failed to process private chat request' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = UpdateChatSchema.parse(await request.json())

    const canAccess = await isParticipant(payload.chatId, user.id)
    if (!canAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const chat = await PrivateChatManager.updateChat(payload.chatId, {
      name: payload.name,
      description: payload.description,
      is_archived: payload.is_archived,
    })

    return NextResponse.json({ chat })
  } catch (error) {
    console.error('Failed to update private chat:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || 'Invalid request' },
        { status: 400 }
      )
    }

    return NextResponse.json({ error: 'Failed to update chat' }, { status: 500 })
  }
}
