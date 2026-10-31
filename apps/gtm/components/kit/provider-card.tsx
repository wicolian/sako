'use client'

/**
 * Provider Card - Individual provider deploy card
 * 
 * Shows provider status and deploy button
 */

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, CheckCircle, Link as LinkIcon } from 'lucide-react'

export interface ProviderStatus {
  id: string
  name: string
  description: string
  icon: string
  connected: boolean
  connectUrl: string | null
}

interface ProviderCardProps {
  provider: ProviderStatus
  onDeploy: () => void
  isDeploying: boolean
}

export function ProviderCard({ provider, onDeploy, isDeploying }: ProviderCardProps) {
  return (
    <div className="flex items-start gap-4 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
      <span className="text-2xl">{provider.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h4 className="font-medium">{provider.name}</h4>
          {provider.connected ? (
            <Badge variant="outline" className="bg-green-500/10 text-emerald-500 border-green-500/20 text-xs">
              <CheckCircle className="w-3 h-3 mr-1" />
              Connected
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs">Not connected</Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground mb-3">
          {provider.description}
        </p>
        {provider.connected ? (
          <Button 
            size="sm" 
            onClick={onDeploy}
            disabled={isDeploying}
          >
            {isDeploying ? (
              <>
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                Deploying...
              </>
            ) : (
              'Deploy'
            )}
          </Button>
        ) : (
          <Button 
            size="sm" 
            variant="outline"
            asChild
          >
            <a href={provider.connectUrl || '#'}>
              <LinkIcon className="w-3 h-3 mr-1" />
              Connect
            </a>
          </Button>
        )}
      </div>
    </div>
  )
}
