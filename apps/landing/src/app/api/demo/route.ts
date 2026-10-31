import { NextResponse } from 'next/server';
import { brevoConfig } from '@/config/brevo';

const BREVO_API = 'https://api.brevo.com/v3';

export async function POST(request: Request) {
  if (!brevoConfig.apiKey || !brevoConfig.demoListId) {
    return NextResponse.json(
      { error: 'Demo request not configured' },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const email = typeof body?.email === 'string' ? body.email.trim() : '';
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const company = typeof body?.company === 'string' ? body.company.trim() : '';
    const companySize = typeof body?.company_size === 'string' ? body.company_size.trim() : '';
    const primaryNeed = typeof body?.primary_need === 'string' ? body.primary_need.trim() : '';
    const planInterest = typeof body?.plan_interest === 'string' ? body.plan_interest.trim() : '';

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: 'Valid email required' },
        { status: 400 }
      );
    }

    if (!name || name.length < 2) {
      return NextResponse.json(
        { error: 'Name required' },
        { status: 400 }
      );
    }

    const [firstName, ...rest] = name.split(/\s+/);
    const lastName = rest.join(' ') || '';

    const attributes: Record<string, string> = {
      FIRSTNAME: firstName,
      LASTNAME: lastName,
      EMAIL: email,
    };
    if (company) attributes.COMPANY = company;
    if (companySize) attributes.COMPANY_SIZE = companySize;
    if (primaryNeed) attributes.PRIMARY_NEED = primaryNeed;
    if (planInterest) attributes.PLAN_INTEREST = planInterest;

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
        attributes,
        listIds: [brevoConfig.demoListId],
        updateEnabled: true,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return NextResponse.json(
        { error: data?.message || 'Request failed' },
        { status: res.status }
      );
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('[demo]', e);
    return NextResponse.json(
      { error: 'Request failed' },
      { status: 500 }
    );
  }
}
