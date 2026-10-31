"use client"

import * as React from "react"
import { Download, Copy, Code, FileText, FileArchive, Check } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"

export interface ExportActionsProps {
  onExportMarkdownZip: () => void
  onExportHtmlZip: () => void
  onExportBrief: () => void
  onCopyAll: () => void
}

export function ExportActions({
  onExportMarkdownZip,
  onExportHtmlZip,
  onExportBrief,
  onCopyAll,
}: ExportActionsProps) {
  const [copied, setCopied] = React.useState(false)

  const handleCopy = () => {
    onCopyAll()
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          Export All
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={onExportMarkdownZip} className="gap-3 cursor-pointer">
          <FileArchive className="h-4 w-4 text-muted-foreground" />
          <div className="flex flex-col">
            <span>Export as Markdown</span>
            <span className="text-xs text-muted-foreground">ZIP file with raw text</span>
          </div>
        </DropdownMenuItem>
        
        <DropdownMenuItem onClick={onExportHtmlZip} className="gap-3 cursor-pointer">
          <Code className="h-4 w-4 text-muted-foreground" />
          <div className="flex flex-col">
            <span>Export as HTML</span>
            <span className="text-xs text-muted-foreground">ZIP file with styled pages</span>
          </div>
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem onClick={onExportBrief} className="gap-3 cursor-pointer">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <div className="flex flex-col">
            <span>Campaign Brief</span>
            <span className="text-xs text-muted-foreground">PDF summary document</span>
          </div>
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem onClick={handleCopy} className="gap-3 cursor-pointer">
          {copied ? (
            <Check className="h-4 w-4 text-emerald-500" />
          ) : (
            <Copy className="h-4 w-4 text-muted-foreground" />
          )}
          <div className="flex flex-col">
            <span>Copy all to clipboard</span>
            <span className="text-xs text-muted-foreground">Combined raw text</span>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
