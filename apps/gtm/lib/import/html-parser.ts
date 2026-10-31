/**
 * HTML Parser & Sanitizer (Jan 2026)
 * 
 * Parses HTML, extracts structured data, sanitizes for editing,
 * detects semantic sections, and injects data-node-ids.
 */

import { JSDOM } from 'jsdom';
import { v4 as uuidv4 } from 'uuid';

export interface ParsedPage {
  title: string;
  description: string;
  ogTags: Record<string, string>;
  sections: PageSection[];
  assets: {
    images: string[];
    fonts: string[];
    icons: string[];
    stylesheets: string[];
  };
  sanitizedHtml: string;
  textContent: string;
  headHtml: string;
  bodyHtml: string;
}

export interface PageSection {
  id: string;
  type: SectionType;
  html: string;
  textContent: string;
  order: number;
  tagName: string;
  className?: string;
  hasImages: boolean;
  hasForm: boolean;
  wordCount: number;
}

export type SectionType = 
  | 'header'
  | 'hero'
  | 'features'
  | 'benefits'
  | 'testimonials'
  | 'pricing'
  | 'faq'
  | 'cta'
  | 'footer'
  | 'logos'
  | 'stats'
  | 'team'
  | 'contact'
  | 'about'
  | 'gallery'
  | 'video'
  | 'unknown';

// Tags to completely remove
const TAGS_TO_REMOVE = [
  'script',
  'noscript',
  'iframe',
  'object',
  'embed',
  'applet',
];

// Attributes to remove (tracking, analytics, etc.)
const ATTRS_TO_REMOVE = [
  'onclick',
  'onload',
  'onerror',
  'onmouseover',
  'onmouseout',
  'onfocus',
  'onblur',
  'onsubmit',
  'data-analytics',
  'data-tracking',
  'data-gtm',
  'data-ga',
];

// Patterns for tracking/analytics scripts and elements
const TRACKING_PATTERNS = [
  /google-analytics/i,
  /googletagmanager/i,
  /gtag/i,
  /fbevents/i,
  /facebook\.net/i,
  /hotjar/i,
  /heap/i,
  /mixpanel/i,
  /segment/i,
  /amplitude/i,
  /intercom/i,
  /drift/i,
  /hubspot/i,
  /marketo/i,
  /pardot/i,
];

// Section type detection patterns
const SECTION_PATTERNS: Record<SectionType, RegExp[]> = {
  header: [/^header$/i, /navbar/i, /nav-bar/i, /top-bar/i, /masthead/i],
  hero: [/hero/i, /banner/i, /jumbotron/i, /splash/i, /intro/i, /above-fold/i],
  features: [/feature/i, /capability/i, /what-we-do/i, /services/i],
  benefits: [/benefit/i, /why-us/i, /advantage/i, /value-prop/i],
  testimonials: [/testimonial/i, /review/i, /customer-story/i, /social-proof/i, /quote/i],
  pricing: [/pricing/i, /plans/i, /packages/i, /subscription/i],
  faq: [/faq/i, /question/i, /accordion/i, /help/i],
  cta: [/cta/i, /call-to-action/i, /signup/i, /get-started/i, /try-free/i],
  footer: [/^footer$/i, /site-footer/i, /bottom/i],
  logos: [/logo/i, /client/i, /partner/i, /trusted-by/i, /as-seen/i],
  stats: [/stat/i, /number/i, /metric/i, /counter/i, /achievement/i],
  team: [/team/i, /people/i, /staff/i, /leadership/i, /founder/i],
  contact: [/contact/i, /get-in-touch/i, /reach-us/i],
  about: [/about/i, /who-we-are/i, /our-story/i, /mission/i],
  gallery: [/gallery/i, /portfolio/i, /showcase/i, /work/i],
  video: [/video/i, /demo/i, /watch/i, /player/i],
  unknown: [],
};

// Content-based section detection
const CONTENT_INDICATORS: Record<SectionType, string[]> = {
  hero: ['get started', 'try free', 'sign up', 'learn more', 'watch demo'],
  features: ['feature', 'capability', 'powerful', 'easy to use'],
  testimonials: ['said', 'told us', 'recommend', 'love using', 'game changer'],
  pricing: ['$', '/mo', '/month', '/year', 'free trial', 'enterprise'],
  faq: ['?', 'how do', 'what is', 'can i', 'do you'],
  cta: ['start', 'try', 'get', 'sign up', 'book demo', 'schedule'],
  logos: ['trusted by', 'as seen', 'partners', 'clients include'],
  stats: ['%', '+', 'million', 'billion', 'thousand', 'customers', 'users'],
  header: [],
  benefits: [],
  footer: [],
  team: [],
  contact: [],
  about: [],
  gallery: [],
  video: [],
  unknown: [],
};

/**
 * Parse HTML and extract structured data
 * Works with both server-rendered and SPA pages by extracting all available content
 */
export function parseHtml(html: string, baseUrl: string): ParsedPage {
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  
  // Extract metadata (works even for SPAs)
  const title = 
    doc.querySelector('title')?.textContent?.trim() ||
    getMetaContent(doc, 'og:title') ||
    getMetaContent(doc, 'twitter:title') ||
    '';
  const description = 
    getMetaContent(doc, 'description') || 
    getMetaContent(doc, 'og:description') || 
    getMetaContent(doc, 'twitter:description') ||
    '';
  const ogTags = extractOgTags(doc);
  
  // Extract assets
  const assets = extractAssets(doc, baseUrl);
  
  // Try to extract content from various sources (SPAs often have data in script tags)
  const extractedContent = extractAllContent(doc, html);
  
  // Sanitize HTML
  const sanitizedDoc = sanitizeDocument(doc, baseUrl);
  
  // Inject node IDs
  injectNodeIds(sanitizedDoc);
  
  // Extract sections
  let sections = extractSections(sanitizedDoc);
  
  // Fallback 1: if no sections found, create from body content
  if (sections.length === 0) {
    const bodyText = sanitizedDoc.body.textContent?.trim() || '';
    const wordCount = bodyText.split(/\s+/).filter(w => w.length > 0).length;
    
    if (wordCount > 5) {
      sections = [{
        id: 'section-0',
        type: 'unknown',
        html: sanitizedDoc.body.innerHTML,
        textContent: bodyText,
        order: 0,
        tagName: 'body',
        className: undefined,
        hasImages: sanitizedDoc.body.querySelector('img') !== null,
        hasForm: sanitizedDoc.body.querySelector('form, input') !== null,
        wordCount,
      }];
    }
  }
  
  // Fallback 2: if still no sections but we have extracted content (meta + JSON-LD + __NEXT_DATA__)
  if (sections.length === 0 && extractedContent.text.length > 20) {
    sections = [{
      id: 'section-0',
      type: 'unknown',
      html: `<div class="extracted-content">${escapeHtml(extractedContent.text)}</div>`,
      textContent: extractedContent.text,
      order: 0,
      tagName: 'div',
      className: 'extracted-content',
      hasImages: false,
      hasForm: false,
      wordCount: extractedContent.text.split(/\s+/).filter(w => w.length > 0).length,
    }];
  }
  
  // Get cleaned HTML
  const sanitizedHtml = sanitizedDoc.documentElement.outerHTML;
  const textContent = sections.length > 0 
    ? sections.map(s => s.textContent).join('\n\n')
    : extractedContent.text;
  const headHtml = sanitizedDoc.head.innerHTML;
  const bodyHtml = sanitizedDoc.body.innerHTML;
  
  return {
    title,
    description,
    ogTags,
    sections,
    assets,
    sanitizedHtml,
    textContent,
    headHtml,
    bodyHtml,
  };
}

/**
 * Extract all available content from various sources
 * - Meta tags (og:title, og:description, etc.)
 * - JSON-LD structured data
 * - Next.js __NEXT_DATA__
 * - Nuxt __NUXT__
 * - Any visible text
 */
function extractAllContent(doc: Document, rawHtml: string): { text: string; sources: string[] } {
  const parts: string[] = [];
  const sources: string[] = [];
  
  // 1. Meta description
  const description = getMetaContent(doc, 'description') || getMetaContent(doc, 'og:description');
  if (description) {
    parts.push(description);
    sources.push('meta:description');
  }
  
  // 2. Open Graph tags
  const ogTitle = getMetaContent(doc, 'og:title');
  const ogSiteName = getMetaContent(doc, 'og:site_name');
  if (ogSiteName && ogSiteName !== ogTitle) {
    parts.push(ogSiteName);
    sources.push('og:site_name');
  }
  
  // 3. JSON-LD structured data
  doc.querySelectorAll('script[type="application/ld+json"]').forEach(script => {
    try {
      const data = JSON.parse(script.textContent || '{}');
      const extracted = extractTextFromJsonLd(data);
      if (extracted) {
        parts.push(extracted);
        sources.push('json-ld');
      }
    } catch {
      // Ignore parse errors
    }
  });
  
  // 4. Next.js __NEXT_DATA__
  const nextDataMatch = rawHtml.match(/<script\s+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
  if (nextDataMatch) {
    try {
      const data = JSON.parse(nextDataMatch[1]);
      const extracted = extractTextFromNextData(data);
      if (extracted) {
        parts.push(extracted);
        sources.push('__NEXT_DATA__');
      }
    } catch {
      // Ignore parse errors
    }
  }
  
  // 5. Nuxt __NUXT__
  const nuxtMatch = rawHtml.match(/window\.__NUXT__\s*=\s*({[\s\S]*?});?\s*<\/script>/i);
  if (nuxtMatch) {
    try {
      const data = JSON.parse(nuxtMatch[1]);
      const extracted = extractTextFromNuxtData(data);
      if (extracted) {
        parts.push(extracted);
        sources.push('__NUXT__');
      }
    } catch {
      // Ignore parse errors
    }
  }
  
  // 6. Any h1-h6 headings in the document
  const headings: string[] = [];
  doc.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(h => {
    const text = h.textContent?.trim();
    if (text && text.length > 2) {
      headings.push(text);
    }
  });
  if (headings.length > 0) {
    parts.push(headings.join('. '));
    sources.push('headings');
  }
  
  // 7. Any visible paragraphs
  const paragraphs: string[] = [];
  doc.querySelectorAll('p').forEach(p => {
    const text = p.textContent?.trim();
    if (text && text.length > 20) {
      paragraphs.push(text);
    }
  });
  if (paragraphs.length > 0) {
    parts.push(paragraphs.slice(0, 10).join(' '));
    sources.push('paragraphs');
  }
  
  return {
    text: parts.join('\n\n'),
    sources,
  };
}

/**
 * Extract text from JSON-LD structured data
 */
function extractTextFromJsonLd(data: unknown): string {
  if (!data || typeof data !== 'object') return '';
  
  const parts: string[] = [];
  const obj = data as Record<string, unknown>;
  
  // Common JSON-LD properties
  if (obj.name && typeof obj.name === 'string') parts.push(obj.name);
  if (obj.description && typeof obj.description === 'string') parts.push(obj.description);
  if (obj.headline && typeof obj.headline === 'string') parts.push(obj.headline);
  if (obj.text && typeof obj.text === 'string') parts.push(obj.text);
  if (obj.about && typeof obj.about === 'string') parts.push(obj.about);
  
  // Organization schema
  if (obj['@type'] === 'Organization') {
    if (obj.slogan && typeof obj.slogan === 'string') parts.push(obj.slogan);
    if (obj.brand && typeof obj.brand === 'object') {
      const brand = obj.brand as Record<string, unknown>;
      if (brand.name && typeof brand.name === 'string') parts.push(brand.name);
    }
  }
  
  // WebSite schema
  if (obj['@type'] === 'WebSite') {
    if (obj.name && typeof obj.name === 'string') parts.push(obj.name);
  }
  
  // Handle arrays (@graph)
  if (Array.isArray(obj['@graph'])) {
    for (const item of obj['@graph']) {
      const extracted = extractTextFromJsonLd(item);
      if (extracted) parts.push(extracted);
    }
  }
  
  return parts.join(' ').trim();
}

/**
 * Extract text from Next.js __NEXT_DATA__
 */
function extractTextFromNextData(data: unknown): string {
  if (!data || typeof data !== 'object') return '';
  
  const parts: string[] = [];
  const obj = data as Record<string, unknown>;
  
  // Navigate to props.pageProps
  const props = obj.props as Record<string, unknown> | undefined;
  const pageProps = props?.pageProps as Record<string, unknown> | undefined;
  
  if (pageProps) {
    // Common Next.js data patterns
    if (pageProps.title && typeof pageProps.title === 'string') parts.push(pageProps.title);
    if (pageProps.description && typeof pageProps.description === 'string') parts.push(pageProps.description);
    if (pageProps.content && typeof pageProps.content === 'string') parts.push(pageProps.content);
    if (pageProps.headline && typeof pageProps.headline === 'string') parts.push(pageProps.headline);
    
    // Recursively extract strings from pageProps
    extractStringsFromObject(pageProps, parts, 3);
  }
  
  return parts.slice(0, 20).join(' ').trim();
}

/**
 * Extract text from Nuxt __NUXT__
 */
function extractTextFromNuxtData(data: unknown): string {
  if (!data || typeof data !== 'object') return '';
  
  const parts: string[] = [];
  const obj = data as Record<string, unknown>;
  
  // Nuxt state patterns
  if (obj.state && typeof obj.state === 'object') {
    extractStringsFromObject(obj.state as Record<string, unknown>, parts, 3);
  }
  
  return parts.slice(0, 20).join(' ').trim();
}

/**
 * Recursively extract strings from an object up to a max depth
 */
function extractStringsFromObject(obj: Record<string, unknown>, parts: string[], maxDepth: number): void {
  if (maxDepth <= 0) return;
  
  for (const value of Object.values(obj)) {
    if (typeof value === 'string' && value.length > 10 && value.length < 500) {
      // Skip URLs, code, and technical strings
      if (!value.startsWith('http') && !value.startsWith('/') && !value.includes('{') && !value.includes('function')) {
        parts.push(value);
      }
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      extractStringsFromObject(value as Record<string, unknown>, parts, maxDepth - 1);
    } else if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === 'string' && item.length > 10 && item.length < 500) {
          if (!item.startsWith('http') && !item.startsWith('/') && !item.includes('{')) {
            parts.push(item);
          }
        } else if (typeof item === 'object' && item !== null) {
          extractStringsFromObject(item as Record<string, unknown>, parts, maxDepth - 1);
        }
      }
    }
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Get meta tag content
 */
function getMetaContent(doc: Document, name: string): string | null {
  const meta = doc.querySelector(`meta[name="${name}"]`) || 
               doc.querySelector(`meta[property="${name}"]`) ||
               doc.querySelector(`meta[property="og:${name}"]`);
  return meta?.getAttribute('content') || null;
}

/**
 * Extract all Open Graph tags
 */
function extractOgTags(doc: Document): Record<string, string> {
  const ogTags: Record<string, string> = {};
  
  doc.querySelectorAll('meta[property^="og:"]').forEach(meta => {
    const property = meta.getAttribute('property')?.replace('og:', '');
    const content = meta.getAttribute('content');
    if (property && content) {
      ogTags[property] = content;
    }
  });
  
  return ogTags;
}

/**
 * Extract all assets (images, fonts, icons, stylesheets)
 */
function extractAssets(doc: Document, baseUrl: string): ParsedPage['assets'] {
  const images: string[] = [];
  const fonts: string[] = [];
  const icons: string[] = [];
  const stylesheets: string[] = [];
  
  // Images
  doc.querySelectorAll('img').forEach(img => {
    const src = img.getAttribute('src');
    if (src) {
      images.push(resolveUrl(src, baseUrl));
    }
  });
  
  // Background images in inline styles
  doc.querySelectorAll('[style*="background"]').forEach(el => {
    const style = el.getAttribute('style') || '';
    const match = style.match(/url\(['"]?([^'")\s]+)['"]?\)/);
    if (match) {
      images.push(resolveUrl(match[1], baseUrl));
    }
  });
  
  // Stylesheets
  doc.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
    const href = link.getAttribute('href');
    if (href) {
      stylesheets.push(resolveUrl(href, baseUrl));
      
      // Check for Google Fonts
      if (href.includes('fonts.googleapis.com') || href.includes('fonts.gstatic.com')) {
        fonts.push(href);
      }
    }
  });
  
  // Icons (favicons, apple-touch-icons)
  doc.querySelectorAll('link[rel*="icon"]').forEach(link => {
    const href = link.getAttribute('href');
    if (href) {
      icons.push(resolveUrl(href, baseUrl));
    }
  });
  
  // Extract fonts from @font-face in style tags
  doc.querySelectorAll('style').forEach(style => {
    const content = style.textContent || '';
    const fontMatches = content.match(/url\(['"]?([^'")\s]+\.(?:woff2?|ttf|otf|eot))['"]?\)/g);
    if (fontMatches) {
      fontMatches.forEach(match => {
        const url = match.match(/url\(['"]?([^'")\s]+)['"]?\)/)?.[1];
        if (url) {
          fonts.push(resolveUrl(url, baseUrl));
        }
      });
    }
  });
  
  return {
    images: [...new Set(images)],
    fonts: [...new Set(fonts)],
    icons: [...new Set(icons)],
    stylesheets: [...new Set(stylesheets)],
  };
}

/**
 * Resolve relative URL to absolute
 */
function resolveUrl(url: string, baseUrl: string): string {
  try {
    return new URL(url, baseUrl).toString();
  } catch {
    return url;
  }
}

/**
 * Sanitize document - remove scripts, tracking, harmful elements
 */
function sanitizeDocument(doc: Document, baseUrl: string): Document {
  // Remove harmful tags
  TAGS_TO_REMOVE.forEach(tag => {
    doc.querySelectorAll(tag).forEach(el => el.remove());
  });
  
  // Remove tracking-related elements
  doc.querySelectorAll('*').forEach(el => {
    // Check for tracking patterns in src/href
    const src = el.getAttribute('src') || el.getAttribute('href') || '';
    if (TRACKING_PATTERNS.some(pattern => pattern.test(src))) {
      el.remove();
      return;
    }
    
    // Remove harmful attributes
    ATTRS_TO_REMOVE.forEach(attr => {
      el.removeAttribute(attr);
    });
    
    // Remove all on* event handlers
    Array.from(el.attributes).forEach(attr => {
      if (attr.name.startsWith('on')) {
        el.removeAttribute(attr.name);
      }
    });
  });
  
  // Remove comments
  const iterator = doc.createNodeIterator(
    doc.documentElement,
    128, // NodeFilter.SHOW_COMMENT
    null
  );
  const comments: Comment[] = [];
  let comment;
  while ((comment = iterator.nextNode())) {
    comments.push(comment as Comment);
  }
  comments.forEach(c => c.remove());
  
  // Convert relative URLs to absolute
  doc.querySelectorAll('a[href]').forEach(a => {
    const href = a.getAttribute('href');
    if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
      a.setAttribute('href', resolveUrl(href, baseUrl));
    }
  });
  
  doc.querySelectorAll('img[src]').forEach(img => {
    const src = img.getAttribute('src');
    if (src) {
      img.setAttribute('src', resolveUrl(src, baseUrl));
    }
  });
  
  return doc;
}

/**
 * Inject data-node-id attributes for editing
 */
function injectNodeIds(doc: Document): void {
  let nodeIndex = 0;
  
  // Inject IDs into meaningful elements
  const meaningfulTags = [
    'section', 'article', 'header', 'footer', 'nav', 'main', 'aside',
    'div', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li', 'a', 'button', 'img', 'span',
    'form', 'input', 'textarea', 'select',
    'table', 'tr', 'td', 'th',
    'figure', 'figcaption', 'blockquote',
  ];
  
  meaningfulTags.forEach(tag => {
    doc.querySelectorAll(tag).forEach(el => {
      if (!el.getAttribute('data-node-id')) {
        el.setAttribute('data-node-id', `node-${nodeIndex++}`);
      }
    });
  });
  
  // Also inject section IDs for top-level sections
  doc.querySelectorAll('body > *').forEach((el, index) => {
    if (!el.getAttribute('data-section-id')) {
      el.setAttribute('data-section-id', `section-${index}`);
    }
  });
}

/**
 * Extract semantic sections from the page
 */
function extractSections(doc: Document): PageSection[] {
  const sections: PageSection[] = [];
  const body = doc.body;
  
  // Find the actual content container
  // Modern sites often wrap everything in #root, #app, #__next, .main, main, etc.
  const contentRoot = findContentRoot(body);
  
  // Get all section candidates from the content root
  const candidates = findSectionCandidates(contentRoot);
  
  candidates.forEach((el, index) => {
    const htmlEl = el as HTMLElement;
    const html = htmlEl.outerHTML;
    const textContent = htmlEl.textContent?.trim() || '';
    const wordCount = textContent.split(/\s+/).filter(w => w.length > 0).length;
    
    // Skip very small elements (unless they have images/videos)
    if (wordCount < 5 && !htmlEl.querySelector('img, video, iframe, svg')) {
      return;
    }
    
    const sectionType = detectSectionType(htmlEl);
    
    sections.push({
      id: htmlEl.getAttribute('data-section-id') || `section-${index}`,
      type: sectionType,
      html,
      textContent,
      order: index,
      tagName: htmlEl.tagName.toLowerCase(),
      className: htmlEl.className || undefined,
      hasImages: htmlEl.querySelector('img') !== null,
      hasForm: htmlEl.querySelector('form, input, button[type="submit"]') !== null,
      wordCount,
    });
  });
  
  return sections;
}

/**
 * Find the actual content root (unwrap SPA containers)
 */
function findContentRoot(body: HTMLElement): Element {
  // Common SPA/framework wrapper IDs
  const wrapperSelectors = [
    '#root',
    '#app',
    '#__next',
    '#__nuxt',
    '#gatsby-focus-wrapper',
    '[data-reactroot]',
    '.main-content',
    'main',
    '#main',
    '#content',
    '.content',
  ];
  
  for (const selector of wrapperSelectors) {
    const wrapper = body.querySelector(selector);
    if (wrapper && wrapper.children.length > 0) {
      // Check if this wrapper contains most of the page content
      const wrapperText = wrapper.textContent?.length || 0;
      const bodyText = body.textContent?.length || 1;
      
      // If wrapper contains >50% of content, use it as root
      if (wrapperText / bodyText > 0.5) {
        return wrapper;
      }
    }
  }
  
  // Check if body has only one child that contains all content
  const directChildren = Array.from(body.children).filter(el => {
    const tag = el.tagName.toLowerCase();
    return !['script', 'style', 'link', 'meta', 'noscript', 'svg'].includes(tag);
  });
  
  if (directChildren.length === 1) {
    const singleChild = directChildren[0];
    // If single wrapper div, look inside
    if (singleChild.tagName.toLowerCase() === 'div' && singleChild.children.length > 1) {
      return singleChild;
    }
  }
  
  return body;
}

/**
 * Find section candidates from a content root
 */
function findSectionCandidates(root: Element): Element[] {
  const skipTags = ['script', 'style', 'link', 'meta', 'noscript', 'svg', 'template'];
  
  // First, try direct children
  let candidates = Array.from(root.children).filter(el => {
    const tag = el.tagName.toLowerCase();
    return !skipTags.includes(tag);
  });
  
  // If only one or two elements, look deeper
  if (candidates.length <= 2) {
    // Try semantic section elements first
    const semanticSections = root.querySelectorAll('section, article, header, footer, nav, main, aside');
    if (semanticSections.length > 0) {
      candidates = Array.from(semanticSections);
    } else {
      // Look for divs with substantial content
      const allDivs = root.querySelectorAll(':scope > div > div, :scope > div > section');
      if (allDivs.length > 2) {
        candidates = Array.from(allDivs);
      }
    }
  }
  
  // Still no candidates? Try finding any element with meaningful content
  if (candidates.length === 0) {
    const allElements = root.querySelectorAll('div, section, article');
    candidates = Array.from(allElements).filter(el => {
      const text = el.textContent?.trim() || '';
      const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
      return wordCount >= 20; // At least 20 words
    }).slice(0, 20); // Limit to 20 sections max
  }
  
  // Filter out nested duplicates (if parent and child both selected, keep parent)
  const filtered: Element[] = [];
  for (const el of candidates) {
    const isNested = candidates.some(other => 
      other !== el && other.contains(el)
    );
    if (!isNested) {
      filtered.push(el);
    }
  }
  
  return filtered;
}

/**
 * Detect section type based on class names, IDs, and content
 */
function detectSectionType(el: HTMLElement): SectionType {
  const className = (el.className || '').toLowerCase();
  const id = (el.id || '').toLowerCase();
  const tagName = el.tagName.toLowerCase();
  const textContent = (el.textContent || '').toLowerCase();
  
  // Check tag name first
  if (tagName === 'header') return 'header';
  if (tagName === 'footer') return 'footer';
  if (tagName === 'nav') return 'header';
  
  // Check class/id patterns
  for (const [sectionType, patterns] of Object.entries(SECTION_PATTERNS)) {
    if (sectionType === 'unknown') continue;
    
    for (const pattern of patterns) {
      if (pattern.test(className) || pattern.test(id)) {
        return sectionType as SectionType;
      }
    }
  }
  
  // Check content indicators
  for (const [sectionType, indicators] of Object.entries(CONTENT_INDICATORS)) {
    if (sectionType === 'unknown' || indicators.length === 0) continue;
    
    const matchCount = indicators.filter(ind => textContent.includes(ind)).length;
    if (matchCount >= 2) {
      return sectionType as SectionType;
    }
  }
  
  // Position-based heuristics
  const parent = el.parentElement;
  if (parent) {
    const siblings = Array.from(parent.children);
    const index = siblings.indexOf(el);
    
    // First substantial element is likely hero
    if (index <= 1 && el.querySelector('h1')) {
      return 'hero';
    }
    
    // Last element is often CTA or footer
    if (index === siblings.length - 1) {
      if (el.querySelector('form') || textContent.includes('subscribe') || textContent.includes('newsletter')) {
        return 'cta';
      }
    }
  }
  
  // Check for specific content patterns
  if (el.querySelectorAll('img[src*="logo"], img[alt*="logo"]').length >= 3) {
    return 'logos';
  }
  
  if (el.querySelectorAll('blockquote, [class*="quote"]').length >= 1) {
    return 'testimonials';
  }
  
  if (textContent.match(/\$\d+|free|pricing|plans/i)) {
    return 'pricing';
  }
  
  return 'unknown';
}

/**
 * Clean HTML for AI processing (strip tags but keep structure)
 */
export function htmlToCleanText(html: string): string {
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  
  // Remove script and style content
  doc.querySelectorAll('script, style, noscript').forEach(el => el.remove());
  
  // Add newlines after block elements
  const blockTags = ['p', 'div', 'section', 'article', 'header', 'footer', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'br'];
  blockTags.forEach(tag => {
    doc.querySelectorAll(tag).forEach(el => {
      el.insertAdjacentText('afterend', '\n');
    });
  });
  
  const text = doc.body.textContent || '';
  
  // Clean up whitespace
  return text
    .replace(/\s+/g, ' ')
    .replace(/\n\s+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Extract all text from headings
 */
export function extractHeadings(doc: Document): { level: number; text: string }[] {
  const headings: { level: number; text: string }[] = [];
  
  doc.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(h => {
    const level = parseInt(h.tagName[1]);
    const text = h.textContent?.trim() || '';
    if (text) {
      headings.push({ level, text });
    }
  });
  
  return headings;
}

/**
 * Extract all link texts and URLs
 */
export function extractLinks(doc: Document): { text: string; href: string }[] {
  const links: { text: string; href: string }[] = [];
  
  doc.querySelectorAll('a[href]').forEach(a => {
    const text = a.textContent?.trim() || '';
    const href = a.getAttribute('href') || '';
    if (text && href && !href.startsWith('#') && !href.startsWith('javascript:')) {
      links.push({ text, href });
    }
  });
  
  return links;
}
