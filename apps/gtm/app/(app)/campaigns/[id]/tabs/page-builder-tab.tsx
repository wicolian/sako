'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Trash2, Sparkles, Loader2, Layout as LayoutIcon, Type, Image as ImageIcon, Settings2, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { Campaign, PageBlock } from '@/lib/supabase/types'
import { EmptyState } from "@/components/ui/empty-state"

interface PageBuilderTabProps {
  campaign: Campaign
  blocks: PageBlock[]
}

const blockTypes = [
  { type: 'hero', label: 'Hero', description: 'Main headline and CTA', icon: Type },
  { type: 'trust', label: 'Trust Badges', description: 'Logos and social proof', icon: ImageIcon },
  { type: 'benefits', label: 'Benefits', description: 'Value propositions', icon: LayoutIcon },
  { type: 'features', label: 'Features', description: 'Product details', icon: LayoutIcon },
  { type: 'pricing', label: 'Pricing', description: 'Pricing tiers', icon: LayoutIcon },
  { type: 'faq', label: 'FAQ', description: 'Common questions', icon: Type },
  { type: 'footer', label: 'Footer', description: 'Links and legal', icon: LayoutIcon },
]

export function PageBuilderTab({ campaign, blocks: initialBlocks }: PageBuilderTabProps) {
  const router = useRouter()
  const [blocks, setBlocks] = useState(initialBlocks)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)
  const saveTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // 5px movement required before drag starts
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  useEffect(() => {
    const timeoutRegistry = saveTimeoutsRef.current

    return () => {
      Object.values(timeoutRegistry).forEach((timeoutId) => clearTimeout(timeoutId))
    }
  }, [])

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = blocks.findIndex((b) => b.id === active.id)
      const newIndex = blocks.findIndex((b) => b.id === over.id)
      
      const newBlocks = arrayMove(blocks, oldIndex, newIndex)
      setBlocks(newBlocks)
      
      // Update order in database
      setSaving(true)
      try {
        await Promise.all(
          newBlocks.map((block, index) =>
            fetch(`/api/page-blocks/${block.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ order: index }),
            })
          )
        )
      } catch (error) {
        console.error('Failed to reorder blocks:', error)
      } finally {
        setSaving(false)
      }
    }
  }

  const generatePage = async () => {
    setGenerating(true)
    try {
      const res = await fetch(`/api/ai/generate-page`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId: campaign.id,
        }),
      })
      if (res.ok) {
        router.refresh()
      }
    } catch (error) {
      console.error('Failed to generate page:', error)
    } finally {
      setGenerating(false)
    }
  }

  const addBlock = async (type: string) => {
    try {
      const res = await fetch(`/api/page-blocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId: campaign.id,
          type,
          order: blocks.length,
          props: getDefaultPropsForType(type)
        }),
      })
      if (res.ok) {
        const newBlock = await res.json()
        setBlocks([...blocks, newBlock])
        setSelectedBlockId(newBlock.id)
      }
    } catch (error) {
      console.error('Failed to add block:', error)
    }
  }

  const removeBlock = async (blockId: string) => {
    try {
      await fetch(`/api/page-blocks/${blockId}`, {
        method: 'DELETE',
      })
      setBlocks(blocks.filter((b) => b.id !== blockId))
      if (selectedBlockId === blockId) {
        setSelectedBlockId(null)
      }
    } catch (error) {
      console.error('Failed to remove block:', error)
    }
  }

  const updateBlockProps = (blockId: string, newProps: Record<string, unknown>) => {
    let mergedProps: Record<string, unknown> = {}

    setBlocks((currentBlocks) =>
      currentBlocks.map((block) => {
        if (block.id !== blockId) {
          return block
        }

        mergedProps = {
          ...toBlockProps(block.props),
          ...newProps,
        }

        return {
          ...block,
          props: mergedProps as PageBlock['props'],
        }
      }),
    )

    const existingTimeout = saveTimeoutsRef.current[blockId]
    if (existingTimeout) {
      clearTimeout(existingTimeout)
    }

    saveTimeoutsRef.current[blockId] = setTimeout(async () => {
      setSaving(true)
      try {
        await fetch(`/api/page-blocks/${blockId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ props: mergedProps }),
        })
      } catch (error) {
        console.error('Failed to save block props:', error)
      } finally {
        delete saveTimeoutsRef.current[blockId]
        setSaving(false)
      }
    }, 500)
  }

  const selectedBlock = blocks.find(b => b.id === selectedBlockId)

  return (
    <div className="flex h-full bg-background border border-border/50 rounded-xl overflow-hidden">
      
      {/* LEFT SIDEBAR: Layers & Insert */}
      <div className="w-64 border-r border-border/50 bg-card flex flex-col">
        <div className="p-4 border-b border-border/50">
          <Button onClick={generatePage} disabled={generating} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm">
            {generating ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4 mr-2" />
            )}
            Auto-Generate
          </Button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Insert Block</h3>
            <div className="grid grid-cols-2 gap-2">
              {blockTypes.map((block) => (
                <button
                  key={block.type}
                  onClick={() => addBlock(block.type)}
                  className="flex flex-col items-center justify-center p-3 border border-border/50 rounded-lg hover:bg-muted/50 hover:border-primary/50 transition-colors text-center group"
                >
                  <block.icon className="w-5 h-5 text-muted-foreground group-hover:text-primary mb-1.5" />
                  <span className="text-[10px] font-medium">{block.label}</span>
                </button>
              ))}
            </div>
          </div>
          
          {blocks.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center justify-between">
                Layers
                {saving && <Loader2 className="w-3 h-3 animate-spin" />}
              </h3>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={blocks.map((b) => b.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-1">
                    {blocks.map((block) => (
                      <LayerItem
                        key={block.id}
                        block={block}
                        isSelected={selectedBlockId === block.id}
                        onSelect={() => setSelectedBlockId(block.id)}
                        onRemove={() => removeBlock(block.id)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          )}
        </div>
      </div>

      {/* CENTER CANVAS: Visual Preview */}
      <div className="flex-1 bg-muted/10 overflow-y-auto p-8 flex flex-col items-center relative" onClick={() => setSelectedBlockId(null)}>
        {blocks.length === 0 ? (
          <div className="m-auto w-full max-w-md">
            <EmptyState
              icon={LayoutIcon}
              title="Empty Canvas"
              description="Click 'Auto-Generate' to let AI build your page, or insert blocks from the left sidebar."
            />
          </div>
        ) : (
          <div className="w-full max-w-4xl bg-background rounded-2xl shadow-xl border border-border/50 overflow-hidden flex flex-col min-h-[800px]" onClick={e => e.stopPropagation()}>
            {/* Fake browser top */}
            <div className="h-10 bg-muted/30 border-b border-border/50 flex items-center px-4 gap-2">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
              </div>
              <div className="mx-auto bg-background/50 border border-border/50 rounded text-[10px] px-3 py-1 text-muted-foreground">
                preview.brand.com
              </div>
            </div>
            {/* Blocks */}
            <div className="flex-1 flex flex-col relative">
              {blocks.map((block) => (
                <div 
                  key={block.id} 
                  className={`relative cursor-pointer transition-colors ${selectedBlockId === block.id ? 'ring-2 ring-primary ring-inset z-10' : 'hover:ring-1 hover:ring-border z-0'}`}
                  onClick={() => setSelectedBlockId(block.id)}
                >
                  <BlockVisual block={block} />
                  {selectedBlockId === block.id && (
                    <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[10px] uppercase font-bold px-2 py-0.5 rounded-bl-lg z-20">
                      {block.type}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* RIGHT SIDEBAR: Properties */}
      <div className="w-72 border-l border-border/50 bg-card overflow-y-auto">
        <div className="p-4 border-b border-border/50 flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-semibold text-sm">Properties</h3>
        </div>
        
        <div className="p-4">
          {selectedBlock ? (
            <BlockPropertiesPanel 
              block={selectedBlock} 
              onChange={(newProps) => updateBlockProps(selectedBlock.id, newProps)} 
            />
          ) : (
            <div className="text-center text-muted-foreground text-sm py-12">
              Select a block on the canvas or in the layers list to edit its properties.
            </div>
          )}
        </div>
      </div>

    </div>
  )
}

function LayerItem({
  block,
  isSelected,
  onSelect,
  onRemove,
}: {
  block: PageBlock
  isSelected: boolean
  onSelect: () => void
  onRemove: () => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className={`flex items-center gap-2 p-2 rounded-md transition-colors ${isSelected ? 'bg-primary/10 text-primary' : 'hover:bg-muted/50 text-foreground'}`}
      onClick={(e) => {
        e.stopPropagation()
        onSelect()
      }}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none p-1"
      >
        <GripVertical className="w-3.5 h-3.5" />
      </button>
      <span className="text-xs font-medium capitalize flex-1 truncate">
        {block.type.replace('_', ' ')}
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="w-6 h-6 opacity-0 hover:opacity-100 focus:opacity-100 transition-opacity"
        onClick={(e) => {
          e.stopPropagation()
          onRemove()
        }}
      >
        <Trash2 className="w-3 h-3 text-muted-foreground hover:text-destructive" />
      </Button>
    </div>
  )
}

function getDefaultPropsForType(type: string) {
  switch (type) {
    case 'hero': return { headline: 'Catchy Headline', subheadline: 'Compelling subheadline that explains the value proposition.', cta_text: 'Get Started' }
    case 'benefits': return { title: 'Why choose us', items: [{title: 'Fast', desc: 'Very fast'}, {title: 'Secure', desc: 'Very secure'}] }
    case 'pricing': return { title: 'Pricing', tiers: [{name: 'Basic', price: '$9'}, {name: 'Pro', price: '$29'}] }
    default: return { text: 'Block content' }
  }
}

function BlockPropertiesPanel({ block, onChange }: { block: PageBlock, onChange: (props: Record<string, unknown>) => void }) {
  const props = toBlockProps(block.props)

  const updateProp = (key: string, value: string) => {
    onChange({ [key]: value })
  }

  switch (block.type) {
    case 'hero':
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Headline</Label>
            <Textarea 
              value={getStringProp(props, 'headline')} 
              onChange={(e) => updateProp('headline', e.target.value)} 
              className="text-sm resize-none"
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Subheadline</Label>
            <Textarea 
              value={getStringProp(props, 'subheadline')} 
              onChange={(e) => updateProp('subheadline', e.target.value)} 
              className="text-sm resize-none"
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">CTA Text</Label>
            <Input 
              value={getStringProp(props, 'cta_text')} 
              onChange={(e) => updateProp('cta_text', e.target.value)} 
              className="text-sm h-8"
            />
          </div>
        </div>
      )
    default:
      return (
        <div className="space-y-4">
          <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded font-mono break-all">
            {JSON.stringify(props, null, 2)}
          </div>
          <p className="text-xs text-muted-foreground">
            Visual editing for {block.type} blocks is coming soon.
          </p>
        </div>
      )
  }
}

function BlockVisual({ block }: { block: PageBlock }) {
  const props = toBlockProps(block.props)

  switch (block.type) {
    case 'hero':
      return (
        <div className="py-24 px-8 text-center bg-background flex flex-col items-center justify-center border-b border-border/10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wider mb-6">
            New Release
          </div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6 max-w-3xl leading-tight">
            {getStringProp(props, 'headline', 'Your Catchy Headline Goes Here')}
          </h1>
          <p className="text-xl text-muted-foreground mb-10 max-w-2xl leading-relaxed">
            {getStringProp(props, 'subheadline', 'A compelling subheadline that explains the value proposition and why users should care about your product.')}
          </p>
          <div className="flex items-center gap-4">
            <Button size="lg" className="h-12 px-8 text-base rounded-full shadow-lg shadow-primary/20">
              {getStringProp(props, 'cta_text', 'Get Started Now')}
            </Button>
            <Button variant="outline" size="lg" className="h-12 px-8 text-base rounded-full bg-transparent">
              Book Demo
            </Button>
          </div>
        </div>
      )
    case 'trust':
      return (
        <div className="py-12 bg-muted/5 border-b border-border/10">
          <p className="text-center text-sm font-medium text-muted-foreground mb-6 uppercase tracking-widest">
            Trusted by innovative teams
          </p>
          <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16 opacity-50 grayscale">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-8 w-24 bg-foreground/20 rounded-md" />
            ))}
          </div>
        </div>
      )
    case 'benefits':
      return (
        <div className="py-20 px-8 bg-background border-b border-border/10">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight mb-4">{getStringProp(props, 'title', 'Why choose our platform')}</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">Everything you need to scale your operations without the headache.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-muted/10 p-6 rounded-2xl border border-border/50">
                <div className="w-12 h-12 bg-primary/10 rounded-xl mb-4 flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Benefit {i}</h3>
                <p className="text-muted-foreground leading-relaxed">Detailed description of this specific benefit and how it helps the user succeed.</p>
              </div>
            ))}
          </div>
        </div>
      )
    case 'features':
      return (
        <div className="py-24 px-8 bg-muted/5 border-b border-border/10">
          <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-16 items-center">
            <div className="space-y-6">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Powerful features that drive results</h2>
              <p className="text-lg text-muted-foreground">Stop wasting time on manual tasks. Our automated systems handle the heavy lifting so you can focus on growth.</p>
              <ul className="space-y-4 pt-4">
                {[1, 2, 3].map(i => (
                  <li key={i} className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                    <span className="font-medium">Feature capability {i}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-card border border-border/50 rounded-2xl aspect-square shadow-2xl flex items-center justify-center p-8">
              <div className="w-full h-full border border-dashed border-border/50 rounded-xl flex items-center justify-center text-muted-foreground">
                <ImageIcon className="w-12 h-12 opacity-20" />
              </div>
            </div>
          </div>
        </div>
      )
    case 'pricing':
      return (
        <div className="py-24 px-8 bg-background border-b border-border/10">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight mb-4">Simple, transparent pricing</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">Start for free, upgrade when you need more power.</p>
          </div>
          <div className="grid md:grid-cols-2 max-w-4xl mx-auto gap-8">
            <div className="p-8 rounded-3xl border border-border/50 bg-card">
              <h3 className="text-2xl font-semibold mb-2">Starter</h3>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-4xl font-bold">$0</span>
                <span className="text-muted-foreground">/mo</span>
              </div>
              <Button className="w-full mb-8" variant="outline">Get Started</Button>
              <ul className="space-y-3 text-sm">
                {[1, 2, 3].map(i => (
                  <li key={i} className="flex items-center gap-2 text-muted-foreground">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Starter feature {i}
                  </li>
                ))}
              </ul>
            </div>
            <div className="p-8 rounded-3xl border border-primary bg-primary/5 relative">
              <div className="absolute top-0 right-8 -translate-y-1/2 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                Popular
              </div>
              <h3 className="text-2xl font-semibold mb-2">Pro</h3>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-4xl font-bold">$49</span>
                <span className="text-muted-foreground">/mo</span>
              </div>
              <Button className="w-full mb-8 bg-primary hover:bg-primary/90 text-primary-foreground">Upgrade to Pro</Button>
              <ul className="space-y-3 text-sm">
                {[1, 2, 3, 4, 5].map(i => (
                  <li key={i} className="flex items-center gap-2 text-foreground font-medium">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Pro feature {i}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )
    case 'footer':
      return (
        <div className="py-12 px-8 bg-card border-t border-border/50 text-center">
          <div className="flex items-center justify-center gap-2 mb-6">
            <div className="w-6 h-6 bg-primary/20 rounded-md" />
            <span className="font-bold tracking-tight">Sako</span>
          </div>
          <div className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground mb-8">
            <span className="hover:text-foreground cursor-pointer">Product</span>
            <span className="hover:text-foreground cursor-pointer">Features</span>
            <span className="hover:text-foreground cursor-pointer">Pricing</span>
            <span className="hover:text-foreground cursor-pointer">Company</span>
          </div>
          <div className="text-xs text-muted-foreground/60">
            © 2026 Sako Intelligence. All rights reserved.
          </div>
        </div>
      )
    default:
      return (
        <div className="py-12 px-8 bg-muted/10 border-b border-border/10 text-center">
          <div className="inline-block p-4 border border-dashed border-border/50 rounded-lg text-muted-foreground bg-background">
            <p className="font-mono text-sm mb-2">{block.type} block</p>
            <p className="text-xs opacity-60 max-w-xs truncate">{JSON.stringify(props)}</p>
          </div>
        </div>
      )
  }
}

function toBlockProps(value: PageBlock['props']): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }

  return {}
}

function getStringProp(props: Record<string, unknown>, key: string, fallback = ''): string {
  const value = props[key]
  return typeof value === 'string' ? value : fallback
}
