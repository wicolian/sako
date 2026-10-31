'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Plus, Play, Settings, Users, Lock, ChevronRight } from 'lucide-react'
import type { StudioApp } from '@/lib/studio/types'

interface Props {
  initialApps: StudioApp[]
  workspaceId: string
}

export function StudioClient({ initialApps, workspaceId }: Props) {
  const router = useRouter()
  const [apps, setApps] = useState<StudioApp[]>(initialApps)

  return (
    <div className="space-y-8">
      {apps.length === 0 ? (
        <Card className="border-border/50 bg-card/40 backdrop-blur-sm overflow-hidden relative mt-8">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-50" />
          <CardContent className="py-20 text-center relative z-10">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center mx-auto mb-6 shadow-[0_0_40px_-10px_rgba(132,204,22,0.5)] border border-primary/20">
              <Plus className="w-10 h-10 text-primary-foreground" />
            </div>
            <h3 className="text-2xl font-bold mb-3">Create your first AI App</h3>
            <p className="text-muted-foreground max-w-md mx-auto mb-8">
              Build custom generative tools tailored to your workspace needs with the Sako Studio builder.
            </p>
            <Button size="lg" className="h-12 px-8 rounded-xl shadow-lg shadow-primary/20 bg-primary hover:bg-primary/90 text-primary-foreground">
              <Plus className="w-4 h-4 mr-2" />
              Create New App
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {apps.map((app, i) => (
              <motion.div
                key={app.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
              >
                <Card className="hover:border-primary/50 bg-card/40 border-border/50 backdrop-blur-sm transition-all h-full group flex flex-col cursor-pointer overflow-hidden relative">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary/50 to-primary/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                  
                  <CardContent className="p-6 flex-1 flex flex-col pt-8">
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-2xl shadow-sm">
                        {app.icon || '🤖'}
                      </div>
                      <Badge variant="outline" className="bg-background/50 backdrop-blur">
                        {app.visibility === 'workspace' ? (
                          <span className="flex items-center gap-1.5"><Users className="w-3 h-3" /> Workspace</span>
                        ) : (
                          <span className="flex items-center gap-1.5"><Lock className="w-3 h-3" /> Private</span>
                        )}
                      </Badge>
                    </div>

                    <div className="space-y-2 mb-6 flex-1">
                      <h3 className="font-semibold text-lg truncate group-hover:text-primary transition-colors">
                        {app.name}
                      </h3>
                      <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                        {app.description || 'No description provided.'}
                      </p>
                    </div>

                    <div className="flex gap-2 pt-4 border-t border-border/50">
                      <Button 
                        variant="secondary" 
                        className="flex-1 gap-2 bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20"
                        onClick={(e) => {
                          e.stopPropagation()
                          router.push(`/studio/${app.id}/run`)
                        }}
                      >
                        <Play className="w-4 h-4 fill-current" />
                        Run
                      </Button>
                      <Button 
                        variant="outline" 
                        size="icon"
                        className="shrink-0 hover:border-primary/50 hover:text-primary transition-colors"
                        onClick={(e) => {
                          e.stopPropagation()
                          router.push(`/studio/${app.id}`)
                        }}
                      >
                        <Settings className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
