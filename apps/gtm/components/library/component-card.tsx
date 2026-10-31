'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Bookmark, Eye, Copy, Lock, ExternalLink, MoreVertical, Code } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface UIComponent {
  id: string
  name: string
  description: string | null
  category: string
  tags: string[]
  thumbnail_url: string | null
  html: string
  css?: string
  is_pro: boolean
  is_public: boolean
  is_system: boolean
  usage_count: number
}

interface ComponentCardProps {
  component: UIComponent
  viewMode: 'grid' | 'list'
  isSaved: boolean
  onToggleSave: () => void
}

export function ComponentCard({
  component,
  viewMode,
  isSaved,
  onToggleSave,
}: ComponentCardProps) {
  const [previewOpen, setPreviewOpen] = useState(false)

  const handleCopyHtml = async () => {
    await navigator.clipboard.writeText(component.html)
    toast.success('HTML copied to clipboard!')
  }

  if (viewMode === 'list') {
    return (
      <>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4 p-4 bg-card rounded-lg border hover:shadow-md transition-shadow"
        >
          {/* Preview thumbnail */}
          <div
            className="w-32 h-20 bg-muted rounded overflow-hidden shrink-0 relative group cursor-pointer"
            onClick={() => setPreviewOpen(true)}
          >
            <div
              className="absolute inset-0 scale-[0.2] origin-top-left"
              style={{ width: '500%', height: '500%' }}
              dangerouslySetInnerHTML={{ __html: component.html }}
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
              <Eye className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-medium truncate">{component.name}</h3>
              {component.is_pro && (
                <Badge variant="secondary" className="shrink-0">
                  <Lock className="h-3 w-3 mr-1" />
                  Pro
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground truncate mt-1">
              {component.description || 'No description'}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline" className="capitalize text-xs">
                {component.category}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {component.usage_count} uses
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onToggleSave}
            >
              <Bookmark className={cn('h-4 w-4', isSaved && 'fill-current')} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleCopyHtml}
            >
              <Copy className="h-4 w-4" />
            </Button>
            <Button size="sm" onClick={() => setPreviewOpen(true)}>
              <Eye className="h-4 w-4 mr-2" />
              Preview
            </Button>
          </div>
        </motion.div>

        <ComponentPreviewDialog
          component={component}
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          onCopyHtml={handleCopyHtml}
        />
      </>
    )
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="group bg-card rounded-xl border overflow-hidden hover:shadow-lg transition-all"
      >
        {/* Preview */}
        <div
          className="relative h-48 bg-muted overflow-hidden cursor-pointer"
          onClick={() => setPreviewOpen(true)}
        >
          <div
            className="absolute inset-0 scale-[0.25] origin-top-left"
            style={{ width: '400%', height: '400%' }}
            dangerouslySetInnerHTML={{ __html: component.html }}
          />
          
          {/* Overlay on hover */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
            <Button
              variant="secondary"
              size="sm"
              className="opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Eye className="h-4 w-4 mr-2" />
              Preview
            </Button>
          </div>

          {/* Pro badge */}
          {component.is_pro && (
            <div className="absolute top-2 right-2">
              <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white">
                <Lock className="h-3 w-3 mr-1" />
                Pro
              </Badge>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-4">
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <h3 className="font-medium truncate">{component.name}</h3>
              <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                {component.description || 'No description'}
              </p>
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setPreviewOpen(true)}>
                  <Eye className="h-4 w-4 mr-2" />
                  Preview
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleCopyHtml}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy HTML
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onToggleSave}>
                  <Bookmark className={cn('h-4 w-4 mr-2', isSaved && 'fill-current')} />
                  {isSaved ? 'Remove from Saved' : 'Save Component'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Tags and stats */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t">
            <Badge variant="outline" className="capitalize text-xs">
              {component.category}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {component.usage_count} uses
            </span>
          </div>
        </div>
      </motion.div>

      <ComponentPreviewDialog
        component={component}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        onCopyHtml={handleCopyHtml}
      />
    </>
  )
}

interface ComponentPreviewDialogProps {
  component: UIComponent
  open: boolean
  onOpenChange: (open: boolean) => void
  onCopyHtml: () => void
}

function ComponentPreviewDialog({
  component,
  open,
  onOpenChange,
  onCopyHtml,
}: ComponentPreviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {component.name}
            {component.is_pro && (
              <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white">
                <Lock className="h-3 w-3 mr-1" />
                Pro
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="preview" className="flex-1 flex flex-col overflow-hidden">
          <TabsList>
            <TabsTrigger value="preview">Preview</TabsTrigger>
            <TabsTrigger value="code">HTML Code</TabsTrigger>
          </TabsList>

          <TabsContent value="preview" className="flex-1 overflow-hidden m-0 mt-4">
            <div className="h-full bg-muted rounded-lg overflow-auto">
              <iframe
                srcDoc={`
                  <!DOCTYPE html>
                  <html>
                  <head>
                    <script src="https://cdn.tailwindcss.com"></script>
                    <style>body { margin: 0; }</style>
                  </head>
                  <body>${component.html}</body>
                  </html>
                `}
                className="w-full h-full min-h-[400px] border-0"
                title="Component Preview"
              />
            </div>
          </TabsContent>

          <TabsContent value="code" className="flex-1 overflow-hidden m-0 mt-4">
            <div className="h-full bg-[#1e1e1e] rounded-lg overflow-auto p-4">
              <pre className="text-sm text-gray-300 font-mono whitespace-pre-wrap">
                {component.html}
              </pre>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onCopyHtml}>
            <Copy className="h-4 w-4 mr-2" />
            Copy HTML
          </Button>
          <Button>
            Use Component
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
