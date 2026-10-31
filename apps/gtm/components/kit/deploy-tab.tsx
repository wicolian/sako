'use client'

/**
 * Deploy Tab - Deploy kit to connected providers
 * 
 * Shows connected providers and allows one-click deployment.
 */

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Loader2, 
  CheckCircle, 
  XCircle, 
  ExternalLink,
  Globe,
  Link as LinkIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { ProviderCard, type ProviderStatus } from './provider-card'

interface DeployTabProps {
  kitId: string
  onDeploy?: (provider: string, url: string) => void
}

interface Deployment {
  id: string
  provider: string
  url: string
  createdAt: string
}

export function DeployTab({ kitId, onDeploy }: DeployTabProps) {
  const [providers, setProviders] = useState<ProviderStatus[]>([])
  const [deployments, setDeployments] = useState<Deployment[]>([])
  const [loading, setLoading] = useState(true)
  const [deploying, setDeploying] = useState<string | null>(null)
  
  // Fetch provider connections
  useEffect(() => {
    Promise.all([
      fetch('/api/providers/connected').then(res => res.json()),
      fetch(`/api/kit/${kitId}/deployments`).then(res => res.json()).catch(() => ({ deployments: [] })),
    ])
      .then(([providersData, deploymentsData]) => {
        // Map connected providers
        const providerList: ProviderStatus[] = [
          {
            id: 'subdomain',
            name: 'Sako Hosting Beta',
            description: 'Upload a hosted artifact for sako.pub domains with DNS configured',
            icon: '🌐',
            connected: true, // Always available
            connectUrl: null,
          },
          {
            id: 'webflow',
            name: 'Webflow',
            description: 'Deploy to your Webflow site',
            icon: '⚡',
            connected: providersData.providers?.includes('webflow'),
            connectUrl: '/api/webflow/oauth/start',
          },
          {
            id: 'hubspot',
            name: 'HubSpot',
            description: 'Push to HubSpot CMS',
            icon: '🧡',
            connected: providersData.providers?.includes('hubspot'),
            connectUrl: '/api/hubspot/oauth/start',
          },
          {
            id: 'framer',
            name: 'Framer',
            description: 'Export or beta deploy to Framer',
            icon: '🎨',
            connected: providersData.providers?.includes('framer'),
            connectUrl: '/api/framer/oauth/start',
          },
          {
            id: 'figma',
            name: 'Figma',
            description: 'Clipboard export for design handoff',
            icon: '🎭',
            connected: true,
            connectUrl: null,
          },
        ]
        
        setProviders(providerList)
        setDeployments(deploymentsData.deployments || [])
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [kitId])
  
  const handleDeploy = async (provider: string) => {
    setDeploying(provider)
    
    try {
      const response = await fetch(`/api/kit/${kitId}/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      })
      
      const data = await response.json()
      
      if (data.success) {
        toast.success(`Deployed to ${provider}!`)
        setDeployments(prev => [{
          id: data.deploymentId,
          provider,
          url: data.url,
          createdAt: new Date().toISOString(),
        }, ...prev])
        onDeploy?.(provider, data.url)
      } else {
        if (data.connectUrl) {
          toast.error(`Please connect ${provider} first`)
          window.location.href = data.connectUrl
        } else {
          toast.error(data.error || 'Deployment failed')
        }
      }
    } catch (error) {
      toast.error('Deployment failed')
    } finally {
      setDeploying(null)
    }
  }
  
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }
  
  return (
    <div className="space-y-6">
      {/* Quick Deploy */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quick Deploy</CardTitle>
          <CardDescription>
            Deploy your landing page with one click
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            {providers.map((provider) => (
              <ProviderCard
                key={provider.id}
                provider={provider}
                onDeploy={() => handleDeploy(provider.id)}
                isDeploying={deploying === provider.id}
              />
            ))}
          </div>
        </CardContent>
      </Card>
      
      {/* Deployment History */}
      {deployments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Deployment History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {deployments.map((deployment) => (
                <div
                  key={deployment.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <div>
                      <p className="text-sm font-medium capitalize">{deployment.provider}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(deployment.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" asChild>
                    <a href={deployment.url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-4 h-4 mr-1" />
                      View
                    </a>
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
