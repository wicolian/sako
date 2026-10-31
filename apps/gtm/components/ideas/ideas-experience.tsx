'use client'

import { useCallback, useEffect, useState } from 'react'
import { SwipeDiscovery, type ContentIdea } from '@/components/ideas/swipe-discovery'

interface IdeasResponse {
  ideas?: ContentIdea[]
}

interface IdeasExperienceProps {
  workspaceId: string
}

export function IdeasExperience({ workspaceId }: IdeasExperienceProps) {
  const [ideas, setIdeas] = useState<ContentIdea[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const loadIdeas = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/ideas')
      if (!response.ok) return
      const payload = (await response.json()) as IdeasResponse
      setIdeas(Array.isArray(payload.ideas) ? payload.ideas : [])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadIdeas()
  }, [loadIdeas])

  const handleSave = useCallback(async (idea: ContentIdea) => {
    await fetch('/api/ideas', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save', idea }),
    })
    setIdeas((prev) => prev.map((item) => (item.id === idea.id ? { ...item, status: 'saved' } : item)))
  }, [])

  const handleSkip = useCallback((idea: ContentIdea) => {
    void fetch('/api/ideas', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'skip', ideaId: idea.id }),
    })
    setIdeas((prev) => prev.map((item) => (item.id === idea.id ? { ...item, status: 'skipped' } : item)))
  }, [])

  const handleRequestMore = useCallback(async () => {
    const response = await fetch('/api/ideas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count: 10 }),
    })

    if (!response.ok) return
    const payload = (await response.json()) as IdeasResponse
    if (Array.isArray(payload.ideas) && payload.ideas.length > 0) {
      setIdeas((prev) => [...prev, ...payload.ideas!])
    }
  }, [])

  const handleGenerateVariations = useCallback(async (idea: ContentIdea) => {
    const response = await fetch('/api/ideas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'variations', idea, count: 3 }),
    })

    if (!response.ok) return
    const payload = (await response.json()) as IdeasResponse
    if (Array.isArray(payload.ideas) && payload.ideas.length > 0) {
      setIdeas((prev) => [...payload.ideas!, ...prev])
    }
  }, [])

  return (
    <SwipeDiscovery
      ideas={ideas}
      onSave={handleSave}
      onSkip={handleSkip}
      onRequestMore={handleRequestMore}
      onGenerateVariations={handleGenerateVariations}
      isLoading={isLoading}
      campaignId={workspaceId}
    />
  )
}
