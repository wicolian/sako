import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');

    if (!key) {
      return NextResponse.json({ error: 'Missing key parameter' }, { status: 400 });
    }

    const input = await db.wallManualInput.findUnique({
      where: { key },
    });

    if (!input) {
      return NextResponse.json({ value: null, updatedAt: null });
    }

    return NextResponse.json({
      value: input.valueJson,
      updatedAt: input.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error('Manual input GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch manual input' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { key, value } = await request.json();

    if (!key || value === undefined) {
      return NextResponse.json(
        { error: 'Missing key or value' },
        { status: 400 }
      );
    }

    await db.wallManualInput.upsert({
      where: { key },
      update: {
        valueJson: value,
        updatedAt: new Date(),
      },
      create: {
        key,
        valueJson: value,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Manual input POST error:', error);
    return NextResponse.json(
      { error: 'Failed to save manual input' },
      { status: 500 }
    );
  }
}
