/**
 * Minimal HTML template sanitizer. Removes scripts, inline event handlers
 * and comments, and splits a page into top-level <section> blocks.
 */
export interface SanitizeResult {
  html: string;
  removed: string[];
}

export function sanitizeTemplate(html: string): SanitizeResult {
  const removed: string[] = [];
  let out = html.replace(/<script[\s\S]*?<\/script>/gi, () => { removed.push('script'); return ''; });
  out = out.replace(/\son\w+="[^"]*"/gi, () => { removed.push('event-handler'); return ''; });
  out = out.replace(/<!--[\s\S]*?-->/g, '');
  return { html: out.trim(), removed };
}

export function extractSections(html: string): { index: number; html: string }[] {
  const matches = html.match(/<section[\s\S]*?<\/section>/gi) ?? [html];
  return matches.map((h, index) => ({ index, html: h }));
}
