'use client'

/**
 * Kit Detail Page - Review, edit, and export a launch kit
 */

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  ArrowLeft,
  Loader2,
  CheckCircle,
  AlertCircle,
  Download,
  Figma,
  Globe,
  FileText,
  Image,
  Mail,
  Share2,
  Presentation,
  Rocket,
  Copy,
  ExternalLink,
} from 'lucide-react'
import { toast } from 'sonner'
import { NotFoundState } from '@/components/ui/error-state'
import { DeployTab } from '@/components/kit/deploy-tab'
import type { LaunchKit } from '@/lib/kit/kit-types'

const STATUS_COLORS = {
  generating: 'bg-blue-500/10 text-blue-500',
  review: 'bg-amber-500/10 text-amber-500',
  approved: 'bg-green-500/10 text-emerald-500',
  exported: 'bg-purple-500/10 text-purple-600',
}

export default function KitDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [kit, setKit] = useState<LaunchKit | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  
  useEffect(() => {
    fetch(`/api/kit/${id}`)
      .then(res => res.json())
      .then(data => {
        if (data.kit) {
          setKit(data.kit)
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [id])
  
  const handleExportZip = async () => {
    if (!kit) return

    try {
      toast.info('Preparing ZIP export...')
      const JSZip = (await import('jszip')).default
      const zip = new JSZip()

      zip.file('kit.json', JSON.stringify(kit, null, 2))

      if (kit.assets.landingPage?.html) {
        zip.file('landing-page.html', kit.assets.landingPage.html)
      }

      if (kit.assets.deck) {
        zip.file('deck.json', JSON.stringify(kit.assets.deck, null, 2))
      }

      if (kit.assets.emails) {
        zip.file('emails.json', JSON.stringify(kit.assets.emails, null, 2))
      }

      if (kit.assets.ads.length > 0) {
        zip.file('ads.json', JSON.stringify(kit.assets.ads, null, 2))
      }

      if (kit.assets.socialPosts.length > 0) {
        zip.file('social-posts.json', JSON.stringify(kit.assets.socialPosts, null, 2))
      }

      zip.file(
        'README.md',
        `# Launch Kit Export\n\nKit ID: ${kit.id}\nExported At: ${new Date().toISOString()}\n`
      )

      const blob = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `launch-kit-${kit.id.slice(0, 8)}.zip`
      a.click()
      URL.revokeObjectURL(url)

      toast.success('ZIP export ready')
    } catch (error) {
      console.error('ZIP export failed:', error)
      toast.error('Failed to export ZIP')
    }
  }
  
  const handleExportFigma = async () => {
    try {
      toast.info('Exporting to Figma...')
      const response = await fetch(`/api/kit/${id}/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'figma' }),
      })

      const data = await response.json()
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Figma export failed')
      }

      if (data.url) {
        window.open(data.url, '_blank', 'noopener,noreferrer')
      }

      toast.success('Figma export started')
    } catch (error) {
      console.error('Figma export failed:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to export to Figma')
    }
  }
  
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 min-h-screen bg-background text-foreground">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }
  
  if (!kit) {
    return <NotFoundState resource="launch kit" backHref="/kit/new" />
  }
  
  return (
    <div className="container max-w-5xl py-8">
      {/* Back Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.push('/dashboard')}
        className="mb-6"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Dashboard
      </Button>
      
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold mb-2">{kit.brief.offer.slice(0, 50)}...</h1>
          <div className="flex items-center gap-3">
            <Badge className={STATUS_COLORS[kit.status]}>
              {kit.status}
            </Badge>
            <span className="text-sm text-muted-foreground">
              Created {new Date(kit.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportZip}>
            <Download className="w-4 h-4 mr-2" />
            Download ZIP
          </Button>
          <Button onClick={handleExportFigma}>
            <Figma className="w-4 h-4 mr-2" />
            Export to Figma
          </Button>
        </div>
      </div>
      
      {/* Compliance Summary */}
      <Card className="mb-6">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold">{kit.compliance.totalClaims}</div>
                <div className="text-xs text-muted-foreground">Total Claims</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-emerald-500">{kit.compliance.approved}</div>
                <div className="text-xs text-muted-foreground">Approved</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-amber-500">{kit.compliance.needsReview}</div>
                <div className="text-xs text-muted-foreground">Need Review</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-destructive">{kit.compliance.blocked}</div>
                <div className="text-xs text-muted-foreground">Blocked</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {kit.compliance.blocked === 0 ? (
                <Badge className="bg-green-500/10 text-emerald-500">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Compliant
                </Badge>
              ) : (
                <Badge className="bg-amber-500/10 text-amber-500">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  Needs Review
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="landing">Landing Page</TabsTrigger>
          <TabsTrigger value="ads">Ads ({kit.assets.ads.length})</TabsTrigger>
          <TabsTrigger value="emails">Emails</TabsTrigger>
          <TabsTrigger value="social">Social ({kit.assets.socialPosts.length})</TabsTrigger>
          <TabsTrigger value="deck">Deck</TabsTrigger>
          <TabsTrigger value="deploy">Deploy</TabsTrigger>
        </TabsList>
        
        {/* Overview Tab */}
        <TabsContent value="overview">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Landing Page
                </CardTitle>
              </CardHeader>
              <CardContent>
                {kit.assets.landingPage ? (
                  <div className="space-y-2">
                    <p className="font-medium">{kit.assets.landingPage.headline}</p>
                    <p className="text-sm text-muted-foreground">{kit.assets.landingPage.subheadline}</p>
                    <Button variant="link" size="sm" className="p-0" onClick={() => setActiveTab('landing')}>
                      View Details →
                    </Button>
                  </div>
                ) : (
                  <p className="text-muted-foreground">Not generated</p>
                )}
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Image className="w-4 h-4" />
                  Ad Variants
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{kit.assets.ads.length}</p>
                <p className="text-sm text-muted-foreground">variants ready</p>
                <Button variant="link" size="sm" className="p-0" onClick={() => setActiveTab('ads')}>
                  View All →
                </Button>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Email Sequence
                </CardTitle>
              </CardHeader>
              <CardContent>
                {kit.assets.emails ? (
                  <>
                    <p className="text-2xl font-bold">{kit.assets.emails.emails.length}</p>
                    <p className="text-sm text-muted-foreground">emails in sequence</p>
                    <Button variant="link" size="sm" className="p-0" onClick={() => setActiveTab('emails')}>
                      View Sequence →
                    </Button>
                  </>
                ) : (
                  <p className="text-muted-foreground">Not generated</p>
                )}
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Share2 className="w-4 h-4" />
                  Social Posts
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{kit.assets.socialPosts.length}</p>
                <p className="text-sm text-muted-foreground">posts ready</p>
                <Button variant="link" size="sm" className="p-0" onClick={() => setActiveTab('social')}>
                  View All →
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        {/* Landing Page Tab */}
        <TabsContent value="landing">
          <Card>
            <CardHeader>
              <CardTitle>Landing Page</CardTitle>
            </CardHeader>
            <CardContent>
              {kit.assets.landingPage ? (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Headline</h3>
                    <p className="text-xl font-semibold">{kit.assets.landingPage.headline}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Subheadline</h3>
                    <p>{kit.assets.landingPage.subheadline}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">CTA</h3>
                    <Badge>{kit.brief.cta}</Badge>
                  </div>
                  {kit.assets.landingPage.html && (
                    <div>
                      <Button variant="outline" size="sm">
                        <Copy className="w-4 h-4 mr-2" />
                        Copy HTML
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground">Landing page not generated</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Ads Tab */}
        <TabsContent value="ads">
          <div className="grid gap-4 md:grid-cols-2">
            {kit.assets.ads.map((ad, i) => (
              <Card key={i}>
                <CardHeader>
                  <CardTitle className="text-sm">Variant {i + 1}</CardTitle>
                  <CardDescription>
                    {ad.platform} • {ad.dimensions.width}x{ad.dimensions.height}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="font-medium mb-2">{ad.headline}</p>
                  <p className="text-sm text-muted-foreground">{ad.primaryText}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
        
        {/* Emails Tab */}
        <TabsContent value="emails">
          {kit.assets.emails ? (
            <div className="space-y-4">
              {kit.assets.emails.emails.map((email, i) => (
                <Card key={i}>
                  <CardHeader>
                    <CardTitle className="text-sm">Email {i + 1}</CardTitle>
                    <CardDescription>{email.subject}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div 
                      className="prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: email.bodyHtml }}
                    />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Email sequence not generated
              </CardContent>
            </Card>
          )}
        </TabsContent>
        
        {/* Social Tab */}
        <TabsContent value="social">
          <div className="grid gap-4 md:grid-cols-2">
            {kit.assets.socialPosts.map((post, i) => (
              <Card key={i}>
                <CardHeader>
                  <CardTitle className="text-sm capitalize">{post.platform}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap">{post.content}</p>
                  {post.hashtags && post.hashtags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {post.hashtags.map((tag, j) => (
                        <Badge key={j} variant="outline" className="text-xs">
                          #{tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
        
        {/* Deck Tab */}
        <TabsContent value="deck">
          {kit.assets.deck ? (
            <div className="grid gap-4 md:grid-cols-2">
              {kit.assets.deck.slides.map((slide, i) => (
                <Card key={i}>
                  <CardHeader>
                    <CardTitle className="text-sm">Slide {i + 1}: {slide.type}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="font-medium">{slide.headline}</p>
                    {slide.bullets && (
                      <ul className="list-disc list-inside text-sm text-muted-foreground mt-2">
                        {slide.bullets.map((bullet, j) => (
                          <li key={j}>{bullet}</li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Deck not generated
              </CardContent>
            </Card>
          )}
        </TabsContent>
        
        {/* Deploy Tab */}
        <TabsContent value="deploy">
          <DeployTab kitId={id} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
