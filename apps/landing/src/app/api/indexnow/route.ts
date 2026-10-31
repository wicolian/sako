import { NextRequest, NextResponse } from 'next/server';

const INDEXNOW_KEY = process.env.INDEXNOW_KEY || '74c6f0a232914e46aeba9a5255a41eac';

export async function POST(request: NextRequest) {
  try {
    const { urlList } = await request.json();

    if (!urlList || !Array.isArray(urlList)) {
      return NextResponse.json({ error: 'urlList is required and must be an array' }, { status: 400 });
    }

    // Submit to IndexNow API
    const response = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        host: 'trysako.com',
        key: INDEXNOW_KEY,
        keyLocation: `https://trysako.com/${INDEXNOW_KEY}.txt`,
        urlList: urlList,
      }),
    });

    if (response.ok) {
      return NextResponse.json({
        success: true,
        message: `Submitted ${urlList.length} URLs to IndexNow`,
        submitted: urlList
      });
    } else {
      const errorText = await response.text();
      return NextResponse.json({
        error: `IndexNow API error: ${response.status}`,
        details: errorText
      }, { status: response.status });
    }
  } catch (error) {
    console.error('IndexNow submission error:', error);
    return NextResponse.json({ error: 'Failed to submit URLs to IndexNow' }, { status: 500 });
  }
}

// Optional: GET endpoint to check if IndexNow is working
export async function GET() {
  return NextResponse.json({
    status: 'IndexNow API ready',
    key: INDEXNOW_KEY,
    keyLocation: `https://trysako.com/${INDEXNOW_KEY}.txt`
  });
}