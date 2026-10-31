/**
 * Dynamic Badge SVG Generator
 * 
 * Generates an SVG badge for embedding on external websites.
 * Cached at edge for performance.
 */

import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

// Cache badge for 1 hour
export const revalidate = 3600

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  
  // In a real implementation, we would look up the report by token
  // For now, extract score from query param or use default
  const { searchParams } = new URL(request.url)
  const scoreParam = searchParams.get('score')
  const score = scoreParam ? parseInt(scoreParam, 10) : 85
  
  const complianceScore = Math.max(0, Math.min(100, score))
  
  // Determine color based on score
  let color = '#10b981' // emerald
  let bgColor = '#10b98120'
  let label = 'Excellent'
  
  if (complianceScore < 80) {
    color = '#f59e0b' // amber
    bgColor = '#f59e0b20'
    label = 'Good'
  }
  if (complianceScore < 50) {
    color = '#ef4444' // red
    bgColor = '#ef444420'
    label = 'Needs Work'
  }
  
  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          padding: '6px 12px',
          borderRadius: '9999px',
          backgroundColor: '#ffffff',
          border: '1px solid #e5e7eb',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        {/* Check icon */}
        <svg
          width="18"
          height="18"
          viewBox="0 0 20 20"
          fill="none"
          style={{ flexShrink: 0 }}
        >
          <circle cx="10" cy="10" r="9" stroke={color} strokeWidth="2" fill={bgColor} />
          <path
            d="M6 10L9 13L14 7"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        
        {/* Text */}
        <span
          style={{
            fontSize: '13px',
            fontWeight: 500,
            color: '#374151',
          }}
        >
          Verified by Sako
        </span>
        
        {/* Score badge */}
        <span
          style={{
            fontSize: '11px',
            fontWeight: 600,
            padding: '2px 6px',
            borderRadius: '4px',
            backgroundColor: bgColor,
            color: color,
          }}
        >
          {complianceScore}
        </span>
      </div>
    ),
    {
      width: 200,
      height: 32,
    }
  )
}
