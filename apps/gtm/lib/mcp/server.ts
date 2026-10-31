/**
 * MCP (Model Context Protocol) Server (Jan 2026)
 * 
 * Exposes Sako Composer tools via MCP for external AI agent integration.
 * This allows Cursor, Claude Desktop, and custom orchestrators to use
 * Sako as a tool server.
 * 
 * @see https://modelcontextprotocol.io/docs
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestScimport { Database } from '@/lib/supabase/types'

type EvidenceRow = Database['public']['Tables']['evidence']['Row']
type CampaignRow = Database['public']['Tables']['campaigns']['Row']
hema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { quickClaimCheck, generateLandingPageContent, generateMarketingAngles } from '@/lib/ai/ai-sdk-client';
import { createServiceClient } from '@/lib/supabase/service';
import {
  getBrainContext,
  listBrainSources,
  resolveApprovedBrainSnapshot,
  syncBrainSource,
} from '@/lib/brain/service';
import { checkComplianceGate } from '@/lib/claims/compliance-gate';
import { incrementUsage } from '@/lib/billing/usage';

// ============================================================================
// MCP Server Configuration
// ============================================================================

const server = new Server(
  {
    name: 'sako-composer',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// ============================================================================
// Tool Definitions
// ============================================================================

const SAKO_TOOLS = [
  {
    name: 'validate_claim',
    description: 'Validate a marketing claim against compliance policy. Returns risk level, issues, and suggestions.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        claim: {
          type: 'string',
          description: 'The marketing claim text to validate',
        },
        policy_mode: {
          type: 'string',
          enum: ['strict', 'standard', 'relaxed'],
          description: 'Policy strictness level',
          default: 'standard',
        },
      },
      required: ['claim'],
    },
  },
  {
    name: 'generate_landing_page',
    description: 'Generate compliant landing page content from a campaign brief',
    inputSchema: {
      type: 'object' as const,
      properties: {
        audience: {
          type: 'string',
          description: 'Target audience description',
        },
        goal: {
          type: 'string',
          description: 'Campaign goal (e.g., "Demo signups", "Lead generation")',
        },
        offer: {
          type: 'string',
          description: 'What you are offering (e.g., "Free trial", "Whitepaper")',
        },
        brand_voice: {
          type: 'string',
          description: 'Brand voice/tone (e.g., "Professional", "Friendly")',
        },
      },
      required: ['audience', 'goal', 'offer'],
    },
  },
  {
    name: 'generate_angles',
    description: 'Generate multiple marketing angles for a campaign',
    inputSchema: {
      type: 'object' as const,
      properties: {
        audience: {
          type: 'string',
          description: 'Target audience',
        },
        goal: {
          type: 'string',
          description: 'Campaign goal',
        },
        industry: {
          type: 'string',
          description: 'Industry vertical',
        },
        count: {
          type: 'number',
          description: 'Number of angles to generate',
          default: 3,
        },
      },
      required: ['audience', 'goal'],
    },
  },
  {
    name: 'search_evidence',
    description: 'Search the evidence library for supporting claims',
    inputSchema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'Search query for evidence',
        },
        workspace_id: {
          type: 'string',
          description: 'Workspace ID to search within',
        },
        limit: {
          type: 'number',
          description: 'Maximum results to return',
          default: 5,
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'list_campaigns',
    description: 'List campaigns in a workspace',
    inputSchema: {
      type: 'object' as const,
      properties: {
        workspace_id: {
          type: 'string',
          description: 'Workspace ID',
        },
        status: {
          type: 'string',
          enum: ['draft', 'active', 'paused', 'completed'],
          description: 'Filter by campaign status',
        },
        limit: {
          type: 'number',
          default: 10,
        },
      },
      required: [],
    },
  },
  {
    name: 'get_campaign_health',
    description: 'Get health score and issues for a campaign',
    inputSchema: {
      type: 'object' as const,
      properties: {
        campaign_id: {
          type: 'string',
          description: 'Campaign ID to check',
        },
      },
      required: ['campaign_id'],
    },
  },
  {
    name: 'create_campaign',
    description: 'Create a new campaign bound to the current approved GTM Brain snapshot',
    inputSchema: {
      type: 'object' as const,
      properties: {
        workspace_id: { type: 'string', description: 'Workspace ID' },
        name: { type: 'string', description: 'Campaign name' },
        audience: { type: 'string', description: 'Target audience' },
        goal: { type: 'string', description: 'Campaign goal' },
        offer: { type: 'string', description: 'Offer or CTA promise' },
      },
      required: ['workspace_id', 'name'],
    },
  },
  {
    name: 'list_brain_sources',
    description: 'List GTM Brain sources for a workspace',
    inputSchema: {
      type: 'object' as const,
      properties: {
        workspace_id: { type: 'string', description: 'Workspace ID' },
      },
      required: ['workspace_id'],
    },
  },
  {
    name: 'sync_brain_source',
    description: 'Run a Brain source sync and create a draft snapshot',
    inputSchema: {
      type: 'object' as const,
      properties: {
        workspace_id: { type: 'string', description: 'Workspace ID' },
        source_id: { type: 'string', description: 'Brain source ID' },
      },
      required: ['workspace_id', 'source_id'],
    },
  },
  {
    name: 'get_brain_snapshot',
    description: 'Read the approved Brain snapshot or a specific snapshot context',
    inputSchema: {
      type: 'object' as const,
      properties: {
        workspace_id: { type: 'string', description: 'Workspace ID' },
        snapshot_id: { type: 'string', description: 'Snapshot ID' },
        brand_id: { type: 'string', description: 'Optional brand ID' },
      },
      required: ['workspace_id'],
    },
  },
  {
    name: 'generate_assets',
    description: 'List canonical asset documents already generated for a campaign',
    inputSchema: {
      type: 'object' as const,
      properties: {
        workspace_id: { type: 'string', description: 'Workspace ID' },
        campaign_id: { type: 'string', description: 'Campaign ID' },
      },
      required: ['workspace_id', 'campaign_id'],
    },
  },
  {
    name: 'review_claims',
    description: 'Review claims attached to canonical asset documents for a campaign',
    inputSchema: {
      type: 'object' as const,
      properties: {
        workspace_id: { type: 'string', description: 'Workspace ID' },
        campaign_id: { type: 'string', description: 'Campaign ID' },
      },
      required: ['workspace_id', 'campaign_id'],
    },
  },
  {
    name: 'publish_asset',
    description: 'Mark an asset as published after compliance passes and meter a publish',
    inputSchema: {
      type: 'object' as const,
      properties: {
        workspace_id: { type: 'string', description: 'Workspace ID' },
        asset_document_id: { type: 'string', description: 'Asset document ID' },
      },
      required: ['workspace_id', 'asset_document_id'],
    },
  },
];

// ============================================================================
// Tool Handlers
// ============================================================================

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: SAKO_TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'validate_claim': {
        const { claim } = args as { claim: string };
        const result = await quickClaimCheck(claim);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'generate_landing_page': {
        const { audience, goal, offer, brand_voice } = args as {
          audience: string;
          goal: string;
          offer: string;
          brand_voice?: string;
        };
        const prompt = `Create landing page for ${audience} with goal: ${goal}, offering: ${offer}`;
        const context = brand_voice ? `Brand voice: ${brand_voice}` : undefined;
        const result = await generateLandingPageContent(prompt, context);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'generate_angles': {
        const { audience, goal, industry, count } = args as {
          audience: string;
          goal: string;
          industry?: string;
          count?: number;
        };
        const result = await generateMarketingAngles(
          { name: 'MCP Campaign', audience, goal, industry },
          undefined,
          count || 3
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'search_evidence': {
        const { query, workspace_id, limit } = args as {
          query: string;
          workspace_id?: string;
          limit?: number;
        };
        const supabase = createServiceClient();
        
        // Vector similarity search
        const { data: evidence } = await supabase
          .from('evidence')
          .select('id, title, content, source_type, source_url')
          .textSearch('content', query)
          .limit(limit || 5);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(evidence || [], null, 2),
            },
          ],
        };
      }

      case 'list_campaigns': {
        const { workspace_id, status, limit } = args as {
          workspace_id?: string;
          status?: string;
          limit?: number;
        };
        const supabase = createServiceClient();
        
        let query = supabase
          .from('campaigns')
          .select('id, name, status, created_at, updated_at')
          .order('updated_at', { ascending: false })
          .limit(limit || 10);

        if (workspace_id) {
          query = query.eq('workspace_id', workspace_id);
        }
        if (status) {
          query = query.eq('status', status);
        }

        const { data: campaigns } = await query;
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(campaigns || [], null, 2),
            },
          ],
        };
      }

      case 'get_campaign_health': {
        const { campaign_id } = args as { campaign_id: string };
        const supabase = createServiceClient();
        
        // Get campaign with related data
        const { data: campaign } = await supabase
          .from('campaigns')
          .select(`
            id, name, status,
            claims:messages(id, status, risk_score)
          `)
          .eq('id', campaign_id)
          .maybeSingle();

        if (!campaign) {
          return {
            content: [{ type: 'text', text: 'Campaign not found' }],
            isError: true,
          };
        }

        // Calculate health metrics
        const claims = (campaign as any).claims || [];
        const totalClaims = claims.length;
        const approvedClaims = claims.filter((c: any) => c.status === 'approved').length;
        const highRiskClaims = claims.filter((c: any) => c.risk_score > 70).length;
        
        const complianceScore = totalClaims > 0 
          ? Math.round((approvedClaims / totalClaims) * 100) 
          : 100;

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                campaign_id,
                campaign_name: campaign.name,
                status: campaign.status,
                health: {
                  complianceScore,
                  totalClaims,
                  approvedClaims,
                  highRiskClaims,
                  grade: complianceScore >= 90 ? 'A' : complianceScore >= 70 ? 'B' : complianceScore >= 50 ? 'C' : 'D',
                },
                issues: highRiskClaims > 0 
                  ? [`${highRiskClaims} high-risk claims need review`]
                  : [],
              }, null, 2),
            },
          ],
        };
      }

      case 'create_campaign': {
        const { workspace_id, name, audience, goal, offer } = args as {
          workspace_id: string;
          name: string;
          audience?: string;
          goal?: string;
          offer?: string;
        };
        const supabase = createServiceClient();
        const snapshot = await resolveApprovedBrainSnapshot(workspace_id);
        if (!snapshot) {
          return {
            content: [{ type: 'text', text: 'No approved Brain snapshot found for workspace' }],
            isError: true,
          };
        }

        const { data, error } = await supabase
          .from('campaigns')
          .insert({
            workspace_id,
            name,
            status: 'draft',
            audience: audience ?? null,
            goal: goal ?? null,
            offer: offer ?? null,
            brain_snapshot_id: snapshot.id,
            constraints: {
              brain_snapshot_id: snapshot.id,
            },
          })
          .select('id, name, status, brain_snapshot_id')
          .single();

        if (error) {
          throw error;
        }

        return {
          content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
        };
      }

      case 'list_brain_sources': {
        const { workspace_id } = args as { workspace_id: string };
        const sources = await listBrainSources(workspace_id);
        return {
          content: [{ type: 'text', text: JSON.stringify(sources, null, 2) }],
        };
      }

      case 'sync_brain_source': {
        const { workspace_id, source_id } = args as { workspace_id: string; source_id: string };
        const result = await syncBrainSource(workspace_id, source_id);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      case 'get_brain_snapshot': {
        const { workspace_id, snapshot_id, brand_id } = args as {
          workspace_id: string;
          snapshot_id?: string;
          brand_id?: string;
        };

        if (snapshot_id) {
          const context = await getBrainContext(workspace_id, snapshot_id);
          return {
            content: [{ type: 'text', text: JSON.stringify(context, null, 2) }],
          };
        }

        const snapshot = await resolveApprovedBrainSnapshot(workspace_id, brand_id);
        return {
          content: [{ type: 'text', text: JSON.stringify(snapshot, null, 2) }],
        };
      }

      case 'generate_assets': {
        const { workspace_id, campaign_id } = args as { workspace_id: string; campaign_id: string };
        const supabase = createServiceClient();
        const { data, error } = await supabase
          .from('asset_documents')
          .select('id, asset_type, status, title, brain_snapshot_id, created_at')
          .eq('workspace_id', workspace_id)
          .eq('campaign_id', campaign_id)
          .order('created_at', { ascending: false });

        if (error) {
          throw error;
        }

        return {
          content: [{ type: 'text', text: JSON.stringify(data ?? [], null, 2) }],
        };
      }

      case 'review_claims': {
        const { workspace_id, campaign_id } = args as { workspace_id: string; campaign_id: string };
        const supabase = createServiceClient();
        const { data, error } = await supabase
          .from('asset_documents')
          .select('id, title, asset_type, compliance_status, claims_json')
          .eq('workspace_id', workspace_id)
          .eq('campaign_id', campaign_id)
          .order('created_at', { ascending: false });

        if (error) {
          throw error;
        }

        return {
          content: [{ type: 'text', text: JSON.stringify(data ?? [], null, 2) }],
        };
      }

      case 'publish_asset': {
        const { workspace_id, asset_document_id } = args as {
          workspace_id: string;
          asset_document_id: string;
        };
        const blocked = await checkComplianceGate(asset_document_id, workspace_id);
        if (blocked) {
          return {
            content: [{ type: 'text', text: 'Compliance gate blocked publish' }],
            isError: true,
          };
        }

        const supabase = createServiceClient();
        const { data, error } = await supabase
          .from('asset_documents')
          .update({ status: 'published' })
          .eq('id', asset_document_id)
          .eq('workspace_id', workspace_id)
          .select('id, title, asset_type, status')
          .single();

        if (error) {
          throw error;
        }

        await incrementUsage(workspace_id, 'deployments');

        return {
          content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
        };
      }

      default:
        return {
          content: [{ type: 'text', text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      ],
      isError: true,
    };
  }
});

// ============================================================================
// Resource Handlers (Read-only data access)
// ============================================================================

server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [
    {
      uri: 'sako://policies/templates',
      name: 'Policy Templates',
      description: 'Available compliance policy templates',
      mimeType: 'application/json',
    },
    {
      uri: 'sako://models/pricing',
      name: 'Model Pricing',
      description: 'AI model pricing information',
      mimeType: 'application/json',
    },
  ],
}));

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  switch (uri) {
    case 'sako://policies/templates':
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({
              templates: [
                { id: 'ftc-standard', name: 'FTC Standard', mode: 'standard' },
                { id: 'healthcare', name: 'Healthcare/HIPAA', mode: 'strict' },
                { id: 'financial', name: 'Financial Services', mode: 'strict' },
                { id: 'b2b-saas', name: 'B2B SaaS', mode: 'relaxed' },
              ],
            }),
          },
        ],
      };

    case 'sako://models/pricing':
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({
              models: {
                'openai/gpt-5.3-chat': { input: 0.175, output: 1.40 },
                'openai/gpt-5.4': { input: 2.50, output: 15.00 },
                'anthropic/claude-opus-4.6': { input: 15.00, output: 75.00 },
                'anthropic/claude-sonnet-4.6': { input: 3.00, output: 15.00 },
              },
              currency: 'USD',
              unit: 'per 1M tokens',
            }),
          },
        ],
      };

    default:
      throw new Error(`Unknown resource: ${uri}`);
  }
});

// ============================================================================
// Server Startup
// ============================================================================

export async function startMCPServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Sako MCP Server started');
}

// Run if executed directly
if (require.main === module) {
  startMCPServer().catch(console.error);
}

export { server };
