/**
 * Page Transitions
 * 
 * CSS-based page transition effects for multi-page navigation
 */

export type TransitionType = 
  | 'fade'
  | 'slide'
  | 'scale'
  | 'blur'
  | 'push'
  | 'wipe'
  | 'instant'

export type TransitionDirection = 'left' | 'right' | 'up' | 'down'

export interface PageTransition {
  id: string
  name: string
  type: TransitionType
  direction?: TransitionDirection
  duration: number // milliseconds
  easing: string
  cssEnter: string
  cssExit: string
}

/**
 * Predefined page transitions
 */
export const PAGE_TRANSITIONS: PageTransition[] = [
  {
    id: 'instant',
    name: 'Instant',
    type: 'instant',
    duration: 0,
    easing: 'linear',
    cssEnter: '',
    cssExit: '',
  },
  {
    id: 'fade',
    name: 'Fade',
    type: 'fade',
    duration: 300,
    easing: 'ease-in-out',
    cssEnter: `
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      .page-enter { animation: fadeIn var(--transition-duration) var(--transition-easing); }
    `,
    cssExit: `
      @keyframes fadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
      }
      .page-exit { animation: fadeOut var(--transition-duration) var(--transition-easing); }
    `,
  },
  {
    id: 'slide-left',
    name: 'Slide Left',
    type: 'slide',
    direction: 'left',
    duration: 400,
    easing: 'ease-out',
    cssEnter: `
      @keyframes slideInLeft {
        from { transform: translateX(100%); }
        to { transform: translateX(0); }
      }
      .page-enter { animation: slideInLeft var(--transition-duration) var(--transition-easing); }
    `,
    cssExit: `
      @keyframes slideOutLeft {
        from { transform: translateX(0); }
        to { transform: translateX(-100%); }
      }
      .page-exit { animation: slideOutLeft var(--transition-duration) var(--transition-easing); }
    `,
  },
  {
    id: 'slide-right',
    name: 'Slide Right',
    type: 'slide',
    direction: 'right',
    duration: 400,
    easing: 'ease-out',
    cssEnter: `
      @keyframes slideInRight {
        from { transform: translateX(-100%); }
        to { transform: translateX(0); }
      }
      .page-enter { animation: slideInRight var(--transition-duration) var(--transition-easing); }
    `,
    cssExit: `
      @keyframes slideOutRight {
        from { transform: translateX(0); }
        to { transform: translateX(100%); }
      }
      .page-exit { animation: slideOutRight var(--transition-duration) var(--transition-easing); }
    `,
  },
  {
    id: 'slide-up',
    name: 'Slide Up',
    type: 'slide',
    direction: 'up',
    duration: 400,
    easing: 'ease-out',
    cssEnter: `
      @keyframes slideInUp {
        from { transform: translateY(100%); }
        to { transform: translateY(0); }
      }
      .page-enter { animation: slideInUp var(--transition-duration) var(--transition-easing); }
    `,
    cssExit: `
      @keyframes slideOutUp {
        from { transform: translateY(0); }
        to { transform: translateY(-100%); }
      }
      .page-exit { animation: slideOutUp var(--transition-duration) var(--transition-easing); }
    `,
  },
  {
    id: 'slide-down',
    name: 'Slide Down',
    type: 'slide',
    direction: 'down',
    duration: 400,
    easing: 'ease-out',
    cssEnter: `
      @keyframes slideInDown {
        from { transform: translateY(-100%); }
        to { transform: translateY(0); }
      }
      .page-enter { animation: slideInDown var(--transition-duration) var(--transition-easing); }
    `,
    cssExit: `
      @keyframes slideOutDown {
        from { transform: translateY(0); }
        to { transform: translateY(100%); }
      }
      .page-exit { animation: slideOutDown var(--transition-duration) var(--transition-easing); }
    `,
  },
  {
    id: 'scale',
    name: 'Scale',
    type: 'scale',
    duration: 300,
    easing: 'ease-in-out',
    cssEnter: `
      @keyframes scaleIn {
        from { transform: scale(0.9); opacity: 0; }
        to { transform: scale(1); opacity: 1; }
      }
      .page-enter { animation: scaleIn var(--transition-duration) var(--transition-easing); }
    `,
    cssExit: `
      @keyframes scaleOut {
        from { transform: scale(1); opacity: 1; }
        to { transform: scale(1.1); opacity: 0; }
      }
      .page-exit { animation: scaleOut var(--transition-duration) var(--transition-easing); }
    `,
  },
  {
    id: 'blur',
    name: 'Blur',
    type: 'blur',
    duration: 400,
    easing: 'ease-in-out',
    cssEnter: `
      @keyframes blurIn {
        from { filter: blur(20px); opacity: 0; }
        to { filter: blur(0); opacity: 1; }
      }
      .page-enter { animation: blurIn var(--transition-duration) var(--transition-easing); }
    `,
    cssExit: `
      @keyframes blurOut {
        from { filter: blur(0); opacity: 1; }
        to { filter: blur(20px); opacity: 0; }
      }
      .page-exit { animation: blurOut var(--transition-duration) var(--transition-easing); }
    `,
  },
  {
    id: 'push-left',
    name: 'Push Left',
    type: 'push',
    direction: 'left',
    duration: 500,
    easing: 'ease-in-out',
    cssEnter: `
      @keyframes pushInLeft {
        from { transform: translateX(100%); }
        to { transform: translateX(0); }
      }
      .page-enter { animation: pushInLeft var(--transition-duration) var(--transition-easing); }
    `,
    cssExit: `
      @keyframes pushOutLeft {
        from { transform: translateX(0); }
        to { transform: translateX(-30%); opacity: 0.5; }
      }
      .page-exit { animation: pushOutLeft var(--transition-duration) var(--transition-easing); }
    `,
  },
  {
    id: 'push-right',
    name: 'Push Right',
    type: 'push',
    direction: 'right',
    duration: 500,
    easing: 'ease-in-out',
    cssEnter: `
      @keyframes pushInRight {
        from { transform: translateX(-100%); }
        to { transform: translateX(0); }
      }
      .page-enter { animation: pushInRight var(--transition-duration) var(--transition-easing); }
    `,
    cssExit: `
      @keyframes pushOutRight {
        from { transform: translateX(0); }
        to { transform: translateX(30%); opacity: 0.5; }
      }
      .page-exit { animation: pushOutRight var(--transition-duration) var(--transition-easing); }
    `,
  },
  {
    id: 'wipe-left',
    name: 'Wipe Left',
    type: 'wipe',
    direction: 'left',
    duration: 600,
    easing: 'ease-in-out',
    cssEnter: `
      @keyframes wipeInLeft {
        from { clip-path: inset(0 100% 0 0); }
        to { clip-path: inset(0 0 0 0); }
      }
      .page-enter { animation: wipeInLeft var(--transition-duration) var(--transition-easing); }
    `,
    cssExit: `
      @keyframes wipeOutLeft {
        from { clip-path: inset(0 0 0 0); }
        to { clip-path: inset(0 0 0 100%); }
      }
      .page-exit { animation: wipeOutLeft var(--transition-duration) var(--transition-easing); }
    `,
  },
  {
    id: 'wipe-right',
    name: 'Wipe Right',
    type: 'wipe',
    direction: 'right',
    duration: 600,
    easing: 'ease-in-out',
    cssEnter: `
      @keyframes wipeInRight {
        from { clip-path: inset(0 0 0 100%); }
        to { clip-path: inset(0 0 0 0); }
      }
      .page-enter { animation: wipeInRight var(--transition-duration) var(--transition-easing); }
    `,
    cssExit: `
      @keyframes wipeOutRight {
        from { clip-path: inset(0 0 0 0); }
        to { clip-path: inset(0 100% 0 0); }
      }
      .page-exit { animation: wipeOutRight var(--transition-duration) var(--transition-easing); }
    `,
  },
]

/**
 * Get a transition by ID
 */
export function getTransition(id: string): PageTransition | undefined {
  return PAGE_TRANSITIONS.find(t => t.id === id)
}

/**
 * Get the default transition
 */
export function getDefaultTransition(): PageTransition {
  return PAGE_TRANSITIONS.find(t => t.id === 'fade') || PAGE_TRANSITIONS[0]
}

/**
 * Generate CSS for a transition
 */
export function generateTransitionCss(transition: PageTransition): string {
  if (transition.type === 'instant') {
    return ''
  }

  return `
    :root {
      --transition-duration: ${transition.duration}ms;
      --transition-easing: ${transition.easing};
    }
    
    .page-wrapper {
      position: relative;
      overflow: hidden;
    }
    
    .page {
      width: 100%;
      min-height: 100vh;
    }
    
    ${transition.cssEnter}
    ${transition.cssExit}
  `
}

/**
 * Generate JavaScript for page transition handling
 */
export function generateTransitionJs(transition: PageTransition): string {
  if (transition.type === 'instant') {
    return ''
  }

  return `
    // Page Transition Handler
    (function() {
      const duration = ${transition.duration};
      
      document.querySelectorAll('a[href^="/"]').forEach(link => {
        link.addEventListener('click', function(e) {
          const href = this.getAttribute('href');
          if (href === window.location.pathname) return;
          
          e.preventDefault();
          
          const currentPage = document.querySelector('.page');
          if (currentPage) {
            currentPage.classList.add('page-exit');
            
            setTimeout(() => {
              window.location.href = href;
            }, duration);
          } else {
            window.location.href = href;
          }
        });
      });
      
      // Add entrance animation on page load
      window.addEventListener('load', () => {
        const page = document.querySelector('.page');
        if (page) {
          page.classList.add('page-enter');
        }
      });
    })();
  `
}

/**
 * Get transitions grouped by type
 */
export function getTransitionsByType(): Record<TransitionType, PageTransition[]> {
  const grouped: Record<TransitionType, PageTransition[]> = {
    instant: [],
    fade: [],
    slide: [],
    scale: [],
    blur: [],
    push: [],
    wipe: [],
  }

  PAGE_TRANSITIONS.forEach(t => {
    grouped[t.type].push(t)
  })

  return grouped
}
