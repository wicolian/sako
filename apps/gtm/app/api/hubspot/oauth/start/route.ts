import { NextRequest, NextResponse } from 'next/server'

const HUBSPOT_CLIENT_ID = process.env.HUBSPOT_CLIENT_ID
const HUBSPOT_REDIRECT_URI = process.env.HUBSPOT_REDIRECT_URI || 'http://localhost:3000/api/hubspot/oauth/callback'

const SCOPES = [
  'crm.objects.contacts.read',
  'crm.objects.contacts.write',
  'forms',
  'content',
]

export async function GET(request: NextRequest) {
  if (!HUBSPOT_CLIENT_ID) {
    return NextResponse.redirect(new URL('/settings?error=hubspot_not_configured', request.url))
  }

  const authUrl = new URL('https://app.hubspot.com/oauth/authorize')
  authUrl.searchParams.set('client_id', HUBSPOT_CLIENT_ID)
  authUrl.searchParams.set('redirect_uri', HUBSPOT_REDIRECT_URI)
  authUrl.searchParams.set('scope', SCOPES.join(' '))

  return NextResponse.redirect(authUrl.toString())
}
