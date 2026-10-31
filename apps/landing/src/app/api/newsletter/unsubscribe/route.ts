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

    const encodedEmail = encodeURIComponent(email);

    const res = await fetch(
      `${BREVO_API}/contacts/${encodedEmail}?identifierType=email_id`,
      {
        method: 'PUT',
        headers: {
          'api-key': brevoConfig.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          unlinkListIds: [brevoConfig.newsletterListId],
          emailBlacklisted: true,
        }),
      }
    );

    if (res.status === 204) {
      return NextResponse.json({ success: true });
    }

    const data = await res.json().catch(() => ({}));

    if (res.status === 404) {
      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: data?.message || 'Unsubscribe failed' },
      { status: res.status }
    );
  } catch (e) {
    console.error('[newsletter unsubscribe]', e);
    return NextResponse.json(
      { error: 'Unsubscribe failed' },
      { status: 500 }
    );
  }
}
