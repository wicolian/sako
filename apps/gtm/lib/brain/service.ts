import { createServiceClient } from '@/lib/supabase/service'
import type { Json } from '@/lib/supabase/types'
import {
  smartFetch,
  normalizeUrl,
  isValidUrl,
} from '@/lib/import/url-fetcher'
import { parseHtml } from '@/lib/import/html-parser'
import { extractDesignTokens } from '@/lib/import/design-extractor'
import {
  analyzeBrand,
  brandAnalysisToBrandContext,
  type BrandAnalysis,
} from '@/lib/import/brand-extractor'
import { extractClaims, type ExtractedClaim } from '@/lib/import/claims-extractor'
import type { BrainBootstrapInput, BrainContext, BrainProvenanceRef, BrainSnapshot, BrainSource, BrainSourceType, LegalRule, ProductFact } from './types'

interface BrainSourceRow {
  id: string
  workspace_id: string
  brand_id: string | null
  source_type: BrainSourceType
  connection_ref: string | null
  external_id: string | null
  display_name: string
  status: BrainSource['status']
  last_synced_at: string | null
  last_snapshot_id: string | null
  config_json: Record<string, Json>
  created_at: string
  updated_at: string
}

interface BrainSnapshotRow {
  id: string
  workspace_id: string
  brand_id: string | null
  status: BrainSnapshot['status']
  source_ids: string[]
  summary_json: Record<string, Json>
  priority_rules_json: Record<string, Json>
  created_by: string | null
  created_at: string
}

interface ProductFactRow {
  id: string
  workspace_id: string
  brand_id: string | null
  fact_key: string
  statement: string
  category: string
  source_id: string | null
  confidence: number
  status: ProductFact['status']
  claimable: boolean
  effective_region: string | null
  metadata_json: Record<string, Json>
  confirmed_by: string | null
  confirmed_at: string | null
  created_at: string
  updated_at: string
}

interface LegalRuleRow {
  id: string
  workspace_id: string
  brand_id: string | null
  rule_type: string
  rule_text: string
  severity: LegalRule['severity']
  applies_to_channels: string[] | null
  applies_to_regions: string[] | null
  required_disclaimer: string | null
  source_id: string | null
  status: LegalRule['status']
  metadata_json: Record<string, Json>
  created_at: string
  updated_at: string
}

interface BrainSyncRunSummary {
  factCount: number
  ruleCount: number
  claimCount: number
  conflictCount: number
  riskLevel: 'low' | 'review_required'
}

interface BrainSourceSyncResult {
  summary: BrainSyncRunSummary
  snapshotId: string
  facts: ProductFact[]
  legalRules: LegalRule[]
}

const GITHUB_ALLOWED_PREFIXES = [
  'README',
  'docs/',
  'content/',
  'src/content/',
  'app/',
  'components/',
  'lib/',
]

const GITHUB_ALLOWED_FILES = [
  'package.json',
  'bunfig.toml',
  'tsconfig.json',
  'next.config.ts',
  'next.config.js',
  'tailwind.config.ts',
  'tailwind.config.js',
]

const GITHUB_TEXT_EXTENSIONS = [
  '.md',
  '.mdx',
  '.txt',
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.json',
  '.yml',
  '.yaml',
]

function rowToBrainSource(row: BrainSourceRow): BrainSource {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    brandId: row.brand_id ?? undefined,
    sourceType: row.source_type,
    connectionRef: row.connection_ref ?? undefined,
    externalId: row.external_id ?? undefined,
    displayName: row.display_name,
    status: row.status,
    lastSyncedAt: row.last_synced_at ?? undefined,
    lastSnapshotId: row.last_snapshot_id ?? undefined,
    config: row.config_json ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function rowToBrainSnapshot(row: BrainSnapshotRow): BrainSnapshot {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    brandId: row.brand_id ?? undefined,
    status: row.status,
    sourceIds: row.source_ids ?? [],
    summary: row.summary_json ?? {},
    priorityRules: row.priority_rules_json ?? {},
    createdBy: row.created_by ?? undefined,
    createdAt: row.created_at,
  }
}

function rowToProductFact(row: ProductFactRow): ProductFact {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    brandId: row.brand_id ?? undefined,
    factKey: row.fact_key,
    statement: row.statement,
    category: row.category,
    sourceId: row.source_id ?? undefined,
    confidence: row.confidence,
    status: row.status,
    claimable: row.claimable,
    effectiveRegion: row.effective_region ?? undefined,
    metadata: row.metadata_json ?? {},
    confirmedBy: row.confirmed_by ?? undefined,
    confirmedAt: row.confirmed_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function rowToLegalRule(row: LegalRuleRow): LegalRule {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    brandId: row.brand_id ?? undefined,
    ruleType: row.rule_type,
    ruleText: row.rule_text,
    severity: row.severity,
    appliesToChannels: row.applies_to_channels ?? [],
    appliesToRegions: row.applies_to_regions ?? [],
    requiredDisclaimer: row.required_disclaimer ?? undefined,
    sourceId: row.source_id ?? undefined,
    status: row.status,
    metadata: row.metadata_json ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function slugifyFactKey(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80) || 'fact'
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))]
}

function toJsonRecord(value: unknown): Record<string, Json> {
  return JSON.parse(JSON.stringify(value)) as Record<string, Json>
}

function splitSentences(input: string): string[] {
  return input
    .split(/\n+/)
    .flatMap((line) => line.split(/(?<=[.!?])\s+/))
    .map((line) => line.trim())
    .filter((line) => line.length > 12)
}

function inferFactCategory(text: string): string {
  const lower = text.toLowerCase()
  if (/(price|pricing|\$|month|annual|plan)/.test(lower)) return 'pricing'
  if (/(feature|integration|supports|works with|api)/.test(lower)) return 'feature'
  if (/(customer|team|audience|buyer)/.test(lower)) return 'audience'
  if (/(compliance|security|soc|hipaa|gdpr|certified)/.test(lower)) return 'compliance'
  if (/(metric|increase|reduce|improve|faster|x|%)/.test(lower)) return 'performance'
  return 'generic'
}

function isClaimableFact(text: string): boolean {
  const lower = text.toLowerCase()
  return (
    /\d/.test(lower) ||
    /(faster|improve|reduce|save|trusted by|used by|integrates with|supports|works with)/.test(lower)
  )
}

function extractFactCandidatesFromText(content: string, sourceLabel: string): Array<{
  factKey: string
  statement: string
  category: string
  claimable: boolean
  metadata: Record<string, Json>
}> {
  const facts: Array<{
    factKey: string
    statement: string
    category: string
    claimable: boolean
    metadata: Record<string, Json>
  }> = []

  for (const sentence of splitSentences(content).slice(0, 120)) {
    const normalized = sentence.replace(/^[-*]\s*/, '').trim()
    if (normalized.length < 15) continue
    if (/(must|should not|cannot|do not|required|disclaimer|legal)/i.test(normalized)) continue

    const keySource = normalized.includes(':')
      ? normalized.split(':', 1)[0] ?? normalized
      : normalized.split(/\s+/).slice(0, 6).join(' ')

    facts.push({
      factKey: slugifyFactKey(keySource),
      statement: normalized.slice(0, 500),
      category: inferFactCategory(normalized),
      claimable: isClaimableFact(normalized),
      metadata: { sourceLabel },
    })
  }

  return facts
}

function extractLegalRulesFromText(content: string, sourceLabel: string): Array<{
  ruleType: string
  ruleText: string
  severity: LegalRule['severity']
  requiredDisclaimer?: string
  metadata: Record<string, Json>
}> {
  const rules: Array<{
    ruleType: string
    ruleText: string
    severity: LegalRule['severity']
    requiredDisclaimer?: string
    metadata: Record<string, Json>
  }> = []

  for (const sentence of splitSentences(content).slice(0, 80)) {
    const normalized = sentence.replace(/^[-*]\s*/, '').trim()
    const lower = normalized.toLowerCase()
    if (!/(must|cannot|do not|required|disclaimer|only if|approved by|legal|forbidden)/.test(lower)) {
      continue
    }

    rules.push({
      ruleType: /(disclaimer|legal)/.test(lower) ? 'disclaimer' : 'policy',
      ruleText: normalized.slice(0, 500),
      severity: /(cannot|do not|forbidden|only if)/.test(lower) ? 'block' : 'warn',
      requiredDisclaimer: /disclaimer/i.test(normalized) ? normalized : undefined,
      metadata: { sourceLabel },
    })
  }

  return rules
}

async function saveUrlDerivedBrandContext(
  workspaceId: string,
  brandId: string | undefined,
  url: string,
  brandAnalysis: BrandAnalysis,
  designTokens: ReturnType<typeof extractDesignTokens>,
): Promise<string | undefined> {
  const supabase = createServiceClient()

  const { data: brandRow, error: brandError } = await supabase
    .from('brands')
    .upsert({
      id: brandId,
      workspace_id: workspaceId,
      name: brandAnalysis.name || 'Imported Brand',
      is_default: brandId ? undefined : true,
      website_url: url,
      primary_color: designTokens.colors.primary,
      secondary_color: designTokens.colors.secondary,
      accent_color: designTokens.colors.accent,
      background_color: designTokens.colors.background,
      text_color: designTokens.colors.text,
      font_family: designTokens.typography.fontFamily,
      heading_font: designTokens.typography.fontHeading,
      voice: brandAnalysis.voice.tone,
      tone_keywords: brandAnalysis.voice.personality,
      tagline: brandAnalysis.tagline,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'id',
      ignoreDuplicates: false,
    })
    .select('id')
    .single()

  if (brandError || !brandRow?.id) {
    return brandId
  }

  await supabase
    .from('brand_memory')
    .upsert({
      workspace_id: workspaceId,
      brand_id: brandRow.id,
      colors: [
        { value: designTokens.colors.primary, role: 'primary', format: 'hex', confidence: 0.85, source: 'brain_sync' },
        { value: designTokens.colors.secondary, role: 'secondary', format: 'hex', confidence: 0.8, source: 'brain_sync' },
        { value: designTokens.colors.accent, role: 'accent', format: 'hex', confidence: 0.8, source: 'brain_sync' },
        { value: designTokens.colors.background, role: 'background', format: 'hex', confidence: 0.75, source: 'brain_sync' },
        { value: designTokens.colors.text, role: 'text', format: 'hex', confidence: 0.75, source: 'brain_sync' },
      ],
      fonts: [
        { family: designTokens.typography.fontHeading, role: 'heading', confidence: 0.8, source: 'brain_sync' },
        { family: designTokens.typography.fontFamily, role: 'body', confidence: 0.8, source: 'brain_sync' },
      ],
      spacing: {
        base: designTokens.spacing.scale[0] ?? 8,
        scale: designTokens.spacing.scale,
        source: 'brain_sync',
      },
      tone: {
        tone: brandAnalysis.voice.tone,
        personality: brandAnalysis.voice.personality,
      },
      key_messages: brandAnalysis.valuePropositions ?? [],
      logo_urls: brandAnalysis.logoUrl ? [brandAnalysis.logoUrl] : [],
      sources: [
        {
          type: 'brain_sync',
          url,
          date: new Date().toISOString(),
          confidence: 0.85,
        },
      ],
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'brand_id,workspace_id',
      ignoreDuplicates: false,
    })

  return brandRow.id as string
}

async function syncUrlLikeSource(source: BrainSource): Promise<{
  facts: Array<{
    factKey: string
    statement: string
    category: string
    claimable: boolean
    metadata: Record<string, Json>
  }>
  rules: Array<{
    ruleType: string
    ruleText: string
    severity: LegalRule['severity']
    requiredDisclaimer?: string
    metadata: Record<string, Json>
  }>
  summary: Record<string, Json>
  brandId?: string
}> {
  const rawUrl = String(source.config.url ?? source.externalId ?? '')
  const url = normalizeUrl(rawUrl)
  if (!isValidUrl(url)) {
    throw new Error(`Invalid source URL for ${source.displayName}`)
  }

  const fetched = await smartFetch(url)
  if (fetched.error) {
    throw new Error(fetched.error)
  }

  const parsed = parseHtml(fetched.html, fetched.url)
  const designTokens = extractDesignTokens(fetched.html)
  const brandAnalysis = await analyzeBrand(parsed, designTokens, fetched.url)
  const claims = await extractClaims(parsed)

  const brandId = await saveUrlDerivedBrandContext(
    source.workspaceId,
    source.brandId,
    fetched.url,
    brandAnalysis,
    designTokens,
  )

  const brandContext = brandAnalysisToBrandContext(brandAnalysis, designTokens)
  const facts = [
    ...extractFactCandidatesFromText(parsed.textContent, source.displayName),
    ...extractFactCandidatesFromText(
      [
        brandAnalysis.tagline,
        ...(brandAnalysis.valuePropositions ?? []),
      ].filter(Boolean).join('. '),
      source.displayName,
    ),
  ].slice(0, 120)

  const rules = extractLegalRulesFromText(parsed.textContent, source.displayName)

  for (const claim of claims.slice(0, 40)) {
    facts.push({
      factKey: slugifyFactKey(claim.text.slice(0, 60)),
      statement: claim.text.slice(0, 500),
      category: claim.category || 'generic',
      claimable: claim.riskScore < 60,
      metadata: {
        sourceLabel: source.displayName,
        fromClaimExtraction: true,
      },
    })
  }

  return {
    facts,
    rules,
    summary: {
      url: fetched.url,
      claimCount: claims.length,
      sectionCount: parsed.sections.length,
      brandContext: toJsonRecord(brandContext),
      designTokens: toJsonRecord(designTokens),
    },
    brandId,
  }
}

function isGitHubPathAllowed(path: string): boolean {
  return (
    GITHUB_ALLOWED_FILES.includes(path) ||
    GITHUB_ALLOWED_PREFIXES.some((prefix) => path === prefix || path.startsWith(prefix))
  )
}

function isAllowedTextFile(path: string): boolean {
  return GITHUB_TEXT_EXTENSIONS.some((ext) => path.toLowerCase().endsWith(ext))
}

function parseGitHubRepo(input: string): { owner: string; repo: string; branch: string } {
  const url = new URL(input)
  const parts = url.pathname.replace(/^\/+/, '').split('/')
  const owner = parts[0] ?? ''
  const repo = parts[1] ?? ''
  const branch = parts[3] ?? 'main'

  if (!owner || !repo) {
    throw new Error('Invalid GitHub repository URL')
  }

  return {
    owner,
    repo: repo.replace(/\.git$/, ''),
    branch,
  }
}

async function syncGitHubSource(source: BrainSource): Promise<{
  facts: Array<{
    factKey: string
    statement: string
    category: string
    claimable: boolean
    metadata: Record<string, Json>
  }>
  rules: Array<{
    ruleType: string
    ruleText: string
    severity: LegalRule['severity']
    requiredDisclaimer?: string
    metadata: Record<string, Json>
  }>
  summary: Record<string, Json>
}> {
  const repoUrl = String(source.config.repoUrl ?? source.externalId ?? '')
  const { owner, repo, branch } = parseGitHubRepo(repoUrl)
  const headers = process.env.GITHUB_TOKEN
    ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
    : undefined

  const treeResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`, {
    headers,
    cache: 'no-store',
  })

  if (!treeResponse.ok) {
    throw new Error(`GitHub tree fetch failed (${treeResponse.status})`)
  }

  const treeJson = (await treeResponse.json()) as { tree?: Array<{ path?: string; type?: string }> }
  const candidatePaths = (treeJson.tree ?? [])
    .filter((entry) => entry.type === 'blob' && typeof entry.path === 'string')
    .map((entry) => entry.path as string)
    .filter((path) => isGitHubPathAllowed(path) && isAllowedTextFile(path))
    .sort()
    .slice(0, 40)

  const fileBodies = await Promise.all(
    candidatePaths.map(async (path) => {
      const rawResponse = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`, {
        headers,
        cache: 'no-store',
      })
      if (!rawResponse.ok) {
        return null
      }

      const text = await rawResponse.text()
      return {
        path,
        text: text.slice(0, 12000),
      }
    }),
  )

  const contentByPath = fileBodies.filter((value): value is { path: string; text: string } => value !== null)
  const combined = contentByPath
    .map((file) => `FILE: ${file.path}\n${file.text}`)
    .join('\n\n')

  const facts = contentByPath.flatMap((file) =>
    extractFactCandidatesFromText(file.text, `github:${file.path}`).map((fact) => ({
      ...fact,
      metadata: {
        ...fact.metadata,
        repo: `${owner}/${repo}`,
        path: file.path,
      },
    })),
  ).slice(0, 160)

  const rules = contentByPath.flatMap((file) =>
    extractLegalRulesFromText(file.text, `github:${file.path}`).map((rule) => ({
      ...rule,
      metadata: {
        ...rule.metadata,
        repo: `${owner}/${repo}`,
        path: file.path,
      },
    })),
  ).slice(0, 80)

  return {
    facts,
    rules,
    summary: {
      repo: `${owner}/${repo}`,
      branch,
      indexedPaths: candidatePaths,
      indexedPathCount: candidatePaths.length,
      combinedExcerpt: combined.slice(0, 6000),
    },
  }
}

async function syncTextSource(source: BrainSource): Promise<{
  facts: Array<{
    factKey: string
    statement: string
    category: string
    claimable: boolean
    metadata: Record<string, Json>
  }>
  rules: Array<{
    ruleType: string
    ruleText: string
    severity: LegalRule['severity']
    requiredDisclaimer?: string
    metadata: Record<string, Json>
  }>
  summary: Record<string, Json>
}> {
  const supabase = createServiceClient()
  const documentIds = Array.isArray(source.config.knowledgeItemIds)
    ? source.config.knowledgeItemIds.filter((value): value is string => typeof value === 'string')
    : []
  const inlineContent = typeof source.config.content === 'string' ? source.config.content : ''

  let knowledgeContent = ''
  if (documentIds.length > 0) {
    const { data } = await supabase
      .from('knowledge_items')
      .select('id, title, content')
      .in('id', documentIds)

    knowledgeContent = (data ?? [])
      .map((item) => `${item.title ?? 'Untitled'}\n${item.content ?? ''}`)
      .join('\n\n')
  }

  const combined = [inlineContent, knowledgeContent].filter(Boolean).join('\n\n')
  const facts = extractFactCandidatesFromText(combined, source.displayName).slice(0, 120)
  const rules = extractLegalRulesFromText(combined, source.displayName).slice(0, 80)

  return {
    facts,
    rules,
    summary: {
      documentCount: documentIds.length,
      contentLength: combined.length,
    },
  }
}

async function upsertProductFacts(
  workspaceId: string,
  brandId: string | undefined,
  sourceId: string,
  facts: Array<{
    factKey: string
    statement: string
    category: string
    claimable: boolean
    metadata: Record<string, Json>
  }>,
): Promise<ProductFact[]> {
  const supabase = createServiceClient()

  const inserts = facts.map((fact) => ({
    workspace_id: workspaceId,
    brand_id: brandId ?? null,
    fact_key: fact.factKey,
    statement: fact.statement,
    category: fact.category,
    source_id: sourceId,
    confidence: fact.claimable ? 0.78 : 0.62,
    status: 'draft',
    claimable: fact.claimable,
    metadata_json: fact.metadata,
  }))

  if (inserts.length > 0) {
    await supabase.from('product_facts').insert(inserts)
  }

  const { data } = await supabase
    .from('product_facts')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('source_id', sourceId)
    .order('created_at', { ascending: false })

  return (data ?? []).map((row) => rowToProductFact(row as ProductFactRow))
}

async function upsertLegalRules(
  workspaceId: string,
  brandId: string | undefined,
  sourceId: string,
  rules: Array<{
    ruleType: string
    ruleText: string
    severity: LegalRule['severity']
    requiredDisclaimer?: string
    metadata: Record<string, Json>
  }>,
): Promise<LegalRule[]> {
  const supabase = createServiceClient()

  const inserts = rules.map((rule) => ({
    workspace_id: workspaceId,
    brand_id: brandId ?? null,
    rule_type: rule.ruleType,
    rule_text: rule.ruleText,
    severity: rule.severity,
    applies_to_channels: [],
    applies_to_regions: [],
    required_disclaimer: rule.requiredDisclaimer ?? null,
    source_id: sourceId,
    status: 'draft',
    metadata_json: rule.metadata,
  }))

  if (inserts.length > 0) {
    await supabase.from('legal_rules').insert(inserts)
  }

  const { data } = await supabase
    .from('legal_rules')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('source_id', sourceId)
    .order('created_at', { ascending: false })

  return (data ?? []).map((row) => rowToLegalRule(row as LegalRuleRow))
}

async function markFactConflicts(workspaceId: string, brandId?: string): Promise<number> {
  const supabase = createServiceClient()
  let query = supabase
    .from('product_facts')
    .select('id, fact_key, statement')
    .eq('workspace_id', workspaceId)
    .in('status', ['draft', 'active', 'review_required'])

  if (brandId) {
    query = query.eq('brand_id', brandId)
  }

  const { data } = await query
  const rows = (data ?? []) as Array<{ id: string; fact_key: string; statement: string }>
  const grouped = new Map<string, Set<string>>()
  const idsByKey = new Map<string, string[]>()

  for (const row of rows) {
    if (!grouped.has(row.fact_key)) {
      grouped.set(row.fact_key, new Set())
      idsByKey.set(row.fact_key, [])
    }
    grouped.get(row.fact_key)?.add(row.statement.trim().toLowerCase())
    idsByKey.get(row.fact_key)?.push(row.id)
  }

  const conflictedIds = [...grouped.entries()]
    .filter(([, values]) => values.size > 1)
    .flatMap(([key]) => idsByKey.get(key) ?? [])

  if (conflictedIds.length > 0) {
    await supabase
      .from('product_facts')
      .update({ status: 'conflicted', claimable: false })
      .in('id', conflictedIds)
  }

  return conflictedIds.length
}

async function createDraftSnapshot(options: {
  workspaceId: string
  brandId?: string
  sourceIds: string[]
  createdBy?: string
  summary: Record<string, Json>
  priorityRules: Record<string, Json>
}): Promise<BrainSnapshot> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('brain_snapshots')
    .insert({
      workspace_id: options.workspaceId,
      brand_id: options.brandId ?? null,
      status: 'draft',
      source_ids: options.sourceIds,
      summary_json: options.summary,
      priority_rules_json: options.priorityRules,
      created_by: options.createdBy ?? null,
    })
    .select('*')
    .single()

  if (error || !data) {
    throw new Error(`Failed to create brain snapshot: ${error?.message ?? 'Unknown error'}`)
  }

  return rowToBrainSnapshot(data as BrainSnapshotRow)
}

export async function listBrainSources(workspaceId: string): Promise<BrainSource[]> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('brain_sources')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to load brain sources: ${error.message}`)
  }

  return (data ?? []).map((row) => rowToBrainSource(row as BrainSourceRow))
}

export async function createBrainSource(input: {
  workspaceId: string
  brandId?: string
  sourceType: BrainSourceType
  connectionRef?: string
  externalId?: string
  displayName: string
  config?: Record<string, Json>
}): Promise<BrainSource> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('brain_sources')
    .insert({
      workspace_id: input.workspaceId,
      brand_id: input.brandId ?? null,
      source_type: input.sourceType,
      connection_ref: input.connectionRef ?? null,
      external_id: input.externalId ?? null,
      display_name: input.displayName,
      status: 'connected',
      config_json: input.config ?? {},
    })
    .select('*')
    .single()

  if (error || !data) {
    throw new Error(`Failed to create brain source: ${error?.message ?? 'Unknown error'}`)
  }

  return rowToBrainSource(data as BrainSourceRow)
}

export async function getBrainSource(workspaceId: string, sourceId: string): Promise<BrainSource | null> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('brain_sources')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('id', sourceId)
    .single()

  if (error || !data) {
    return null
  }

  return rowToBrainSource(data as BrainSourceRow)
}

export async function syncBrainSource(
  workspaceId: string,
  sourceId: string,
  options?: { createdBy?: string; autoApproveLowRisk?: boolean },
): Promise<BrainSourceSyncResult> {
  const supabase = createServiceClient()
  const source = await getBrainSource(workspaceId, sourceId)
  if (!source) {
    throw new Error('Brain source not found')
  }

  const { data: runRow, error: runError } = await supabase
    .from('brain_sync_runs')
    .insert({
      brain_source_id: source.id,
      workspace_id: workspaceId,
      status: 'running',
      started_at: new Date().toISOString(),
      metrics_json: {},
      changes_json: {},
    })
    .select('id')
    .single()

  if (runError || !runRow?.id) {
    throw new Error(`Failed to create sync run: ${runError?.message ?? 'Unknown error'}`)
  }

  await supabase
    .from('brain_sources')
    .update({ status: 'syncing' })
    .eq('id', source.id)

  try {
    let extracted: Awaited<ReturnType<typeof syncUrlLikeSource>> | Awaited<ReturnType<typeof syncGitHubSource>> | Awaited<ReturnType<typeof syncTextSource>>
    if (source.sourceType === 'url' || source.sourceType === 'webflow' || source.sourceType === 'framer') {
      extracted = await syncUrlLikeSource(source)
    } else if (source.sourceType === 'github') {
      extracted = await syncGitHubSource(source)
    } else {
      extracted = await syncTextSource(source)
    }

    const brandId = 'brandId' in extracted ? extracted.brandId ?? source.brandId : source.brandId
    const facts = await upsertProductFacts(workspaceId, brandId, source.id, extracted.facts)
    const legalRules = await upsertLegalRules(workspaceId, brandId, source.id, extracted.rules)
    const conflictCount = await markFactConflicts(workspaceId, brandId)
    const riskLevel = conflictCount > 0 ? 'review_required' : 'low'

    const snapshot = await createDraftSnapshot({
      workspaceId,
      brandId,
      sourceIds: uniqueStrings([source.id]),
      createdBy: options?.createdBy,
      summary: {
        sourceId: source.id,
        sourceType: source.sourceType,
        displayName: source.displayName,
        extractedSummary: extracted.summary,
        factCount: facts.length,
        legalRuleCount: legalRules.length,
        conflictCount,
      },
      priorityRules: {
        truthPriority: [
          'confirmed_product_facts',
          'active_legal_rules',
          'approved_brain_snapshot',
          'first_party_source_extracts',
          'brand_memory',
          'memory_items',
        ],
        reviewRequired: riskLevel === 'review_required',
      },
    })

    const nextStatus: BrainSource['status'] =
      options?.autoApproveLowRisk && riskLevel === 'low'
        ? 'ready'
        : riskLevel === 'review_required'
          ? 'review_required'
          : 'ready'

    if (options?.autoApproveLowRisk && riskLevel === 'low') {
      await approveBrainSnapshot(workspaceId, snapshot.id)
    }

    await supabase
      .from('brain_sources')
      .update({
        brand_id: brandId ?? null,
        status: nextStatus,
        last_synced_at: new Date().toISOString(),
        last_snapshot_id: snapshot.id,
      })
      .eq('id', source.id)

    await supabase
      .from('brain_sync_runs')
      .update({
        status: riskLevel === 'review_required' ? 'review_required' : 'completed',
        completed_at: new Date().toISOString(),
        changes_json: {
          factCount: facts.length,
          legalRuleCount: legalRules.length,
          conflictCount,
        },
        metrics_json: {
          factCount: facts.length,
          legalRuleCount: legalRules.length,
        },
      })
      .eq('id', runRow.id)

    return {
      summary: {
        factCount: facts.length,
        ruleCount: legalRules.length,
        claimCount: extracted.summary.claimCount as number ?? 0,
        conflictCount,
        riskLevel,
      },
      snapshotId: snapshot.id,
      facts,
      legalRules,
    }
  } catch (error) {
    await supabase
      .from('brain_sources')
      .update({ status: 'error' })
      .eq('id', source.id)

    await supabase
      .from('brain_sync_runs')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_text: error instanceof Error ? error.message : 'Unknown sync error',
      })
      .eq('id', runRow.id)

    throw error
  }
}

export async function listBrainSnapshots(workspaceId: string, brandId?: string): Promise<BrainSnapshot[]> {
  const supabase = createServiceClient()
  let query = supabase
    .from('brain_snapshots')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })

  if (brandId) {
    query = query.eq('brand_id', brandId)
  }

  const { data, error } = await query
  if (error) {
    throw new Error(`Failed to load brain snapshots: ${error.message}`)
  }

  return (data ?? []).map((row) => rowToBrainSnapshot(row as BrainSnapshotRow))
}

export async function approveBrainSnapshot(workspaceId: string, snapshotId: string): Promise<BrainSnapshot> {
  const supabase = createServiceClient()
  const { data: snapshotData, error: snapshotError } = await supabase
    .from('brain_snapshots')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('id', snapshotId)
    .single()

  if (snapshotError || !snapshotData) {
    throw new Error(`Brain snapshot not found: ${snapshotError?.message ?? snapshotId}`)
  }

  const snapshot = rowToBrainSnapshot(snapshotData as BrainSnapshotRow)

  let supersedeQuery = supabase
    .from('brain_snapshots')
    .update({ status: 'superseded' })
    .eq('workspace_id', workspaceId)
    .eq('status', 'approved')

  supersedeQuery = snapshot.brandId
    ? supersedeQuery.eq('brand_id', snapshot.brandId)
    : supersedeQuery.is('brand_id', null)

  await supersedeQuery

  const { data, error } = await supabase
    .from('brain_snapshots')
    .update({ status: 'approved' })
    .eq('id', snapshotId)
    .select('*')
    .single()

  if (error || !data) {
    throw new Error(`Failed to approve brain snapshot: ${error?.message ?? 'Unknown error'}`)
  }

  const approved = rowToBrainSnapshot(data as BrainSnapshotRow)
  await supabase
    .from('product_facts')
    .update({ status: 'active' })
    .eq('workspace_id', workspaceId)
    .in('source_id', approved.sourceIds)
    .neq('status', 'conflicted')

  await supabase
    .from('legal_rules')
    .update({ status: 'active' })
    .eq('workspace_id', workspaceId)
    .in('source_id', approved.sourceIds)
    .neq('status', 'archived')

  await supabase
    .from('brain_sources')
    .update({ last_snapshot_id: approved.id, status: 'ready' })
    .in('id', approved.sourceIds)

  return approved
}

export async function resolveApprovedBrainSnapshot(workspaceId: string, brandId?: string): Promise<BrainSnapshot | null> {
  const supabase = createServiceClient()
  let query = supabase
    .from('brain_snapshots')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(1)

  if (brandId) {
    query = query.eq('brand_id', brandId)
  }

  const { data, error } = await query.maybeSingle()
  if (error || !data) {
    return null
  }

  return rowToBrainSnapshot(data as BrainSnapshotRow)
}

export async function getBrainContext(
  workspaceId: string,
  snapshotId: string,
): Promise<BrainContext | null> {
  const supabase = createServiceClient()
  const { data: snapshotRow, error: snapshotError } = await supabase
    .from('brain_snapshots')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('id', snapshotId)
    .single()

  if (snapshotError || !snapshotRow) {
    return null
  }

  const snapshot = rowToBrainSnapshot(snapshotRow as BrainSnapshotRow)
  const factQuery = supabase
    .from('product_facts')
    .select('*')
    .eq('workspace_id', workspaceId)
    .in('status', ['active', 'draft'])

  const ruleQuery = supabase
    .from('legal_rules')
    .select('*')
    .eq('workspace_id', workspaceId)
    .in('status', ['active', 'draft'])

  const scopedFactQuery = snapshot.brandId ? factQuery.eq('brand_id', snapshot.brandId) : factQuery
  const scopedRuleQuery = snapshot.brandId ? ruleQuery.eq('brand_id', snapshot.brandId) : ruleQuery

  const [{ data: sourceRows }, { data: factRows }, { data: ruleRows }] = await Promise.all([
    supabase.from('brain_sources').select('*').in('id', snapshot.sourceIds),
    scopedFactQuery,
    scopedRuleQuery,
  ])

  return {
    snapshot,
    sources: (sourceRows ?? []).map((row) => rowToBrainSource(row as BrainSourceRow)),
    productFacts: (factRows ?? []).map((row) => rowToProductFact(row as ProductFactRow)),
    legalRules: (ruleRows ?? []).map((row) => rowToLegalRule(row as LegalRuleRow)),
  }
}

export function buildBrainPromptContext(context: BrainContext): string {
  const approvedFacts = context.productFacts
    .filter((fact) => fact.status !== 'conflicted')
    .slice(0, 24)
    .map((fact) => `- [${fact.category}] ${fact.statement}${fact.claimable ? ' (claimable)' : ''}`)
    .join('\n')

  const legalRules = context.legalRules
    .filter((rule) => rule.status !== 'archived')
    .slice(0, 18)
    .map((rule) => `- [${rule.severity}] ${rule.ruleText}${rule.requiredDisclaimer ? ` | Disclaimer: ${rule.requiredDisclaimer}` : ''}`)
    .join('\n')

  return [
    `Brain snapshot: ${context.snapshot.id}`,
    approvedFacts ? `Product facts:\n${approvedFacts}` : '',
    legalRules ? `Legal rules:\n${legalRules}` : '',
  ].filter(Boolean).join('\n\n')
}

export function buildBrainProvenance(context: BrainContext): BrainProvenanceRef[] {
  return context.sources.map((source) => ({
    sourceType: source.sourceType,
    sourceId: source.id,
    snapshotId: context.snapshot.id,
  }))
}

export async function bootstrapBrain(
  workspaceId: string,
  userId: string,
  input: BrainBootstrapInput,
): Promise<{
  sources: BrainSource[]
  snapshots: BrainSnapshot[]
  approvedSnapshot?: BrainSnapshot
}> {
  const supabase = createServiceClient()

  const { data: brandData } = await supabase
    .from('brands')
    .select('id')
    .eq('workspace_id', workspaceId)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const brandId =
    input.brandId ??
    (typeof brandData?.id === 'string' ? brandData.id : undefined)

  await supabase
    .from('workspaces')
    .update({
      settings: {
        industry: input.industry ?? null,
        onboarding_completed: false,
        target_channels: input.targetChannels,
        approval_rules: input.approvalRules ?? {},
        brain_bootstrapped_at: new Date().toISOString(),
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', workspaceId)

  const createdSources: BrainSource[] = []
  const snapshots: BrainSnapshot[] = []

  for (const source of input.sources) {
    const created = await createBrainSource({
      workspaceId,
      brandId,
      sourceType: source.sourceType,
      connectionRef: source.connectionRef,
      externalId: source.externalId,
      displayName: source.displayName,
      config: source.config,
    })
    createdSources.push(created)

    const syncResult = await syncBrainSource(workspaceId, created.id, {
      createdBy: userId,
      autoApproveLowRisk: input.autoApproveLowRisk,
    })

    const { data } = await supabase
      .from('brain_snapshots')
      .select('*')
      .eq('id', syncResult.snapshotId)
      .single()

    if (data) {
      snapshots.push(rowToBrainSnapshot(data as BrainSnapshotRow))
    }
  }

  const approvedSnapshot =
    snapshots.find((snapshot) => snapshot.status === 'approved') ??
    (snapshots.length > 0 ? await approveBrainSnapshot(workspaceId, snapshots[0].id) : undefined)

  await supabase
    .from('workspaces')
    .update({
      settings: {
        industry: input.industry ?? null,
        onboarding_completed: true,
        onboarding_completed_at: new Date().toISOString(),
        target_channels: input.targetChannels,
        approval_rules: input.approvalRules ?? {},
        brain_snapshot_id: approvedSnapshot?.id ?? null,
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', workspaceId)

  return {
    sources: createdSources,
    snapshots,
    approvedSnapshot,
  }
}
