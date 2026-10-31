/**
 * Public Report Page - View shared compliance reports
 */

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase/service'
import { ScoreBadge } from '@/components/gate/score-badge'
import { ClaimCard, type ClaimResult } from '@/components/gate/claim-card'
import { ComplianceBadge, BadgeEmbedDialog } from '@/components/gate/compliance-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Code2, Wand2, ArrowLeft } from 'lucide-react'
import type { Metadata } from 'next'

interface ReportPageProps {
  params: Promise<{ token: string }>
}

// Generate metadata for social sharing
export async function generateMetadata({ params }: ReportPageProps): Promise<Metadata> {
  const { token } = await params
  const supabase = createServiceClient()
  
  const { data: report } = await supabase
    .from('compliance_reports')
    .select('compliance_score, summary, industry')
    .eq('token', token)
    .eq('is_public', true)
    .single()
  
  if (!report) {
    return {
      title: 'Report Not Found | Sako',
    }
  }
  
  const score = report.compliance_score
  const summary = report.summary as { total: number; approved: number }
  
  return {
    title: `Compliance Score: ${score} | Sako`,
    description: `This content scored ${score}/100 on compliance. ${summary.approved}/${summary.total} claims approved.`,
    openGraph: {
      title: `Compliance Score: ${score}/100`,
      description: `Validated ${summary.total} marketing claims. ${summary.approved} approved.`,
      images: [`/api/badge/${token}?score=${score}`],
    },
    twitter: {
      card: 'summary',
      title: `Compliance Score: ${score}/100`,
      description: `Validated ${summary.total} marketing claims. ${summary.approved} approved.`,
    },
  }
}

export default async function ReportPage({ params }: ReportPageProps) {
  const { token } = await params
  const supabase = createServiceClient()
  
  // Fetch report
  const { data: report, error } = await supabase
    .from('compliance_reports')
    .select('*')
    .eq('token', token)
    .eq('is_public', true)
    .gt('expires_at', new Date().toISOString())
    .single()
  
  if (error || !report) {
    notFound()
  }
  
  // Increment view count (fire and forget)
  supabase.rpc('increment_report_views', { report_token: token }).then(() => {})
  
  const results = report.results as ClaimResult[]
  const summary = report.summary as {
    total: number
    approved: number
    needsProof: number
    blocked: number
    averageRiskScore: number
  }
  
  return (
    <div className="container max-w-4xl py-8 md:py-12 px-4 min-h-screen bg-background text-foreground">
      {/* Back Link */}
      <Link 
        href="/gate" 
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        Back to Compliance Gate
      </Link>
      
      {/* Header */}
      <div className="text-center mb-8">
        <Badge variant="secondary" className="mb-4">
          {report.industry.replace('_', ' ').toUpperCase()}
        </Badge>
        <h1 className="text-2xl md:text-3xl font-bold mb-2">
          Compliance Report
        </h1>
        <p className="text-muted-foreground">
          Generated {new Date(report.created_at).toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          })}
        </p>
      </div>
      
      {/* Score and Summary */}
      <Card className="mb-8">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <ScoreBadge score={summary.averageRiskScore} size="lg" />
            
            <div className="flex-1 w-full">
              <h3 className="text-lg font-semibold mb-4">Summary</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-3 rounded-lg bg-emerald-500/10">
                  <div className="text-2xl font-bold text-emerald-600">
                    {summary.approved}
                  </div>
                  <div className="text-xs text-muted-foreground">Approved</div>
                </div>
                
                <div className="text-center p-3 rounded-lg bg-amber-500/10">
                  <div className="text-2xl font-bold text-amber-500">
                    {summary.needsProof}
                  </div>
                  <div className="text-xs text-muted-foreground">Need Proof</div>
                </div>
                
                <div className="text-center p-3 rounded-lg bg-red-500/10">
                  <div className="text-2xl font-bold text-destructive">
                    {summary.blocked}
                  </div>
                  <div className="text-xs text-muted-foreground">Blocked</div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Actions */}
      <div className="flex flex-wrap gap-3 mb-8">
        <BadgeEmbedDialog score={summary.averageRiskScore} reportToken={token}>
          <Button variant="outline">
            <Code2 className="mr-2 h-4 w-4" />
            Embed Badge
          </Button>
        </BadgeEmbedDialog>
        
        <Button asChild className="bg-gradient-to-r from-violet-500 to-purple-600">
          <Link href="/signup?source=report">
            <Wand2 className="mr-2 h-4 w-4" />
            Generate Compliant Content
          </Link>
        </Button>
      </div>
      
      {/* Claims List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">
            Validated Claims ({results.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {results.map((claim, index) => (
              <ClaimCard 
                key={index}
                claim={claim} 
                index={index}
              />
            ))}
          </div>
        </CardContent>
      </Card>
      
      {/* CTA */}
      <Card className="mt-8 border-dashed border-2 border-primary/20 bg-primary/5">
        <CardContent className="p-6 text-center">
          <h3 className="font-semibold mb-2">
            Want to validate your own content?
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Try the Compliance Gate for free. No signup required.
          </p>
          <Button asChild>
            <Link href="/gate">Try Compliance Gate</Link>
          </Button>
        </CardContent>
      </Card>
      
      {/* Footer */}
      <p className="text-center text-xs text-muted-foreground mt-8">
        Report viewed {report.view_count} times • Expires in {getDaysUntil(report.expires_at)} days
      </p>
    </div>
  )
}

function getDaysUntil(dateStr: string): number {
  const now = new Date()
  const target = new Date(dateStr)
  const diff = target.getTime() - now.getTime()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}
