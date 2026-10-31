import { NextResponse } from 'next/server';
import { getSessionCookie, verifySession } from '@/lib/auth';

export async function GET() {
  try {
    const token = await getSessionCookie();
    
    if (!token) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    const isValid = await verifySession(token);
    
    if (!isValid) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    return NextResponse.json({ authenticated: true });
  } catch (error) {
    console.error('Auth status check error:', error);
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
}
