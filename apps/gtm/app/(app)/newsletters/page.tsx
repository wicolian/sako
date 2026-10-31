'use client'

import { useState } from 'react'
import { 
  Mail, 
  Sparkles, 
  Download, 
  Copy, 
  Eye,
  Loader2,
  Palette,
  Type,
  Layout,
  Check
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'

interface NewsletterDesign {
  id: string
  style: 'minimal' | 'bold' | 'classic'
  subject: string
  preheader: string
  colorScheme: {
    background: string
    text: string
    accent: string
    buttonBackground: string
    buttonText: string
  }
  typography: {
    headingFont: string
    bodyFont: string
    headingSize: string
    bodySize: string
  }
}

interface Newsletter {
  id: string
  topic: string
  subjectLines: string[]
  preheaders: string[]
  content: {
    headline: string
    introduction: string
    mainContent: string[]
    bulletPoints?: string[]
    cta: {
      text: string
      url?: string
    }
    signoff: string
  }
  designs: NewsletterDesign[]
}

const DESIGN_STYLES = [
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Clean and modern with lots of whitespace',
    icon: <Layout className="w-5 h-5" />,
  },
  {
    id: 'bold',
    name: 'Bold',
    description: 'High contrast with colorful accents',
    icon: <Palette className="w-5 h-5" />,
  },
  {
    id: 'classic',
    name: 'Classic',
    description: 'Traditional newsletter layout',
    icon: <Type className="w-5 h-5" />,
  },
]

export default function NewslettersPage() {
  const { toast } = useToast()
  const [isGenerating, setIsGenerating] = useState(false)
  const [newsletter, setNewsletter] = useState<Newsletter | null>(null)
  const [selectedDesignIndex, setSelectedDesignIndex] = useState(0)
  const [previewOpen, setPreviewOpen] = useState(false)

  const [formData, setFormData] = useState({
    topic: '',
    audience: '',
    tone: 'professional',
    goal: 'engagement',
    ctaUrl: '',
  })

  const handleGenerate = async () => {
    if (!formData.topic.trim()) {
      toast({
        title: 'Missing topic',
        description: 'Please enter what your newsletter is about',
        variant: 'destructive',
      })
      return
    }

    setIsGenerating(true)
    setNewsletter(null)

    try {
      const response = await fetch('/api/newsletter/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: formData.topic,
          audience: formData.audience,
          tone: formData.tone,
          goal: formData.goal,
          ctaUrl: formData.ctaUrl,
          includeDesigns: true,
          designCount: 3,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to generate newsletter')
      }

      const data = await response.json()
      setNewsletter(data.newsletter)
      setSelectedDesignIndex(0)

      toast({
        title: 'Newsletter generated!',
        description: `Created ${data.newsletter.designs?.length || 3} design variants`,
      })
    } catch (error) {
      console.error('Generation error:', error)
      toast({
        title: 'Generation failed',
        description: 'Please try again',
        variant: 'destructive',
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({ title: 'Copied to clipboard' })
  }

  const handleExport = async (format: 'html' | 'klaviyo' | 'mailchimp') => {
    if (!newsletter) return

    try {
      const response = await fetch('/api/newsletter/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: formData.topic,
          audience: formData.audience,
          tone: formData.tone,
          goal: formData.goal,
          exportFormat: format,
          exportDesignIndex: selectedDesignIndex,
        }),
      })

      const data = await response.json()

      if (format === 'html') {
        // Download HTML file
        const blob = new Blob([data.export.data], { type: 'text/html' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `newsletter-${Date.now()}.html`
        a.click()
        URL.revokeObjectURL(url)
      } else {
        // Copy to clipboard for Klaviyo/Mailchimp
        copyToClipboard(JSON.stringify(data.export.data, null, 2))
      }

      toast({
        title: 'Exported!',
        description: format === 'html' ? 'HTML file downloaded' : `${format} template copied`,
      })
    } catch (error) {
      toast({
        title: 'Export failed',
        description: 'Please try again',
        variant: 'destructive',
      })
    }
  }

  const selectedDesign = newsletter?.designs?.[selectedDesignIndex]

  return (
    <div className="container max-w-7xl mx-auto py-8 px-4 min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Newsletter Generator</h1>
        <p className="text-muted-foreground">
          Create newsletters that are both written and designed by AI
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Left: Configuration */}
        <div className="lg:col-span-1 space-y-6">
          {/* Newsletter Details */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Newsletter Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Topic / Theme</Label>
                <Textarea
                  placeholder="What's this newsletter about? e.g., Product launch announcement, Weekly tips..."
                  value={formData.topic}
                  onChange={(e) =>
                    setFormData({ ...formData, topic: e.target.value })
                  }
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>Target Audience</Label>
                <Input
                  placeholder="e.g., Newsletter subscribers, customers"
                  value={formData.audience}
                  onChange={(e) =>
                    setFormData({ ...formData, audience: e.target.value })
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tone</Label>
                  <Select
                    value={formData.tone}
                    onValueChange={(v) => setFormData({ ...formData, tone: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="casual">Casual</SelectItem>
                      <SelectItem value="friendly">Friendly</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Goal</Label>
                  <Select
                    value={formData.goal}
                    onValueChange={(v) => setFormData({ ...formData, goal: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="engagement">Engagement</SelectItem>
                      <SelectItem value="sales">Sales</SelectItem>
                      <SelectItem value="announcement">Announcement</SelectItem>
                      <SelectItem value="educational">Educational</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>CTA Link URL (optional)</Label>
                <Input
                  placeholder="https://..."
                  value={formData.ctaUrl}
                  onChange={(e) =>
                    setFormData({ ...formData, ctaUrl: e.target.value })
                  }
                />
              </div>
            </CardContent>
          </Card>

          {/* Generate Button */}
          <Button
            className="w-full"
            size="lg"
            onClick={handleGenerate}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Generate Newsletter
              </>
            )}
          </Button>

          {/* Design Selection */}
          {newsletter && newsletter.designs && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Choose Design</CardTitle>
                <CardDescription>
                  Select from {newsletter.designs.length} generated designs
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {DESIGN_STYLES.map((style, idx) => {
                  const design = newsletter.designs[idx]
                  if (!design) return null

                  return (
                    <button
                      key={style.id}
                      className={cn(
                        'w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left',
                        selectedDesignIndex === idx
                          ? 'border-primary bg-primary/5'
                          : 'hover:bg-muted'
                      )}
                      onClick={() => setSelectedDesignIndex(idx)}
                    >
                      <div
                        className="w-10 h-10 rounded flex items-center justify-center"
                        style={{ backgroundColor: design.colorScheme.buttonBackground }}
                      >
                        {style.icon}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-sm">{style.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {style.description}
                        </div>
                      </div>
                      {selectedDesignIndex === idx && (
                        <Check className="w-5 h-5 text-primary" />
                      )}
                    </button>
                  )
                })}
              </CardContent>
            </Card>
          )}

          {/* Export Options */}
          {newsletter && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Export</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => handleExport('html')}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download HTML
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => handleExport('klaviyo')}
                >
                  <Mail className="w-4 h-4 mr-2" />
                  Export for Klaviyo
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => handleExport('mailchimp')}
                >
                  <Mail className="w-4 h-4 mr-2" />
                  Export for Mailchimp
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: Generated Newsletter */}
        <div className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Generated Newsletter</CardTitle>
                  <CardDescription>
                    {newsletter
                      ? 'Edit and preview your newsletter'
                      : 'Fill in details and generate'}
                  </CardDescription>
                </div>
                {newsletter && (
                  <Button variant="outline" onClick={() => setPreviewOpen(true)}>
                    <Eye className="w-4 h-4 mr-2" />
                    Preview
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {!newsletter ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                    <Mail className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="font-medium mb-2">No newsletter generated yet</h3>
                  <p className="text-sm text-muted-foreground max-w-sm">
                    Enter your newsletter topic and click Generate to create
                    your email with multiple design options.
                  </p>
                </div>
              ) : (
                <Tabs defaultValue="content">
                  <TabsList>
                    <TabsTrigger value="content">Content</TabsTrigger>
                    <TabsTrigger value="subject">Subject Lines</TabsTrigger>
                    <TabsTrigger value="design">Design</TabsTrigger>
                  </TabsList>

                  <TabsContent value="content" className="space-y-4 mt-4">
                    {/* Headline */}
                    <div className="p-4 bg-muted rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-muted-foreground">
                          HEADLINE
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(newsletter.content.headline)}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                      <p className="text-lg font-bold">{newsletter.content.headline}</p>
                    </div>

                    {/* Introduction */}
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-muted-foreground">
                          INTRODUCTION
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(newsletter.content.introduction)}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                      <p>{newsletter.content.introduction}</p>
                    </div>

                    {/* Main Content */}
                    <div className="border rounded-lg overflow-hidden">
                      <div className="px-4 py-2 bg-muted border-b">
                        <span className="text-xs font-medium">MAIN CONTENT</span>
                      </div>
                      <div className="p-4 space-y-4">
                        {newsletter.content.mainContent.map((paragraph, idx) => (
                          <p key={idx}>{paragraph}</p>
                        ))}
                      </div>
                    </div>

                    {/* Bullet Points */}
                    {newsletter.content.bulletPoints && (
                      <div className="p-4 border rounded-lg">
                        <span className="text-xs font-medium text-muted-foreground block mb-2">
                          KEY POINTS
                        </span>
                        <ul className="list-disc list-inside space-y-1">
                          {newsletter.content.bulletPoints.map((point, idx) => (
                            <li key={idx}>{point}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* CTA */}
                    <div className="p-4 bg-primary/10 rounded-lg">
                      <span className="text-xs font-medium text-muted-foreground block mb-2">
                        CALL TO ACTION
                      </span>
                      <Button className="w-full">{newsletter.content.cta.text}</Button>
                    </div>

                    {/* Signoff */}
                    <div className="p-4 border rounded-lg">
                      <span className="text-xs font-medium text-muted-foreground block mb-2">
                        SIGNOFF
                      </span>
                      <p className="italic">{newsletter.content.signoff}</p>
                    </div>
                  </TabsContent>

                  <TabsContent value="subject" className="space-y-4 mt-4">
                    <div className="space-y-3">
                      <span className="text-sm font-medium">Subject Line Options</span>
                      {newsletter.subjectLines.map((subject, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-3 border rounded-lg"
                        >
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{idx + 1}</Badge>
                            <span>{subject}</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(subject)}
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-3 pt-4 border-t">
                      <span className="text-sm font-medium">Preheader Options</span>
                      {newsletter.preheaders.map((preheader, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-3 border rounded-lg"
                        >
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{idx + 1}</Badge>
                            <span className="text-sm text-muted-foreground">
                              {preheader}
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(preheader)}
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </TabsContent>

                  <TabsContent value="design" className="space-y-4 mt-4">
                    {selectedDesign && (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="p-4 border rounded-lg">
                            <span className="text-xs font-medium text-muted-foreground block mb-2">
                              COLOR SCHEME
                            </span>
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-6 h-6 rounded border"
                                  style={{
                                    backgroundColor: selectedDesign.colorScheme.background,
                                  }}
                                />
                                <span className="text-sm">Background</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-6 h-6 rounded border"
                                  style={{
                                    backgroundColor: selectedDesign.colorScheme.accent,
                                  }}
                                />
                                <span className="text-sm">Accent</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-6 h-6 rounded border"
                                  style={{
                                    backgroundColor:
                                      selectedDesign.colorScheme.buttonBackground,
                                  }}
                                />
                                <span className="text-sm">Button</span>
                              </div>
                            </div>
                          </div>

                          <div className="p-4 border rounded-lg">
                            <span className="text-xs font-medium text-muted-foreground block mb-2">
                              TYPOGRAPHY
                            </span>
                            <div className="space-y-2">
                              <div>
                                <span className="text-xs text-muted-foreground">
                                  Heading:
                                </span>
                                <span className="ml-2 text-sm">
                                  {selectedDesign.typography.headingFont}
                                </span>
                              </div>
                              <div>
                                <span className="text-xs text-muted-foreground">Body:</span>
                                <span className="ml-2 text-sm">
                                  {selectedDesign.typography.bodyFont}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </TabsContent>
                </Tabs>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Newsletter Preview</DialogTitle>
          </DialogHeader>
          {newsletter && selectedDesign && (
            <div
              className="rounded-lg overflow-hidden"
              style={{
                backgroundColor: selectedDesign.colorScheme.background,
                color: selectedDesign.colorScheme.text,
                fontFamily: selectedDesign.typography.bodyFont,
              }}
            >
              <div className="max-w-xl mx-auto p-8">
                <h1
                  style={{
                    fontFamily: selectedDesign.typography.headingFont,
                    fontSize: selectedDesign.typography.headingSize,
                    marginBottom: '1rem',
                  }}
                >
                  {newsletter.content.headline}
                </h1>
                <p style={{ marginBottom: '1rem' }}>{newsletter.content.introduction}</p>
                {newsletter.content.mainContent.map((p, idx) => (
                  <p key={idx} style={{ marginBottom: '1rem' }}>
                    {p}
                  </p>
                ))}
                {newsletter.content.bulletPoints && (
                  <ul style={{ marginBottom: '1rem', paddingLeft: '1.5rem' }}>
                    {newsletter.content.bulletPoints.map((bp, idx) => (
                      <li key={idx}>{bp}</li>
                    ))}
                  </ul>
                )}
                <div style={{ textAlign: 'center', margin: '2rem 0' }}>
                  <button
                    style={{
                      backgroundColor: selectedDesign.colorScheme.buttonBackground,
                      color: selectedDesign.colorScheme.buttonText,
                      padding: '12px 24px',
                      borderRadius: '6px',
                      border: 'none',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                    }}
                  >
                    {newsletter.content.cta.text}
                  </button>
                </div>
                <p style={{ fontStyle: 'italic' }}>{newsletter.content.signoff}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
