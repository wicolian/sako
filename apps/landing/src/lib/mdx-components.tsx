import Link from 'next/link';

// Define MDXComponents type since it's not available from mdx/types
type MDXComponents = Record<string, React.ComponentType<any>>;
import { LegalContent } from '@/components/blocks/LegalContent';
import { ManageCookiesButton } from '@/components/ui/buttons/manage-cookies-button';
import {
  ServicesHero,
  CoreDesignBento,
  WebBuildBento,
  MotionVideoBento,
  OngoingSupportBento,
  ScopeBoundaries,
  WebScopeBrief,
  FastestWin,
  ServicesCTA,
} from '@/components/blocks/ServicesBento';
import React from 'react';

// MDX Link Component
const MdxLink: React.FC<{ href?: string; children: React.ReactNode }> = ({ href, children }) => {
  const isExternal = href?.startsWith('http');
  if (isExternal) {
    // Add nofollow for external links (except our own domains)
    const isOwnDomain = href?.includes('trysako.com') || href?.includes('creativeops.in');
    const rel = isOwnDomain ? "noopener noreferrer" : "noopener noreferrer nofollow";

    return React.createElement('a', {
      href,
      target: "_blank",
      rel,
      className: "text-black underline underline-offset-4 hover:text-[#9AE83E] transition-colors"
    }, children);
  }
  return React.createElement(Link, {
    href: href || '/',
    className: "text-black underline underline-offset-4 hover:text-[#9AE83E] transition-colors"
  }, children);
};

// MDX Paragraph Component with email auto-mailto
const MdxParagraph: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return React.createElement('p', {
    className: "text-gray-600 leading-relaxed mb-4"
  }, processChildrenForEmails(children, false));
};

// Email processing utility - only process emails when not in link context
const processTextForEmails = (text: string, inLinkContext: boolean = false) => {
  // If we're in a link context, don't process emails to avoid nested <a> tags
  if (inLinkContext) {
    return text;
  }

  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
  const parts = text.split(emailRegex);
  const matches = text.match(emailRegex);

  if (!matches || parts.length === 1) {
    return text;
  }

  const result = [];
  for (let i = 0; i < parts.length; i++) {
    if (parts[i]) {
      result.push(parts[i]);
    }
    if (matches[i]) {
      result.push(
        React.createElement('a', {
          key: `email-${i}-${Math.random()}`,
          href: `mailto:${matches[i]}`,
          className: "text-black underline underline-offset-4 hover:text-[#9AE83E] transition-colors"
        }, matches[i])
      );
    }
  }
  return result;
};

const processChildrenForEmails = (children: any, inLinkContext: boolean = false): any => {
  if (typeof children === 'string') {
    return processTextForEmails(children, inLinkContext);
  }

  if (Array.isArray(children)) {
    return children.map((child, index) =>
      React.createElement(React.Fragment, { key: `frag-${index}-${Math.random()}` }, processChildrenForEmails(child, inLinkContext))
    );
  }

  if (typeof children === 'object' && children !== null && 'props' in children) {
    // Check if this is a link element - be more thorough in detection
    const elementType = children.type;
    const isLinkElement =
      elementType === 'a' ||
      (typeof elementType === 'function' && elementType.name === 'MdxLink') ||
      (typeof elementType === 'object' && elementType?.name === 'MdxLink') ||
      (children.props?.href && typeof children.props.href === 'string');

    const newInLinkContext = inLinkContext || isLinkElement;

    // If this is a link element, don't process its children for emails to avoid nested <a> tags
    if (isLinkElement) {
      return children;
    }

    return React.cloneElement(children, {
      ...children.props,
      children: processChildrenForEmails(children.props.children, newInLinkContext)
    });
  }

  return children;
};

// Generate slug from text for heading IDs
function generateSlug(children: React.ReactNode): string {
  const text = React.Children.toArray(children)
    .map(child => {
      if (typeof child === 'string') return child;
      if (React.isValidElement(child) && child.props) {
        return generateSlug((child.props as { children?: React.ReactNode }).children);
      }
      return '';
    })
    .join('');
  
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

// Custom MDX components for consistent styling
export function getMDXComponents(components: MDXComponents): MDXComponents {
  return {
    // Headings with proper IDs for SEO and anchor linking
    h1: ({ children }: { children: React.ReactNode }) => {
      const id = generateSlug(children);
      return React.createElement('h1', {
        id,
        className: "text-4xl sm:text-5xl font-semibold text-black tracking-tight mb-6 scroll-mt-24"
      }, children);
    },

    h2: ({ children }: { children: React.ReactNode }) => {
      const id = generateSlug(children);
      return React.createElement('h2', {
        id,
        className: "text-2xl sm:text-3xl font-medium text-black tracking-tight mt-12 mb-4 scroll-mt-24"
      }, children);
    },

    h3: ({ children }: { children: React.ReactNode }) => {
      const id = generateSlug(children);
      return React.createElement('h3', {
        id,
        className: "text-xl font-semibold text-black mt-8 mb-3 scroll-mt-24"
      }, children);
    },

    h4: ({ children }: { children: React.ReactNode }) => {
      const id = generateSlug(children);
      return React.createElement('h4', {
        id,
        className: "text-lg font-semibold text-black mt-6 mb-2 scroll-mt-24"
      }, children);
    },
    
    h5: ({ children }: { children: React.ReactNode }) => {
      const id = generateSlug(children);
      return React.createElement('h5', {
        id,
        className: "text-base font-semibold text-black mt-4 mb-2 scroll-mt-24"
      }, children);
    },
    
    h6: ({ children }: { children: React.ReactNode }) => {
      const id = generateSlug(children);
      return React.createElement('h6', {
        id,
        className: "text-sm font-semibold text-gray-700 mt-4 mb-2 scroll-mt-24"
      }, children);
    },

    strong: ({ children }: { children: React.ReactNode }) =>
      React.createElement('strong', {
        className: "font-semibold text-black"
      }, children),

    em: ({ children }: { children: React.ReactNode }) =>
      React.createElement('em', {
        className: "font-serif italic text-brand-serif-accent"
      }, children),

    // Links and auto-mailto for emails
    a: MdxLink,

    // Paragraphs and text (with auto-mailto for emails)
    p: MdxParagraph,

    // Handle plain text and div elements that might contain emails
    div: ({ children, className, ...props }: { children: React.ReactNode; className?: string; [key: string]: any }) =>
      React.createElement('div', { className, ...props }, processChildrenForEmails(children, false)),

    span: ({ children, className, ...props }: { children: React.ReactNode; className?: string; [key: string]: any }) =>
      React.createElement('span', { className, ...props }, processChildrenForEmails(children, false)),
    
    // Lists
    ul: ({ children }: { children: React.ReactNode }) =>
      React.createElement('ul', {
        className: "list-disc list-inside space-y-2 text-gray-600 mb-6 ml-4"
      }, children),

    ol: ({ children }: { children: React.ReactNode }) =>
      React.createElement('ol', {
        className: "list-decimal list-inside space-y-2 text-gray-600 mb-6 ml-4"
      }, children),

    li: ({ children }: { children: React.ReactNode }) =>
      React.createElement('li', {
        className: "leading-relaxed"
      }, children),

    // Blockquote
    blockquote: ({ children }: { children: React.ReactNode }) =>
      React.createElement('blockquote', {
        className: "border-l-4 border-[#9AE83E] pl-6 py-2 my-6 italic text-gray-600 bg-gray-50 rounded-r-lg"
      }, children),

    // Code
    code: ({ children }: { children: React.ReactNode }) =>
      React.createElement('code', {
        className: "bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono text-gray-800"
      }, children),

    pre: ({ children }: { children: React.ReactNode }) =>
      React.createElement('pre', {
        className: "bg-gray-900 text-gray-100 p-4 rounded-xl overflow-x-auto mb-6 font-mono text-sm"
      }, children),

    // Horizontal rule
    hr: () =>
      React.createElement('hr', {
        className: "border-gray-200 my-12"
      }),

    // Custom components
    LegalContent: ({ title, lastUpdated, children }: { title: string; lastUpdated?: string; children: React.ReactNode }) => {
      // Use current date if no lastUpdated provided
      const currentDate = lastUpdated || new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      return React.createElement(LegalContent, {
        title,
        lastUpdated: currentDate,
        children
      });
    },

    // Table
    table: ({ children }: { children: React.ReactNode }) =>
      React.createElement('div', {
        className: "overflow-x-auto mb-6"
      }, React.createElement('table', {
        className: "w-full border-collapse"
      }, children)),

    th: ({ children }: { children: React.ReactNode }) =>
      React.createElement('th', {
        className: "border border-gray-200 bg-gray-50 px-4 py-3 text-left font-semibold text-sm"
      }, children),

    td: ({ children }: { children: React.ReactNode }) =>
      React.createElement('td', {
        className: "border border-gray-200 px-4 py-3 text-sm text-gray-600"
      }, children),

    // Cookie consent button - rendered directly as the component
    ManageCookiesButton,

    // Services page components
    ServicesHero,
    CoreDesignBento,
    WebBuildBento,
    MotionVideoBento,
    OngoingSupportBento,
    ScopeBoundaries,
    WebScopeBrief,
    FastestWin,
    ServicesCTA,

    ...components,
  };
}


