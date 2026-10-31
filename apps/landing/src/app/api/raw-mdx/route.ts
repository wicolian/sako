import { NextRequest, NextResponse } from 'next/server';
import { getPageBySlug } from '@/lib/mdx';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const slug = searchParams.get('slug') || '';

  try {
    const page = await getPageBySlug(slug);
    
    if (!page) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }

    return NextResponse.json({
      content: page.content || '',
      title: page.frontmatter?.title || 'Sako',
      description: page.frontmatter?.seo?.metaDescription || '',
    });
  } catch (error) {
    console.error('Error fetching raw MDX:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

