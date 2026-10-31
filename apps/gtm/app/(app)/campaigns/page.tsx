import Link from 'next/link'
import { Plus, FileText, ArrowRight, Sparkles, Activity, Search, Filter, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { formatRelativeTime } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface Campaign {
  id: string
  name: string
  status: string
  audience: string | null
  goal: string | null
  updated_at: string
}

const statusConfig: Record<string, {
  label: string
  variant: 'default' | 'secondary' | 'destructive' | 'outline'
  icon: typeof FileText
  color: string
  bgColor: string
  borderColor: string
}> = {
  draft: {
    label: 'Draft',
    variant: 'secondary',
    icon: FileText,
    color: 'text-muted-foreground',
    bgColor: 'bg-muted',
    borderColor: 'border-border',
  },
  ready: {
    label: 'Ready',
    variant: 'outline',
    icon: FileText,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/20',
  },
  generating: {
    label: 'Generating',
    variant: 'outline',
    icon: Loader2,
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/20',
  },
  published: {
    label: 'Live',
    variant: 'default',
    icon: Sparkles,
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/20',
  },
  running: {
    label: 'Live',
    variant: 'default',
    icon: Activity,
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/20',
  },
  archived: {
    label: 'Archived',
    variant: 'secondary',
    icon: FileText,
    color: 'text-muted-foreground',
    bgColor: 'bg-muted',
    borderColor: 'border-border',
  },
  failed: {
    label: 'Failed',
    variant: 'destructive',
    icon: FileText,
    color: 'text-destructive',
    bgColor: 'bg-destructive/10',
    borderColor: 'border-destructive/20',
  },
}

export default async function CampaignsPage() {
  const supabase = await createServerSupabaseClient()
  
  const { data } = await supabase
    .from('campaigns')
    .select('*')
    .order('updated_at', { ascending: false })
  
  const campaigns = data as Campaign[] | null

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-8 bg-background min-h-screen text-foreground">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Campaigns</h1>
          <p className="text-muted-foreground mt-1">
            AI-generated marketing assets grounded in your brand
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" asChild className="gap-2">
            <Link href="/import">
              <GlobeIcon className="w-4 h-4" /> Import URL
            </Link>
          </Button>
          <Button variant="outline" asChild className="gap-2">
            <Link href="/kit/new">
              <Sparkles className="w-4 h-4" /> Launch Kit
            </Link>
          </Button>
          <Button asChild className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20">
            <Link href="/campaigns/new">
              <Sparkles className="w-4 h-4" /> Create Campaign
            </Link>
          </Button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search campaigns..."
            className="pl-10 bg-card/50 border-border/50 focus-visible:ring-primary/30"
          />
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          {['all', 'draft', 'generating', 'ready', 'failed', 'live', 'archived'].map(f => (
            <Badge 
              key={f}
              variant={f === 'all' ? "default" : "secondary"}
              className="cursor-pointer text-[10px] uppercase tracking-wider font-mono hover:bg-primary/80"
            >
              {f}
            </Badge>
          ))}
        </div>
      </div>

      {/* Campaigns List */}
      {campaigns && campaigns.length > 0 ? (
        <div className="grid gap-3">
          {campaigns.map((campaign) => {
            const config = statusConfig[campaign.status] || statusConfig.draft
            const Icon = config.icon
            const isGenerating = campaign.status === 'generating'
            
            return (
              <Link key={campaign.id} href={`/campaigns/${campaign.id}`}>
                <Card className="hover:border-primary/50 bg-card/40 border-border/50 backdrop-blur-sm transition-all cursor-pointer group">
                  <CardContent className="flex items-center gap-5 p-5">
                    {/* Status icon */}
                    <div className={cn(
                      "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-110",
                      config.bgColor
                    )}>
                      <Icon className={cn("h-6 w-6", config.color, isGenerating && 'animate-spin')} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold text-lg truncate group-hover:text-primary transition-colors">
                          {campaign.name}
                        </h3>
                        <Badge variant="outline" className={cn("text-[10px] uppercase tracking-wider font-mono", config.color, config.borderColor, config.bgColor.replace('/10', '/5'))}>
                          {config.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-1.5 text-sm text-muted-foreground">
                        {campaign.audience && (
                          <span className="truncate max-w-[250px] bg-muted/50 px-2 py-0.5 rounded-md border border-border/30">
                            {campaign.audience}
                          </span>
                        )}
                        {campaign.goal && (
                          <span className="truncate max-w-[300px] flex items-center gap-2">
                            <span className="w-1 h-1 rounded-full bg-border" />
                            {campaign.goal}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Meta */}
                    <div className="flex items-center gap-6">
                      <div className="text-sm font-medium text-muted-foreground shrink-0 tabular-nums">
                        {formatRelativeTime(campaign.updated_at)}
                      </div>

                      {/* Arrow indicator */}
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all">
                        <ArrowRight className="h-4 w-4 text-primary" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      ) : (
        /* Empty state with contextual education */
        <Card className="border-border/50 bg-card/40 backdrop-blur-sm overflow-hidden relative mt-8">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-50" />
          <CardContent className="py-20 text-center relative z-10">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-emerald-400 flex items-center justify-center mx-auto mb-6 shadow-[0_0_40px_-10px_rgba(132,204,22,0.5)]">
              <Sparkles className="w-10 h-10 text-primary-foreground" />
            </div>
            <h3 className="text-2xl font-bold mb-3">Create your first campaign</h3>
            <p className="text-muted-foreground max-w-lg mx-auto mb-8">
              Import your website to automatically generate landing pages, social posts, and email sequences grounded in your brand voice.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" className="h-12 px-8 rounded-xl shadow-lg shadow-primary/20">
                <Link href="/campaigns/new">
                  <Sparkles className="w-4 h-4 mr-2" />
                  Create Campaign
                </Link>
              </Button>
              <Button variant="outline" asChild size="lg" className="h-12 px-8 rounded-xl bg-background/50 backdrop-blur">
                <Link href="/kit/new">
                  <Sparkles className="w-4 h-4 mr-2" />
                  Launch Kit
                </Link>
              </Button>
              <Button variant="outline" asChild size="lg" className="h-12 px-8 rounded-xl bg-background/50 backdrop-blur">
                <Link href="/import">
                  <GlobeIcon className="w-4 h-4 mr-2" />
                  Import website
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function GlobeIcon(props: React.ComponentProps<'svg'>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
      <path d="M2 12h20" />
    </svg>
  )
}
