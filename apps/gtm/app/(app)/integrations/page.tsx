'use client'

/**
 * Integrations Hub Page
 * 
 * Central management for all platform integrations.
 */

import { useState, useMemo, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Search,
  Plug,
  Check,
  Clock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  getProviderCatalog,
  PROVIDER_CATEGORIES,
  type ProviderCatalogItem,
  type ProviderCategory,
} from '@/lib/providers/catalog'
import { cn } from '@/lib/utils'

export default function IntegrationsPage() {
  const integrations = useMemo(() => getProviderCatalog(), [])
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<ProviderCategory | 'all'>('all')
  const [selectedIntegration, setSelectedIntegration] = useState<ProviderCatalogItem | null>(null)
  const [connectedIds, setConnectedIds] = useState<string[]>([])
  const [connectionsLoading, setConnectionsLoading] = useState(true)
  const [actionPending, setActionPending] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function fetchConnections(): Promise<void> {
      try {
        const response = await fetch('/api/providers/connected')
        if (!response.ok) return
        const data: unknown = await response.json()
        if (
          cancelled ||
          typeof data !== 'object' ||
          data === null ||
          !('providers' in data) ||
          !Array.isArray((data as Record<string, unknown>).providers)
        ) {
          return
        }
        const ids = (data as { providers: unknown[] }).providers.filter(
          (id): id is string => typeof id === 'string'
        )
        setConnectedIds(ids)
      } catch {
        // Leave connectedIds as empty array on network error
      } finally {
        if (!cancelled) {
          setConnectionsLoading(false)
        }
      }
    }

    void fetchConnections()

    return () => {
      cancelled = true
    }
  }, [])

  const refreshConnections = async () => {
    setConnectionsLoading(true)
    try {
      const response = await fetch('/api/providers/connected')
      if (!response.ok) return
      const data = await response.json() as { providers?: string[] }
      setConnectedIds(data.providers || [])
    } finally {
      setConnectionsLoading(false)
    }
  }

  const handleConnect = () => {
    if (!selectedIntegration) return

    const connectUrl =
      selectedIntegration.id === 'twitter'
        ? '/api/auth/twitter'
        : `/api/providers/${selectedIntegration.id}/connect`

    window.location.href = connectUrl
  }

  const handleDisconnect = async () => {
    if (!selectedIntegration) return

    setActionPending(true)
    try {
      const disconnectUrl =
        selectedIntegration.id === 'twitter'
          ? '/api/auth/twitter/disconnect'
          : `/api/providers/${selectedIntegration.id}/disconnect`

      const response = await fetch(disconnectUrl, { method: 'POST' })
      if (!response.ok) {
        throw new Error('Disconnect failed')
      }

      await refreshConnections()
      setSelectedIntegration(null)
    } finally {
      setActionPending(false)
    }
  }

  const filteredIntegrations = useMemo(() => {
    let filtered = integrations

    if (activeCategory !== 'all') {
      filtered = filtered.filter(i => i.category === activeCategory)
    }

    if (search) {
      const lowerSearch = search.toLowerCase()
      filtered = filtered.filter(i =>
        i.name.toLowerCase().includes(lowerSearch) ||
        i.description.toLowerCase().includes(lowerSearch)
      )
    }

    return filtered
  }, [activeCategory, integrations, search])

  const getStatusBadge = (integration: ProviderCatalogItem) => {
    if (connectedIds.includes(integration.id)) {
      return (
        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
          <Check className="h-3 w-3 mr-1" />
          Connected
        </Badge>
      )
    }

    if (integration.deliveryMode === 'coming_soon') {
      return (
        <Badge variant="outline" className="text-muted-foreground">
          <Clock className="h-3 w-3 mr-1" />
          Coming Soon
        </Badge>
      )
    }

    if (integration.deliveryMode === 'export_only') {
      return (
        <Badge className="bg-slate-100 text-slate-700 border-slate-200">
          Export Only
        </Badge>
      )
    }

    if (integration.surfaceStatus === 'beta') {
      return (
        <Badge className="bg-amber-500/10 text-amber-500 border-amber-200">
          Beta
        </Badge>
      )
    }

    return null
  }

  return (
    <div className="container py-8 min-h-screen bg-background text-foreground">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Plug className="h-8 w-8 text-primary" />
            Integrations
          </h1>
          <p className="text-muted-foreground mt-1">
            Connect your favorite tools and platforms
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="gap-1">
            {connectionsLoading ? (
              <span className="text-muted-foreground">Loading...</span>
            ) : (
              <>
                <Check className="h-3 w-3 text-emerald-500" />
                {connectedIds.length} connected
              </>
            )}
          </Badge>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search integrations..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 max-w-md"
        />
      </div>

      {/* Category Tabs */}
      <Tabs value={activeCategory} onValueChange={(v) => setActiveCategory(v as typeof activeCategory)} className="mb-6">
        <TabsList className="flex-wrap h-auto gap-2 bg-transparent p-0">
          <TabsTrigger
            value="all"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            All
          </TabsTrigger>
          {PROVIDER_CATEGORIES.map((category) => (
            <TabsTrigger
              key={category.id}
              value={category.id}
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              {category.name}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Integration Grid */}
      {filteredIntegrations.length === 0 ? (
        <div className="text-center py-12">
          <Plug className="h-12 w-12 mx-auto text-muted-foreground/20 mb-4" />
          <p className="text-muted-foreground">No integrations found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredIntegrations.map((integration, index) => (
            <motion.div
              key={integration.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card
                className={cn(
                  "cursor-pointer transition-all hover:shadow-md hover:border-primary/50",
                  connectedIds.includes(integration.id) && "border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/10"
                )}
                onClick={() => setSelectedIntegration(integration)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
                        style={{ backgroundColor: integration.color }}
                      >
                        {integration.iconLabel}
                      </div>
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          {integration.name}
                        </CardTitle>
                        <CardDescription className="text-xs">
                          {PROVIDER_CATEGORIES.find(c => c.id === integration.category)?.name}
                        </CardDescription>
                      </div>
                    </div>
                    {getStatusBadge(integration)}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3">
                    {integration.description}
                  </p>
                  <div className="flex items-center gap-2 mb-3">
                    <Badge variant="outline" className="text-xs capitalize">
                      {integration.deliveryMode === 'direct_deploy'
                        ? 'Direct Deploy'
                        : integration.deliveryMode === 'export_only'
                          ? 'Export Only'
                          : 'Coming Soon'}
                    </Badge>
                    {!integration.configured && (
                      <Badge variant="outline" className="text-xs text-amber-500 border-amber-200">
                        Not Configured
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {integration.features.slice(0, 3).map((feature, i) => (
                      <Badge key={i} variant="secondary" className="text-xs font-normal">
                        {feature}
                      </Badge>
                    ))}
                    {integration.features.length > 3 && (
                      <Badge variant="secondary" className="text-xs font-normal">
                        +{integration.features.length - 3}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Integration Detail Dialog */}
      <Dialog open={!!selectedIntegration} onOpenChange={() => setSelectedIntegration(null)}>
        <DialogContent className="max-w-lg">
          {selectedIntegration && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-4">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-xl"
                    style={{ backgroundColor: selectedIntegration.color }}
                  >
                    {selectedIntegration.iconLabel}
                  </div>
                  <div>
                    <DialogTitle className="flex items-center gap-2">
                      {selectedIntegration.name}
                    </DialogTitle>
                    <DialogDescription>
                      {selectedIntegration.description}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-4 py-4">
                {/* Features */}
                <div>
                  <h4 className="text-sm font-medium mb-2">Features</h4>
                  <ul className="space-y-1">
                    {selectedIntegration.features.map((feature, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Check className="h-4 w-4 text-emerald-500" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Auth Type */}
                <div>
                  <h4 className="text-sm font-medium mb-2">Connection Type</h4>
                  <Badge variant="outline" className="capitalize">
                    {selectedIntegration.authType.replace('_', ' ')}
                  </Badge>
                </div>

                <div>
                  <h4 className="text-sm font-medium mb-2">Launch Status</h4>
                  <div className="flex gap-2">
                    <Badge variant="outline" className="capitalize">
                      {selectedIntegration.deliveryMode === 'direct_deploy'
                        ? 'Direct deploy'
                        : selectedIntegration.deliveryMode === 'export_only'
                          ? 'Export only'
                          : 'Coming soon'}
                    </Badge>
                    {!selectedIntegration.configured && (
                      <Badge variant="outline" className="text-amber-500 border-amber-200">
                        Missing env setup
                      </Badge>
                    )}
                  </div>
                </div>

                {connectedIds.includes(selectedIntegration.id) && (
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
                    <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                      <Check className="h-4 w-4" />
                      <span className="text-sm font-medium">Connected</span>
                    </div>
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                      Last synced: Just now
                    </p>
                  </div>
                )}
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                {selectedIntegration.deliveryMode === 'coming_soon' ? (
                  <Button disabled>
                    <Clock className="h-4 w-4 mr-2" />
                    Coming Soon
                  </Button>
                ) : connectedIds.includes(selectedIntegration.id) ? (
                  <Button variant="destructive" onClick={() => void handleDisconnect()} disabled={actionPending}>
                    Disconnect
                  </Button>
                ) : (
                  <Button onClick={handleConnect} disabled={actionPending}>
                    <Plug className="h-4 w-4 mr-2" />
                    Connect
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
