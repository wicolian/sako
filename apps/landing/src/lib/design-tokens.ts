// Design System Tokens - Extracted from existing landing page
// Use these for consistent styling across all pages

export const tokens = {
  colors: {
    // Brand-light-theme
    lime: '#9AE83E',
    limeHover: '#8ECC2D',
    black: '#0A0A0A',
    dark: '#1a1a1a',
    serifAccent: '#7c7c7c',

    // Backgrounds
    bgPrimary: '#FAFAFA',
    bgSecondary: '#F5F5F5',
    bgCard: '#FFFFFF',
    bgDark: '#1a1a1a',
    
    // Text
    textPrimary: '#0A0A0A',
    textSecondary: '#525252',
    textMuted: '#9CA3AF',
    textOnDark: '#FFFFFF',
    textOnDarkMuted: '#A3A3A3',
    
    // Borders
    border: '#E5E5E5',
    borderLight: '#F3F4F6',
    borderDark: 'rgba(255,255,255,0.1)',
  },
  
  fonts: {
    sans: 'var(--font-geist-sans)',
    serif: 'var(--font-playfair)',
    mono: 'var(--font-geist-mono)',
  },
  
  radius: {
    sm: '0.5rem',
    md: '0.75rem',
    lg: '1rem',
    xl: '1.5rem',
    '2xl': '2rem',
    '3xl': '2.5rem',
    full: '9999px',
  },
  
  spacing: {
    section: '6rem',
    sectionMobile: '4rem',
    container: '1200px',
    containerNarrow: '800px',
  },
  
  shadows: {
    card: '0 1px 3px rgba(0,0,0,0.1)',
    cardHover: '0 20px 25px -5px rgba(0,0,0,0.1)',
    lime: '0 25px 50px -12px rgba(163,230,53,0.1)',
  },
} as const;

// Tailwind class mappings for common patterns
export const patterns = {
  // Section layouts
  section: 'py-24 px-6',
  sectionAlt: 'py-24 px-6 bg-gray-50',
  sectionTight: 'py-16 px-6',
  sectionWide: 'py-32 px-6',
  container: 'max-w-[1200px] mx-auto w-full',
  containerNarrow: 'max-w-[800px] mx-auto w-full',
  containerWide: 'max-w-[1400px] mx-auto w-full',
  
  // Cards - Homepage inspired
  card: 'bg-white rounded-2xl border border-gray-200 p-8 shadow-sm group hover:shadow-lg transition-all duration-300',
  cardElevated: 'bg-white rounded-2xl border border-gray-200 p-8 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300',
  cardDark: 'bg-[#1a1a1a] text-white rounded-3xl border border-white/5 p-8 shadow-2xl',
  cardLime: 'bg-[#9AE83E] text-black rounded-3xl p-8',
  cardMono: 'bg-white border border-gray-100 p-6 font-mono text-xs',

  // Bento Grid Layouts
  bentoGrid: 'grid grid-cols-1 md:grid-cols-3 md:grid-rows-3 gap-4 auto-rows-min',
  bentoCard: 'bg-white border border-gray-200 shadow-sm flex flex-col justify-between group transition-colors rounded-2xl',
  bentoCardLarge: 'bg-[#1a1a1a] text-white p-8 rounded-3xl border border-[#1a1a1a] shadow-xl md:col-span-2 flex flex-col md:flex-row gap-8 items-center overflow-hidden relative',

  // Buttons - Homepage style
  btnPrimary: 'px-8 py-3.5 bg-[#1a1a1a] text-white text-sm font-semibold rounded-full hover:bg-gray-800 hover:scale-105 transition-all shadow-xl shadow-[#9AE83E]/10 flex items-center gap-2',
  btnSecondary: 'px-8 py-3.5 bg-white border border-gray-200 text-sm font-medium rounded-full hover:bg-gray-50 hover:border-gray-300 transition-all',
  btnLime: 'px-8 py-3.5 bg-[#9AE83E] text-black text-sm font-bold rounded-full hover:bg-white transition-colors',
  btnGhost: 'px-8 py-3.5 text-sm text-gray-500 hover:text-black transition-colors',
  
  // Typography - Homepage inspired
  heading1: 'text-5xl sm:text-7xl font-semibold text-black tracking-tight leading-[1.05]',
  heading2: 'text-3xl sm:text-4xl font-medium text-black tracking-tight',
  heading3: 'text-xl font-semibold text-black',
  heading4: 'text-lg font-semibold text-black',
  subtitle: 'text-lg text-gray-700 leading-relaxed',
  bodyText: 'text-sm text-gray-600 leading-relaxed',
  caption: 'text-xs text-gray-500 uppercase font-mono tracking-wider',
  captionLarge: 'text-xs font-mono text-gray-600 uppercase tracking-widest',
  
  // Eyebrow/Badge - Homepage style
  eyebrow: 'inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-gray-200 text-xs font-medium text-gray-500 shadow-sm',
  badge: 'px-3 py-1 bg-[#9AE83E] text-black text-xs font-bold rounded-full uppercase tracking-wider',
  badgeMono: 'px-2 py-0.5 bg-[#9AE83E]/10 text-[#9AE83E] text-xs font-mono rounded',
  
  // Serif italic accent - uses Playfair Display
  // Note: Use font-serif (not font-playfair) as it maps to --font-family-serif
  serifItalic: 'font-serif italic font-normal text-brand-serif-accent',

  // Status indicators
  statusDot: 'w-2 h-2 rounded-full bg-[#9AE83E]',
  statusDotInactive: 'w-2 h-2 rounded-full bg-gray-300',

  // Layout utilities
  flexBetween: 'flex justify-between items-center',
  flexCenter: 'flex items-center justify-center',
  spaceY: 'space-y-4',
  spaceYLarge: 'space-y-6',
} as const;

export type Tokens = typeof tokens;
export type Patterns = typeof patterns;


