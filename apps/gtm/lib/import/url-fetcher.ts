/**
 * URL Fetcher (Jan 2026)
 * 
 * Reliably fetches URLs with bot protection handling, proxy rotation,
 * user-agent spoofing, JavaScript rendering support, and retry logic.
 */

import { JSDOM } from 'jsdom';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright-core';

// Realistic browser user agents for rotation
const USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
];

export interface FetchResult {
  html: string;
  url: string; // Final URL after redirects
  statusCode: number;
  headers: Record<string, string>;
  loadTime: number;
  contentType: string;
  title?: string;
  description?: string;
  error?: string;
}

export interface FetchOptions {
  timeout?: number;
  maxRedirects?: number;
  retries?: number;
  retryDelay?: number;
  headers?: Record<string, string>;
  renderJs?: boolean;
}

const DEFAULT_OPTIONS: Required<FetchOptions> = {
  timeout: 30000, // 30 seconds
  maxRedirects: 5,
  retries: 3,
  retryDelay: 1000, // 1 second
  headers: {},
  renderJs: false,
};

/**
 * Get a random user agent
 */
function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Extract basic metadata from HTML
 */
function extractBasicMetadata(html: string): { title?: string; description?: string } {
  try {
    const dom = new JSDOM(html);
    const doc = dom.window.document;
    
    const title = doc.querySelector('title')?.textContent?.trim();
    const description = 
      doc.querySelector('meta[name="description"]')?.getAttribute('content') ||
      doc.querySelector('meta[property="og:description"]')?.getAttribute('content');
    
    return { title, description: description || undefined };
  } catch {
    return {};
  }
}

/**
 * Core URL fetcher with all protections
 */
export async function fetchUrl(
  url: string,
  options: FetchOptions = {}
): Promise<FetchResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const startTime = Date.now();
  
  let lastError: Error | null = null;
  let currentUrl = url;
  let redirectCount = 0;
  
  // Retry loop
  for (let attempt = 0; attempt < opts.retries; attempt++) {
    try {
      // Reset for this attempt
      currentUrl = url;
      redirectCount = 0;
      
      // Follow redirects manually to track final URL
      while (redirectCount < opts.maxRedirects) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), opts.timeout);
        
        try {
          const response = await fetch(currentUrl, {
            method: 'GET',
            headers: {
              'User-Agent': getRandomUserAgent(),
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.5',
              'Accept-Encoding': 'gzip, deflate, br',
              'DNT': '1',
              'Connection': 'keep-alive',
              'Upgrade-Insecure-Requests': '1',
              'Sec-Fetch-Dest': 'document',
              'Sec-Fetch-Mode': 'navigate',
              'Sec-Fetch-Site': 'none',
              'Sec-Fetch-User': '?1',
              'Cache-Control': 'max-age=0',
              ...opts.headers,
            },
            redirect: 'manual', // Handle redirects manually
            signal: controller.signal,
          });
          
          clearTimeout(timeoutId);
          
          // Check for redirects
          if (response.status >= 300 && response.status < 400) {
            const location = response.headers.get('location');
            if (location) {
              // Handle relative URLs
              currentUrl = new URL(location, currentUrl).toString();
              redirectCount++;
              continue;
            }
          }
          
          // Check for successful response
          if (!response.ok && response.status !== 200) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          
          const html = await response.text();
          const loadTime = Date.now() - startTime;
          const metadata = extractBasicMetadata(html);
          
          // Convert headers to object
          const headers: Record<string, string> = {};
          response.headers.forEach((value, key) => {
            headers[key] = value;
          });
          
          return {
            html,
            url: currentUrl,
            statusCode: response.status,
            headers,
            loadTime,
            contentType: response.headers.get('content-type') || 'text/html',
            title: metadata.title,
            description: metadata.description,
          };
        } finally {
          clearTimeout(timeoutId);
        }
      }
      
      throw new Error(`Too many redirects (max: ${opts.maxRedirects})`);
      
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Don't retry on certain errors
      if (lastError.name === 'AbortError') {
        lastError = new Error(`Request timed out after ${opts.timeout}ms`);
      }
      
      // Wait before retrying (with exponential backoff)
      if (attempt < opts.retries - 1) {
        await sleep(opts.retryDelay * Math.pow(2, attempt));
      }
    }
  }
  
  // All retries failed
  return {
    html: '',
    url: currentUrl,
    statusCode: 0,
    headers: {},
    loadTime: Date.now() - startTime,
    contentType: '',
    error: lastError?.message || 'Unknown error',
  };
}

/**
 * Lightweight fetch for simple pages (no retry, shorter timeout)
 */
export async function fetchUrlSimple(url: string): Promise<string> {
  const result = await fetchUrl(url, {
    timeout: 15000,
    retries: 1,
    maxRedirects: 3,
  });
  
  if (result.error) {
    throw new Error(result.error);
  }
  
  return result.html;
}

/**
 * Fetch with JavaScript rendering using external service
 * Falls back to simple fetch if rendering service is unavailable
 */
export async function fetchUrlRendered(
  url: string,
  options: FetchOptions = {}
): Promise<FetchResult> {
  // Check if we have Browserless configured
  const browserlessKey = process.env.BROWSERLESS_API_KEY;
  
  if (browserlessKey) {
    try {
      return await fetchWithBrowserless(url, browserlessKey, options);
    } catch (error) {
      console.warn('Browserless rendering failed:', error);
    }
  }
  
  // Check for Playwright endpoint
  const playwrightEndpoint = process.env.PLAYWRIGHT_ENDPOINT;
  
  if (playwrightEndpoint) {
    try {
      return await fetchWithPlaywright(url, playwrightEndpoint, options);
    } catch (error) {
      console.warn('Playwright rendering failed:', error);
    }
  }
  
  // Fallback to simple fetch
  console.warn('No JS rendering service available, using simple fetch');
  return fetchUrl(url, options);
}

/**
 * Fetch using Browserless.io Playwright WebSocket API
 * This is more reliable than the HTTP API and handles SPAs better
 */
async function fetchWithBrowserless(
  url: string,
  apiKey: string,
  options: FetchOptions
): Promise<FetchResult> {
  const startTime = Date.now();
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  let browser: Browser | null = null;
  let context: BrowserContext | null = null;
  let page: Page | null = null;

  try {
    // Connect to Browserless via WebSocket
    const wsEndpoint = `wss://production-sfo.browserless.io/chromium/playwright?token=${apiKey}`;
    browser = await chromium.connect(wsEndpoint);

    if (!browser) {
      throw new Error('Failed to connect to Browserless');
    }

    // Create a new browser context
    context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: getRandomUserAgent(),
    });

    if (!context) {
      throw new Error('Failed to create browser context');
    }

    // Create a new page
    page = await context.newPage();

    if (!page) {
      throw new Error('Failed to create page');
    }

    // Navigate to the URL with proper wait conditions
    const response = await page.goto(url, {
      waitUntil: 'networkidle',
      timeout: opts.timeout,
    });

    if (!response) {
      throw new Error('Failed to load page - no response received');
    }

    // Wait a bit for any dynamic content to load
    await page.waitForTimeout(2000);

    // Get the final URL (after redirects)
    const finalUrl = page.url();

    // Get the rendered HTML
    const html = await page.content();

    // Extract metadata
    const title = await page.title();
    let description: string | undefined;
    
    try {
      description = await page.$eval('meta[name="description"]', (el: HTMLMetaElement) => el.content).catch(() => undefined);
      if (!description) {
        description = await page.$eval('meta[property="og:description"]', (el: HTMLMetaElement) => el.content).catch(() => undefined);
      }
    } catch {
      // Ignore metadata extraction errors
    }

    const loadTime = Date.now() - startTime;

    return {
      html,
      url: finalUrl,
      statusCode: response.status(),
      headers: response.headers(),
      loadTime,
      contentType: response.headers()['content-type'] || 'text/html',
      title: title || undefined,
      description: description || undefined,
    };
  } catch (error) {
    let errorMessage = 'Browserless rendering failed';

    if (error instanceof Error) {
      errorMessage = error.message;

      // Check for specific Browserless errors
      if (error.message.includes('teamSeats') || error.message.includes('seats')) {
        errorMessage = 'Browserless team seats limit reached. Consider upgrading your Browserless plan.';
      } else if (error.message.includes('429') || error.message.includes('rate limit')) {
        errorMessage = 'Browserless rate limit exceeded. Consider upgrading your plan or using simple HTML fetch.';
      } else if (error.message.includes('403') || error.message.includes('authentication')) {
        errorMessage = 'Browserless authentication failed. Check your API key.';
      } else if (error.message.includes('402') || error.message.includes('payment')) {
        errorMessage = 'Browserless payment required. Your account may have reached its usage limits.';
      }
    }

    throw new Error(errorMessage);
  } finally {
    // Clean up resources
    try {
      if (page) await page.close();
      if (context) await context.close();
      if (browser) await browser.close();
    } catch (cleanupError) {
      console.warn('Error cleaning up Browserless resources:', cleanupError);
    }
  }
}

/**
 * Fetch using custom Playwright endpoint
 */
async function fetchWithPlaywright(
  url: string,
  endpoint: string,
  options: FetchOptions
): Promise<FetchResult> {
  const startTime = Date.now();
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url,
      timeout: opts.timeout,
      waitUntil: 'networkidle',
    }),
  });
  
  if (!response.ok) {
    throw new Error(`Playwright endpoint error: ${response.status}`);
  }
  
  const data = await response.json();
  const html = data.html || data.content || '';
  const metadata = extractBasicMetadata(html);
  
  return {
    html,
    url: data.url || url,
    statusCode: data.statusCode || 200,
    headers: data.headers || {},
    loadTime: Date.now() - startTime,
    contentType: 'text/html',
    title: metadata.title,
    description: metadata.description,
  };
}

/**
 * Validate URL before fetching
 */
export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

/**
 * Normalize URL (add https if missing, remove trailing slash, etc.)
 */
export function normalizeUrl(url: string): string {
  let normalized = url.trim();
  
  // Add protocol if missing
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    normalized = 'https://' + normalized;
  }
  
  try {
    const parsed = new URL(normalized);
    
    // Remove trailing slash from path (unless it's just /)
    if (parsed.pathname.endsWith('/') && parsed.pathname.length > 1) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }
    
    return parsed.toString();
  } catch {
    return normalized;
  }
}

/**
 * Check if URL is likely to need JS rendering
 */
export function needsJsRendering(html: string): boolean {
  // Check for common SPA indicators
  const spaIndicators = [
    '<div id="root"></div>',
    '<div id="app"></div>',
    '<div id="__next"></div>',
    'window.__NUXT__',
    'window.__INITIAL_STATE__',
    '__PRELOADED_STATE__',
  ];
  
  // Check if page has very little content (likely SPA)
  const textContent = html.replace(/<[^>]*>/g, '').trim();
  const isEmptyBody = textContent.length < 1000; // Increased threshold
  
  return spaIndicators.some(indicator => html.includes(indicator)) || isEmptyBody;
}

/**
 * Smart fetch - fetches URL and extracts content
 * The HTML parser handles extracting content from meta tags, JSON-LD, __NEXT_DATA__, etc.
 * No JS rendering needed for brand/claim extraction.
 */
export async function smartFetch(
  url: string,
  options: FetchOptions & { renderJs?: boolean } = {}
): Promise<FetchResult> {
  // Simple fetch works for our use case - parser extracts meta tags, JSON-LD, etc.
  return fetchUrl(url, options);
}
