/**
 * Audit Logs API
 * 
 * GET /api/audit - Get audit logs (admins only)
 * GET /api/audit/export - Export audit logs to CSV
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerUser, getUserWorkspace } from '@/lib/supabase/auth-server'
import { auditLogger, type AuditAction, type ResourceType } from '@/lib/audit/audit-logger'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const user = await getServerUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const workspace = await getUserWorkspace(user.id)
    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    }

    // Check if user is admin or owner
    const supabase = await createServerSupabaseClient()
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspace.workspaceId)
      .eq('user_id', user.id)
      .single()

    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    // Parse query params
    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)
    const action = searchParams.get('action') as AuditAction | null
    const resourceType = searchParams.get('resourceType') as ResourceType | null
    const userId = searchParams.get('userId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    // Check for export request
    if (searchParams.get('export') === 'csv') {
      const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      const end = endDate ? new Date(endDate) : new Date()
      
      const csv = await auditLogger.exportToCsv(workspace.workspaceId, start, end)
      
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="audit-logs-${workspace.workspaceId}-${start.toISOString().split('T')[0]}.csv"`,
        },
      })
    }

    const result = await auditLogger.getAuditLogs(workspace.workspaceId, {
      limit,
      offset,
      action: action || undefined,
      resourceType: resourceType || undefined,
      userId: userId || undefined,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    })

    return NextResponse.json({
      logs: result.logs,
      total: result.total,
      limit,
      offset,
    })
  } catch (error) {
    console.error('Get audit logs error:', error)
    return NextResponse.json({ error: 'Failed to get audit logs' }, { status: 500 })
  }
}
