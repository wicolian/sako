import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import readingTime from 'reading-time';
import { appendUTMParams, getUTMCampaignParams } from './utils';

// Types
export interface PageFrontmatter {
  title: string;
  slug: string;
  template: 'standard' | 'comparison' | 'legal' | 'audience' | 'pricing' | 'calculator' | 'contact';
  published: boolean;
  priority?: number;
  seo: {
    metaTitle: string;
    metaDescription: string;
    keywords?: string[];
    ogImage?: string;
  };
  jsonLd?: {
    type: string;
  };
  updatedAt?: string;
}

export interface PageData {
  frontmatter: PageFrontmatter;
  content: string;
  readingTime: string;
  slug: string;
}

const CONTENT_PATH = path.join(process.cwd(), 'content');

// Recursively get all MDX files
function getMdxFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) {
    return [];
  }
  
  const files: string[] = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      files.push(...getMdxFiles(fullPath));
    } else if (item.name.endsWith('.mdx')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

// Get slug from file path
function getSlugFromPath(filePath: string): string {
  const relativePath = path.relative(CONTENT_PATH, filePath);
  const slug = relativePath
    .replace(/\.mdx$/, '')
    .replace(/\/index$/, '')
    .replace(/\\/g, '/');
  
  // Handle root index (home page)
  if (slug === 'home' || slug === 'index') {
    return '';
  }
  
  return slug;
}

// Get all pages
export async function getAllPages(): Promise<PageData[]> {
  const files = getMdxFiles(CONTENT_PATH);

  const pages = files.map((filePath) => {
    const source = fs.readFileSync(filePath, 'utf8');
    const { data, content: rawContent } = matter(source);
    const slug = getSlugFromPath(filePath);

    // Process UTM links in content
    const content = processMDXLinks(rawContent, 'content');

    // Always use current date for updatedAt - pages are updated when built
    const now = new Date();
    const updatedAt = now.toISOString().split('T')[0]; // YYYY-MM-DD format

    const frontmatter = {
      ...data,
      updatedAt,
    } as PageFrontmatter;

    return {
      frontmatter,
      content,
      readingTime: readingTime(content).text,
      slug,
    };
  });

  return pages;
}

// Get published pages only (for production)
export async function getPublishedPages(): Promise<PageData[]> {
  const allPages = await getAllPages();
  
  if (process.env.NODE_ENV === 'production') {
    return allPages.filter((page) => page.frontmatter.published === true);
  }
  
  return allPages;
}

// Get page by slug
export async function getPageBySlug(slug: string): Promise<PageData | null> {
  const pages = await getAllPages();

  // Handle home page
  const searchSlug = slug === '' || slug === '/' ? '' : slug;

  const page = pages.find((p) => {
    const pageSlug = p.frontmatter.slug || p.slug;
    return pageSlug === searchSlug || pageSlug === `/${searchSlug}`;
  });

  return page || null;
}

// Generate static params for all pages
export async function generateAllStaticParams(): Promise<{ slug: string[] }[]> {
  const pages = await getPublishedPages();
  
  return pages.map((page) => {
    const slug = page.frontmatter.slug || page.slug;
    // Split slug into segments, filter empty strings
    const segments = slug.split('/').filter(Boolean);
    return { slug: segments };
  });
}

// Get pages by template
export async function getPagesByTemplate(template: PageFrontmatter['template']): Promise<PageData[]> {
  const pages = await getPublishedPages();
  return pages.filter((page) => page.frontmatter.template === template);
}

// Parse title with {italic} markers
export function parseTitle(title: string): { before: string; italic: string; after: string }[] {
  const parts: { before: string; italic: string; after: string }[] = [];
  const regex = /\{([^}]+)\}/g;
  let lastIndex = 0;
  let match;
  
  while ((match = regex.exec(title)) !== null) {
    const before = title.slice(lastIndex, match.index);
    const italic = match[1];
    lastIndex = regex.lastIndex;
    
    // Look ahead for more text
    const nextMatch = regex.exec(title);
    regex.lastIndex = lastIndex; // Reset for next iteration
    
    const after = nextMatch 
      ? title.slice(lastIndex, nextMatch.index) 
      : title.slice(lastIndex);
    
    parts.push({ before, italic, after: nextMatch ? '' : after });
    
    if (!nextMatch) break;
  }
  
  // If no matches, return the whole title as "before"
  if (parts.length === 0) {
    parts.push({ before: title, italic: '', after: '' });
  }
  
  return parts;
}

// Process external links in MDX content - replaces hardcoded URLs with environment variables
export function processMDXLinks(content: string, campaign: string = 'content') {
  let processedContent = content;

  // Replace external URLs with environment variables (UTM params added at runtime by UTMTrackedLink)
  const replacements = [
    {
      pattern: /https:\/\/app\.trysako\.com(?![?&])/g,
      replacement: process.env.NEXT_PUBLIC_APP_URL!
    },
    {
      pattern: /https:\/\/cal\.com\/koushik-venkatesan-mmvnbd\/sako-fit-check(?![?&])/g,
      replacement: process.env.NEXT_PUBLIC_BOOKING_URL!
    }
  ];

  replacements.forEach(({ pattern, replacement }) => {
    processedContent = processedContent.replace(pattern, replacement);
  });

  return processedContent;
}

