/**
 * Unified Asset Editor Page
 *
 * Route: /assets/[type]/[id]
 * Loads AssetDocument + brand context → renders correct editor.
 *
 * Type routing:
 * - landing → redirect to existing editor-shell
 * - social → SocialEditor (canvas)
 * - deck → SlideEditor (canvas)
 * - email → EmailEditor (canvas)
 * - ad → AdEditor (canvas)
 */

import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceFromHeaders } from '@/lib/workspace'
import { rowToAssetDocument, type AssetDocumentRow } from '@/lib/assets/asset-document'
import { AssetEditorClient } from './asset-editor-client'

interface PageProps {
  params: Promise<{ type: string; id: string }>
}

export default async function AssetEditorPage({ params }: PageProps) {
  const { type, id } = await params

  // Landing pages use the existing editor-shell
  if (type === 'landing') {
    redirect(`/editor/${id}`)
  }

  const supabase = await createClient()
  const workspace = await getWorkspaceFromHeaders()

  if (!workspace?.workspaceId) {
    redirect('/login')
  }

  // Fetch asset document
  const { data: assetRow, error } = await supabase
    .from('asset_documents')
    .select('*')
    .eq('id', id)
    .eq('workspace_id', workspace.workspaceId)
    .single()

  if (error || !assetRow) {
    notFound()
  }

  const assetDocument = rowToAssetDocument(assetRow as unknown as AssetDocumentRow)

  // Fetch brand memory if brand exists
  let brandMemory = null
  if (assetDocument.brandId) {
    const { data: memory } = await supabase
      .from('brand_memory')
      .select('*')
      .eq('brand_id', assetDocument.brandId)
      .eq('workspace_id', workspace.workspaceId)
      .single()

    if (memory) {
      brandMemory = {
        colors: (memory.colors as Array<{ value: string; role: string }>) ?? [],
        fonts: (memory.fonts as Array<{ family: string; role: string }>) ?? [],
        spacing: memory.spacing as { base: number; scale: number[] } | undefined,
        logoUrl: (memory.logo_urls as string[])?.[0],
      }
    }
  }

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 bg-card/40 backdrop-blur-sm border-b border-border/50">
        <div className="flex items-center gap-3">
          <a href="/campaigns" className="text-muted-foreground hover:text-foreground/90 text-sm">
            ← Back
          </a>
          <span className="text-zinc-700">|</span>
          <span className="text-sm text-foreground/90 font-medium">
            {assetDocument.title ?? `${type} asset`}
          </span>
          <span className="text-xs text-muted-foreground/80 uppercase bg-muted/50 px-2 py-0.5 rounded">
            {type}
          </span>
        </div>
      </header>

      {/* Editor */}
      <div className="flex-1 overflow-hidden">
        <AssetEditorClient
          assetDocument={assetDocument}
          brandMemory={brandMemory}
          assetType={type}
        />
      </div>
    </div>
  )
}
