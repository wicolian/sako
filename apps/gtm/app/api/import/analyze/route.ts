/**
 * URL Import & Analysis API (Jan 2026)
 * 
 * Single endpoint that orchestrates the entire import flow:
 * URL fetch → Parse → Extract brand → Extract claims → Research evidence → Link evidence
 * 
 * Returns streaming progress updates.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getWorkspaceIdWithFallback } from '@/lib/workspace';
import { smartFetch, isValidUrl, normalizeUrl } from '@/lib/import/url-fetcher';
import { parseHtml, type ParsedPage } from '@/lib/import/html-parser';
import { extractDesignTokens, type DesignTokens } from '@/lib/import/design-extractor';
import { analyzeBrand, extractBrandNameQuick, brandAnalysisToBrandContext, type BrandAnalysis } from '@/lib/import/brand-extractor';
import { extractClaims, type ExtractedClaim } from '@/lib/import/claims-extractor';
import { researchAllClaims, getEvidenceSummary, isTavilyReachable, type EvidenceCandidate } from '@/lib/import/evidence-researcher';
import { autoLinkEvidence, getLinkingSummary, calculateComplianceScore, type LinkedEvidence } from '@/lib/import/evidence-linker';
import { extractCanonicalDomain, fetchBrandfetchMetadata, type BrandfetchMetadata } from '@/lib/import/brandfetch';
import type { StreamEvent, ImportRequest, ImportResult } from './import-types';

export const runtime = 'nodejs';
export const maxDuration = 120; // 2 minutes max

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const workspaceId = getWorkspaceIdWithFallback(req);
    if (!workspaceId) {
      return NextResponse.json({ error: 'No workspace' }, { status: 400 });
    }
    
    const body: ImportRequest = await req.json();
    
    if (!body.url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }
    
    if (!body.confirmOwnership) {
      return NextResponse.json({ error: 'You must confirm ownership of the content' }, { status: 400 });
    }
    
    // Normalize URL
    const url = normalizeUrl(body.url);
    
    if (!isValidUrl(url)) {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
    }
    
    // Create streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        let closed = false
        let terminalSent = false

        const close = () => {
          if (!closed) {
            closed = true
            controller.close()
          }
        }

        const send = (event: StreamEvent) => {
          if (closed || terminalSent) return
          if (event.event === 'error' || event.event === 'complete') {
            terminalSent = true
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        };
        
        try {
          const canonicalDomain = extractCanonicalDomain(url)

          // Stage 1: Brandfetch metadata (12%)
          send({ event: 'progress', stage: 'brand_metadata', progress: 12, message: 'Looking up brand metadata...' });
          let brandfetchMetadata: BrandfetchMetadata | null = null

          try {
            brandfetchMetadata = await fetchBrandfetchMetadata(url)
          } catch (error) {
            console.warn('Brandfetch lookup failed:', error)
          }

          send({
            event: 'progress',
            stage: 'brand_metadata',
            progress: 20,
            message: brandfetchMetadata
              ? `Brandfetch returned metadata for ${brandfetchMetadata.name || canonicalDomain}.`
              : 'Brandfetch metadata unavailable, falling back to page analysis.',
            partialData: {
              sourceUrl: url,
              brand: brandfetchMetadata
                ? {
                    name: brandfetchMetadata.name || canonicalDomain,
                    tagline: brandfetchMetadata.description || 'Brand metadata imported.',
                  }
                : {
                    name: canonicalDomain,
                    tagline: 'Scanning live page content…',
                  },
              metadataSource: brandfetchMetadata ? 'brandfetch' : 'html_ai',
            },
          })

          // Stage 2: Fetch URL (28%)
          send({ event: 'progress', stage: 'fetching', progress: 28, message: 'Fetching page...' });
          
          const fetchResult = await smartFetch(url);

          if (fetchResult.error) {
            send({ event: 'error', error: fetchResult.error, stage: 'fetching' });
            close();
            return;
          }
          
          // Stage 3: Parse HTML (36%)
          send({ event: 'progress', stage: 'parsing', progress: 36, message: 'Parsing HTML...' });
          
          const parsedPage = parseHtml(fetchResult.html, fetchResult.url);
          const quickBrandPreview = {
            name: brandfetchMetadata?.name || extractBrandNameQuick(parsedPage),
            tagline: brandfetchMetadata?.description || parsedPage.description || 'Scanning live page content…',
          };
          
          // Only fail if we have NO content at all (not even title/description)
          const hasAnyContent = 
            parsedPage.sections.length > 0 ||
            parsedPage.textContent.length > 20 ||
            parsedPage.title.length > 0 ||
            parsedPage.description.length > 0;
          
          if (!hasAnyContent) {
            console.error('Parse failed: no content found', { 
              htmlLength: fetchResult.html.length,
              sections: parsedPage.sections.length,
              textLength: parsedPage.textContent.length,
              title: parsedPage.title,
            });
            
            send({ 
              event: 'error', 
              error: 'Could not extract any content from this page. The page may be blocked, empty, or require authentication.', 
              stage: 'parsing' 
            });
            close();
            return;
          }
          
          // Log what we extracted for debugging
          console.log('Parse success:', {
            sections: parsedPage.sections.length,
            textLength: parsedPage.textContent.length,
            title: parsedPage.title,
            hasDescription: !!parsedPage.description,
            ogTags: Object.keys(parsedPage.ogTags).length,
          });

          send({
            event: 'progress',
            stage: 'parsing',
            progress: 40,
            message: `Parsed ${parsedPage.sections.length} page sections and extracted the main copy.`,
            partialData: {
              sourceUrl: url,
              brand: quickBrandPreview,
              metadataSource: brandfetchMetadata ? 'brandfetch' : 'html_ai',
            },
          });
          
          // Stage 4: Extract design tokens (48%)
          send({ event: 'progress', stage: 'extracting_design', progress: 44, message: 'Extracting design tokens...' });
          
          const extractedDesignTokens = extractDesignTokens(fetchResult.html);
          const designTokens = mergeDesignTokens(extractedDesignTokens, brandfetchMetadata)
          send({
            event: 'progress',
            stage: 'extracting_design',
            progress: 48,
            message: brandfetchMetadata
              ? 'Captured page tokens and blended them with Brandfetch metadata.'
              : 'Captured the page palette and typography.',
            partialData: {
              sourceUrl: url,
              brand: quickBrandPreview,
              designTokens,
              metadataSource: brandfetchMetadata ? 'brandfetch' : 'html_ai',
            },
          })
          
          // Stage 5: Analyze brand (62%)
          send({ event: 'progress', stage: 'extracting_brand', progress: 54, message: 'Synthesizing brand context from page copy...' });
          
          const aiBrandAnalysis = await analyzeBrand(parsedPage, designTokens, fetchResult.url);
          const brandAnalysis = mergeBrandAnalysis(aiBrandAnalysis, brandfetchMetadata, canonicalDomain)
          send({
            event: 'progress',
            stage: 'extracting_brand',
            progress: 62,
            message: `Mapped brand voice, audience, and value props for ${brandAnalysis.name || quickBrandPreview.name}.`,
            partialData: {
              sourceUrl: url,
              brand: brandAnalysis,
              designTokens,
              metadataSource: brandfetchMetadata ? 'brandfetch' : 'html_ai',
            },
          })
          
          // Get company context for evidence research
          const companyContext = {
            name: brandAnalysis.name || extractBrandNameQuick(parsedPage),
            domain: canonicalDomain,
            industry: brandAnalysis.industry,
          };
          
          // Stage 6: Extract claims (72%)
          send({ event: 'progress', stage: 'detecting_claims', progress: 66, message: 'Detecting marketing claims...' });
          
          const claims = await extractClaims(parsedPage);
          send({
            event: 'progress',
            stage: 'detecting_claims',
            progress: 72,
            message: claims.length > 0
              ? `Found ${claims.length} claims to review.`
              : 'No high-signal claims found on the page, continuing with brand import.',
            partialData: {
              sourceUrl: url,
              brand: brandAnalysis,
              designTokens,
              claims,
            },
          })
          
          // Stage 7: Optional evidence research (84%)
          send({ event: 'progress', stage: 'researching_evidence', progress: 76, message: 'Checking evidence availability...' });
          
          const allEvidence: EvidenceCandidate[] = [];
          let evidenceByClaimId = new Map<string, EvidenceCandidate[]>();
          let evidenceStatus: 'completed' | 'skipped' = 'completed'
          let evidenceMessage = 'Evidence research complete.'
          
          if (claims.length === 0) {
            evidenceStatus = 'skipped'
            evidenceMessage = 'No claims detected, so evidence research was skipped.'
          } else if (!process.env.TAVILY_API_KEY) {
            evidenceStatus = 'skipped'
            evidenceMessage = 'Evidence research skipped because Tavily is not configured.'
          } else if (!(await isTavilyReachable())) {
            evidenceStatus = 'skipped'
            evidenceMessage = 'Evidence research skipped because Tavily is unreachable right now.'
          } else {
            try {
              evidenceByClaimId = await researchAllClaims(
                claims,
                companyContext,
                (progress) => {
                  const pct = 76 + (progress.current / progress.total) * 8;
                  send({ 
                    event: 'progress', 
                    stage: 'researching_evidence', 
                    progress: Math.round(pct), 
                    message: `Researching claim ${progress.current}/${progress.total}...` 
                  });
                }
              );
              
              evidenceByClaimId.forEach((evidence) => {
                allEvidence.push(...evidence);
              });
            } catch (error) {
              evidenceStatus = 'skipped'
              evidenceMessage = 'Evidence research unavailable right now. Brand import will continue without it.'
              console.warn('Skipping evidence research:', error)
            }
          }
          
          // Stage 8: Link evidence (88%)
          send({ event: 'progress', stage: 'linking_evidence', progress: 84, message: evidenceMessage });
          
          const linkedEvidence = await autoLinkEvidence(claims, evidenceByClaimId, {
            skipRewriteGeneration: evidenceStatus === 'skipped' || allEvidence.length === 0,
          });
          
          // Stage 9: Generate summary (95%)
          send({ event: 'progress', stage: 'finalizing', progress: 92, message: 'Generating summary...' });
          
          const linkingSummary = getLinkingSummary(linkedEvidence);
          const complianceResult = calculateComplianceScore(claims, linkedEvidence);
          const evidenceSummary = getEvidenceSummary(allEvidence);
          const proofProfile = buildImportProofProfile({
            brandAnalysis,
            claims,
            linkedEvidence,
            evidence: allEvidence,
            sections: parsedPage.sections,
          });
          send({
            event: 'progress',
            stage: 'finalizing',
            progress: 95,
            message: 'Building your import summary and compliance snapshot.',
            partialData: {
              sourceUrl: url,
              brand: brandAnalysis,
              designTokens,
              claims,
              linkedEvidence,
              summary: {
                claimsTotal: claims.length,
                claimsSupported: linkingSummary.supported,
                claimsNeedReview: linkingSummary.weak,
                claimsBlocked: linkingSummary.unsupported,
                evidenceFound: evidenceSummary.total,
                complianceScore: complianceResult.score,
                complianceGrade: complianceResult.grade,
              },
              proofProfile,
              evidenceStatus,
              evidenceMessage,
              metadataSource: brandfetchMetadata ? 'brandfetch' : 'html_ai',
            },
          })
          
          // Save import to database
          const brandContext = {
            ...brandAnalysisToBrandContext(brandAnalysis, designTokens),
            proofHints: {
              recommendedStrategy: proofProfile.recommendedStrategy,
              candidates: proofProfile.candidates,
              gaps: proofProfile.gaps,
            },
          };
          
          let brandId: string

          try {
            brandId = await saveImportResult(supabase, workspaceId, {
              canonicalDomain,
              url,
              brandAnalysis,
              designTokens,
              claims,
              evidence: allEvidence,
              linkedEvidence,
              complianceScore: complianceResult.score,
              proofProfile,
              brandfetchMetadata,
            });
          } catch (persistError) {
            send({
              event: 'error',
              stage: 'finalizing',
              error:
                persistError instanceof Error
                  ? persistError.message
                  : 'Brand import analysis finished, but Composer could not save the imported brand.',
            });
            close();
            return;
          }
          
          // Stage 9: Complete (100%)
          const result: ImportResult = {
            event: 'complete',
            data: {
              brandId,
              sourceUrl: url,
              brand: brandAnalysis,
              designTokens,
              claims,
              evidence: allEvidence,
              linkedEvidence,
              sanitizedHtml: parsedPage.sanitizedHtml,
              sections: parsedPage.sections.map(s => ({
                id: s.id,
                type: s.type,
                textContent: s.textContent.slice(0, 200),
              })),
              summary: {
                claimsTotal: claims.length,
                claimsSupported: linkingSummary.supported,
                claimsNeedReview: linkingSummary.weak,
                claimsBlocked: linkingSummary.unsupported,
                evidenceFound: evidenceSummary.total,
                complianceScore: complianceResult.score,
                complianceGrade: complianceResult.grade,
              },
              brandContext,
              proofProfile,
              metadataSource: brandfetchMetadata ? 'brandfetch' : 'html_ai',
              evidenceStatus,
              evidenceMessage,
            },
          };
          
          send(result);
          close();
          
        } catch (error) {
          console.error('Import error:', error);
          send({ 
            event: 'error', 
            error: error instanceof Error ? error.message : 'Unknown error', 
            stage: 'unknown' 
          });
          close();
        }
      },
    });
    
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
    
  } catch (error) {
    console.error('Import API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * Save import result to database
 */
async function saveImportResult(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  workspaceId: string,
  data: {
    canonicalDomain: string;
    url: string;
    brandAnalysis: BrandAnalysis;
    designTokens: DesignTokens;
    claims: ExtractedClaim[];
    evidence: EvidenceCandidate[];
    linkedEvidence: LinkedEvidence[];
    complianceScore: number;
    proofProfile: {
      recommendedStrategy: 'product-proof' | 'customer-proof' | 'evidence-stack' | 'compliance-proof';
      candidates: string[];
      gaps: string[];
    };
    brandfetchMetadata: BrandfetchMetadata | null;
  }
): Promise<string> {
  const { error: workspaceSettingsError } = await supabase
    .from('workspace_settings')
    .upsert({
      workspace_id: workspaceId,
      brand_voice: data.brandAnalysis.voice.tone,
      brand_colors: {
        primary: data.designTokens.colors.primary,
        secondary: data.designTokens.colors.secondary,
        accent: data.designTokens.colors.accent,
        background: data.designTokens.colors.background,
        text: data.designTokens.colors.text,
      },
      brand_typography: {
        fontFamily: data.designTokens.typography.fontFamily,
        fontHeading: data.designTokens.typography.fontHeading,
      },
      industry: data.brandAnalysis.industry,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'workspace_id',
    });

  if (workspaceSettingsError) {
    throw new Error(`Composer could not save workspace brand settings: ${workspaceSettingsError.message}`);
  }

  const brandPayload = {
    workspace_id: workspaceId,
    name: data.brandAnalysis.name,
    tagline: data.brandAnalysis.tagline,
    description: data.brandfetchMetadata?.description || data.brandAnalysis.tagline,
    website_url: data.brandfetchMetadata?.websiteUrl || data.url,
    primary_color: data.designTokens.colors.primary,
    secondary_color: data.designTokens.colors.secondary,
    accent_color: data.designTokens.colors.accent,
    background_color: data.designTokens.colors.background,
    text_color: data.designTokens.colors.text,
    color_palette: buildColorPalette(data.designTokens),
    font_family: data.designTokens.typography.fontFamily,
    font_heading: data.designTokens.typography.fontHeading,
    voice: data.brandAnalysis.voice.tone,
    tone_attributes: data.brandAnalysis.voice.personality,
    value_propositions: data.brandAnalysis.valuePropositions ?? [],
    key_messages: data.brandAnalysis.keyMessages ?? [],
    logo_primary_url: data.brandfetchMetadata?.logoPrimaryUrl || data.brandAnalysis.logoUrl || null,
    logo_primary_dark_url: data.brandfetchMetadata?.logoPrimaryDarkUrl || null,
    logo_icon_url: data.brandfetchMetadata?.logoIconUrl || null,
    favicon_url: data.brandfetchMetadata?.faviconUrl || null,
    social_links: data.brandfetchMetadata?.socialLinks || {},
    updated_at: new Date().toISOString(),
  };

  const { data: existingBrands, error: existingBrandsError } = await supabase
    .from('brands')
    .select('id, website_url, is_default')
    .eq('workspace_id', workspaceId);

  if (existingBrandsError) {
    throw new Error(`Composer could not inspect existing brands: ${existingBrandsError.message}`);
  }

  const matchedBrand = (existingBrands || []).find((brand) => {
    const websiteUrl = typeof brand.website_url === 'string' ? brand.website_url : null
    if (!websiteUrl) return false
    try {
      return extractCanonicalDomain(websiteUrl) === data.canonicalDomain
    } catch {
      return false
    }
  })

  const hasDefaultBrand = (existingBrands || []).some((brand) => Boolean(brand.is_default))
  const shouldBeDefault = !matchedBrand && !hasDefaultBrand

  let brandRecord: { id: string } | null = null
  let brandError: { message?: string } | null = null

  if (matchedBrand) {
    const result = await supabase
      .from('brands')
      .update(brandPayload)
      .eq('id', matchedBrand.id)
      .select('id')
      .single()
    brandRecord = result.data
    brandError = result.error
  } else {
    const result = await supabase
      .from('brands')
      .insert({
        ...brandPayload,
        is_default: shouldBeDefault,
      })
      .select('id')
      .single()
    brandRecord = result.data
    brandError = result.error
  }

  if (brandError || !brandRecord?.id) {
    throw new Error(
      `Composer could not save the imported brand profile${brandError?.message ? `: ${brandError.message}` : '.'}`
    );
  }

  const { error: brandMemoryError } = await supabase
    .from('brand_memory')
    .upsert({
      workspace_id: workspaceId,
      brand_id: brandRecord.id,
      colors: [
        { value: data.designTokens.colors.primary, role: 'primary', format: 'hex', confidence: 0.85, source: 'url_import' },
        { value: data.designTokens.colors.secondary, role: 'secondary', format: 'hex', confidence: 0.8, source: 'url_import' },
        { value: data.designTokens.colors.accent, role: 'accent', format: 'hex', confidence: 0.8, source: 'url_import' },
        { value: data.designTokens.colors.background, role: 'background', format: 'hex', confidence: 0.75, source: 'url_import' },
        { value: data.designTokens.colors.text, role: 'text', format: 'hex', confidence: 0.75, source: 'url_import' },
      ],
      fonts: [
        { family: data.designTokens.typography.fontHeading, role: 'heading', confidence: 0.8, source: 'computed-style' },
        { family: data.designTokens.typography.fontFamily, role: 'body', confidence: 0.8, source: 'computed-style' },
      ],
      spacing: {
        base: data.designTokens.spacing.scale[0] ?? 8,
        scale: data.designTokens.spacing.scale,
        source: 'css-analysis',
      },
      tone: {
        tone: data.brandAnalysis.voice.tone,
        personality: data.brandAnalysis.voice.personality,
      },
      key_messages: dedupeStrings([
        ...(data.brandAnalysis.keyMessages ?? []),
        ...(data.brandAnalysis.valuePropositions ?? []),
      ]),
      logo_urls: [
        data.brandfetchMetadata?.logoPrimaryUrl,
        data.brandfetchMetadata?.logoPrimaryDarkUrl,
        data.brandAnalysis.logoUrl,
      ].filter((value): value is string => Boolean(value)),
      icon_urls: [
        data.brandfetchMetadata?.logoIconUrl,
        data.brandfetchMetadata?.faviconUrl,
      ].filter((value): value is string => Boolean(value)),
      sources: [
        {
          type: 'url_import',
          url: data.url,
          date: new Date().toISOString(),
          confidence: 0.85,
          metadataSource: data.brandfetchMetadata ? 'brandfetch' : 'html_ai',
          brandfetchQualityScore: data.brandfetchMetadata?.qualityScore ?? null,
          proofProfile: data.proofProfile,
        },
      ],
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'brand_id,workspace_id',
      ignoreDuplicates: false,
    });

  if (brandMemoryError) {
    if (isMissingBrandMemoryTableError(brandMemoryError.message)) {
      console.warn('Skipping brand_memory persistence because the table is unavailable:', brandMemoryError.message);
    } else {
      throw new Error(`Composer saved the brand profile but could not save brand memory: ${brandMemoryError.message}`);
    }
  }

  for (const claim of data.claims) {
    const link = data.linkedEvidence.find((item) => item.claimId === claim.id);
    const { error: claimError } = await supabase
      .from('claims')
      .insert({
        workspace_id: workspaceId,
        text: claim.text,
        original_text: claim.text,
        claim_type: claim.type === 'hard' ? 'hard' : claim.type === 'soft' ? 'soft' : 'unverified',
        category: normalizeClaimCategoryForDb(claim),
        risk_score: claim.riskScore,
        reason_codes: claim.flags,
        status: link?.status === 'supported'
          ? 'approved'
          : link?.status === 'weak'
            ? 'needs_proof'
            : 'draft',
        suggested_rewrites: link?.suggestedRewrite ? [link.suggestedRewrite] : [],
      });

    if (claimError) {
      throw new Error(`Composer could not save imported claims: ${claimError.message}`);
    }
  }

  for (const evidence of data.evidence) {
    const { error: evidenceError } = await supabase
      .from('evidence')
      .insert({
        workspace_id: workspaceId,
        url: evidence.sourceUrl,
        type: 'url',
        source_type: evidence.sourceType || 'other',
        tier: evidence.tier || 'C',
        title: evidence.title,
        content: evidence.snippet,
        metadata: {
          confidence: evidence.confidence,
        },
      });

    if (evidenceError) {
      throw new Error(`Composer could not save imported evidence: ${evidenceError.message}`);
    }
  }

  console.log('Import result saved successfully');
  return brandRecord.id;
}

function mergeDesignTokens(
  extractedDesignTokens: DesignTokens,
  brandfetchMetadata: BrandfetchMetadata | null
): DesignTokens {
  if (!brandfetchMetadata) {
    return extractedDesignTokens;
  }

  const trustBrandfetch = shouldTrustBrandfetch(brandfetchMetadata);
  const preferBrandfetchColors = trustBrandfetch || !extractedDesignTokens.colors.extractedFromPage;
  const preferBrandfetchTypography = trustBrandfetch || !extractedDesignTokens.typography.extractedFromPage;

  const mergedPrimary = preferBrandfetchColors
    ? brandfetchMetadata.primaryColor || extractedDesignTokens.colors.primary
    : extractedDesignTokens.colors.primary;
  const mergedSecondary = preferBrandfetchColors
    ? brandfetchMetadata.secondaryColor || extractedDesignTokens.colors.secondary
    : extractedDesignTokens.colors.secondary;
  const mergedAccent = preferBrandfetchColors
    ? brandfetchMetadata.accentColor || extractedDesignTokens.colors.accent
    : extractedDesignTokens.colors.accent;

  return {
    ...extractedDesignTokens,
    colors: {
      ...extractedDesignTokens.colors,
      primary: mergedPrimary,
      secondary: mergedSecondary,
      accent: mergedAccent,
      allColors: dedupeStrings([
        mergedPrimary,
        mergedSecondary,
        mergedAccent,
        ...brandfetchMetadata.palette,
        ...extractedDesignTokens.colors.allColors,
      ]),
    },
    typography: {
      ...extractedDesignTokens.typography,
      fontFamily: preferBrandfetchTypography
        ? brandfetchMetadata.fontFamily || extractedDesignTokens.typography.fontFamily
        : extractedDesignTokens.typography.fontFamily,
      fontHeading: preferBrandfetchTypography
        ? brandfetchMetadata.fontHeading || brandfetchMetadata.fontFamily || extractedDesignTokens.typography.fontHeading
        : extractedDesignTokens.typography.fontHeading,
    },
  };
}

function mergeBrandAnalysis(
  aiBrandAnalysis: BrandAnalysis,
  brandfetchMetadata: BrandfetchMetadata | null,
  canonicalDomain: string
): BrandAnalysis {
  if (!brandfetchMetadata) {
    return aiBrandAnalysis;
  }

  const trustBrandfetch = shouldTrustBrandfetch(brandfetchMetadata);
  const canonicalName = brandfetchMetadata.name?.trim();
  const description = brandfetchMetadata.description?.trim() || brandfetchMetadata.longDescription?.trim();
  const fallbackTagline = shouldReplaceAiTagline(aiBrandAnalysis.tagline) ? description : undefined;

  return {
    ...aiBrandAnalysis,
    name:
      (trustBrandfetch && canonicalName) ||
      canonicalName ||
      aiBrandAnalysis.name ||
      canonicalDomain,
    tagline: fallbackTagline || aiBrandAnalysis.tagline || description || `${canonicalDomain} import`,
    keyMessages:
      aiBrandAnalysis.keyMessages.length > 0
        ? aiBrandAnalysis.keyMessages
        : description
          ? [description]
          : [],
    valuePropositions:
      aiBrandAnalysis.valuePropositions.length > 0
        ? aiBrandAnalysis.valuePropositions
        : description
          ? [description]
          : [],
    logoUrl:
      (trustBrandfetch && brandfetchMetadata.logoPrimaryUrl) ||
      brandfetchMetadata.logoPrimaryUrl ||
      aiBrandAnalysis.logoUrl,
  };
}

function shouldTrustBrandfetch(metadata: BrandfetchMetadata): boolean {
  const normalizedScore = normalizeQualityScore(metadata.qualityScore);
  return normalizedScore === null || normalizedScore >= 0.55;
}

function normalizeQualityScore(score: number | null): number | null {
  if (score === null || Number.isNaN(score)) {
    return null;
  }

  if (score > 1) {
    return score / 100;
  }

  return score;
}

function shouldReplaceAiTagline(tagline: string | undefined): boolean {
  if (!tagline) {
    return true;
  }

  const normalized = tagline.trim().toLowerCase();
  return normalized.length === 0 || normalized === 'no tagline detected';
}

function buildColorPalette(designTokens: DesignTokens) {
  const palette = [
    { name: 'Primary', hex: designTokens.colors.primary, usage: 'brand-primary' },
    { name: 'Secondary', hex: designTokens.colors.secondary, usage: 'brand-secondary' },
    { name: 'Accent', hex: designTokens.colors.accent, usage: 'brand-accent' },
    { name: 'Background', hex: designTokens.colors.background, usage: 'page-background' },
    { name: 'Text', hex: designTokens.colors.text, usage: 'body-text' },
    ...designTokens.colors.allColors.slice(0, 5).map((color, index) => ({
      name: `Palette ${index + 1}`,
      hex: color,
      usage: 'imported-palette',
    })),
  ];

  return palette.filter((entry, index, allEntries) => {
    return Boolean(entry.hex) && allEntries.findIndex((candidate) => candidate.hex === entry.hex) === index;
  });
}

function dedupeStrings(values: Array<string | undefined | null>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function isMissingBrandMemoryTableError(message: string | undefined): boolean {
  if (!message) {
    return false;
  }

  return (
    message.includes("Could not find the table 'public.brand_memory'") ||
    message.includes("relation \"brand_memory\" does not exist")
  );
}

function normalizeClaimCategoryForDb(
  claim: Pick<ExtractedClaim, 'category' | 'text'>
): 'performance' | 'security' | 'pricing' | 'compliance' | 'generic' {
  if (claim.category === 'performance' || claim.category === 'security' || claim.category === 'compliance') {
    return claim.category;
  }

  const text = claim.text.toLowerCase();

  if (/\b(hipaa|gdpr|soc ?2|iso ?27001|certified|compliant|compliance|audit)\b/.test(text)) {
    return text.includes('soc') || text.includes('iso') || text.includes('security')
      ? 'security'
      : 'compliance';
  }

  if (/\b(price|pricing|cost|save|discount|free trial|affordable|roi|return on investment)\b/.test(text)) {
    return 'pricing';
  }

  if (/\b(faster|speed|improve|performance|productivity|reduce|increase|stat|metric|benchmark|time)\b/.test(text)) {
    return 'performance';
  }

  return 'generic';
}

function buildImportProofProfile(input: {
  brandAnalysis: BrandAnalysis;
  claims: ExtractedClaim[];
  linkedEvidence: LinkedEvidence[];
  evidence: EvidenceCandidate[];
  sections: ParsedPage['sections'];
}): {
  recommendedStrategy: 'product-proof' | 'customer-proof' | 'evidence-stack' | 'compliance-proof';
  candidates: string[];
  gaps: string[];
} {
  const { brandAnalysis, claims, linkedEvidence, evidence, sections } = input;

  const supportedCount = linkedEvidence.filter((item) => item.status === 'supported').length;
  const weakCount = linkedEvidence.filter((item) => item.status === 'weak').length;
  const hasComplianceSignals =
    /\b(fintech|finance|banking|insurance|security|compliance|health|medical|legal)\b/i.test(brandAnalysis.industry) ||
    claims.some((claim) => claim.category === 'security' || claim.category === 'compliance');
  const hasProductSections = sections.some((section) =>
    ['features', 'product', 'how-it-works', 'pricing', 'faq'].includes(section.type),
  );
  const testimonialCount = brandAnalysis.socialProof.testimonials.length;
  const logoCount = brandAnalysis.socialProof.logos.length;
  const statCount = brandAnalysis.socialProof.stats.length;

  const recommendedStrategy =
    hasComplianceSignals
      ? 'compliance-proof'
      : supportedCount >= 2 || statCount >= 2
        ? 'evidence-stack'
        : testimonialCount > 0 || logoCount > 0
          ? 'customer-proof'
          : hasProductSections
            ? 'product-proof'
            : 'evidence-stack';

  const candidates = [
    ...brandAnalysis.socialProof.stats.map((entry) => `Imported site metric: ${entry}`),
    ...brandAnalysis.socialProof.testimonials.slice(0, 2).map((entry) => `Imported testimonial: ${entry}`),
    ...brandAnalysis.socialProof.logos.slice(0, 3).map((entry) => `Imported logo proof: ${entry}`),
    ...claims
      .filter((claim) => Boolean(claim.evidenceExpectation))
      .slice(0, 4)
      .map((claim) => `${claim.text} -> expected evidence: ${claim.evidenceExpectation}`),
    ...evidence.slice(0, 4).map((entry) => `Research evidence candidate: ${entry.title}`),
  ];

  const gaps = [
    supportedCount === 0 ? 'No claims were strongly supported by linked evidence during import' : null,
    weakCount >= 2 ? 'Multiple imported claims still need stronger supporting evidence' : null,
    recommendedStrategy === 'customer-proof' && testimonialCount === 0 && logoCount === 0
      ? 'Customer-proof route selected but the import did not surface attributable customer proof'
      : null,
    recommendedStrategy === 'evidence-stack' && statCount === 0
      ? 'Evidence-stack route needs a defensible metric, benchmark, or sourced result'
      : null,
    recommendedStrategy === 'compliance-proof' &&
    !claims.some((claim) => (claim.evidenceExpectation ?? '').toLowerCase().includes('certification'))
      ? 'Compliance-heavy positioning needs a reviewable certification, policy statement, or audit artifact'
      : null,
    !hasProductSections ? 'The imported site does not clearly show the product or workflow yet' : null,
  ].filter((value): value is string => Boolean(value));

  return {
    recommendedStrategy,
    candidates: [...new Set(candidates)].slice(0, 8),
    gaps: [...new Set(gaps)].slice(0, 6),
  };
}
