/**
 * Workspace Management API
 * 
 * POST /api/workspace - Create a new workspace
 * GET /api/workspace - Get current user's workspace
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export async function POST(req: NextRequest) {
  try {
    // Use anon client to verify auth
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { name, industry } = body;

    if (!name) {
      return NextResponse.json({ error: 'Workspace name is required' }, { status: 400 });
    }

    // Use service client to bypass RLS for admin operations
    const serviceClient = createServiceClient();

    // Generate a slug from the name
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') + 
      '-' + Date.now().toString(36);

    // Create the workspace (service client bypasses RLS)
    const { data: workspace, error: workspaceError } = await serviceClient
      .from('workspaces')
      .insert({
        name,
        slug,
        settings: {
          industry,
          onboarding_completed: false,
        },
      })
      .select()
      .single();

    if (workspaceError) {
      console.error('Failed to create workspace:', workspaceError);
      return NextResponse.json({ error: `Failed to create workspace: ${workspaceError.message}` }, { status: 500 });
    }

    // Add the user as the owner of the workspace (service client bypasses RLS)
    const { error: memberError } = await serviceClient
      .from('workspace_members')
      .insert({
        user_id: user.id,
        workspace_id: workspace.id,
        role: 'owner',
      });

    if (memberError) {
      console.error('Failed to add workspace member:', memberError);
      // Rollback workspace creation
      await serviceClient.from('workspaces').delete().eq('id', workspace.id);
      return NextResponse.json({ error: `Failed to set up workspace: ${memberError.message}` }, { status: 500 });
    }

    // Create default workspace settings
    const { error: settingsError } = await serviceClient
      .from('workspace_settings')
      .insert({
        workspace_id: workspace.id,
        forbidden_phrases: ['guaranteed', 'risk-free', '100% safe'],
      });

    if (settingsError) {
      console.error('Failed to create workspace settings:', settingsError);
      // Non-fatal - continue anyway
    }

    return NextResponse.json({ 
      workspace,
      message: 'Workspace created successfully',
    });

  } catch (error) {
    console.error('Workspace API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    // Use anon client to verify auth
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use service client to bypass RLS for reading workspace data
    const serviceClient = createServiceClient();

    // Get user's workspace
    const { data: membership, error } = await serviceClient
      .from('workspace_members')
      .select(`
        role,
        workspaces (
          id,
          name,
          slug,
          settings,
          created_at
        )
      `)
      .eq('user_id', user.id)
      .single();

    if (error || !membership) {
      return NextResponse.json({ 
        workspace: null,
        needsOnboarding: true,
      });
    }

    // Supabase returns joined data - handle both array and object forms
    const workspacesRaw = membership.workspaces;
    const workspaceData = Array.isArray(workspacesRaw) 
      ? workspacesRaw[0] as {
          id: string;
          name: string;
          slug: string;
          settings: Record<string, unknown>;
          created_at: string;
        } | undefined
      : workspacesRaw as {
          id: string;
          name: string;
          slug: string;
          settings: Record<string, unknown>;
          created_at: string;
        } | null;

    return NextResponse.json({
      workspace: workspaceData,
      role: membership.role,
      needsOnboarding: !workspaceData?.settings?.onboarding_completed,
    });

  } catch (error) {
    console.error('Workspace API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    // Use anon client to verify auth
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();

    // Use service client to bypass RLS
    const serviceClient = createServiceClient();

    // Get user's workspace
    const { data: membership } = await serviceClient
      .from('workspace_members')
      .select('workspace_id, role')
      .eq('user_id', user.id)
      .single();

    if (!membership) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 });
    }

    // Update workspace settings
    const { data: workspace, error } = await serviceClient
      .from('workspaces')
      .update({
        settings: body.settings,
        updated_at: new Date().toISOString(),
      })
      .eq('id', membership.workspace_id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: `Failed to update workspace: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({ workspace });

  } catch (error) {
    console.error('Workspace API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
