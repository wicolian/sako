export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// Campaign status enum
export type CampaignStatus = 'draft' | 'ready' | 'published' | 'running' | 'archived'

// Message type enum
export type MessageType = 'headline' | 'supporting' | 'cta' | 'disclaimer'

// Message status enum
export type MessageStatus = 'approved' | 'needs_evidence' | 'blocked'

// Evidence type enum
export type EvidenceType = 'url' | 'text' | 'file' | 'metric'

// Evidence tier enum
export type EvidenceTier = 'A' | 'B' | 'C'

// Evidence source type enum
export type EvidenceSourceType = 'third_party_report' | 'customer_contract' | 'audited_metric' | 'case_study' | 'testimonial' | 'internal_doc' | 'screenshot' | 'anecdote' | 'other'

// Page block type enum
export type PageBlockType = 'hero' | 'trust' | 'benefits' | 'features' | 'pricing' | 'faq' | 'footer' | 'custom'

// Deployment status enum
export type DeploymentStatus = 'pending' | 'partial' | 'success' | 'failed'

// ============================================================================
// ClaimsOS Types
// ============================================================================

// Workspace member role enum
export type WorkspaceMemberRole = 'admin' | 'reviewer' | 'member'

// Policy mode enum
export type PolicyMode = 'standard' | 'strict' | 'relaxed'

// Claim type enum
export type ClaimType = 'hard' | 'soft' | 'unverified'

// Claim category enum
export type ClaimCategory = 'performance' | 'security' | 'pricing' | 'compliance' | 'generic'

// Claim status enum
export type ClaimStatus = 'draft' | 'needs_proof' | 'blocked' | 'ready_review' | 'approved' | 'rejected'

// Approval decision enum
export type ApprovalDecision = 'approved' | 'rejected' | 'needs_changes'

// Audit action enum
export type AuditAction = 'create' | 'update' | 'delete' | 'approve' | 'reject' | 'link' | 'unlink' | 'export'

// Audit entity type enum
export type AuditEntityType = 'claim' | 'evidence' | 'policy' | 'approval' | 'claim_pack'

// Claim pack export format enum
export type ClaimPackExportFormat = 'json' | 'markdown' | 'pdf'

// Reason codes for claim validation
export type ReasonCode =
  | 'SUPERLATIVE_NO_PROOF'
  | 'FORBIDDEN_TERM'
  | 'REGULATED_CATEGORY'
  | 'QUANT_DELTA_NO_SOURCE'
  | 'COMPARATIVE_NO_BASELINE'
  | 'WEASEL_WORDS_STRICT'
  | 'ABSOLUTE_CLAIM'
  | 'MISSING_EVIDENCE'

export interface Database {
  public: {
    Tables: {
      workspaces: {
        Row: {
          id: string
          name: string
          slug: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          created_at?: string
          updated_at?: string
        }
      }
      workspace_settings: {
        Row: {
          id: string
          workspace_id: string
          forbidden_phrases: string[]
          default_view: string | null
          brand_colors: Json | null
          brand_typography: Json | null
          brand_logo_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          forbidden_phrases?: string[]
          default_view?: string | null
          brand_colors?: Json | null
          brand_typography?: Json | null
          brand_logo_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          forbidden_phrases?: string[]
          default_view?: string | null
          brand_colors?: Json | null
          brand_typography?: Json | null
          brand_logo_url?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      brands: {
        Row: {
          id: string
          workspace_id: string
          name: string
          tagline: string | null
          description: string | null
          website_url: string | null
          logo_primary_url: string | null
          logo_primary_dark_url: string | null
          logo_icon_url: string | null
          favicon_url: string | null
          primary_color: string
          secondary_color: string | null
          accent_color: string | null
          background_color: string
          text_color: string
          color_palette: Json | null
          gradients: Json | null
          font_family: string | null
          font_heading: string | null
          font_mono: string | null
          font_weights: Json | null
          font_cdn_url: string | null
          voice: string | null
          tone_attributes: Json | null
          key_messages: Json | null
          value_propositions: Json | null
          boilerplate: string | null
          visual_style: Json | null
          icon_style: string | null
          image_style: string | null
          guidelines_url: string | null
          dos: Json | null
          donts: Json | null
          social_links: Json | null
          is_default: boolean | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          name: string
          tagline?: string | null
          description?: string | null
          website_url?: string | null
          logo_primary_url?: string | null
          logo_primary_dark_url?: string | null
          logo_icon_url?: string | null
          favicon_url?: string | null
          primary_color?: string
          secondary_color?: string | null
          accent_color?: string | null
          background_color?: string
          text_color?: string
          color_palette?: Json | null
          gradients?: Json | null
          font_family?: string | null
          font_heading?: string | null
          font_mono?: string | null
          font_weights?: Json | null
          font_cdn_url?: string | null
          voice?: string | null
          tone_attributes?: Json | null
          key_messages?: Json | null
          value_propositions?: Json | null
          boilerplate?: string | null
          visual_style?: Json | null
          icon_style?: string | null
          image_style?: string | null
          guidelines_url?: string | null
          dos?: Json | null
          donts?: Json | null
          social_links?: Json | null
          is_default?: boolean | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          name?: string
          tagline?: string | null
          description?: string | null
          website_url?: string | null
          logo_primary_url?: string | null
          logo_primary_dark_url?: string | null
          logo_icon_url?: string | null
          favicon_url?: string | null
          primary_color?: string
          secondary_color?: string | null
          accent_color?: string | null
          background_color?: string
          text_color?: string
          color_palette?: Json | null
          gradients?: Json | null
          font_family?: string | null
          font_heading?: string | null
          font_mono?: string | null
          font_weights?: Json | null
          font_cdn_url?: string | null
          voice?: string | null
          tone_attributes?: Json | null
          key_messages?: Json | null
          value_propositions?: Json | null
          boilerplate?: string | null
          visual_style?: Json | null
          icon_style?: string | null
          image_style?: string | null
          guidelines_url?: string | null
          dos?: Json | null
          donts?: Json | null
          social_links?: Json | null
          is_default?: boolean | null
          created_at?: string
          updated_at?: string
        }
      }
      brand_assets: {
        Row: {
          id: string
          brand_id: string
          name: string
          type: string
          format: string | null
          url: string
          width: number | null
          height: number | null
          file_size: number | null
          usage: string | null
          created_at: string
        }
        Insert: {
          id?: string
          brand_id: string
          name: string
          type: string
          format?: string | null
          url: string
          width?: number | null
          height?: number | null
          file_size?: number | null
          usage?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          brand_id?: string
          name?: string
          type?: string
          format?: string | null
          url?: string
          width?: number | null
          height?: number | null
          file_size?: number | null
          usage?: string | null
          created_at?: string
        }
      }
      campaigns: {
        Row: {
          id: string
          workspace_id: string
          brand_id: string | null
          name: string
          status: CampaignStatus
          audience: string | null
          goal: string | null
          offer: string | null
          cta: string | null
          constraints: Json | null
          selected_angle_id: string | null
          version: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          brand_id?: string | null
          name: string
          status?: CampaignStatus
          audience?: string | null
          goal?: string | null
          offer?: string | null
          cta?: string | null
          constraints?: Json | null
          selected_angle_id?: string | null
          version?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          brand_id?: string | null
          name?: string
          status?: CampaignStatus
          audience?: string | null
          goal?: string | null
          offer?: string | null
          cta?: string | null
          constraints?: Json | null
          selected_angle_id?: string | null
          version?: number
          created_at?: string
          updated_at?: string
        }
      }
      evidence: {
        Row: {
          id: string
          workspace_id: string
          type: EvidenceType
          title: string
          content: string | null
          url: string | null
          file_path: string | null
          metadata: Json | null
          tier: EvidenceTier
          source_type: EvidenceSourceType | null
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          type: EvidenceType
          title: string
          content?: string | null
          url?: string | null
          file_path?: string | null
          metadata?: Json | null
          tier?: EvidenceTier
          source_type?: EvidenceSourceType | null
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          type?: EvidenceType
          title?: string
          content?: string | null
          url?: string | null
          file_path?: string | null
          metadata?: Json | null
          tier?: EvidenceTier
          source_type?: EvidenceSourceType | null
          created_at?: string
        }
      }
      messages: {
        Row: {
          id: string
          campaign_id: string
          type: MessageType
          text: string
          status: MessageStatus
          strength: 'hard' | 'soft'
          risk_tags: string[]
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          campaign_id: string
          type: MessageType
          text: string
          status?: MessageStatus
          strength?: 'hard' | 'soft'
          risk_tags?: string[]
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          campaign_id?: string
          type?: MessageType
          text?: string
          status?: MessageStatus
          strength?: 'hard' | 'soft'
          risk_tags?: string[]
          created_at?: string
          updated_at?: string
        }
      }
      message_evidence: {
        Row: {
          id: string
          message_id: string
          evidence_id: string
          note: string | null
          created_at: string
        }
        Insert: {
          id?: string
          message_id: string
          evidence_id: string
          note?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          message_id?: string
          evidence_id?: string
          note?: string | null
          created_at?: string
        }
      }
      angles: {
        Row: {
          id: string
          campaign_id: string
          name: string
          description: string | null
          rank: number
          trust_score: number
          rationale: string | null
          payload: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          campaign_id: string
          name: string
          description?: string | null
          rank?: number
          trust_score?: number
          rationale?: string | null
          payload?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          campaign_id?: string
          name?: string
          description?: string | null
          rank?: number
          trust_score?: number
          rationale?: string | null
          payload?: Json | null
          created_at?: string
        }
      }
      page_blocks: {
        Row: {
          id: string
          campaign_id: string
          angle_id: string | null
          type: PageBlockType
          order: number
          props: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          campaign_id: string
          angle_id?: string | null
          type: PageBlockType
          order?: number
          props?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          campaign_id?: string
          angle_id?: string | null
          type?: PageBlockType
          order?: number
          props?: Json
          created_at?: string
          updated_at?: string
        }
      }
      followup_flows: {
        Row: {
          id: string
          campaign_id: string
          angle_id: string | null
          graph_json: Json
          compiled_json: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          campaign_id: string
          angle_id?: string | null
          graph_json?: Json
          compiled_json?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          campaign_id?: string
          angle_id?: string | null
          graph_json?: Json
          compiled_json?: Json | null
          created_at?: string
          updated_at?: string
        }
      }
      hubspot_connections: {
        Row: {
          id: string
          workspace_id: string
          portal_id: string
          access_token_encrypted: string
          refresh_token_encrypted: string
          expires_at: string
          scopes: string[]
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          portal_id: string
          access_token_encrypted: string
          refresh_token_encrypted: string
          expires_at: string
          scopes?: string[]
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          portal_id?: string
          access_token_encrypted?: string
          refresh_token_encrypted?: string
          expires_at?: string
          scopes?: string[]
          created_at?: string
          updated_at?: string
        }
      }
      deployments: {
        Row: {
          id: string
          campaign_id: string
          angle_id: string | null
          idempotency_key: string
          status: DeploymentStatus
          hubspot_payload: Json | null
          hubspot_result: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          campaign_id: string
          angle_id?: string | null
          idempotency_key: string
          status?: DeploymentStatus
          hubspot_payload?: Json | null
          hubspot_result?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          campaign_id?: string
          angle_id?: string | null
          idempotency_key?: string
          status?: DeploymentStatus
          hubspot_payload?: Json | null
          hubspot_result?: Json | null
          created_at?: string
          updated_at?: string
        }
      }
      performance: {
        Row: {
          id: string
          campaign_id: string
          deployment_id: string | null
          captured_at: string
          metrics: Json
          notes: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          campaign_id: string
          deployment_id?: string | null
          captured_at?: string
          metrics?: Json
          notes?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          campaign_id?: string
          deployment_id?: string | null
          captured_at?: string
          metrics?: Json
          notes?: Json | null
          created_at?: string
        }
      }
      campaign_versions: {
        Row: {
          id: string
          campaign_id: string
          version: number
          parent_version_id: string | null
          diff: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          campaign_id: string
          version: number
          parent_version_id?: string | null
          diff?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          campaign_id?: string
          version?: number
          parent_version_id?: string | null
          diff?: Json | null
          created_at?: string
        }
      }
      // ========================================================================
      // ClaimsOS Tables
      // ========================================================================
      workspace_members: {
        Row: {
          id: string
          user_id: string
          workspace_id: string
          role: WorkspaceMemberRole
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          workspace_id: string
          role?: WorkspaceMemberRole
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          workspace_id?: string
          role?: WorkspaceMemberRole
          created_at?: string
          updated_at?: string
        }
      }
      policies: {
        Row: {
          id: string
          workspace_id: string
          version: number
          mode: PolicyMode
          forbidden_terms: Json
          regulated_categories: Json
          superlative_rules: Json
          evidence_requirements: Json
          created_at: string
          updated_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          workspace_id: string
          version?: number
          mode?: PolicyMode
          forbidden_terms?: Json
          regulated_categories?: Json
          superlative_rules?: Json
          evidence_requirements?: Json
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          workspace_id?: string
          version?: number
          mode?: PolicyMode
          forbidden_terms?: Json
          regulated_categories?: Json
          superlative_rules?: Json
          evidence_requirements?: Json
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
      }
      claims: {
        Row: {
          id: string
          workspace_id: string
          text: string
          original_text: string | null
          claim_type: ClaimType
          category: ClaimCategory
          status: ClaimStatus
          risk_score: number
          reason_codes: Json
          required_evidence_tier: EvidenceTier | null
          suggested_rewrites: Json
          policy_version: number | null
          created_by: string | null
          approved_by: string | null
          approved_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          text: string
          original_text?: string | null
          claim_type?: ClaimType
          category?: ClaimCategory
          status?: ClaimStatus
          risk_score?: number
          reason_codes?: Json
          required_evidence_tier?: EvidenceTier | null
          suggested_rewrites?: Json
          policy_version?: number | null
          created_by?: string | null
          approved_by?: string | null
          approved_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          text?: string
          original_text?: string | null
          claim_type?: ClaimType
          category?: ClaimCategory
          status?: ClaimStatus
          risk_score?: number
          reason_codes?: Json
          required_evidence_tier?: EvidenceTier | null
          suggested_rewrites?: Json
          policy_version?: number | null
          created_by?: string | null
          approved_by?: string | null
          approved_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      claim_evidence_links: {
        Row: {
          id: string
          claim_id: string
          evidence_id: string
          relevance_note: string | null
          created_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          claim_id: string
          evidence_id: string
          relevance_note?: string | null
          created_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          claim_id?: string
          evidence_id?: string
          relevance_note?: string | null
          created_at?: string
          created_by?: string | null
        }
      }
      approvals: {
        Row: {
          id: string
          claim_id: string
          reviewer_id: string
          decision: ApprovalDecision
          comment: string | null
          policy_version: number | null
          created_at: string
        }
        Insert: {
          id?: string
          claim_id: string
          reviewer_id: string
          decision: ApprovalDecision
          comment?: string | null
          policy_version?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          claim_id?: string
          reviewer_id?: string
          decision?: ApprovalDecision
          comment?: string | null
          policy_version?: number | null
          created_at?: string
        }
      }
      audit_log: {
        Row: {
          id: string
          workspace_id: string
          entity_type: AuditEntityType
          entity_id: string
          action: AuditAction
          before_state: Json | null
          after_state: Json | null
          actor_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          entity_type: AuditEntityType
          entity_id: string
          action: AuditAction
          before_state?: Json | null
          after_state?: Json | null
          actor_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          entity_type?: AuditEntityType
          entity_id?: string
          action?: AuditAction
          before_state?: Json | null
          after_state?: Json | null
          actor_id?: string | null
          created_at?: string
        }
      }
      claim_packs: {
        Row: {
          id: string
          workspace_id: string
          name: string
          description: string | null
          claim_ids: Json
          export_format: ClaimPackExportFormat
          share_token: string | null
          expires_at: string | null
          file_path: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          name: string
          description?: string | null
          claim_ids?: Json
          export_format?: ClaimPackExportFormat
          share_token?: string | null
          expires_at?: string | null
          file_path?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          name?: string
          description?: string | null
          claim_ids?: Json
          export_format?: ClaimPackExportFormat
          share_token?: string | null
          expires_at?: string | null
          file_path?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}

// Helper types for easier usage
export type Workspace = Database['public']['Tables']['workspaces']['Row']
export type WorkspaceSettings = Database['public']['Tables']['workspace_settings']['Row']
export type Brand = Database['public']['Tables']['brands']['Row']
export type BrandAsset = Database['public']['Tables']['brand_assets']['Row']
export type Campaign = Database['public']['Tables']['campaigns']['Row']
export type Evidence = Database['public']['Tables']['evidence']['Row']
export type Message = Database['public']['Tables']['messages']['Row']
export type MessageEvidence = Database['public']['Tables']['message_evidence']['Row']
export type Angle = Database['public']['Tables']['angles']['Row']
export type PageBlock = Database['public']['Tables']['page_blocks']['Row']
export type FollowupFlow = Database['public']['Tables']['followup_flows']['Row']
export type HubspotConnection = Database['public']['Tables']['hubspot_connections']['Row']
export type Deployment = Database['public']['Tables']['deployments']['Row']
export type Performance = Database['public']['Tables']['performance']['Row']
export type CampaignVersion = Database['public']['Tables']['campaign_versions']['Row']

// ClaimsOS helper types
export type WorkspaceMember = Database['public']['Tables']['workspace_members']['Row']
export type Policy = Database['public']['Tables']['policies']['Row']
export type Claim = Database['public']['Tables']['claims']['Row']
export type ClaimEvidenceLink = Database['public']['Tables']['claim_evidence_links']['Row']
export type Approval = Database['public']['Tables']['approvals']['Row']
export type AuditLogEntry = Database['public']['Tables']['audit_log']['Row']
export type ClaimPack = Database['public']['Tables']['claim_packs']['Row']

// Policy configuration types
export interface ForbiddenTerm {
  term: string
  regex?: boolean
  severity?: 'block' | 'warn'
  replacement?: string
}

export interface RegulatedCategories {
  security: boolean
  health: boolean
  finance: boolean
  legal: boolean
}

export interface SuperlativeRules {
  block_without_proof: string[]
  require_evidence_tier: EvidenceTier
}

export interface EvidenceRequirements {
  performance: EvidenceTier
  security: EvidenceTier
  pricing: EvidenceTier
  compliance: EvidenceTier
  generic: EvidenceTier
}

// Parsed policy type
export interface ParsedPolicy {
  id: string
  workspace_id: string
  version: number
  mode: PolicyMode
  forbidden_terms: ForbiddenTerm[]
  regulated_categories: RegulatedCategories
  superlative_rules: SuperlativeRules
  evidence_requirements: EvidenceRequirements
}

// Claim with evidence
export interface ClaimWithEvidence extends Claim {
  evidence: Evidence[]
  evidence_links: ClaimEvidenceLink[]
}

// Claim with full context
export interface ClaimWithContext extends Claim {
  evidence: Evidence[]
  approvals: Approval[]
  created_by_user?: { email: string; full_name?: string }
}
