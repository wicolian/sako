/**
 * Playground Generation API (Jan 2026)
 * 
 * Generates landing page sections using AI.
 * Returns clean HTML without markdown wrappers.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient as createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { generateText } from '@/lib/ai/langsmith-ai';
import { MODELS } from '@/lib/ai/ai-sdk-client';
import { z } from 'zod';

const DesignDirectionSchema = z.enum(['auto', 'trust', 'product', 'editorial', 'technical', 'conversion']);

const GenerateSectionSchema = z.object({
  sectionType: z.string(),
  brief: z.string(),
  brandId: z.string().optional(),
  designDirection: DesignDirectionSchema.optional(),
  style: z.object({
    theme: z.enum(['dark', 'light', 'gradient', 'glass']).optional(),
    layout: z.enum(['centered', 'split', 'grid', 'asymmetric', 'stacked']).optional(),
  }).optional(),
});

const GeneratePageSchema = z.object({
  brief: z.string(),
  industry: z.string().optional(),
  brandId: z.string().optional(),
  workspaceId: z.string(),
  designDirection: DesignDirectionSchema.optional(),
  sections: z.array(z.string()).optional(),
  style: z.object({
    theme: z.enum(['dark', 'light', 'gradient', 'glass']).optional(),
    layout: z.enum(['centered', 'split', 'grid', 'asymmetric', 'stacked']).optional(),
  }).optional(),
});

const SaveDesignSchema = z.object({
  name: z.string(),
  html: z.string(),
  sections: z.array(z.object({
    type: z.string(),
    html: z.string(),
  })),
  workspaceId: z.string(),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const action = body.action as 'section' | 'page' | 'search' | 'save';

    switch (action) {
      case 'section': {
        const parsed = GenerateSectionSchema.safeParse(body);
        if (!parsed.success) {
          return NextResponse.json({ error: 'Invalid input', details: parsed.error.errors }, { status: 400 });
        }
        
        const result = await generateSectionDirect(
          parsed.data.sectionType,
          parsed.data.brief,
          parsed.data.style,
          parsed.data.designDirection,
        );
        return NextResponse.json(result);
      }

      case 'page': {
        const parsed = GeneratePageSchema.safeParse(body);
        if (!parsed.success) {
          return NextResponse.json({ error: 'Invalid input', details: parsed.error.errors }, { status: 400 });
        }
        
        const result = await generateFullPageDirect(
          parsed.data.brief,
          parsed.data.sections || ['hero', 'features', 'testimonials', 'cta'],
          parsed.data.style,
          parsed.data.industry,
          parsed.data.designDirection,
        );
        return NextResponse.json(result);
      }

      case 'save': {
        const parsed = SaveDesignSchema.safeParse(body);
        if (!parsed.success) {
          return NextResponse.json({ error: 'Invalid input', details: parsed.error.errors }, { status: 400 });
        }
        
        const serviceClient = createServiceClient();
        const { data, error } = await serviceClient
          .from('designs')
          .insert({
            name: parsed.data.name,
            html: parsed.data.html,
            sections: parsed.data.sections,
            workspace_id: parsed.data.workspaceId,
            created_by: user.id,
            status: 'draft',
          })
          .select()
          .single();
        
        if (error) {
          console.error('Save design error:', error);
          return NextResponse.json({ error: 'Failed to save design', details: error.message }, { status: 500 });
        }
        
        return NextResponse.json({ success: true, design: data });
      }

      case 'search': {
        return NextResponse.json({ templates: [] });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Playground generation error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to generate content', details: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * Clean HTML output - remove markdown code blocks if AI wraps them
 */
function cleanHtmlOutput(text: string): string {
  let html = text.trim();
  
  // Remove markdown code block wrappers
  html = html.replace(/^```html\s*/i, '');
  html = html.replace(/^```\s*/i, '');
  html = html.replace(/\s*```$/i, '');
  
  // If still wrapped in multiple code blocks, extract sections
  if (html.includes('```html')) {
    const sections = html.match(/```html\s*([\s\S]*?)```/gi);
    if (sections) {
      html = sections.map(s => s.replace(/```html\s*/gi, '').replace(/```/g, '')).join('\n');
    }
  }
  
  return html.trim();
}

/**
 * Generate a single section using direct AI generation
 */
async function generateSectionDirect(
  sectionType: string,
  brief: string,
  style?: { theme?: string; layout?: string },
  designDirection: z.infer<typeof DesignDirectionSchema> = 'auto',
): Promise<{ html: string; claims: string[]; headline: string; subheadline: string }> {
  const theme = style?.theme || 'light';
  const layout = style?.layout || 'centered';
  
  const { text } = await generateText({
    model: MODELS.CREATIVE,
    system: `You are an expert landing page designer. Generate restrained, conversion-focused HTML sections.

CRITICAL OUTPUT RULES:
- Return ONLY raw HTML code
- DO NOT wrap in markdown code blocks (no \`\`\`html or \`\`\`)
- DO NOT include explanations, comments, or text outside HTML
- Start directly with <section> or the first HTML tag
- End with the closing tag, nothing after

DESIGN RULES:
- Use Tailwind CSS classes for all styling
- Create brand-fit, restrained designs
- Ensure mobile responsiveness with responsive classes
- Make text highly readable with good contrast
- Prefer plain or lightly tinted backgrounds
- Use animation only when it communicates state or hierarchy
- Do NOT use cursor-follow effects, scroll-jacking, hover-scale gimmicks, glassmorphism, emoji filler, fake dashboard chrome, or decorative gradients

THEME: ${theme}
LAYOUT: ${layout}
DIRECTION: ${designDirection}`,
    prompt: `Generate a ${sectionType} section for a landing page.

Brief: ${brief}

${getSectionGuidelines(sectionType)}

IMPORTANT: Output ONLY the raw HTML. No markdown, no code blocks, no explanations. Start with <section and end with </section>.`,
  });

  const html = cleanHtmlOutput(text);
  const claims = extractClaims(html);
  const headline = extractHeadline(html);
  const subheadline = extractSubheadline(html);

  return { html, claims, headline, subheadline };
}

/**
 * Generate a full landing page with multiple sections
 */
async function generateFullPageDirect(
  brief: string,
  sections: string[],
  style?: { theme?: string; layout?: string },
  industry?: string,
  designDirection: z.infer<typeof DesignDirectionSchema> = 'auto',
): Promise<{
  html: string;
  sections: Array<{ type: string; html: string; headline: string; subheadline: string }>;
  claims: string[];
}> {
  const theme = style?.theme || 'light';
  const layout = style?.layout || 'centered';
  
  const generatedSections: Array<{ type: string; html: string; headline: string; subheadline: string }> = [];
  const allClaims: string[] = [];

  // Generate each section
  for (const sectionType of sections) {
    const sectionBrief = `${brief}${industry ? ` for ${industry} industry` : ''}`;
    
    const result = await generateSectionDirect(
      sectionType,
      sectionBrief,
      { theme, layout },
      designDirection,
    );
    
    generatedSections.push({ 
      type: sectionType, 
      html: result.html,
      headline: result.headline,
      subheadline: result.subheadline,
    });
    allClaims.push(...result.claims);
  }

  // Combine all sections into full page HTML
  const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Landing Page</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="${theme === 'dark' ? 'bg-slate-950 text-slate-50' : 'bg-card text-zinc-900'}">
${generatedSections.map(s => s.html).join('\n\n')}
</body>
</html>`;

  return {
    html: fullHtml,
    sections: generatedSections,
    claims: [...new Set(allClaims)],
  };
}

/**
 * Get section-specific guidelines for better generation
 */
function getSectionGuidelines(sectionType: string): string {
  const guidelines: Record<string, string> = {
    hero: `HERO SECTION REQUIREMENTS:
- Use <section class="min-h-[80vh] ...">
- Large, bold headline (text-4xl md:text-6xl font-bold)
- Supporting subheadline (text-lg md:text-xl opacity-80)
- Primary CTA button with strong contrast
- Use a product, proof, or visual anchor when relevant
- Avoid decorative motion and gradients unless clearly justified`,

    features: `FEATURES SECTION REQUIREMENTS:
- Use <section class="py-20 ...">
- Section headline and subheadline
- 3-6 feature cards in a responsive grid (grid-cols-1 md:grid-cols-2 lg:grid-cols-3)
- Each feature has title and description
- Use simple cards or lists; avoid decorative hover effects`,

    testimonials: `TESTIMONIALS SECTION REQUIREMENTS:
- Use <section class="py-20 ...">
- Section headline
- 2-3 testimonial cards with quote, author name, title, company
- Use quotation marks or icons
- Star ratings with SVG stars
- Avatar circles with initials`,

    pricing: `PRICING SECTION REQUIREMENTS:
- Use <section class="py-20 ...">
- Section headline and subheadline
- 2-4 pricing tiers in responsive cards
- Highlight "most popular" tier with border/badge
- List features with checkmark SVGs
- CTA button for each tier`,

    cta: `CTA SECTION REQUIREMENTS:
- Use <section class="py-20 ...">
- Compelling headline
- Brief supporting text
- Large, prominent CTA button
- Use simple background treatment with strong contrast`,

    faq: `FAQ SECTION REQUIREMENTS:
- Use <section class="py-20 ...">
- Section headline
- 4-6 question/answer pairs
- Simple list with clear spacing
- Bold questions, regular answers`,

    stats: `STATS SECTION REQUIREMENTS:
- Use <section class="py-16 ...">
- 3-4 impressive statistics with large text
- Supporting labels for each stat
- Horizontal layout on desktop`,

    logos: `LOGOS SECTION REQUIREMENTS:
- Use <section class="py-16 ...">
- "Trusted by" headline
- 4-6 placeholder logo boxes with company names
- Grayscale/opacity effect`,
  };

  return guidelines[sectionType] || `Generate a ${sectionType} section with appropriate content and styling.`;
}

/**
 * Extract headline from HTML
 */
function extractHeadline(html: string): string {
  const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  const h2Match = html.match(/<h2[^>]*>([^<]+)<\/h2>/i);
  const spanMatch = html.match(/<span[^>]*class="[^"]*text-(?:4xl|5xl|6xl|7xl)[^"]*"[^>]*>([^<]+)<\/span>/i);
  
  const match = h1Match || h2Match || spanMatch;
  if (match) {
    return match[1].trim().slice(0, 100);
  }
  return 'New Section';
}

/**
 * Extract subheadline from HTML  
 */
function extractSubheadline(html: string): string {
  const pMatch = html.match(/<p[^>]*class="[^"]*(?:text-lg|text-xl|opacity|text-muted)[^"]*"[^>]*>([^<]+)<\/p>/i);
  if (pMatch) {
    return pMatch[1].trim().slice(0, 200);
  }
  return '';
}

/**
 * Extract potential marketing claims from generated HTML
 */
function extractClaims(html: string): string[] {
  const claims: string[] = [];
  const claimPatterns = [
    /(?:increase|boost|improve|reduce|save|grow)\s+(?:by\s+)?\d+%/gi,
    /\d+x\s+(?:faster|better|more|stronger)/gi,
    /#1\s+(?:in|for|rated)/gi,
    /guaranteed\s+[\w\s]+/gi,
    /proven\s+(?:to|results)/gi,
    /trusted\s+by\s+[\d,]+/gi,
    /\d+\+?\s+(?:companies|customers|users|businesses)/gi,
  ];

  const textContent = html.replace(/<[^>]+>/g, ' ');
  claimPatterns.forEach((pattern) => {
    const matches = textContent.match(pattern);
    if (matches) claims.push(...matches);
  });

  return [...new Set(claims)];
}
