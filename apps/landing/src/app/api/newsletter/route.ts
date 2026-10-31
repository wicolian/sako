import { NextResponse } from 'next/server';
import { brevoConfig } from '@/config/brevo';

const BREVO_API = 'https://api.brevo.com/v3';

export async function POST(request: Request) {
  if (!brevoConfig.apiKey || !brevoConfig.newsletterListId) {
    return NextResponse.json(
      { error: 'Newsletter not configured' },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const email = typeof body?.email === 'string' ? body.email.trim() : '';

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: 'Valid email required' },
        { status: 400 }
      );
    }

    const attributes: Record<string, string> = {};
    const utmSource = typeof body?.utm_source === 'string' ? body.utm_source : '';
    const utmMedium = typeof body?.utm_medium === 'string' ? body.utm_medium : '';
    const utmCampaign = typeof body?.utm_campaign === 'string' ? body.utm_campaign : '';
    const utmContent = typeof body?.utm_content === 'string' ? body.utm_content : '';
    const utmTerm = typeof body?.utm_term === 'string' ? body.utm_term : '';
    if (utmSource) attributes.UTM_SOURCE = utmSource;
    if (utmMedium) attributes.UTM_MEDIUM = utmMedium;
    if (utmCampaign) attributes.UTM_CAMPAIGN = utmCampaign;
    if (utmContent) attributes.UTM_CONTENT = utmContent;
    if (utmTerm) attributes.UTM_TERM = utmTerm;

    const res = await fetch(`${BREVO_API}/contacts`, {
      method: 'POST',
      headers: {
        'api-key': brevoConfig.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        listIds: [brevoConfig.newsletterListId],
        updateEnabled: true,
        ...(Object.keys(attributes).length > 0 && { attributes }),
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      if (res.status === 400 && data?.code === 'duplicate_parameter') {
        return NextResponse.json({ success: true });
      }
      return NextResponse.json(
        { error: data?.message || 'Subscription failed' },
        { status: res.status }
      );
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('[newsletter]', e);
    return NextResponse.json(
      { error: 'Subscription failed' },
      { status: 500 }
    );
  }
}
