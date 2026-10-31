/**
 * ALB Liveness Check Endpoint
 * 
 * Simple, fast endpoint for AWS Application Load Balancer health checks.
 * Returns 200 OK if the server is running - no auth, no DB calls.
 */

export async function GET() {
  return Response.json(
    {
      status: 'healthy',
      timestamp: Date.now(),
      version: process.env.npm_package_version || '1.0.0',
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    }
  )
}

// Also support HEAD requests for lighter health checks
export async function HEAD() {
  return new Response(null, { status: 200 })
}
