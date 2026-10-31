'use client'

import { useState, useEffect } from 'react'
import { X, Sparkles, AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import type { CanvasBlockData } from './canvas-block'

interface BlockEditorProps {
  block: CanvasBlockData
  onUpdate: (updates: Partial<CanvasBlockData['content']>) => void
  onClose: () => void
  onRegenerate: () => void
}

export function BlockEditor({ block, onUpdate, onClose, onRegenerate }: BlockEditorProps) {
  const [localContent, setLocalContent] = useState(block.content)

  useEffect(() => {
    setLocalContent(block.content)
  }, [block.id, block.content])

  const handleChange = (field: string, value: unknown) => {
    const updated = { ...localContent, [field]: value }
    setLocalContent(updated)
    onUpdate({ [field]: value })
  }

  const handleArrayItemChange = (field: string, index: number, key: string, value: string) => {
    const items = [...((localContent[field] as unknown[]) || [])]
    items[index] = { ...(items[index] as Record<string, unknown>), [key]: value }
    setLocalContent({ ...localContent, [field]: items })
    onUpdate({ [field]: items })
  }

  const addArrayItem = (field: string, template: Record<string, unknown>) => {
    const items = [...((localContent[field] as unknown[]) || []), template]
    setLocalContent({ ...localContent, [field]: items })
    onUpdate({ [field]: items })
  }

  const removeArrayItem = (field: string, index: number) => {
    const items = ((localContent[field] as unknown[]) || []).filter((_, i) => i !== index)
    setLocalContent({ ...localContent, [field]: items })
    onUpdate({ [field]: items })
  }

  const hasViolation = (field: string): boolean => {
    return block.violations?.some((v) => v.field === field) ?? false
  }

  const getViolation = (field: string) => {
    return block.violations?.find((v) => v.field === field)
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <h3 className="font-medium capitalize">{block.type} Block</h3>
          <p className="text-xs text-muted-foreground">Edit content and styling</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onRegenerate}>
            <Sparkles className="w-3 h-3 mr-1" />
            Regenerate
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {block.type === 'hero' && (
          <HeroFields
            content={localContent}
            onChange={handleChange}
            hasViolation={hasViolation}
            getViolation={getViolation}
          />
        )}

        {block.type === 'features' && (
          <ArrayFields
            field="items"
            label="Features"
            content={localContent}
            template={{ title: '', description: '', icon: 'zap' }}
            fields={[
              { key: 'title', label: 'Title', type: 'input' },
              { key: 'description', label: 'Description', type: 'textarea' },
            ]}
            onChange={handleArrayItemChange}
            onAdd={addArrayItem}
            onRemove={removeArrayItem}
            hasViolation={hasViolation}
            getViolation={getViolation}
          />
        )}

        {block.type === 'testimonials' && (
          <ArrayFields
            field="items"
            label="Testimonials"
            content={localContent}
            template={{ quote: '', author: '', company: '' }}
            fields={[
              { key: 'quote', label: 'Quote', type: 'textarea' },
              { key: 'author', label: 'Author', type: 'input' },
              { key: 'company', label: 'Company', type: 'input' },
            ]}
            onChange={handleArrayItemChange}
            onAdd={addArrayItem}
            onRemove={removeArrayItem}
            hasViolation={hasViolation}
            getViolation={getViolation}
          />
        )}

        {block.type === 'cta' && (
          <CTAFields
            content={localContent}
            onChange={handleChange}
            hasViolation={hasViolation}
            getViolation={getViolation}
          />
        )}

        {/* Generic fallback for other block types */}
        {!['hero', 'features', 'testimonials', 'cta'].includes(block.type) && (
          <GenericFields
            content={localContent}
            onChange={handleChange}
            hasViolation={hasViolation}
            getViolation={getViolation}
          />
        )}
      </div>
    </div>
  )
}

interface FieldsProps {
  content: Record<string, unknown>
  onChange: (field: string, value: unknown) => void
  hasViolation: (field: string) => boolean
  getViolation: (field: string) => { message: string; severity: string } | undefined
}

function HeroFields({ content, onChange, hasViolation, getViolation }: FieldsProps) {
  return (
    <div className="space-y-4">
      <FieldWithValidation
        label="Headline"
        field="headline"
        type="input"
        value={(content.headline as string) || ''}
        onChange={(v) => onChange('headline', v)}
        hasViolation={hasViolation('headline')}
        violation={getViolation('headline')}
      />
      <FieldWithValidation
        label="Subheadline"
        field="subheadline"
        type="textarea"
        value={(content.subheadline as string) || ''}
        onChange={(v) => onChange('subheadline', v)}
        hasViolation={hasViolation('subheadline')}
        violation={getViolation('subheadline')}
      />
      <FieldWithValidation
        label="CTA Text"
        field="cta_text"
        type="input"
        value={(content.cta_text as string) || ''}
        onChange={(v) => onChange('cta_text', v)}
        hasViolation={hasViolation('cta_text')}
        violation={getViolation('cta_text')}
      />
    </div>
  )
}

function CTAFields({ content, onChange, hasViolation, getViolation }: FieldsProps) {
  return (
    <div className="space-y-4">
      <FieldWithValidation
        label="Headline"
        field="headline"
        type="input"
        value={(content.headline as string) || ''}
        onChange={(v) => onChange('headline', v)}
        hasViolation={hasViolation('headline')}
        violation={getViolation('headline')}
      />
      <FieldWithValidation
        label="Description"
        field="description"
        type="textarea"
        value={(content.description as string) || ''}
        onChange={(v) => onChange('description', v)}
        hasViolation={hasViolation('description')}
        violation={getViolation('description')}
      />
      <FieldWithValidation
        label="Button Text"
        field="button_text"
        type="input"
        value={(content.button_text as string) || ''}
        onChange={(v) => onChange('button_text', v)}
        hasViolation={hasViolation('button_text')}
        violation={getViolation('button_text')}
      />
    </div>
  )
}

function GenericFields({ content, onChange, hasViolation, getViolation }: FieldsProps) {
  const textFields = Object.entries(content).filter(
    ([, value]) => typeof value === 'string'
  )

  return (
    <div className="space-y-4">
      {textFields.map(([key, value]) => (
        <FieldWithValidation
          key={key}
          label={key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
          field={key}
          type={(value as string).length > 100 ? 'textarea' : 'input'}
          value={value as string}
          onChange={(v) => onChange(key, v)}
          hasViolation={hasViolation(key)}
          violation={getViolation(key)}
        />
      ))}
    </div>
  )
}

interface ArrayFieldsProps {
  field: string
  label: string
  content: Record<string, unknown>
  template: Record<string, unknown>
  fields: Array<{ key: string; label: string; type: 'input' | 'textarea' }>
  onChange: (field: string, index: number, key: string, value: string) => void
  onAdd: (field: string, template: Record<string, unknown>) => void
  onRemove: (field: string, index: number) => void
  hasViolation: (field: string) => boolean
  getViolation: (field: string) => { message: string } | undefined
}

function ArrayFields({
  field,
  label,
  content,
  template,
  fields,
  onChange,
  onAdd,
  onRemove,
  hasViolation,
  getViolation,
}: ArrayFieldsProps) {
  const items = (content[field] as Record<string, unknown>[]) || []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">{label}</Label>
        <Button variant="outline" size="sm" onClick={() => onAdd(field, template)}>
          Add Item
        </Button>
      </div>
      {items.map((item, index) => (
        <div key={index} className="p-3 border rounded-lg space-y-3">
          <div className="flex items-center justify-between">
            <Badge variant="outline">#{index + 1}</Badge>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-destructive"
              onClick={() => onRemove(field, index)}
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
          {fields.map((f) => {
            const fieldKey = `${field}-${index}-${f.key}`
            return (
              <FieldWithValidation
                key={f.key}
                label={f.label}
                field={fieldKey}
                type={f.type}
                value={(item[f.key] as string) || ''}
                onChange={(v) => onChange(field, index, f.key, v)}
                hasViolation={hasViolation(fieldKey)}
                violation={getViolation(fieldKey)}
              />
            )
          })}
        </div>
      ))}
    </div>
  )
}

interface FieldWithValidationProps {
  label: string
  field: string
  type: 'input' | 'textarea'
  value: string
  onChange: (value: string) => void
  hasViolation: boolean
  violation?: { message: string; severity?: string }
}

function FieldWithValidation({
  label,
  field,
  type,
  value,
  onChange,
  hasViolation,
  violation,
}: FieldWithValidationProps) {
  const InputComponent = type === 'textarea' ? Textarea : Input

  return (
    <div className="space-y-1.5">
      <Label htmlFor={field} className="text-sm">
        {label}
      </Label>
      <InputComponent
        id={field}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(hasViolation && 'border-amber-500 focus-visible:ring-amber-500')}
      />
      {hasViolation && violation && (
        <div className="flex items-center gap-1 text-xs text-amber-500">
          <AlertTriangle className="w-3 h-3" />
          {violation.message}
        </div>
      )}
    </div>
  )
}
