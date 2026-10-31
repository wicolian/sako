/**
 * URL Import & Analysis API (Jan 2026)
 * 
 * Single endpoint that orchestrates the entire import flow:
 * URL fetch → Parse → Extract brand → Extract claims → Research evidence → Link evidence
 * 
 * Returns streaming progress updates.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getWorkspaceIdWithFallback } from '@/lib/workspace';
import { db } from '@/lib/db';
import { smartFetch, isValidUrl, normalizeUrl } from '@/lib/import/url-fetcher';
import { parseHtml, type ParsedPage } from '@/lib/import/html-parser';
import { extractDesignTokens, type DesignTokens } from '@/lib/import/design-extractor';
import { analyzeBrand, extractBrandNameQuick, brandAnalysisToBrandContext, type BrandAnalysis } from '@/lib/import/brand-extractor';
import { extractClaims, getClaimsSummary, type ExtractedClaim } from '@/lib/import/claims-extractor';
import { researchAllClaims, getEvidenceSummary, type EvidenceCandidate } from '@/lib/import/evidence-researcher';
import { autoLinkEvidence, getLinkingSummary, calculateComplianceScore, type LinkedEvidence } from '@/lib/import/evidence-linker';

export const runtime = 'nodejs';
export const maxDuration = 120; // 2 minutes max

export interface ImportRequest {
  url: string;
  confirmOwnership: boolean;
}

export interface ImportProgress {
  event: 'progress';
  stage: string;
  progress: number;
  message?: string;
  partialData?: Record<string, unknown>;
}

export interface ImportResult {
  event: 'complete';
  data: {
    brandId: string;
    sourceUrl: string;
    brand: BrandAnalysis;
    designTokens: DesignTokens;
    claims: ExtractedClaim[];
    evidence: EvidenceCandidate[];
    linkedEvidence: LinkedEvidence[];
    sanitizedHtml: string;
    sections: Array<{
      id: string;
      type: string;
      textContent: string;
    }>;
    summary: {
      claimsTotal: number;
      claimsSupported: number;
      claimsNeedReview: number;
      claimsBlocked: number;
      evidenceFound: number;
      complianceScore: number;
      complianceGrade: string;
    };
    brandContext: ReturnType<typeof brandAnalysisToBrandContext>;
    proofProfile: {
      recommendedStrategy: 'product-proof' | 'customer-proof' | 'evidence-stack' | 'compliance-proof';
      candidates: string[];
      gaps: string[];
    };
  };
}

export interface ImportError {
  event: 'error';
  error: string;
  stage: string;
}

type StreamEvent = ImportProgress | ImportResult | ImportError;

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
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
        const send = (event: StreamEvent) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        };
        
        try {
          // Stage 1: Fetch URL (10%)
          send({ event: 'progress', stage: 'fetching', progress: 10, message: 'Fetching page...' });
          
          const fetchResult = await smartFetch(url);

          if (fetchResult.error) {
            send({ event: 'error', error: fetchResult.error, stage: 'fetching' });
            controller.close();
            return;
          }
          
          // Stage 2: Parse HTML (20%)
          send({ event: 'progress', stage: 'parsing', progress: 20, message: 'Parsing HTML...' });

          const parsedPage = parseHtml(fetchResult.html, fetchResult.url);
          const quickBrandPreview = {
            name: extractBrandNameQuick(parsedPage),
            tagline: parsedPage.description || 'Scanning live page content…',
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
            controller.close();
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
            progress: 20,
            message: `Parsed ${parsedPage.sections.length} page sections and extracted the main copy.`,
            partialData: {
              sourceUrl: url,
              brand: quickBrandPreview,
            },
          });
          
          // Stage 3: Extract design tokens (25%)
          send({ event: 'progress', stage: 'extracting_design', progress: 25, message: 'Extracting design tokens...' });
          
          const designTokens = extractDesignTokens(fetchResult.html);
          send({
            event: 'progress',
            stage: 'extracting_design',
            progress: 30,
            message: 'Captured the page palette and typography.',
            partialData: {
              sourceUrl: url,
              brand: quickBrandPreview,
              designTokens,
            },
          })
          
          // Stage 4: Analyze brand (35%)
          send({ event: 'progress', stage: 'extracting_brand', progress: 35, message: 'Analyzing brand...' });
          
          const brandAnalysis = await analyzeBrand(parsedPage, designTokens, fetchResult.url);
          send({
            event: 'progress',
            stage: 'extracting_brand',
            progress: 45,
            message: `Mapped brand voice, audience, and value props for ${brandAnalysis.name || quickBrandPreview.name}.`,
            partialData: {
              sourceUrl: url,
              brand: brandAnalysis,
              designTokens,
            },
          })
          
          // Get company context for evidence research
          const companyContext = {
            name: brandAnalysis.name || extractBrandNameQuick(parsedPage),
            domain: new URL(url).hostname,
            industry: brandAnalysis.industry,
          };
          
          // Stage 5: Extract claims (50%)
          send({ event: 'progress', stage: 'detecting_claims', progress: 50, message: 'Detecting marketing claims...' });
          
          const claims = await extractClaims(parsedPage);
          send({
            event: 'progress',
            stage: 'detecting_claims',
            progress: 55,
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
          
          // Stage 6: Research evidence (70%)
          send({ event: 'progress', stage: 'researching_evidence', progress: 55, message: 'Researching evidence...' });
          
          const allEvidence: EvidenceCandidate[] = [];
          let evidenceByClaimId = new Map<string, EvidenceCandidate[]>();
          
          // Only research if we have claims and Tavily is configured
          if (claims.length > 0 && process.env.TAVILY_API_KEY) {
            evidenceByClaimId = await researchAllClaims(
              claims,
              companyContext,
              (progress) => {
                const pct = 55 + (progress.current / progress.total) * 15;
                send({ 
                  event: 'progress', 
                  stage: 'researching_evidence', 
                  progress: Math.round(pct), 
                  message: `Researching claim ${progress.current}/${progress.total}...` 
                });
              }
            );
            
            // Flatten evidence
            evidenceByClaimId.forEach((evidence) => {
              allEvidence.push(...evidence);
            });
          }
          
          // Stage 7: Link evidence (85%)
          send({ event: 'progress', stage: 'linking_evidence', progress: 85, message: 'Linking evidence to claims...' });
          
          const linkedEvidence = await autoLinkEvidence(claims, evidenceByClaimId);
          
          // Stage 8: Generate summary (95%)
          send({ event: 'progress', stage: 'finalizing', progress: 95, message: 'Generating summary...' });
          
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
              url,
              brandAnalysis,
              designTokens,
              claims,
              evidence: allEvidence,
              linkedEvidence,
              complianceScore: complianceResult.score,
              proofProfile,
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
            controller.close();
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
            },
          };
          
          send(result);
          controller.close();
          
        } catch (error) {
          console.error('Import error:', error);
          send({ 
            event: 'error', 
            error: error instanceof Error ? error.message : 'Unknown error', 
            stage: 'unknown' 
          });
          controller.close();
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
  workspaceId: string,
  data: {
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

  const { data: brandRecord, error: brandError } = await supabase
    .from('brands')
    .upsert({
      workspace_id: workspaceId,
      name: data.brandAnalysis.name,
      tagline: data.brandAnalysis.tagline,
      website_url: data.url,
      is_default: true,
      primary_color: data.designTokens.colors.primary,
      secondary_color: data.designTokens.colors.secondary,
      accent_color: data.designTokens.colors.accent,
      background_color: data.designTokens.colors.background,
      text_color: data.designTokens.colors.text,
      font_family: data.designTokens.typography.fontFamily,
      font_heading: data.designTokens.typography.fontHeading,
      voice: data.brandAnalysis.voice.tone,
      tone_attributes: data.brandAnalysis.voice.personality,
      value_propositions: data.brandAnalysis.valuePropositions ?? [],
      logo_primary_url: data.brandAnalysis.logoUrl ?? null,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'workspace_id,is_default',
      ignoreDuplicates: false,
    })
    .select('id')
    .single();

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
      key_messages: data.brandAnalysis.valuePropositions ?? [],
      logo_urls: data.brandAnalysis.logoUrl ? [data.brandAnalysis.logoUrl] : [],
      sources: [
        {
          type: 'url_import',
          url: data.url,
          date: new Date().toISOString(),
          confidence: 0.85,
          proofProfile: data.proofProfile,
        },
      ],
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'brand_id,workspace_id',
      ignoreDuplicates: false,
    });

  if (brandMemoryError) {
    throw new Error(`Composer saved the brand profile but could not save brand memory: ${brandMemoryError.message}`);
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
        category: claim.category || 'generic',
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
