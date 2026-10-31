'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Upload,
  Search,
  FileText,
  File,
  Award,
  BarChart3,
  MessageSquare,
  Filter,
  Plus,
  Eye,
  Trash2,
  Download,
  ExternalLink,
  Link2,
  Loader2,
  MoreHorizontal,
  FolderOpen
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
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
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

interface Evidence {
  id: string
  title: string
  content?: string
  source_type: 'case_study' | 'certification' | 'statistic' | 'testimonial' | 'document'
  source_url?: string
  created_at: string
  linked_claims?: Array<{ id: string; text: string }>
}

const EVIDENCE_TYPES = [
  { id: 'all', label: 'All', icon: FolderOpen },
  { id: 'case_study', label: 'Case Studies', icon: FileText },
  { id: 'certification', label: 'Certifications', icon: Award },
  { id: 'statistic', label: 'Statistics', icon: BarChart3 },
  { id: 'testimonial', label: 'Testimonials', icon: MessageSquare },
  { id: 'document', label: 'Documents', icon: File },
]

export default function EvidencePage() {
  const [evidence, setEvidence] = useState<Evidence[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedType, setSelectedType] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedEvidence, setSelectedEvidence] = useState<Evidence | null>(null)
  const [isUploadOpen, setIsUploadOpen] = useState(false)

  const fetchEvidence = useCallback(async () => {
    try {
      const response = await fetch('/api/evidence')
      if (response.ok) {
        const data = await response.json()
        setEvidence(data.evidence || [])
      }
    } catch (error) {
      console.error('Failed to fetch evidence:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchEvidence()
  }, [fetchEvidence])

  const filteredEvidence = evidence.filter((ev) => {
    if (selectedType !== 'all' && ev.source_type !== selectedType) return false
    if (searchQuery && !ev.title.toLowerCase().includes(searchQuery.toLowerCase())) return false
    return true
  })

  const typeIcons: Record<string, React.ElementType> = {
    case_study: FileText,
    certification: Award,
    statistic: BarChart3,
    testimonial: MessageSquare,
    document: File,
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 bg-background min-h-screen text-foreground">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Evidence Library</h1>
          <p className="text-muted-foreground mt-1">
            Manage proof points and documentation for your marketing claims
          </p>
        </div>
        <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
          <DialogTrigger asChild>
            <Button size="lg" className="gap-2 shadow-lg shadow-primary/20">
              <Plus className="h-4 w-4" />
              Upload Evidence
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <UploadEvidenceForm
              onSuccess={() => {
                setIsUploadOpen(false)
                fetchEvidence()
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {EVIDENCE_TYPES.map((type) => (
            <Badge
              key={type.id}
              onClick={() => setSelectedType(type.id)}
              variant={selectedType === type.id ? "default" : "secondary"}
              className={cn(
                "cursor-pointer px-3 py-1.5 gap-2 transition-all",
                selectedType !== type.id && "hover:bg-primary/20"
              )}
            >
              <type.icon className="h-3.5 w-3.5" />
              {type.label}
            </Badge>
          ))}
        </div>

        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search evidence..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-card/50 border-border/50 focus-visible:ring-primary/30"
          />
        </div>
      </div>

      {/* Evidence Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : filteredEvidence.length === 0 ? (
        <EmptyState onUpload={() => setIsUploadOpen(true)} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {filteredEvidence.map((ev, index) => {
              const Icon = typeIcons[ev.source_type] || File
              return (
                <motion.div
                  key={ev.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card 
                    className="bg-card/40 border-border/50 hover:border-primary/50 backdrop-blur-sm transition-all cursor-pointer group h-full flex flex-col relative overflow-hidden"
                    onClick={() => setSelectedEvidence(ev)}
                  >
                    <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <CardContent className="p-6 flex-1 flex flex-col relative z-10">
                      <div className="flex items-start justify-between mb-4">
                        <div className="p-3 rounded-xl bg-primary/10 text-primary transition-transform group-hover:scale-110">
                          <Icon className="h-6 w-6" />
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 -mr-2"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setSelectedEvidence(ev)}>
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Download className="h-4 w-4 mr-2" />
                              Download
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive focus:text-destructive">
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      <div className="space-y-1 mb-6 flex-1">
                        <h3 className="font-semibold text-lg line-clamp-2 leading-tight">
                          {ev.title}
                        </h3>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="capitalize">{ev.source_type.replace('_', ' ')}</span>
                          <span>•</span>
                          <span>{new Date(ev.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-border/50 flex justify-between items-center">
                        {ev.linked_claims && ev.linked_claims.length > 0 ? (
                          <Badge variant="outline" className="text-[10px] uppercase tracking-wider font-mono bg-background">
                            <Link2 className="h-3 w-3 mr-1" />
                            {ev.linked_claims.length} claim{ev.linked_claims.length > 1 ? 's' : ''}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">No claims linked</span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Evidence Detail Sheet */}
      <Sheet open={!!selectedEvidence} onOpenChange={() => setSelectedEvidence(null)}>
        <SheetContent className="w-[500px] sm:max-w-none bg-card/95 backdrop-blur-xl border-l-border/50">
          {selectedEvidence && (
            <>
              <SheetHeader className="mb-6">
                <SheetTitle className="text-2xl">{selectedEvidence.title}</SheetTitle>
              </SheetHeader>
              <div className="space-y-8">
                <div className="flex items-center gap-3">
                  <Badge className="capitalize gap-1.5 px-3 py-1">
                    {(() => {
                      const Icon = typeIcons[selectedEvidence.source_type] || File;
                      return <Icon className="w-3.5 h-3.5" />
                    })()}
                    {selectedEvidence.source_type.replace('_', ' ')}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    Uploaded {new Date(selectedEvidence.created_at).toLocaleDateString()}
                  </span>
                </div>

                {selectedEvidence.content && (
                  <div className="space-y-3">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Content
                    </Label>
                    <div className="p-4 bg-muted/30 rounded-xl border border-border/50 shadow-inner">
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{selectedEvidence.content}</p>
                    </div>
                  </div>
                )}

                {selectedEvidence.source_url && (
                  <Button variant="outline" className="w-full gap-2 h-12 rounded-xl border-primary/20 hover:bg-primary/5" asChild>
                    <a href={selectedEvidence.source_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" />
                      View Source Reference
                    </a>
                  </Button>
                )}

                {selectedEvidence.linked_claims && selectedEvidence.linked_claims.length > 0 && (
                  <div className="space-y-3">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Linked Claims ({selectedEvidence.linked_claims.length})
                    </Label>
                    <div className="space-y-2">
                      {selectedEvidence.linked_claims.map((claim) => (
                        <div
                          key={claim.id}
                          className="p-3 bg-muted/30 rounded-lg border border-border/50 flex items-start gap-3"
                        >
                          <Link2 className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                          <p className="text-sm text-foreground/90">{claim.text}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-6 border-t border-border/50">
                  <Button variant="outline" className="flex-1 rounded-xl">
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                  <Button variant="destructive" className="flex-1 rounded-xl">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

function EmptyState({ onUpload }: { onUpload: () => void }) {
  return (
    <Card className="border-border/50 bg-card/40 backdrop-blur-sm overflow-hidden relative mt-8">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-50" />
      <CardContent className="py-20 text-center relative z-10">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-emerald-400 flex items-center justify-center mx-auto mb-6 shadow-[0_0_40px_-10px_rgba(132,204,22,0.5)]">
          <FileText className="w-10 h-10 text-primary-foreground" />
        </div>
        <h3 className="text-2xl font-bold mb-3">No evidence yet</h3>
        <p className="text-muted-foreground max-w-md mx-auto mb-8">
          Upload case studies, certifications, and other proof points to automatically support your marketing claims.
        </p>
        <Button onClick={onUpload} size="lg" className="h-12 px-8 rounded-xl shadow-lg shadow-primary/20">
          <Upload className="h-4 w-4 mr-2" />
          Upload Evidence
        </Button>
      </CardContent>
    </Card>
  )
}

function UploadEvidenceForm({ onSuccess }: { onSuccess: () => void }) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [sourceType, setSourceType] = useState<string>('case_study')
  const [sourceUrl, setSourceUrl] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      const response = await fetch('/api/evidence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content, source_type: sourceType, source_url: sourceUrl }),
      })

      if (response.ok) {
        onSuccess()
      }
    } catch (error) {
      console.error('Failed to create evidence:', error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle className="text-xl">Upload Evidence</DialogTitle>
      </DialogHeader>
      <div className="space-y-5 mt-6">
        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Acme Corp Case Study"
            className="bg-muted/50 border-border/50"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="type">Type</Label>
          <Select value={sourceType} onValueChange={setSourceType}>
            <SelectTrigger className="bg-muted/50 border-border/50">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="case_study">Case Study</SelectItem>
              <SelectItem value="certification">Certification</SelectItem>
              <SelectItem value="statistic">Statistic</SelectItem>
              <SelectItem value="testimonial">Testimonial</SelectItem>
              <SelectItem value="document">Document</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="content">Content</Label>
          <Textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Describe the evidence or paste the content..."
            className="min-h-[120px] bg-muted/50 border-border/50 resize-none"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="url">Source URL (optional)</Label>
          <Input
            id="url"
            type="url"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="https://..."
            className="bg-muted/50 border-border/50"
          />
        </div>

        <Button type="submit" className="w-full h-11 mt-4" disabled={saving || !title}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
          Upload Evidence
        </Button>
      </div>
    </form>
  )
}
