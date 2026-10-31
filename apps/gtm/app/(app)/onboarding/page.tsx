'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileText,
  FolderGit2,
  Globe,
  ShieldCheck,
  Sparkles,
  Workflow,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'

type UploadedDocument = {
  name: string
  content: string
}

type BrainContextPayload = {
  context: {
    productFacts: Array<{ id: string; statement: string; category: string; claimable: boolean; status: string }>
    legalRules: Array<{ id: string; ruleText: string; severity: string; requiredDisclaimer?: string; status: string }>
    snapshot: { id: string }
  } | null
}

const CHANNEL_OPTIONS = ['landing pages', 'email', 'social', 'decks', 'website']
const STEPS = [
  'Workspace',
  'Brand Source',
  'Import',
  'Brand Facts',
  'Compliance Rules',
  'Review Flow',
  'Ready',
]

export default function OnboardingPage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [workspaceName, setWorkspaceName] = useState('')
  const [industry, setIndustry] = useState('')
  const [targetChannels, setTargetChannels] = useState<string[]>(['landing pages', 'email'])
  const [siteUrl, setSiteUrl] = useState('')
  const [webflowUrl, setWebflowUrl] = useState('')
  const [framerUrl, setFramerUrl] = useState('')
  const [githubRepoUrl, setGithubRepoUrl] = useState('')
  const [docsContent, setDocsContent] = useState('')
  const [legalContent, setLegalContent] = useState('')
  const [notionContent, setNotionContent] = useState('')
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDocument[]>([])
  const [brainContext, setBrainContext] = useState<BrainContextPayload['context']>(null)
  const [approvalRules, setApprovalRules] = useState({
    requireClaimReview: true,
    requirePublishApproval: true,
    autoApproveLowRisk: true,
  })
  const [error, setError] = useState<string | null>(null)

  const progress = useMemo(
    () => Math.round(((currentStep + 1) / STEPS.length) * 100),
    [currentStep],
  )

  const hasAtLeastOneSource = Boolean(
    siteUrl.trim() ||
    webflowUrl.trim() ||
    framerUrl.trim() ||
    githubRepoUrl.trim() ||
    docsContent.trim() ||
    legalContent.trim() ||
    notionContent.trim() ||
    uploadedDocs.length > 0,
  )

  async function handleWorkspaceCreate() {
    if (!workspaceName.trim()) return
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: workspaceName, industry }),
      })
      const payload = (await response.json()) as { workspace?: { id: string }; error?: string }
      if (!response.ok || !payload.workspace?.id) {
        throw new Error(payload.error || 'Failed to create workspace')
      }
      setWorkspaceId(payload.workspace.id)
      setCurrentStep(1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create workspace')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleFileUpload(files: FileList | null) {
    if (!files?.length) return
    const entries = await Promise.all(
      Array.from(files).map(async (file) => ({
        name: file.name,
        content: await file.text(),
      })),
    )
    setUploadedDocs((prev) => [...prev, ...entries])
  }

  async function handleIngest() {
    if (!workspaceId || !hasAtLeastOneSource) return
    setIsLoading(true)
    setError(null)

    try {
      const sources = [
        siteUrl.trim()
          ? {
              sourceType: 'url',
              displayName: 'Primary Website',
              externalId: siteUrl.trim(),
              config: { url: siteUrl.trim() },
            }
          : null,
        webflowUrl.trim()
          ? {
              sourceType: 'webflow',
              displayName: 'Webflow Site',
              externalId: webflowUrl.trim(),
              config: { url: webflowUrl.trim() },
            }
          : null,
        framerUrl.trim()
          ? {
              sourceType: 'framer',
              displayName: 'Framer Site',
              externalId: framerUrl.trim(),
              config: { url: framerUrl.trim() },
            }
          : null,
        githubRepoUrl.trim()
          ? {
              sourceType: 'github',
              displayName: 'GitHub Repository',
              externalId: githubRepoUrl.trim(),
              config: { repoUrl: githubRepoUrl.trim() },
            }
          : null,
        docsContent.trim()
          ? {
              sourceType: 'manual',
              displayName: 'Product Docs',
              config: { content: docsContent.trim() },
            }
          : null,
        notionContent.trim()
          ? {
              sourceType: 'notion',
              displayName: 'Notion Knowledge',
              config: { content: notionContent.trim() },
            }
          : null,
        legalContent.trim()
          ? {
              sourceType: 'file_upload',
              displayName: 'Legal Docs',
              config: { content: legalContent.trim() },
            }
          : null,
        ...uploadedDocs.map((doc) => ({
          sourceType: 'file_upload' as const,
          displayName: doc.name,
          config: { content: doc.content },
        })),
      ].filter(Boolean)

      const response = await fetch('/api/brain/bootstrap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceName,
          industry,
          targetChannels,
          approvalRules,
          autoApproveLowRisk: approvalRules.autoApproveLowRisk,
          sources,
        }),
      })

      const payload = (await response.json()) as {
        approvedSnapshot?: { id: string }
        error?: string
      }
      if (!response.ok || !payload.approvedSnapshot?.id) {
        throw new Error(payload.error || 'Failed to analyze the selected sources')
      }

      const contextResponse = await fetch(`/api/brain/snapshots?snapshotId=${payload.approvedSnapshot.id}`)
      const contextPayload = (await contextResponse.json()) as BrainContextPayload
      if (!contextResponse.ok) {
        throw new Error('Failed to load the approved brand context')
      }

      setBrainContext(contextPayload.context)
      setCurrentStep(3)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to ingest sources')
    } finally {
      setIsLoading(false)
    }
  }

  function next() {
    setCurrentStep((value) => Math.min(value + 1, STEPS.length - 1))
  }

  function back() {
    setCurrentStep((value) => Math.max(value - 1, 0))
  }

  function toggleChannel(channel: string) {
    setTargetChannels((prev) =>
      prev.includes(channel)
        ? prev.filter((item) => item !== channel)
        : [...prev, channel],
    )
  }

  const factRows = brainContext?.productFacts ?? []
  const legalRows = brainContext?.legalRules ?? []

  async function handleCompleteOnboarding() {
    setIsLoading(true)
    setError(null)

    try {
      const connectedProviders = [
        siteUrl.trim() ? 'website' : null,
        webflowUrl.trim() ? 'webflow' : null,
        framerUrl.trim() ? 'framer' : null,
        githubRepoUrl.trim() ? 'github' : null,
      ].filter((provider): provider is string => Boolean(provider))

      const response = await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceName,
          industry,
          primaryGoal: targetChannels.join(', '),
          connectedProviders,
        }),
      })

      const payload = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to complete onboarding')
      }

      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete onboarding')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground px-4 py-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">Composer setup</p>
              <h1 className="text-3xl font-semibold text-foreground">Start with your website</h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                Import your site first. Add docs or legal notes only if the website does not tell the full story.
              </p>
            </div>
            <Badge variant="outline">{STEPS[currentStep]}</Badge>
          </div>
          <Progress value={progress} />
          <div className="flex flex-wrap gap-2">
            {STEPS.map((step, index) => (
              <Badge key={step} variant={index <= currentStep ? 'default' : 'secondary'}>
                {index + 1}. {step}
              </Badge>
            ))}
          </div>
        </div>

        {error ? (
          <Card className="border-destructive/40">
            <CardContent className="pt-6 text-sm text-destructive">{error}</CardContent>
          </Card>
        ) : null}

        <motion.div
          key={currentStep}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          {currentStep === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Workspace and target channels</CardTitle>
                <CardDescription>Name the workspace, then choose which campaign outputs you want Composer to generate first.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="workspace-name">Workspace name</Label>
                    <Input id="workspace-name" value={workspaceName} onChange={(e) => setWorkspaceName(e.target.value)} placeholder="Acme Growth" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="industry">Industry</Label>
                    <Input id="industry" value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="B2B SaaS" />
                  </div>
                </div>
                <div className="space-y-3">
                  <Label>Target channels</Label>
                  <div className="flex flex-wrap gap-2">
                    {CHANNEL_OPTIONS.map((channel) => (
                      <Button
                        key={channel}
                        type="button"
                        variant={targetChannels.includes(channel) ? 'default' : 'outline'}
                        onClick={() => toggleChannel(channel)}
                      >
                        {channel}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button onClick={handleWorkspaceCreate} disabled={isLoading || !workspaceName.trim()}>
                    {isLoading ? 'Creating...' : 'Create workspace'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {currentStep === 1 ? (
            <Card>
              <CardHeader>
                <CardTitle>Choose your brand source</CardTitle>
                <CardDescription>
                  Start with your main website. Everything else is fallback context for gaps, disclaimers, or internal details.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Recommended:</span> paste your primary website and let Composer extract the first usable brand profile.
                  Add docs, repo links, or legal notes only if you need to fill in missing context.
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <SourceField
                    icon={<Globe className="h-4 w-4" />}
                    label="Primary website"
                    placeholder="https://yourcompany.com"
                    value={siteUrl}
                    onChange={setSiteUrl}
                    badge="Recommended"
                    description="Best first input for brand voice, claims, and positioning."
                  />
                  <SourceField
                    icon={<Globe className="h-4 w-4" />}
                    label="Webflow published URL"
                    placeholder="https://acme.webflow.io"
                    value={webflowUrl}
                    onChange={setWebflowUrl}
                    description="Optional. Use if your public site lives in Webflow."
                  />
                  <SourceField
                    icon={<Globe className="h-4 w-4" />}
                    label="Framer published URL"
                    placeholder="https://acme.framer.website"
                    value={framerUrl}
                    onChange={setFramerUrl}
                    description="Optional. Use if your public site lives in Framer."
                  />
                  <SourceField
                    icon={<FolderGit2 className="h-4 w-4" />}
                    label="GitHub repository"
                    placeholder="https://github.com/acme/product"
                    value={githubRepoUrl}
                    onChange={setGithubRepoUrl}
                    description="Optional. Helpful for product docs and structured copy sources."
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="docs">Product docs or release notes</Label>
                    <Textarea id="docs" value={docsContent} onChange={(e) => setDocsContent(e.target.value)} rows={7} placeholder="Paste product docs, messaging notes, positioning, release notes..." />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notion">Notion or internal knowledge</Label>
                    <Textarea id="notion" value={notionContent} onChange={(e) => setNotionContent(e.target.value)} rows={7} placeholder="Paste Notion content or internal GTM notes..." />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="legal">Legal docs and disclaimers</Label>
                  <Textarea id="legal" value={legalContent} onChange={(e) => setLegalContent(e.target.value)} rows={6} placeholder="Paste legal review notes, forbidden claims, required disclaimers, regional constraints..." />
                </div>

                <div className="space-y-3">
                  <Label htmlFor="uploads">Upload text documents</Label>
                  <Input id="uploads" type="file" multiple onChange={(e) => void handleFileUpload(e.target.files)} />
                  {uploadedDocs.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {uploadedDocs.map((doc) => (
                        <Badge key={doc.name} variant="secondary">{doc.name}</Badge>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="flex justify-between">
                  <Button variant="outline" onClick={back}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back
                  </Button>
                  <Button onClick={() => setCurrentStep(2)} disabled={!hasAtLeastOneSource}>
                    Continue <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {currentStep === 2 ? (
            <Card>
              <CardHeader>
                <CardTitle>Build your brand context</CardTitle>
                <CardDescription>Composer will import these sources, extract usable facts, and prepare a claims-aware starting point for campaign generation.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  {[
                    { label: 'Website', value: siteUrl || 'Not provided' },
                    { label: 'Webflow', value: webflowUrl || 'Not provided' },
                    { label: 'Framer', value: framerUrl || 'Not provided' },
                    { label: 'GitHub', value: githubRepoUrl || 'Not provided' },
                  ].map((entry) => (
                    <div key={entry.label} className="rounded-lg border p-3">
                      <p className="text-sm font-medium text-foreground">{entry.label}</p>
                      <p className="text-sm text-muted-foreground">{entry.value}</p>
                    </div>
                  ))}
                </div>
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  Product docs, legal notes, and uploaded files become supporting context. GitHub sync stays scoped to README, docs, content, app, components, lib, and config files.
                </div>
                <div className="flex justify-between">
                  <Button variant="outline" onClick={back}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back
                  </Button>
                  <Button onClick={handleIngest} disabled={isLoading || !workspaceId}>
                    {isLoading ? 'Analyzing sources...' : 'Analyze sources'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {currentStep === 3 ? (
            <Card>
              <CardHeader>
                <CardTitle>Review extracted facts</CardTitle>
                <CardDescription>These are the facts Composer will use to ground campaign copy and claims review.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {factRows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No facts extracted yet.</p>
                ) : (
                  factRows.slice(0, 20).map((fact) => (
                    <div key={fact.id} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-foreground">{fact.statement}</p>
                        <Badge variant={fact.claimable ? 'default' : 'secondary'}>
                          {fact.claimable ? 'Claimable' : fact.status}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">{fact.category}</p>
                    </div>
                  ))
                )}
                <div className="flex justify-between">
                  <Button variant="outline" onClick={back}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back
                  </Button>
                  <Button onClick={next}>
                    Continue <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {currentStep === 4 ? (
            <Card>
              <CardHeader>
                <CardTitle>Review compliance rules</CardTitle>
                <CardDescription>These rules and disclaimers will be checked before export, deploy, or approval.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {legalRows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No legal rules were extracted from the current sources.</p>
                ) : (
                  legalRows.slice(0, 20).map((rule) => (
                    <div key={rule.id} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-foreground">{rule.ruleText}</p>
                        <Badge variant={rule.severity === 'block' ? 'destructive' : 'secondary'}>
                          {rule.severity}
                        </Badge>
                      </div>
                      {rule.requiredDisclaimer ? (
                        <p className="mt-1 text-xs text-muted-foreground">Disclaimer: {rule.requiredDisclaimer}</p>
                      ) : null}
                    </div>
                  ))
                )}
                <div className="flex justify-between">
                  <Button variant="outline" onClick={back}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back
                  </Button>
                  <Button onClick={next}>
                    Continue <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {currentStep === 5 ? (
            <Card>
              <CardHeader>
                <CardTitle>Choose the review flow</CardTitle>
                <CardDescription>Decide when Composer should pause for proof or approval before anything ships.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ApprovalToggle
                  checked={approvalRules.requireClaimReview}
                  label="Require claim review for unresolved proof"
                  onCheckedChange={(checked) => setApprovalRules((prev) => ({ ...prev, requireClaimReview: checked }))}
                />
                <ApprovalToggle
                  checked={approvalRules.requirePublishApproval}
                  label="Require publish approval before final export or deploy"
                  onCheckedChange={(checked) => setApprovalRules((prev) => ({ ...prev, requirePublishApproval: checked }))}
                />
                <ApprovalToggle
                  checked={approvalRules.autoApproveLowRisk}
                  label="Auto-approve low-risk source syncs"
                  onCheckedChange={(checked) => setApprovalRules((prev) => ({ ...prev, autoApproveLowRisk: checked }))}
                />
                <div className="flex justify-between">
                  <Button variant="outline" onClick={back}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back
                  </Button>
                  <Button onClick={next}>
                    Continue <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {currentStep === 6 ? (
            <Card>
              <CardHeader>
                <CardTitle>You're ready to create campaigns</CardTitle>
                <CardDescription>Your first brand context is approved. Next, create a campaign, review claims, and choose how to ship it.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <SummaryCard icon={<Sparkles className="h-4 w-4" />} title="Context snapshot" value={brainContext?.snapshot.id ?? 'Not created'} />
                  <SummaryCard icon={<FileText className="h-4 w-4" />} title="Facts" value={String(factRows.length)} />
                  <SummaryCard icon={<ShieldCheck className="h-4 w-4" />} title="Compliance rules" value={String(legalRows.length)} />
                  <SummaryCard icon={<Workflow className="h-4 w-4" />} title="Channels" value={targetChannels.join(', ')} />
                </div>
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  Composer will use this approved context for campaign generation, claims review, and shipping decisions.
                </div>
                <div className="flex justify-between">
                  <Button variant="outline" onClick={back}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back
                  </Button>
                  <Button onClick={() => void handleCompleteOnboarding()} disabled={isLoading}>
                    {isLoading ? 'Finishing setup...' : 'Open dashboard'}
                    <CheckCircle2 className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </motion.div>
      </div>
    </div>
  )
}

function SourceField(props: {
  icon: ReactNode
  label: string
  placeholder: string
  value: string
  onChange: (value: string) => void
  description?: string
  badge?: string
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label>{props.label}</Label>
        {props.badge ? <Badge variant="secondary">{props.badge}</Badge> : null}
      </div>
      <div className="relative">
        <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          {props.icon}
        </div>
        <Input className="pl-10" placeholder={props.placeholder} value={props.value} onChange={(e) => props.onChange(e.target.value)} />
      </div>
      {props.description ? <p className="text-xs text-muted-foreground">{props.description}</p> : null}
    </div>
  )
}

function ApprovalToggle(props: {
  checked: boolean
  label: string
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <label className="flex items-center justify-between rounded-lg border p-4">
      <span className="text-sm font-medium text-foreground">{props.label}</span>
      <Checkbox checked={props.checked} onCheckedChange={(checked) => props.onCheckedChange(Boolean(checked))} />
    </label>
  )
}

function SummaryCard(props: {
  icon: ReactNode
  title: string
  value: string
}) {
  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        {props.icon}
        <span className="text-sm">{props.title}</span>
      </div>
      <p className="mt-2 text-sm font-medium text-foreground">{props.value}</p>
    </div>
  )
}
