#!/usr/bin/env npx tsx
/**
 * Template Migration Script (Jan 2026)
 * 
 * Ingests the 206 HTML templates from the design folder into
 * the vector database for Template RAG.
 * 
 * Usage: npx tsx scripts/migrate-templates.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

// Configuration
const TEMPLATES_PATH = process.env.TEMPLATES_PATH || '/Users/kelashik/Downloads/designmax/aura_html_templates/html/';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const AI_GATEWAY_API_KEY = process.env.AI_GATEWAY_API_KEY!;

// Models (from ai-sdk-client per latest-models-only.mdc)
const EMBEDDING_MODEL = 'openai/text-embedding-3-small';
const FAST_MODEL = 'openai/gpt-5.3-chat';

interface TemplateSection {
  id: string;
  templateName: string;
  category: string;
  visualStyle: {
    theme: string;
    layout: string;
    density: string;
  };
  components: string[];
  suitableFor: string[];
  aestheticTags: string[];
  html: string;
  description: string;
  embedding: number[];
  sectionOrder: number;
}

async function main() {
  console.log('🚀 Template Migration Script');
  console.log('============================\n');
  
  // Validate environment
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Missing Supabase credentials. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
    process.exit(1);
  }
  
  if (!AI_GATEWAY_API_KEY) {
    console.error('❌ Missing AI_GATEWAY_API_KEY for embedding generation.');
    process.exit(1);
  }
  
  // Create Supabase client
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  
  // Find template files
  console.log(`📂 Scanning templates in: ${TEMPLATES_PATH}`);
  
  if (!fs.existsSync(TEMPLATES_PATH)) {
    console.error(`❌ Templates directory not found: ${TEMPLATES_PATH}`);
    process.exit(1);
  }
  
  const files = fs.readdirSync(TEMPLATES_PATH)
    .filter(f => f.endsWith('.html'))
    .sort();
  
  console.log(`📄 Found ${files.length} HTML templates\n`);
  
  if (files.length === 0) {
    console.log('No templates found. Exiting.');
    process.exit(0);
  }
  
  let processed = 0;
  let failed = 0;
  let sectionsCreated = 0;
  
  // Process each template
  for (const file of files) {
    const templatePath = path.join(TEMPLATES_PATH, file);
    const templateName = path.basename(file, '.html');
    
    console.log(`\n📝 Processing: ${templateName}`);
    
    try {
      const html = fs.readFileSync(templatePath, 'utf-8');
      
      // Extract sections
      const sections = extractSections(html);
      console.log(`   Found ${sections.length} sections`);
      
      // Extract design tokens
      const designTokens = extractDesignTokens(html);
      
      // Process each section
      for (const section of sections) {
        try {
          // Skip very small sections
          if (section.html.length < 200) {
            continue;
          }
          
          // Truncate HTML for AI analysis
          const truncatedHtml = section.html.slice(0, 4000);
          
          // Generate metadata using AI
          const metadata = await generateSectionMetadata(truncatedHtml, section.type, section.order, designTokens);
          
          // Generate embedding
          const embeddingText = buildEmbeddingText(metadata);
          const embedding = await generateEmbedding(embeddingText);
          
          // Create section ID
          const sectionId = `${templateName}-${metadata.category}-${section.order}`;
          
          // Upsert to database
          const { error } = await supabase
            .from('design_templates')
            .upsert({
              section_id: sectionId,
              template_name: templateName,
              category: metadata.category,
              visual_style: metadata.visualStyle,
              design_tokens: designTokens,
              components: metadata.components,
              suitable_for: metadata.suitableFor,
              aesthetic_tags: metadata.aestheticTags,
              html: section.html,
              description: metadata.semanticDescription,
              embedding: embedding,
              section_order: section.order,
              created_at: new Date().toISOString(),
            }, {
              onConflict: 'section_id',
            });
          
          if (error) {
            console.error(`   ❌ DB error for section ${section.order}:`, error.message);
          } else {
            sectionsCreated++;
            console.log(`   ✓ Section ${section.order}: ${metadata.category}`);
          }
        } catch (sectionError) {
          console.error(`   ❌ Section ${section.order} failed:`, sectionError);
        }
        
        // Rate limit
        await sleep(500);
      }
      
      processed++;
    } catch (error) {
      console.error(`   ❌ Template failed:`, error);
      failed++;
    }
  }
  
  // Summary
  console.log('\n============================');
  console.log('📊 Migration Summary');
  console.log('============================');
  console.log(`Templates processed: ${processed}`);
  console.log(`Templates failed: ${failed}`);
  console.log(`Sections created: ${sectionsCreated}`);
  console.log('============================\n');
}

/**
 * Extract sections from HTML
 */
function extractSections(html: string): Array<{ type: string; html: string; order: number }> {
  const sections: Array<{ type: string; html: string; order: number }> = [];
  
  // Match common section patterns
  const sectionPatterns = [
    /<section[^>]*>([\s\S]*?)<\/section>/gi,
    /<header[^>]*>([\s\S]*?)<\/header>/gi,
    /<footer[^>]*>([\s\S]*?)<\/footer>/gi,
    /<article[^>]*>([\s\S]*?)<\/article>/gi,
    /<main[^>]*>([\s\S]*?)<\/main>/gi,
  ];
  
  let order = 0;
  
  // Extract body content
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const bodyContent = bodyMatch ? bodyMatch[1] : html;
  
  // Try direct children of body first
  const directChildPattern = /<(section|header|footer|div|nav|main|article)[^>]*class="[^"]*"[^>]*>([\s\S]*?)<\/\1>/gi;
  let match;
  
  while ((match = directChildPattern.exec(bodyContent)) !== null) {
    const tagName = match[1];
    const content = match[0];
    
    // Determine type from class or tag
    let type = 'unknown';
    if (/hero|banner|splash|jumbotron/i.test(content)) type = 'hero';
    else if (/feature/i.test(content)) type = 'features';
    else if (/testimonial|review|quote/i.test(content)) type = 'testimonials';
    else if (/pricing|plan|package/i.test(content)) type = 'pricing';
    else if (/cta|call-to-action|signup/i.test(content)) type = 'cta';
    else if (/footer/i.test(content) || tagName === 'footer') type = 'footer';
    else if (/header|nav/i.test(content) || tagName === 'header' || tagName === 'nav') type = 'header';
    else if (/faq|accordion/i.test(content)) type = 'faq';
    else if (/logo|client|partner/i.test(content)) type = 'logos';
    else if (/stat|number|metric/i.test(content)) type = 'stats';
    else if (/team|people/i.test(content)) type = 'team';
    else if (/contact/i.test(content)) type = 'contact';
    else if (/about/i.test(content)) type = 'about';
    
    sections.push({
      type,
      html: content,
      order: order++,
    });
  }
  
  // If no sections found, try to split by major divs
  if (sections.length === 0) {
    const divPattern = /<div[^>]*class="[^"]*(?:section|container|wrapper)[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
    
    while ((match = divPattern.exec(bodyContent)) !== null) {
      sections.push({
        type: 'unknown',
        html: match[0],
        order: order++,
      });
    }
  }
  
  return sections;
}

/**
 * Extract design tokens from HTML/CSS
 */
function extractDesignTokens(html: string): Record<string, string[]> {
  const tokens: Record<string, string[]> = {
    colors: [],
    fonts: [],
    spacing: [],
  };
  
  // Extract colors
  const colorPattern = /#([0-9a-fA-F]{3,8})\b/g;
  const rgbPattern = /rgb\((\d+),\s*(\d+),\s*(\d+)\)/g;
  
  let match;
  const colors = new Set<string>();
  
  while ((match = colorPattern.exec(html)) !== null) {
    colors.add(`#${match[1].toLowerCase()}`);
  }
  
  while ((match = rgbPattern.exec(html)) !== null) {
    const r = parseInt(match[1]).toString(16).padStart(2, '0');
    const g = parseInt(match[2]).toString(16).padStart(2, '0');
    const b = parseInt(match[3]).toString(16).padStart(2, '0');
    colors.add(`#${r}${g}${b}`);
  }
  
  tokens.colors = Array.from(colors).slice(0, 10);
  
  // Extract fonts
  const fontPattern = /font-family:\s*["']?([^;'"]+)/gi;
  const fonts = new Set<string>();
  
  while ((match = fontPattern.exec(html)) !== null) {
    const fontList = match[1].split(',').map(f => f.trim().replace(/["']/g, ''));
    fontList.forEach(f => {
      if (!['sans-serif', 'serif', 'monospace', 'inherit'].includes(f.toLowerCase())) {
        fonts.add(f);
      }
    });
  }
  
  tokens.fonts = Array.from(fonts).slice(0, 5);
  
  return tokens;
}

/**
 * Generate section metadata using AI
 */
async function generateSectionMetadata(
  html: string,
  detectedType: string,
  order: number,
  designTokens: Record<string, string[]>
): Promise<{
  category: string;
  visualStyle: { theme: string; layout: string; density: string };
  components: string[];
  suitableFor: string[];
  aestheticTags: string[];
  semanticDescription: string;
}> {
  const prompt = `Analyze this HTML section and extract structured metadata.
Do NOT include any vendor/template names or branding - treat this as a generic design pattern.

Section HTML:
${html}

Template order: ${order} (0 = first section, likely hero/header)
Detected type: ${detectedType}

Available design tokens:
- Colors: ${designTokens.colors?.slice(0, 5).join(', ') || 'N/A'}
- Fonts: ${designTokens.fonts?.slice(0, 3).join(', ') || 'N/A'}

Respond in JSON with:
{
  "category": "hero|features|testimonials|pricing|cta|footer|header|faq|logos|stats|team|contact|about|gallery|unknown",
  "visualStyle": {
    "theme": "light|dark|gradient|colorful",
    "layout": "centered|split|grid|asymmetric",
    "density": "minimal|balanced|dense"
  },
  "components": ["list of UI components used like buttons, cards, icons, images"],
  "suitableFor": ["industries or use cases this is good for"],
  "aestheticTags": ["style tags like modern, futuristic, elegant, minimal"],
  "semanticDescription": "A detailed description for similarity search focusing on visual style not content"
}`;

  const response = await fetch('https://ai-gateway.vercel.sh/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${AI_GATEWAY_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'openai/gpt-5.3-chat',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    // Fallback to basic metadata
    return {
      category: detectedType || 'unknown',
      visualStyle: { theme: 'light', layout: 'centered', density: 'balanced' },
      components: ['text', 'container'],
      suitableFor: ['general'],
      aestheticTags: ['modern'],
      semanticDescription: `A ${detectedType} section`,
    };
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;
  
  try {
    return JSON.parse(content);
  } catch {
    return {
      category: detectedType || 'unknown',
      visualStyle: { theme: 'light', layout: 'centered', density: 'balanced' },
      components: ['text', 'container'],
      suitableFor: ['general'],
      aestheticTags: ['modern'],
      semanticDescription: `A ${detectedType} section`,
    };
  }
}

/**
 * Build embedding text from metadata
 */
function buildEmbeddingText(metadata: {
  category: string;
  visualStyle: { theme: string; layout: string; density: string };
  components: string[];
  suitableFor: string[];
  aestheticTags: string[];
  semanticDescription: string;
}): string {
  return `${metadata.category} section with ${metadata.visualStyle.theme} theme, ${metadata.visualStyle.layout} layout. 
${metadata.semanticDescription}. 
Suitable for: ${metadata.suitableFor.join(', ')}. 
Style: ${metadata.aestheticTags.join(', ')}.
Components: ${metadata.components.join(', ')}.`;
}

/**
 * Generate embedding using AI Gateway
 */
async function generateEmbedding(text: string): Promise<number[]> {
  const response = await fetch('https://ai-gateway.vercel.sh/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${AI_GATEWAY_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'openai/text-embedding-3-small',
      input: text,
    }),
  });

  if (!response.ok) {
    throw new Error(`Embedding API error: ${response.status}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

/**
 * Sleep for rate limiting
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Run
main().catch(console.error);
