'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

export type ViewMode = 'agent' | 'advanced'

const VIEW_STORAGE_KEY = 'sako-view-preference'

export function useViewPreference() {
  const [viewMode, setViewModeState] = useState<ViewMode>('agent')
  const [isLoading, setIsLoading] = useState(true)

  // Load preference on mount
  useEffect(() => {
    const loadPreference = async () => {
      try {
        // First check localStorage for quick load
        const stored = localStorage.getItem(VIEW_STORAGE_KEY) as ViewMode | null
        if (stored === 'agent' || stored === 'advanced') {
          setViewModeState(stored)
        }

        // Then sync with server
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        
        if (user) {
          const { data } = await supabase
            .from('workspace_members')
            .select('workspace_id')
            .eq('user_id', user.id)
            .maybeSingle()
          
          const memberData = data as { workspace_id: string } | null
          if (memberData?.workspace_id) {
            const { data: settings } = await supabase
              .from('workspace_settings')
              .select('default_view')
              .eq('workspace_id', memberData.workspace_id)
              .maybeSingle()
            
            const settingsData = settings as { default_view: ViewMode | null } | null
            if (settingsData?.default_view) {
              setViewModeState(settingsData.default_view)
              localStorage.setItem(VIEW_STORAGE_KEY, settingsData.default_view)
            }
          }
        }
      } catch (error) {
        console.error('Failed to load view preference:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadPreference()
  }, [])

  // Set preference
  const setViewMode = useCallback(async (mode: ViewMode) => {
    setViewModeState(mode)
    localStorage.setItem(VIEW_STORAGE_KEY, mode)
    
    // Also set cookie for server-side redirect
    document.cookie = `${VIEW_STORAGE_KEY}=${mode}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        const { data } = await supabase
          .from('workspace_members')
          .select('workspace_id')
          .eq('user_id', user.id)
          .maybeSingle()
        
        const memberData = data as { workspace_id: string } | null
        if (memberData?.workspace_id) {
          await fetch('/api/settings', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              default_view: mode,
              updated_at: new Date().toISOString(),
            }),
          })
        }
      }
    } catch (error) {
      console.error('Failed to save view preference:', error)
    }
  }, [])

  // Toggle between modes
  const toggleViewMode = useCallback(() => {
    const newMode = viewMode === 'agent' ? 'advanced' : 'agent'
    setViewMode(newMode)
  }, [viewMode, setViewMode])

  return {
    viewMode,
    setViewMode,
    toggleViewMode,
    isLoading,
    isAgentView: viewMode === 'agent',
    isAdvancedView: viewMode === 'advanced',
  }
}
