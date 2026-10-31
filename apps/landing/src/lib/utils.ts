import { twMerge } from "tailwind-merge";
import { getUTMContext } from "./utm-store";

type ClassValue = string | number | boolean | null | undefined | ClassValue[];

function clsxInner(val: ClassValue): string {
  if (!val) return "";
  if (typeof val === "string" || typeof val === "number") return String(val);
  if (Array.isArray(val)) return val.map(clsxInner).filter(Boolean).join(" ");
  return "";
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(inputs.map(clsxInner).filter(Boolean).join(" "));
}

// Get current date in different formats for MDX frontmatter and content
export function getCurrentDate() {
  const now = new Date();

  // ISO format for frontmatter (updatedAt)
  const isoDate = now.toISOString().split('T')[0];

  // Readable format for content (Last Updated)
  const readableDate = now.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return {
    iso: isoDate,
    readable: readableDate
  };
}

// UTM parameter types for landing page tracking
export interface UTMParams {
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
  term?: string;
}

// Default UTM parameters for landing page
export const DEFAULT_UTM_PARAMS: UTMParams = {
  source: 'trysakolandingpage',
  medium: 'website',
  campaign: 'launch'
};

// Build UTM parameters string from object
export function buildUTMString(params: UTMParams): string {
  const utmPairs = Object.entries(params)
    .filter(([_, value]) => value !== undefined && value !== '')
    .map(([key, value]) => `utm_${key}=${encodeURIComponent(value)}`);

  return utmPairs.length > 0 ? `?${utmPairs.join('&')}` : '';
}

// Append UTM parameters to a URL
export function appendUTMParams(url: string, utmParams: UTMParams = DEFAULT_UTM_PARAMS): string {
  // Return empty string or handle missing URLs
  if (!url || url === '') {
    return url;
  }

  // Don't add UTM params to internal links (relative URLs or same domain)
  if (url.startsWith('/') || url.startsWith('#') || url.includes('trysako.com')) {
    return url;
  }

  try {
    const urlObj = new URL(url);
    // If URL already has UTM params, don't override them
    const hasExistingUTM = Array.from(urlObj.searchParams.keys()).some(key => key.startsWith('utm_'));
    if (hasExistingUTM) {
      return url;
    }

    // Add UTM parameters
    Object.entries(utmParams).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        urlObj.searchParams.set(`utm_${key}`, value);
      }
    });

    return urlObj.toString();
  } catch (error) {
    // If URL parsing fails, return original URL
    console.warn('Failed to parse URL for UTM params:', url, error);
    return url;
  }
}

function isInternalPath(path: string): boolean {
  return path.startsWith("/") || path.startsWith("#") || path.includes("trysako.com");
}

/**
 * Preserve UTM params from session on internal links.
 * For internal paths only, appends current UTM from getUTMContext to the URL.
 */
export function preserveUTM(url: string): string {
  if (typeof window === "undefined") return url;
  if (!isInternalPath(url)) return url;
  try {
    const urlObj = new URL(url, window.location.origin);
    const utm = getUTMContext();
    const entries = Object.entries(utm).filter(([, v]) => v != null && v !== "");
    for (const [key, value] of entries) {
      if (value) urlObj.searchParams.set(key, value);
    }
    return urlObj.pathname + urlObj.search + urlObj.hash;
  } catch {
    return url;
  }
}

// Get UTM parameters for specific campaigns
export function getUTMCampaignParams(campaign: string, content?: string): UTMParams {
  return {
    ...DEFAULT_UTM_PARAMS,
    campaign,
    ...(content && { content })
  };
}


