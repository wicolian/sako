/**
 * Newsletter Templates
 * 
 * Pre-built newsletter design templates:
 * - Industry-specific templates
 * - Seasonal templates
 * - Use-case templates
 */

import type { NewsletterContent, NewsletterSection, ColorScheme, Typography } from '@/components/newsletter/newsletter-editor'

export interface NewsletterTemplate {
  id: string
  name: string
  description: string
  category: TemplateCategory
  thumbnail?: string
  content: NewsletterContent
  tags: string[]
}

export type TemplateCategory =
  | 'product'
  | 'announcement'
  | 'promotional'
  | 'educational'
  | 'seasonal'
  | 'welcome'
  | 'digest'

export const TEMPLATE_CATEGORIES: { id: TemplateCategory; label: string; description: string }[] = [
  { id: 'product', label: 'Product Launch', description: 'New product and feature announcements' },
  { id: 'announcement', label: 'Announcement', description: 'Company news and updates' },
  { id: 'promotional', label: 'Promotional', description: 'Sales, discounts, and offers' },
  { id: 'educational', label: 'Educational', description: 'Tips, guides, and how-tos' },
  { id: 'seasonal', label: 'Seasonal', description: 'Holiday and seasonal campaigns' },
  { id: 'welcome', label: 'Welcome', description: 'New subscriber onboarding' },
  { id: 'digest', label: 'Digest', description: 'Weekly/monthly content roundups' },
]

// Default color schemes
const COLOR_SCHEMES: Record<string, ColorScheme> = {
  modern: {
    background: '#ffffff',
    text: '#1a1a1a',
    accent: '#6366f1',
    buttonBackground: '#6366f1',
    buttonText: '#ffffff',
    headerBackground: '#6366f1',
    footerBackground: '#f3f4f6',
  },
  minimal: {
    background: '#ffffff',
    text: '#374151',
    accent: '#111827',
    buttonBackground: '#111827',
    buttonText: '#ffffff',
    headerBackground: '#ffffff',
    footerBackground: '#fafafa',
  },
  warm: {
    background: '#fffbeb',
    text: '#451a03',
    accent: '#f59e0b',
    buttonBackground: '#f59e0b',
    buttonText: '#ffffff',
    headerBackground: '#fef3c7',
    footerBackground: '#fef3c7',
  },
  ocean: {
    background: '#f0f9ff',
    text: '#0c4a6e',
    accent: '#0ea5e9',
    buttonBackground: '#0ea5e9',
    buttonText: '#ffffff',
    headerBackground: '#0ea5e9',
    footerBackground: '#e0f2fe',
  },
  forest: {
    background: '#f0fdf4',
    text: '#14532d',
    accent: '#22c55e',
    buttonBackground: '#22c55e',
    buttonText: '#ffffff',
    headerBackground: '#22c55e',
    footerBackground: '#dcfce7',
  },
  holiday: {
    background: '#fef2f2',
    text: '#7f1d1d',
    accent: '#dc2626',
    buttonBackground: '#dc2626',
    buttonText: '#ffffff',
    headerBackground: '#dc2626',
    footerBackground: '#fee2e2',
  },
}

// Default typography
const TYPOGRAPHY: Typography = {
  headingFont: 'Georgia, serif',
  bodyFont: 'Arial, sans-serif',
  headingSize: 28,
  bodySize: 16,
  lineHeight: 1.6,
}

// Template definitions
export const NEWSLETTER_TEMPLATES: NewsletterTemplate[] = [
  // Product Launch Templates
  {
    id: 'product-launch-modern',
    name: 'Modern Product Launch',
    description: 'Clean, modern template for announcing new products',
    category: 'product',
    tags: ['product', 'launch', 'modern', 'minimal'],
    content: {
      subject: 'Introducing [Product Name] - Your Solution to [Problem]',
      preheader: 'Be the first to experience our latest innovation',
      sections: [
        { id: 'header-1', type: 'header', content: { text: 'PRODUCT LAUNCH' } },
        { id: 'hero-1', type: 'hero', content: { headline: 'Introducing [Product Name]', subheadline: 'The solution you\'ve been waiting for' } },
        { id: 'text-1', type: 'text', content: { text: 'We\'re thrilled to announce our newest product that will revolutionize the way you work. After months of development and feedback from users like you, we\'re finally ready to share it with the world.' } },
        { id: 'columns-1', type: 'columns', content: { leftTitle: 'Feature 1', leftText: 'Description of the first key feature', rightTitle: 'Feature 2', rightText: 'Description of the second key feature' } },
        { id: 'cta-1', type: 'cta', content: { text: 'Explore Now', url: '' } },
        { id: 'footer-1', type: 'footer', content: { text: '© 2026 Company Name | Unsubscribe | Privacy Policy' } },
      ],
      colorScheme: COLOR_SCHEMES.modern,
      typography: TYPOGRAPHY,
    },
  },

  // Welcome Series
  {
    id: 'welcome-series-friendly',
    name: 'Friendly Welcome',
    description: 'Warm welcome email for new subscribers',
    category: 'welcome',
    tags: ['welcome', 'onboarding', 'friendly'],
    content: {
      subject: 'Welcome to [Company] - Let\'s get started!',
      preheader: 'Everything you need to know to get the most out of your subscription',
      sections: [
        { id: 'header-1', type: 'header', content: { text: 'WELCOME ABOARD!' } },
        { id: 'text-1', type: 'text', content: { text: 'Hi there! 👋\n\nWe\'re so excited to have you join our community. You\'ve made a great decision, and we can\'t wait to show you everything we have in store.' } },
        { id: 'text-2', type: 'text', content: { text: 'Here\'s what you can expect from us:\n\n• Weekly tips and insights\n• Exclusive member-only content\n• Early access to new features\n• Special offers and discounts' } },
        { id: 'cta-1', type: 'cta', content: { text: 'Complete Your Profile', url: '' } },
        { id: 'divider-1', type: 'divider', content: {} },
        { id: 'text-3', type: 'text', content: { text: 'Have questions? Reply to this email - we read and respond to every message!' } },
        { id: 'footer-1', type: 'footer', content: { text: 'Thanks for joining us!\n\n© 2026 Company Name' } },
      ],
      colorScheme: COLOR_SCHEMES.warm,
      typography: { ...TYPOGRAPHY, bodySize: 16, lineHeight: 1.7 },
    },
  },

  // Promotional Templates
  {
    id: 'sale-announcement',
    name: 'Flash Sale',
    description: 'High-impact template for sales and promotions',
    category: 'promotional',
    tags: ['sale', 'promotion', 'discount', 'urgent'],
    content: {
      subject: '⚡ FLASH SALE: [X]% Off Everything - Today Only!',
      preheader: 'Don\'t miss out on our biggest sale of the year',
      sections: [
        { id: 'header-1', type: 'header', content: { text: '⚡ FLASH SALE ⚡' } },
        { id: 'hero-1', type: 'hero', content: { headline: 'UP TO 50% OFF', subheadline: 'For the next 24 hours only' } },
        { id: 'text-1', type: 'text', content: { text: 'This is not a drill! Our biggest sale of the season is happening RIGHT NOW. Everything in our store is marked down, and the clock is ticking.' } },
        { id: 'cta-1', type: 'cta', content: { text: 'SHOP THE SALE', url: '' } },
        { id: 'text-2', type: 'text', content: { text: 'Use code FLASH50 at checkout for an additional 10% off!' } },
        { id: 'footer-1', type: 'footer', content: { text: 'Sale ends at midnight. Some exclusions apply.\n\n© 2026 Company Name' } },
      ],
      colorScheme: {
        ...COLOR_SCHEMES.modern,
        accent: '#dc2626',
        buttonBackground: '#dc2626',
        headerBackground: '#dc2626',
      },
      typography: { ...TYPOGRAPHY, headingSize: 36 },
    },
  },

  // Educational/Content Templates
  {
    id: 'weekly-tips',
    name: 'Weekly Tips',
    description: 'Educational content with actionable tips',
    category: 'educational',
    tags: ['tips', 'education', 'weekly', 'content'],
    content: {
      subject: '5 Tips to [Achieve Goal] This Week',
      preheader: 'Actionable advice you can implement today',
      sections: [
        { id: 'header-1', type: 'header', content: { text: 'WEEKLY INSIGHTS' } },
        { id: 'text-1', type: 'text', content: { text: 'Happy [Day]!\n\nThis week, we\'re diving into [topic] and sharing our top strategies for success.' } },
        { id: 'text-2', type: 'text', content: { text: '**Tip #1: Start Small**\n\nThe best way to build a new habit is to start with something so small you can\'t say no...' } },
        { id: 'text-3', type: 'text', content: { text: '**Tip #2: Be Consistent**\n\nConsistency beats intensity every time. Focus on showing up rather than being perfect...' } },
        { id: 'text-4', type: 'text', content: { text: '**Tip #3: Track Progress**\n\nWhat gets measured gets managed. Keep a simple log of your daily activities...' } },
        { id: 'divider-1', type: 'divider', content: {} },
        { id: 'cta-1', type: 'cta', content: { text: 'Read Full Guide', url: '' } },
        { id: 'footer-1', type: 'footer', content: { text: 'See you next week!\n\n© 2026 Company Name' } },
      ],
      colorScheme: COLOR_SCHEMES.ocean,
      typography: { ...TYPOGRAPHY, bodyFont: 'Georgia, serif' },
    },
  },

  // Seasonal Templates
  {
    id: 'holiday-greeting',
    name: 'Holiday Greeting',
    description: 'Festive template for holiday communications',
    category: 'seasonal',
    tags: ['holiday', 'seasonal', 'festive', 'greeting'],
    content: {
      subject: '🎄 Season\'s Greetings from [Company]',
      preheader: 'Wishing you a wonderful holiday season',
      sections: [
        { id: 'header-1', type: 'header', content: { text: '🎄 HAPPY HOLIDAYS 🎄' } },
        { id: 'hero-1', type: 'hero', content: { headline: 'Season\'s Greetings', subheadline: 'From our family to yours' } },
        { id: 'text-1', type: 'text', content: { text: 'As the year comes to a close, we wanted to take a moment to express our heartfelt gratitude for your continued support and trust in us.' } },
        { id: 'text-2', type: 'text', content: { text: 'This year has been incredible, and it\'s all thanks to amazing customers like you. Here\'s to an even better year ahead!' } },
        { id: 'cta-1', type: 'cta', content: { text: 'See Our Year in Review', url: '' } },
        { id: 'footer-1', type: 'footer', content: { text: 'With warm wishes,\nThe [Company] Team\n\n© 2026 Company Name' } },
      ],
      colorScheme: COLOR_SCHEMES.holiday,
      typography: { ...TYPOGRAPHY, headingFont: 'Georgia, serif' },
    },
  },

  // Digest Templates
  {
    id: 'monthly-digest',
    name: 'Monthly Digest',
    description: 'Content roundup for newsletters and blogs',
    category: 'digest',
    tags: ['digest', 'roundup', 'monthly', 'content'],
    content: {
      subject: 'Your [Month] Digest: Top Stories & Updates',
      preheader: 'Everything you might have missed this month',
      sections: [
        { id: 'header-1', type: 'header', content: { text: 'MONTHLY DIGEST' } },
        { id: 'text-1', type: 'text', content: { text: 'Here\'s your monthly roundup of the best content, updates, and news from [Company].' } },
        { id: 'columns-1', type: 'columns', content: { leftTitle: '📰 Top Story', leftText: 'Our most-read article this month was about...', rightTitle: '🎉 Product Update', rightText: 'We launched a new feature that lets you...' } },
        { id: 'divider-1', type: 'divider', content: {} },
        { id: 'text-2', type: 'text', content: { text: '**More Stories You Might Like:**\n\n• Article title one\n• Article title two\n• Article title three' } },
        { id: 'cta-1', type: 'cta', content: { text: 'Visit Our Blog', url: '' } },
        { id: 'footer-1', type: 'footer', content: { text: 'Until next month!\n\n© 2026 Company Name' } },
      ],
      colorScheme: COLOR_SCHEMES.minimal,
      typography: TYPOGRAPHY,
    },
  },

  // Announcement Templates
  {
    id: 'company-news',
    name: 'Company News',
    description: 'Professional template for company announcements',
    category: 'announcement',
    tags: ['announcement', 'news', 'update', 'corporate'],
    content: {
      subject: 'Important Update from [Company]',
      preheader: 'News you need to know',
      sections: [
        { id: 'header-1', type: 'header', content: { text: 'COMPANY UPDATE' } },
        { id: 'text-1', type: 'text', content: { text: 'Dear Valued Customer,\n\nWe have an important announcement to share with you today.' } },
        { id: 'text-2', type: 'text', content: { text: '[Main announcement content goes here. Be clear, concise, and direct about the news you\'re sharing.]' } },
        { id: 'text-3', type: 'text', content: { text: '**What This Means for You:**\n\n[Explain the impact and any actions needed]' } },
        { id: 'cta-1', type: 'cta', content: { text: 'Learn More', url: '' } },
        { id: 'text-4', type: 'text', content: { text: 'If you have any questions, please don\'t hesitate to reach out to our support team.' } },
        { id: 'footer-1', type: 'footer', content: { text: 'Best regards,\n[Name], CEO\n\n© 2026 Company Name' } },
      ],
      colorScheme: COLOR_SCHEMES.forest,
      typography: { ...TYPOGRAPHY, bodyFont: 'Georgia, serif' },
    },
  },
]

/**
 * Get templates by category
 */
export function getTemplatesByCategory(category: TemplateCategory): NewsletterTemplate[] {
  return NEWSLETTER_TEMPLATES.filter((t) => t.category === category)
}

/**
 * Get template by ID
 */
export function getTemplateById(id: string): NewsletterTemplate | undefined {
  return NEWSLETTER_TEMPLATES.find((t) => t.id === id)
}

/**
 * Search templates by keyword
 */
export function searchTemplates(query: string): NewsletterTemplate[] {
  const lowerQuery = query.toLowerCase()
  return NEWSLETTER_TEMPLATES.filter(
    (t) =>
      t.name.toLowerCase().includes(lowerQuery) ||
      t.description.toLowerCase().includes(lowerQuery) ||
      t.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))
  )
}

/**
 * Get all available color schemes
 */
export function getColorSchemes(): Record<string, ColorScheme> {
  return COLOR_SCHEMES
}

/**
 * Clone a template with a new ID
 */
export function cloneTemplate(template: NewsletterTemplate): NewsletterContent {
  return {
    ...template.content,
    sections: template.content.sections.map((section) => ({
      ...section,
      id: `section-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      content: { ...section.content },
    })),
  }
}
