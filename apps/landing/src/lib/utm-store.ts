/**
 * UTM Session Persistence Layer
 * Persists UTM parameters across internal navigation for attribution.
 */

const STORAGE_KEY = 'sako_utm';
const MAX_LENGTH = 255;

export interface UTMContext {
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  utm_term?: string | null;
}

function truncate(val: string): string {
  return val.length > MAX_LENGTH ? val.slice(0, MAX_LENGTH) : val;
}

/**
 * Parse all 5 UTM params from the current URL
 */
export function getUTMFromURL(): UTMContext {
  if (typeof window === 'undefined') return {};

  try {
    const params = new URLSearchParams(window.location.search);
    const get = (key: string) => {
      const v = params.get(key);
      return v ? truncate(v) : null;
    };

    const utm: UTMContext = {
      utm_source: get('utm_source'),
      utm_medium: get('utm_medium'),
      utm_campaign: get('utm_campaign'),
      utm_content: get('utm_content'),
      utm_term: get('utm_term'),
    };

    return utm;
  } catch {
    return {};
  }
}

/**
 * Write UTM to sessionStorage when present in URL.
 * Call when user lands with UTM params.
 */
export function persistUTM(): void {
  if (typeof window === 'undefined') return;

  const utm = getUTMFromURL();
  const hasUTM = Object.values(utm).some((v) => v != null && v !== '');

  if (hasUTM) {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(utm));
    } catch {
      // sessionStorage full or unavailable
    }
  }
}

/**
 * Return UTM from URL first, else from sessionStorage.
 * Persists to sessionStorage when URL has UTM.
 */
export function getUTMContext(): UTMContext {
  if (typeof window === 'undefined') return {};

  const fromUrl = getUTMFromURL();
  const hasInUrl = Object.values(fromUrl).some((v) => v != null && v !== '');

  if (hasInUrl) {
    persistUTM();
    return fromUrl;
  }

  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as UTMContext;
      return parsed;
    }
  } catch {
    // Invalid JSON or unavailable
  }

  return {};
}

/**
 * Clear stored UTM (e.g. on sign-out)
 */
export function clearUTM(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore
  }
}
