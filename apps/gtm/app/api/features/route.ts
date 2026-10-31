/**
 * Feature Availability API (Jan 2026)
 * 
 * Returns which features are available based on configured API keys.
 * Used by the frontend to show appropriate UI states.
 */

import { NextResponse } from 'next/server';
import { getFeatureAvailability, getEnvStatus, getUnavailableFeatures } from '@/lib/features/availability';

export async function GET() {
  const availability = getFeatureAvailability();
  const envStatus = getEnvStatus();
  const unavailable = getUnavailableFeatures();
  
  // Check if core features are working
  const coreReady = availability.core.authentication.available && 
                    availability.core.aiGeneration.available;
  
  // Count available optional features
  const optionalFeatures = {
    total: 6,
    available: [
      availability.video.voiceover.available,
      availability.video.assembly.available,
      availability.research.evidenceResearch.available,
      availability.research.competitorIntel.available,
      availability.integrations.hubspot.available,
      availability.integrations.figma.available,
    ].filter(Boolean).length,
  };
  
  return NextResponse.json({
    coreReady,
    optionalFeatures,
    availability,
    envStatus,
    unavailable,
    message: coreReady 
      ? `App is ready. ${optionalFeatures.available}/${optionalFeatures.total} optional features configured.`
      : 'Core features not configured. Please check your environment variables.',
  });
}
