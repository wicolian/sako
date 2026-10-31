'use client'

/**
 * Export Options - Kit export choices
 */

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Download,
  Figma,
  Globe,
  ArrowRight,
} from 'lucide-react'

interface ExportOptionsProps {
  kitId: string
  onExport: (format: string) => void
}

export function ExportOptions({ kitId, onExport }: ExportOptionsProps) {
  const options = [
    {
      id: 'zip',
      title: 'Download ZIP',
      description: 'All assets as HTML, images, and text files',
      icon: Download,
      primary: true,
    },
    {
      id: 'figma',
      title: 'Export to Figma',
      description: 'Clipboard export for design handoff',
      icon: Figma,
      primary: false,
    },
    {
      id: 'subdomain',
      title: 'Sako Hosting Beta',
      description: 'Upload a hosted artifact for sako.pub domains with DNS configured',
      icon: Globe,
      primary: false,
    },
  ]
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Export Your Kit</CardTitle>
        <CardDescription>
          Choose how you want to use your launch kit
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {options.map((option) => (
          <button
            key={option.id}
            onClick={() => onExport(option.id)}
            className={`w-full p-4 rounded-lg border text-left transition-colors flex items-center gap-4 ${
              option.primary 
                ? 'border-primary bg-primary/5 hover:bg-primary/10' 
                : 'hover:border-primary/50 hover:bg-accent/50'
            }`}
          >
            <option.icon className="w-5 h-5 text-primary" />
            <div className="flex-1">
              <div className="font-medium">{option.title}</div>
              <div className="text-sm text-muted-foreground">{option.description}</div>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground" />
          </button>
        ))}
      </CardContent>
    </Card>
  )
}
