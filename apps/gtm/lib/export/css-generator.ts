/**
 * CSS Generator
 * 
 * Generates optimized CSS from design global styles
 */

import type { WebsiteDesign } from '@/lib/website/ai-designer'

type GlobalStyles = WebsiteDesign['globalStyles']

/**
 * Generate CSS custom properties from global styles
 */
export function generateCssVariables(styles: GlobalStyles): string {
  const borderRadius = getBorderRadius(styles.borderRadius)

  return `    :root {
      --color-primary: ${styles.primaryColor || '#6366f1'};
      --color-secondary: ${styles.secondaryColor || styles.primaryColor || '#6366f1'};
      --color-accent: ${styles.accentColor || '#f59e0b'};
      --font-heading: '${styles.fontHeading || 'Inter'}', system-ui, sans-serif;
      --font-body: '${styles.fontBody || 'Inter'}', system-ui, sans-serif;
      --radius-sm: ${borderRadius.sm};
      --radius-md: ${borderRadius.md};
      --radius-lg: ${borderRadius.lg};
      --radius-full: ${borderRadius.full};
    }`
}

/**
 * Generate the main CSS stylesheet
 */
export function generateCss(styles: GlobalStyles): string {
  const isDark = styles.colorScheme === 'dark'

  return `    /* Reset & Base */
    *, *::before, *::after {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    html {
      scroll-behavior: smooth;
    }
    
    body {
      font-family: var(--font-body);
      line-height: 1.6;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      ${isDark ? `
      background-color: #0a0a0a;
      color: #fafafa;
      ` : `
      background-color: #ffffff;
      color: #0a0a0a;
      `}
    }
    
    h1, h2, h3, h4, h5, h6 {
      font-family: var(--font-heading);
      line-height: 1.2;
      font-weight: 700;
    }
    
    img, video {
      max-width: 100%;
      height: auto;
      display: block;
    }
    
    a {
      color: inherit;
      text-decoration: none;
    }
    
    /* Buttons */
    .btn-primary {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 0.875rem 1.75rem;
      background-color: var(--color-primary);
      color: white;
      font-family: var(--font-body);
      font-size: 1rem;
      font-weight: 600;
      border-radius: var(--radius-md);
      border: none;
      cursor: pointer;
      transition: all 0.2s ease;
      text-decoration: none;
    }
    
    .btn-primary:hover {
      opacity: 0.9;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }
    
    .btn-primary:active {
      transform: translateY(0);
    }
    
    .btn-secondary {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 0.875rem 1.75rem;
      background-color: transparent;
      color: var(--color-primary);
      font-family: var(--font-body);
      font-size: 1rem;
      font-weight: 600;
      border-radius: var(--radius-md);
      border: 2px solid var(--color-primary);
      cursor: pointer;
      transition: all 0.2s ease;
      text-decoration: none;
    }
    
    .btn-secondary:hover {
      background-color: var(--color-primary);
      color: white;
    }
    
    .btn-ghost {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 0.875rem 1.75rem;
      background-color: transparent;
      color: var(--color-primary);
      font-family: var(--font-body);
      font-size: 1rem;
      font-weight: 600;
      border-radius: var(--radius-md);
      border: none;
      cursor: pointer;
      transition: all 0.2s ease;
      text-decoration: none;
    }
    
    .btn-ghost:hover {
      background-color: var(--color-primary);
      background-opacity: 0.1;
    }
    
    /* Typography */
    .text-primary {
      color: var(--color-primary);
    }
    
    .text-secondary {
      color: var(--color-secondary);
    }
    
    .bg-primary {
      background-color: var(--color-primary);
    }
    
    /* Cards */
    .card {
      background: ${isDark ? '#1a1a1a' : '#ffffff'};
      border-radius: var(--radius-lg);
      padding: 1.5rem;
      border: 1px solid ${isDark ? '#2a2a2a' : '#e5e7eb'};
    }
    
    /* Focus styles */
    :focus-visible {
      outline: 2px solid var(--color-primary);
      outline-offset: 2px;
    }
    
    /* Selection */
    ::selection {
      background-color: var(--color-primary);
      color: white;
    }
    
    /* Animations */
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    .animate-fade-in {
      animation: fadeIn 0.5s ease-out forwards;
    }
    
    /* Responsive utilities */
    @media (max-width: 768px) {
      .btn-primary, .btn-secondary {
        padding: 0.75rem 1.25rem;
        font-size: 0.875rem;
      }
    }`
}

/**
 * Get border radius values based on style preference
 */
function getBorderRadius(style: GlobalStyles['borderRadius']): {
  sm: string
  md: string
  lg: string
  full: string
} {
  switch (style) {
    case 'none':
      return { sm: '0', md: '0', lg: '0', full: '0' }
    case 'small':
      return { sm: '0.125rem', md: '0.25rem', lg: '0.375rem', full: '9999px' }
    case 'large':
      return { sm: '0.375rem', md: '0.75rem', lg: '1rem', full: '9999px' }
    case 'full':
      return { sm: '9999px', md: '9999px', lg: '9999px', full: '9999px' }
    default: // medium
      return { sm: '0.25rem', md: '0.5rem', lg: '0.75rem', full: '9999px' }
  }
}

/**
 * Generate responsive CSS for a specific breakpoint
 */
export function generateResponsiveCss(styles: GlobalStyles): string {
  return `
    /* Mobile-first responsive styles */
    @media (min-width: 640px) {
      /* sm breakpoint */
    }
    
    @media (min-width: 768px) {
      /* md breakpoint */
    }
    
    @media (min-width: 1024px) {
      /* lg breakpoint */
    }
    
    @media (min-width: 1280px) {
      /* xl breakpoint */
    }
  `
}

/**
 * Generate dark mode CSS overrides
 */
export function generateDarkModeCss(): string {
  return `
    /* Dark mode */
    @media (prefers-color-scheme: dark) {
      body {
        background-color: #0a0a0a;
        color: #fafafa;
      }
      
      .card {
        background: #1a1a1a;
        border-color: #2a2a2a;
      }
    }
  `
}
