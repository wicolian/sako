/**
 * Workspace Management API
 * 
 * POST /api/workspace - Create a new workspace
 * GET /api/workspace - Get current user's workspace
 * PATCH /api/workspace - Update workspace settings
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export async function POST(req: NextRequest) {
  try {
    // Use anon client to verify auth
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!userId) {
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

    console.log('[Workspace API] Creating workspace:', { workspaceId, name, slug, userId });

    // Create the workspace using raw SQL
    try {
      const workspaceResult = await sql<{ id: string; name: string; slug: string; settings: Record<string, unknown> }>(
        `INSERT INTO workspaces (id, name, slug, settings, created_at, updated_at) 
         VALUES ($1, $2, $3, $4::jsonb, NOW(), NOW()) 
         RETURNING id, name, slug, settings`,
        [workspaceId, name, slug, settings]
      );

      console.log('[Workspace API] Workspace created:', workspaceResult);

      if (!workspaceResult || workspaceResult.length === 0) {
        throw new Error('Workspace insert did not return data');
      }

      const workspace = workspaceResult[0];

      // Add the user as admin of the workspace
      const memberId = uuidv4();
      await sql(
        `INSERT INTO workspace_members (id, user_id, workspace_id, role, created_at, updated_at) 
         VALUES ($1, $2, $3, $4, NOW(), NOW())`,
        [memberId, userId, workspace.id, 'admin']
      );

      console.log('[Workspace API] Added member:', { memberId, userId, workspaceId: workspace.id });

      // Create default workspace settings
      const settingsId = uuidv4();
      await sql(
        `INSERT INTO workspace_settings (id, workspace_id, forbidden_phrases, created_at, updated_at) 
         VALUES ($1, $2, ARRAY['guaranteed', 'risk-free', '100% safe']::text[], NOW(), NOW())`,
        [settingsId, workspace.id]
      );

      console.log('[Workspace API] Workspace setup complete');

      return NextResponse.json({ 
        workspace: {
          id: workspace.id,
          name: workspace.name,
          slug: workspace.slug,
          settings: typeof workspace.settings === 'string' 
            ? JSON.parse(workspace.settings) 
            : workspace.settings,
        },
        message: 'Workspace created successfully',
      });

    } catch (dbError) {
      console.error('[Workspace API] Database error:', dbError);
      
      // Try to provide more helpful error message
      const errorMessage = dbError instanceof Error ? dbError.message : 'Database error';
      
      // Check if it's a "table doesn't exist" error
      if (errorMessage.includes('does not exist') || errorMessage.includes('relation')) {
        return NextResponse.json({ 
          error: 'Database tables not set up. Please run migrations first.',
          details: errorMessage,
        }, { status: 500 });
      }
      
      return NextResponse.json({ 
        error: 'Failed to create workspace',
        details: errorMessage,
      }, { status: 500 });
    }

  } catch (error) {
    console.error('[Workspace API] Error:', error);
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
    
    if (!userId) {
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

    if (!membershipResult || membershipResult.length === 0) {
      return NextResponse.json({ 
        workspace: null,
        needsOnboarding: true,
      });
    }

    const membership = membershipResult[0];

    // Get workspace details
    const workspaceResult = await sql<{ id: string; name: string; slug: string; settings: string; created_at: string }>(
      `SELECT id, name, slug, settings, created_at FROM workspaces WHERE id = $1`,
      [membership.workspace_id]
    );

    if (!workspaceResult || workspaceResult.length === 0) {
      return NextResponse.json({ 
        workspace: null,
        needsOnboarding: true,
      });
    }

    const workspace = workspaceResult[0];

    // Parse settings if it's a string
    const settings = typeof workspace.settings === 'string' 
      ? JSON.parse(workspace.settings) 
      : workspace.settings;

    return NextResponse.json({
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      settings,
      role: membership.role,
      needsOnboarding: !settings?.onboarding_completed,
    });

  } catch (error) {
    console.error('[Workspace API] GET error:', error);
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
    
    if (!userId) {
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

    if (!membershipResult || membershipResult.length === 0) {
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

    return NextResponse.json({ workspace: workspaceResult[0] });

  } catch (error) {
    console.error('[Workspace API] PATCH error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
