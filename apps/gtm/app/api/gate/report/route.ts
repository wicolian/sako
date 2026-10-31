/**
 * Gate Report API - Create shareable compliance reports
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getClientIp } from '@/lib/gate/rate-limiter'
import crypto from 'crypto'

interface CreateReportRequest {
  originalText: string
  industry: string
  results: Array<{
    text: string
    status: string
    riskScore: number
    issues: string[]
    suggestion?: string
  }>
  summary: {
    total: number
    approved: number
    needsProof: number
    blocked: number
    averageRiskScore: number
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: CreateReportRequest = await request.json()
    const { originalText, industry, results, summary } = body
    
    if (!originalText || !results || !summary) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }
    
    const supabase = createServiceClient()
    
    // Hash IP for privacy
    const clientIp = getClientIp(request.headers)
    const ipHash = crypto.createHash('sha256').update(clientIp).digest('hex').slice(0, 16)
    
    // Calculate compliance score (inverse of risk)
    const complianceScore = Math.max(0, 100 - summary.averageRiskScore)
    
    // Create report
    const { data: report, error } = await supabase
      .from('compliance_reports')
      .insert({
        original_text: originalText,
        industry,
        results: results,
        summary: summary,
        compliance_score: complianceScore,
        average_risk_score: summary.averageRiskScore,
        ip_hash: ipHash,
        user_agent: request.headers.get('user-agent'),
      })
      .select('token, compliance_score')
      .single()
    
    if (error) {
      console.error('Failed to create report:', error)
      return NextResponse.json(
        { error: 'Failed to create report' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      success: true,
      token: report.token,
      url: `/gate/report/${report.token}`,
      score: report.compliance_score,
    })
    
  } catch (error) {
    console.error('Report creation error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
