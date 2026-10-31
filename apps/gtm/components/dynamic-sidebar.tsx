'use client'

import { useEffect, useState, Suspense } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { AppSidebar } from '@/components/app-sidebar'
import { AgentSidebar } from '@/components/agent-sidebar'
import { useViewPreference } from '@/hooks/use-view-preference'

function URLPreferenceHandler() {
  const { setViewMode } = useViewPreference()
  const searchParams = useSearchParams()

  useEffect(() => {
    const viewParam = searchParams.get('view')
    if (viewParam === 'agent' || viewParam === 'advanced') {
      setViewMode(viewParam)
    }
  }, [searchParams, setViewMode])

  return null
}

export function DynamicSidebar({ children }: { children: React.ReactNode }) {
  const { viewMode, isLoading } = useViewPreference()
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // During SSR or loading, show nothing to prevent hydration mismatch
  if (!mounted || isLoading) {
    return (
      <div className="flex h-screen w-full">
        <div className="w-64 shrink-0 border-r bg-sidebar" />
        <div className="flex-1 overflow-hidden">
          {children}
        </div>
      </div>
    )
  }

  // Use agent sidebar for agent view, otherwise use full sidebar
  const SidebarComponent = viewMode === 'agent' ? AgentSidebar : AppSidebar

  return (
    <>
      <Suspense fallback={null}>
        <URLPreferenceHandler />
      </Suspense>
      <SidebarComponent>{children}</SidebarComponent>
    </>
  )
}
