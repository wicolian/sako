/**
 * Manual Brand Creation Wizard
 *
 * Route: /brands/create
 * Detailed form when URL import fails or user prefers manual:
 * - Name, industry, logo upload
 * - Color pickers (primary/secondary/accent)
 * - Font selector
 * - Voice settings (formality slider, banned words, dos/don'ts)
 * - Key messages
 *
 * Writes to same brand_memory contract as URL import.
 */

import { getWorkspaceFromHeaders } from '@/lib/workspace'
import { redirect } from 'next/navigation'
import { BrandWizardClient } from './brand-wizard-client'

export default async function CreateBrandPage() {
  const workspace = await getWorkspaceFromHeaders()

  if (!workspace?.workspaceId) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-2xl mx-auto px-6 py-8">
        <div className="mb-8">
          <a href="/brands" className="text-sm text-muted-foreground hover:text-foreground/90">
            ← Back to Brands
          </a>
          <h1 className="text-2xl font-bold mt-4">Create Brand Manually</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Define your brand identity. This creates the same Brand Memory as URL import.
          </p>
        </div>

        <BrandWizardClient workspaceId={workspace.workspaceId} />
      </div>
    </div>
  )
}
