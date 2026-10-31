import { NextRequest, NextResponse } from 'next/server';
import { fetchAllMetrics } from '@/lib/aggregator';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const segment = searchParams.get('segment') || 'all';
    const mode = searchParams.get('mode') || 'internal';
    const investorMode = mode === 'investor';

    const data = await fetchAllMetrics(segment, investorMode);

    return NextResponse.json(data);
  } catch (error) {
    console.error('Summary API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch metrics' },
      { status: 500 }
    );
  }
}
