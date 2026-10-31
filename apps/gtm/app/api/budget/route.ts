/**
 * Budget Management API
 * 
 * GET /api/budget - Get budget status and configuration
 * PATCH /api/budget - Update budget configuration
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { 
  getBudgetStatus, 
  getBudgetConfig, 
  updateBudgetConfig,
  getBudgetAlerts,
  acknowledgeBudgetAlert,
} from '@/lib/enterprise/budget-enforcement';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get workspace ID
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('workspace_id, role')
      .eq('user_id', user.id)
      .single();

    if (!membership) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 });
    }

    const workspaceId = membership.workspace_id;

    // Get budget status and config
    const [status, config, alerts] = await Promise.all([
      getBudgetStatus(workspaceId),
      getBudgetConfig(workspaceId),
      getBudgetAlerts(workspaceId, { acknowledged: false, limit: 5 }),
    ]);

    return NextResponse.json({
      status,
      config,
      alerts,
      canManage: ['admin', 'owner'].includes(membership.role),
    });
  } catch (error) {
    console.error('Error fetching budget:', error);
    return NextResponse.json(
      { error: 'Failed to fetch budget' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get workspace ID and role
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('workspace_id, role')
      .eq('user_id', user.id)
      .single();

    if (!membership) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 });
    }

    // Check if user can manage budget (admin/owner only)
    if (!['admin', 'owner'].includes(membership.role)) {
      return NextResponse.json(
        { error: 'Only admins can manage budget settings' },
        { status: 403 }
      );
    }

    const workspaceId = membership.workspace_id;
    const body = await request.json();

    // Validate and update config
    const updates: Parameters<typeof updateBudgetConfig>[1] = {};

    if (body.monthlyHardCapDollars !== undefined) {
      updates.monthlyHardCapCents = body.monthlyHardCapDollars !== null 
        ? Math.round(body.monthlyHardCapDollars * 100) 
        : null;
    }

    if (body.alertThresholds !== undefined) {
      if (!Array.isArray(body.alertThresholds)) {
        return NextResponse.json({ error: 'alertThresholds must be an array' }, { status: 400 });
      }
      updates.alertThresholds = body.alertThresholds;
    }

    if (body.notifyEmails !== undefined) {
      if (!Array.isArray(body.notifyEmails)) {
        return NextResponse.json({ error: 'notifyEmails must be an array' }, { status: 400 });
      }
      updates.notifyEmails = body.notifyEmails;
    }

    if (body.autoTopUp !== undefined) {
      updates.autoTopUp = !!body.autoTopUp;
    }

    if (body.autoTopUpAmountDollars !== undefined) {
      updates.autoTopUpAmount = Math.round(body.autoTopUpAmountDollars * 100);
    }

    await updateBudgetConfig(workspaceId, updates);

    // Return updated status
    const status = await getBudgetStatus(workspaceId);
    const config = await getBudgetConfig(workspaceId);

    return NextResponse.json({
      success: true,
      status,
      config,
    });
  } catch (error) {
    console.error('Error updating budget:', error);
    return NextResponse.json(
      { error: 'Failed to update budget' },
      { status: 500 }
    );
  }
}
