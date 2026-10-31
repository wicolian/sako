/**
 * POST /api/automations/playbooks
 * GET /api/automations/playbooks
 *
 * Create and list automation playbooks.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getWorkspaceId } from '@/lib/workspace'
import {
  createAutomationRule,
  listAutomationRules,
  type AutomationType,
} from '@/lib/automation/automation-engine'

const CreatePlaybookSchema = z.object({
  type: z.enum(['daily_linkedin', 'weekly_social', 'campaign_drip', 'custom']),
  brandId: z.string().uuid(),
  name: z.string().optional(),
  schedule: z.string().optional(),
  timezone: z.string().optional(),
  config: z.object({
    platforms: z.array(z.string()).optional(),
    contentTypes: z.array(z.string()).optional(),
    topics: z.array(z.string()).optional(),
    approvalRequired: z.boolean().optional(),
  }).optional(),
})

export async function POST(request: NextRequest) {
  const workspaceId = getWorkspaceId(request)
  if (!workspaceId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const input = CreatePlaybookSchema.parse(body)

    const rule = await createAutomationRule({
      workspaceId,
      brandId: input.brandId,
      type: input.type as AutomationType,
      name: input.name,
      schedule: input.schedule,
      timezone: input.timezone,
      config: input.config,
    })

    return NextResponse.json({ rule }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 })
    }
    console.error('[automations/playbooks] Error:', error)
    return NextResponse.json({ error: 'Failed to create automation' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const workspaceId = getWorkspaceId(request)
  if (!workspaceId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const rules = await listAutomationRules(workspaceId)
    return NextResponse.json({ rules })
  } catch (error) {
    console.error('[automations/playbooks] Error:', error)
    return NextResponse.json({ error: 'Failed to list automations' }, { status: 500 })
  }
}
