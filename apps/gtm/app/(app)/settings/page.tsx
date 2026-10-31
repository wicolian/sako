'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Check, ExternalLink, Loader2, Plus, X, CheckCircle2, Key, Shield, AlertCircle, Sparkles, Link2 } from 'lucide-react'
import { BrandManager } from '@/components/settings/brand-manager'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/use-toast'
import { ApiKeysTable, type ApiKey } from '@/components/settings/api-keys-table'
import { CreateKeyDialog } from '@/components/settings/create-key-dialog'
import { PolicyTemplateSelector } from '@/components/settings/policy-template-selector'
import { BillingSection } from '@/components/settings/billing-section'
import { ModelPickerSettings } from '@/components/settings/model-picker'
import type { ModelPreferences } from '@/lib/ai/openrouter'
import type { PlanId } from '@/lib/billing/plans'

interface WorkspaceSettings {
  forbidden_phrases: string[]
}

interface HubSpotConnection {
  portal_id: string
  expires_at: string
}

interface ProviderConnection {
  connected: boolean
  user_email?: string
  user_name?: string
  user_handle?: string
  connected_at?: string
}

interface BillingSubscription {
  plan_id: PlanId
  status: string
}


// Wrap the main content in a Suspense boundary for useSearchParams
export default function SettingsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    }>
      <SettingsContent />
    </Suspense>
  )
}

function SettingsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [forbiddenPhrases, setForbiddenPhrases] = useState<string[]>([])
  const [hubspotConnection, setHubspotConnection] = useState<HubSpotConnection | null>(null)
  const [webflowConnection, setWebflowConnection] = useState<ProviderConnection>({ connected: false })
  const [figmaConnection, setFigmaConnection] = useState<ProviderConnection>({ connected: false })
  const [newPhrase, setNewPhrase] = useState('')
  const [saving, setSaving] = useState(false)
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [showCreateKeyDialog, setShowCreateKeyDialog] = useState(false)
  const [currentPolicyTemplate, setCurrentPolicyTemplate] = useState<string | null>(null)
  const [modelPreferences, setModelPreferences] = useState<ModelPreferences>({})
  const [subscription, setSubscription] = useState<BillingSubscription | null>(null)

  useEffect(() => {
    loadSettings()
    
    // Handle OAuth callbacks
    const success = searchParams.get('success')
    const error = searchParams.get('error')
    
    if (success) {
      toast({ title: 'Connected!', description: `${success.replace('_connected', '')} has been connected.` })
      router.replace('/settings')
    }
    if (error) {
      toast({ title: 'Connection failed', description: error.replace(/_/g, ' '), variant: 'destructive' })
      router.replace('/settings')
    }
  }, [searchParams, router, toast])

  const loadSettings = async () => {
    try {
      const [settingsRes, hubspotRes, webflowRes, figmaRes, keysRes, policyRes, modelsRes, subscriptionRes] = await Promise.all([
        fetch('/api/settings'),
        fetch('/api/hubspot/status'),
        fetch('/api/webflow/status'),
        fetch('/api/figma/status'),
        fetch('/api/api-keys'),
        fetch('/api/policies'),
        fetch('/api/settings/models'),
        fetch('/api/billing/subscription'),
      ])
      
      if (settingsRes.ok) {
        const settings: WorkspaceSettings = await settingsRes.json()
        setForbiddenPhrases(settings.forbidden_phrases || [])
      }
      
      if (hubspotRes.ok) {
        const hubspot = await hubspotRes.json()
        if (hubspot.connected) {
          setHubspotConnection(hubspot)
        }
      }

      if (webflowRes.ok) {
        const webflow = await webflowRes.json()
        setWebflowConnection(webflow)
      }

      if (figmaRes.ok) {
        const figma = await figmaRes.json()
        setFigmaConnection(figma)
      }

      if (keysRes.ok) {
        const keys = await keysRes.json()
        setApiKeys(keys)
      }

      if (policyRes.ok) {
        const policy = await policyRes.json()
        setCurrentPolicyTemplate(policy?.applied_template_id || null)
      }

      if (modelsRes.ok) {
        const modelsData = await modelsRes.json() as { preferences?: ModelPreferences }
        setModelPreferences(modelsData.preferences ?? {})
      }

      if (subscriptionRes.ok) {
        const subscriptionData = await subscriptionRes.json() as { subscription?: BillingSubscription | null }
        setSubscription(subscriptionData.subscription ?? null)
      }
    } catch (error) {
      console.error('Failed to load settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const addPhrase = () => {
    if (newPhrase && !forbiddenPhrases.includes(newPhrase)) {
      setForbiddenPhrases([...forbiddenPhrases, newPhrase])
      setNewPhrase('')
    }
  }

  const removePhrase = (phrase: string) => {
    setForbiddenPhrases(forbiddenPhrases.filter((p) => p !== phrase))
  }

  const saveSettings = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          forbidden_phrases: forbiddenPhrases,
        }),
      })
      if (res.ok) {
        toast({ title: 'Settings saved', description: 'Your changes have been saved.' })
      }
      router.refresh()
    } catch (error) {
      console.error('Failed to save settings:', error)
      toast({ title: 'Error', description: 'Failed to save settings.', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const connectHubSpot = () => {
    window.location.href = '/api/hubspot/oauth/start'
  }

  const disconnectHubSpot = async () => {
    try {
      await fetch('/api/hubspot/disconnect', { method: 'POST' })
      setHubspotConnection(null)
      toast({ title: 'Disconnected', description: 'HubSpot has been disconnected.' })
    } catch (error) {
      console.error('Failed to disconnect:', error)
    }
  }

  const disconnectWebflow = async () => {
    try {
      await fetch('/api/webflow/disconnect', { method: 'POST' })
      setWebflowConnection({ connected: false })
      toast({ title: 'Disconnected', description: 'Webflow has been disconnected.' })
    } catch (error) {
      console.error('Failed to disconnect:', error)
    }
  }

  const disconnectFigma = async () => {
    try {
      await fetch('/api/figma/disconnect', { method: 'POST' })
      setFigmaConnection({ connected: false })
      toast({ title: 'Disconnected', description: 'Figma has been disconnected.' })
    } catch (error) {
      console.error('Failed to disconnect:', error)
    }
  }

  const handleRevokeKey = async (keyId: string) => {
    await fetch(`/api/api-keys?id=${keyId}`, { method: 'DELETE' })
    setApiKeys(prev => prev.map(k => k.id === keyId ? { ...k, is_active: false } : k))
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-6 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
            <p className="text-muted-foreground mt-1">
              Plan, connections, compliance rules, and API access for the launch path.
            </p>
          </div>
        </div>

        <Tabs defaultValue="connections" className="space-y-8">
          <TabsList className="bg-muted/50 border border-border/50 p-1 w-full justify-start overflow-x-auto">
            <TabsTrigger value="connections" className="data-[state=active]:bg-card/40 data-[state=active]:shadow-sm">Connections</TabsTrigger>
            <TabsTrigger value="brand" className="data-[state=active]:bg-card/40 data-[state=active]:shadow-sm">Brand</TabsTrigger>
            <TabsTrigger value="compliance" className="data-[state=active]:bg-card/40 data-[state=active]:shadow-sm">Compliance</TabsTrigger>
            <TabsTrigger value="api" className="data-[state=active]:bg-card/40 data-[state=active]:shadow-sm">API Keys</TabsTrigger>
            <TabsTrigger value="billing" className="data-[state=active]:bg-card/40 data-[state=active]:shadow-sm">Billing</TabsTrigger>
            <TabsTrigger value="ai-models" className="data-[state=active]:bg-card/40 data-[state=active]:shadow-sm">Models</TabsTrigger>
          </TabsList>

          {/* Connections Tab */}
          <TabsContent value="connections" className="space-y-6">
            <Card className="bg-card/40 border-border/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle>Shipping connections</CardTitle>
                <CardDescription>
                  Only the launch-facing destinations live here: direct deploys and design handoff.
                </CardDescription>
              </CardHeader>
            </Card>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {/* HubSpot */}
              <Card className="bg-card/40 border-border/50 backdrop-blur-sm transition-all hover:border-primary/30">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#ff7a59] rounded-xl flex items-center justify-center text-white font-bold shadow-sm">
                      HS
                    </div>
                    HubSpot
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="mb-4">
                    <Badge variant="secondary">Direct deploy</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-6">Connect HubSpot to push approved campaign assets directly from Composer.</p>
                  {hubspotConnection ? (
                    <div className="flex items-center justify-between p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        <div>
                          <p className="text-sm font-semibold text-emerald-500">Connected</p>
                          <p className="text-[10px] text-emerald-600/80 uppercase font-mono">ID: {hubspotConnection.portal_id}</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={disconnectHubSpot} className="h-8 text-xs hover:bg-destructive/10 hover:text-destructive">Disconnect</Button>
                    </div>
                  ) : (
                    <Button onClick={connectHubSpot} className="w-full bg-muted/50 hover:bg-primary hover:text-primary-foreground text-foreground border border-border/50 transition-colors">
                      <Link2 className="w-4 h-4 mr-2" /> Connect
                    </Button>
                  )}
                </CardContent>
              </Card>

              {/* Webflow */}
              <Card className="bg-card/40 border-border/50 backdrop-blur-sm transition-all hover:border-primary/30">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#4353FF] rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-sm">
                      WF
                    </div>
                    Webflow
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="mb-4">
                    <Badge variant="secondary">Beta deploy</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-6">Connect Webflow for beta landing page deploys. This is not positioned as broad site sync.</p>
                  {webflowConnection.connected ? (
                    <div className="flex items-center justify-between p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        <div className="overflow-hidden max-w-[120px]">
                          <p className="text-sm font-semibold text-emerald-500">Connected</p>
                          <p className="text-[10px] text-emerald-600/80 truncate">{webflowConnection.user_email || webflowConnection.user_name}</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={disconnectWebflow} className="h-8 text-xs hover:bg-destructive/10 hover:text-destructive">Disconnect</Button>
                    </div>
                  ) : (
                    <Button onClick={() => window.location.href = '/api/webflow/oauth/start'} className="w-full bg-muted/50 hover:bg-primary hover:text-primary-foreground text-foreground border border-border/50 transition-colors">
                      <Link2 className="w-4 h-4 mr-2" /> Connect
                    </Button>
                  )}
                </CardContent>
              </Card>

              {/* Figma */}
              <Card className="bg-card/40 border-border/50 backdrop-blur-sm transition-all hover:border-primary/30">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-black border border-white/10 rounded-xl flex items-center justify-center shadow-sm">
                      <svg className="w-5 h-5 text-white" viewBox="0 0 38 57" fill="currentColor">
                        <path d="M19 28.5a9.5 9.5 0 1 1 19 0 9.5 9.5 0 0 1-19 0z"/>
                        <path d="M0 47.5A9.5 9.5 0 0 1 9.5 38H19v9.5a9.5 9.5 0 1 1-19 0z"/>
                        <path d="M19 0v19h9.5a9.5 9.5 0 1 0 0-19H19z"/>
                        <path d="M0 9.5A9.5 9.5 0 0 0 9.5 19H19V0H9.5A9.5 9.5 0 0 0 0 9.5z"/>
                        <path d="M0 28.5A9.5 9.5 0 0 0 9.5 38H19V19H9.5A9.5 9.5 0 0 0 0 28.5z"/>
                      </svg>
                    </div>
                    Figma
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="mb-4">
                    <Badge variant="secondary">Export-only</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-6">Connect Figma for design handoff. Composer exports content into design workflows; it is not a live deploy target.</p>
                  {figmaConnection.connected ? (
                    <div className="flex items-center justify-between p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        <div className="overflow-hidden max-w-[120px]">
                          <p className="text-sm font-semibold text-emerald-500">Connected</p>
                          <p className="text-[10px] text-emerald-600/80 truncate">@{figmaConnection.user_handle || figmaConnection.user_email}</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={disconnectFigma} className="h-8 text-xs hover:bg-destructive/10 hover:text-destructive">Disconnect</Button>
                    </div>
                  ) : (
                    <Button onClick={() => window.location.href = '/api/figma/oauth/start'} className="w-full bg-muted/50 hover:bg-primary hover:text-primary-foreground text-foreground border border-border/50 transition-colors">
                      <Link2 className="w-4 h-4 mr-2" /> Connect
                    </Button>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Brand Kit Tab */}
          <TabsContent value="brand">
            <BrandManager />
          </TabsContent>

          {/* Compliance Tab */}
          <TabsContent value="compliance" className="space-y-6">
            <Card className="bg-card/40 border-border/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-emerald-500" />
                  Compliance Policy
                </CardTitle>
                <CardDescription>
                  Select an industry template to automatically apply regulatory constraints to generation.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PolicyTemplateSelector
                  currentTemplateId={currentPolicyTemplate}
                  onTemplateApplied={() => loadSettings()}
                />
              </CardContent>
            </Card>

            <Card className="bg-card/40 border-border/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-destructive" />
                  Forbidden Phrases
                </CardTitle>
                <CardDescription>
                  Any generated asset containing these exact phrases will be blocked instantly.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-3">
                  <Input 
                    placeholder="Add a phrase (e.g., 'guaranteed results')" 
                    value={newPhrase} 
                    onChange={(e) => setNewPhrase(e.target.value)} 
                    onKeyDown={(e) => e.key === 'Enter' && addPhrase()} 
                    className="bg-muted/50 border-border/50 focus-visible:ring-primary/50"
                  />
                  <Button onClick={addPhrase} variant="secondary">
                    <Plus className="w-4 h-4 mr-2" /> Add
                  </Button>
                </div>
                {forbiddenPhrases.length > 0 && (
                  <div className="flex flex-wrap gap-2 p-4 bg-muted/20 rounded-xl border border-border/50">
                    {forbiddenPhrases.map((phrase) => (
                      <Badge key={phrase} variant="outline" className="flex items-center gap-1.5 py-1.5 pl-3 pr-2 bg-background border-border/50 hover:border-destructive/50 transition-colors">
                        {phrase}
                        <button onClick={() => removePhrase(phrase)} className="text-muted-foreground hover:text-destructive transition-colors">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="flex justify-end pt-4 border-t border-border/50">
                  <Button onClick={saveSettings} disabled={saving} className="shadow-lg shadow-primary/20 bg-primary text-primary-foreground hover:bg-primary/90">
                    {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
                    Save Rules
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* API Keys Tab */}
          <TabsContent value="api" className="space-y-6">
            <Card className="bg-card/40 border-border/50 backdrop-blur-sm">
              <CardHeader className="flex flex-row items-start justify-between pb-6">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2">
                    <Key className="w-5 h-5 text-primary" /> API Keys
                  </CardTitle>
                  <CardDescription>Create and revoke keys for the public validation API.</CardDescription>
                </div>
                <Button onClick={() => setShowCreateKeyDialog(true)} size="sm" className="shadow-lg shadow-primary/20">
                  <Plus className="w-4 h-4 mr-2" /> Generate Key
                </Button>
              </CardHeader>
              <CardContent>
                <div className="rounded-xl overflow-hidden border border-border/50">
                  <ApiKeysTable keys={apiKeys} onRevoke={handleRevokeKey} />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/40 border-border/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-base font-semibold">API Quick Start</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Create a workspace key here, then send it to the public validation endpoint with `x-api-key` or `Authorization: Bearer`.
                </p>
                <div className="relative group">
                  <pre className="bg-muted/50 p-5 rounded-xl border border-border/50 text-[13px] font-mono overflow-x-auto text-muted-foreground group-hover:text-foreground transition-colors">
{`curl -X POST https://your-app.example.com/api/v1/validate \\
  -H "x-api-key: sk_live_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{"claims": [{"id": "1", "text": "Best product ever"}]}'`}
                  </pre>
                </div>
              </CardContent>
            </Card>

            <CreateKeyDialog
              open={showCreateKeyDialog}
              onOpenChange={setShowCreateKeyDialog}
              onKeyCreated={() => {
                fetch('/api/api-keys').then(res => res.json()).then(setApiKeys)
              }}
            />
          </TabsContent>

          {/* Billing Tab */}
          <TabsContent value="billing" className="space-y-6">
            <BillingSection />
          </TabsContent>

          {/* AI Models Tab */}
          <TabsContent value="ai-models" className="space-y-6">
            <Card className="bg-card/40 border-border/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  Model access
                </CardTitle>
                <CardDescription>
                  Choose which approved models your workspace can use for generation.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ModelPickerSettings
                  initialPreferences={modelPreferences}
                  planId={subscription?.plan_id}
                  subscriptionStatus={subscription?.status}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
