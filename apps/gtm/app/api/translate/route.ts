/**
 * Translation API
 * 
 * POST /api/translate - Translate content
 * GET /api/translate/languages - Get supported languages
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { translateContent, translateCampaignContent, detectLanguage, SUPPORTED_LANGUAGES } from '@/lib/ai/multi-language';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { text, content, targetLanguage, sourceLanguage, industry, tone, glossary, preservePlaceholders } = body;

    // Validate target language
    const targetLang = SUPPORTED_LANGUAGES.find(l => l.code === targetLanguage);
    if (!targetLang) {
      return NextResponse.json(
        { error: `Unsupported target language: ${targetLanguage}` },
        { status: 400 }
      );
    }

    // If content object is provided, use bulk translation
    if (content && typeof content === 'object') {
      const result = await translateCampaignContent(content, targetLanguage, {
        sourceLanguage,
        industry,
        tone,
        glossary,
      });

      return NextResponse.json({
        success: true,
        targetLanguage,
        targetLanguageName: targetLang.name,
        direction: targetLang.direction,
        translations: result,
      });
    }

    // Single text translation
    if (text && typeof text === 'string') {
      const result = await translateContent(text, targetLanguage, {
        sourceLanguage,
        industry,
        tone,
        glossary,
        preservePlaceholders,
      });

      return NextResponse.json({
        success: true,
        ...result,
        targetLanguageName: targetLang.name,
        direction: targetLang.direction,
      });
    }

    return NextResponse.json(
      { error: 'Either text or content is required' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Translation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Translation failed' },
      { status: 500 }
    );
  }
}

export async function GET() {
  // Return supported languages grouped by tier
  const byTier = {
    premium: SUPPORTED_LANGUAGES.filter(l => l.tier === 'premium'),
    standard: SUPPORTED_LANGUAGES.filter(l => l.tier === 'standard'),
    beta: SUPPORTED_LANGUAGES.filter(l => l.tier === 'beta'),
  };

  return NextResponse.json({
    languages: SUPPORTED_LANGUAGES,
    byTier,
    total: SUPPORTED_LANGUAGES.length,
    rtlLanguages: SUPPORTED_LANGUAGES.filter(l => l.direction === 'rtl').map(l => l.code),
  });
}
