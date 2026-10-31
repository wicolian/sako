import { NextRequest, NextResponse } from 'next/server';
import { POLICY_TEMPLATES, getPolicyTemplate, getPolicyTemplatesByIndustry } from '@/lib/claims/policy-templates';
import { createServiceClient } from '@/lib/supabase/service';
import { getWorkspaceId } from '@/lib/workspace';

/**
 * GET /api/policies/templates
 * 
 * List available policy templates, optionally filtered by industry
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const industry = searchParams.get('industry');

    const templates = industry 
      ? getPolicyTemplatesByIndustry(industry)
      : POLICY_TEMPLATES;

    // Return templates without full policy config (just metadata)
    const templatesMetadata = templates.map(t => ({
      id: t.id,
      name: t.name,
      description: t.description,
      industry: t.industry,
      regulations: t.regulations,
      mode: t.policy.mode,
    }));

    return NextResponse.json({
      templates: templatesMetadata,
      industries: [...new Set(POLICY_TEMPLATES.map(t => t.industry))],
    });
  } catch (error: any) {
    console.error('Error listing policy templates:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/policies/templates
 * 
 * Apply a policy template to the current workspace
 */
export async function POST(request: NextRequest) {
  try {
    const workspaceId = getWorkspaceId(request);
    const supabase = createServiceClient();
    const { templateId, customizations = {} } = await request.json();

    if (!templateId) {
      return NextResponse.json({ error: 'templateId is required' }, { status: 400 });
    }

    const template = getPolicyTemplate(templateId);
    if (!template) {
      return NextResponse.json({ error: `Unknown template: ${templateId}` }, { status: 404 });
    }

    // Get current policy version
    const { data: currentPolicy } = await supabase
      .from('policies')
      .select('version')
      .eq('workspace_id', workspaceId)
      .order('version', { ascending: false })
      .limit(1)
      .single();

    const newVersion = (currentPolicy?.version || 0) + 1;

    // Merge template with customizations
    const mergedPolicy = {
      ...template.policy,
      ...customizations,
      forbiddenTerms: [
        ...(template.policy.forbiddenTerms || []),
        ...(customizations.forbiddenTerms || []),
      ],
    };

    // Create new policy version from template
    const { data: newPolicy, error } = await supabase
      .from('policies')
      .insert({
        workspace_id: workspaceId,
        version: newVersion,
        mode: mergedPolicy.mode,
        forbidden_terms: mergedPolicy.forbiddenTerms,
        regulated_categories: mergedPolicy.regulatedCategories,
        superlative_rules: mergedPolicy.superlativeRules,
        evidence_requirements: mergedPolicy.evidenceRequirements,
        template_id: templateId,
        template_name: template.name,
      })
      .select()
      .single();

    if (error) {
      console.error('Error applying policy template:', error);
      return NextResponse.json({ error: 'Failed to apply template' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      policy: newPolicy,
      template: {
        id: template.id,
        name: template.name,
        description: template.description,
      },
    });
  } catch (error: any) {
    console.error('Error applying policy template:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
