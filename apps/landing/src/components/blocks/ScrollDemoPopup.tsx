'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { X } from 'lucide-react';

const STORAGE_KEY_PREFIX = 'sako_scroll_demo_shown';
const SCROLL_THRESHOLD = 0.85;

const ENABLED_PAGES = ['/', '/enterprise', '/pricing', '/composer', '/compare', '/roi-calculator', '/how-it-works', '/product'];

function isPageEnabled(path: string): boolean {
  if (path === '/') return true;
  return ENABLED_PAGES.some((p) => p !== '/' && path.startsWith(p));
}

export function ScrollDemoPopup() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const prevPathnameRef = useRef<string | null>(null);

  const checkScroll = useCallback(() => {
    if (typeof window === 'undefined') return;

    const normalizedPath = pathname || '/';
    if (!isPageEnabled(normalizedPath)) return;

    const storageKey = `${STORAGE_KEY_PREFIX}_${normalizedPath}`;
    const alreadyShown = sessionStorage.getItem(storageKey);
    if (alreadyShown) return;

    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;

    if (docHeight > 0 && scrollTop / docHeight >= SCROLL_THRESHOLD) {
      setVisible(true);
      sessionStorage.setItem(storageKey, '1');
    }
  }, [pathname]);

  const dismiss = useCallback(() => {
    setVisible(false);
    if (typeof window !== 'undefined') {
      const storageKey = `${STORAGE_KEY_PREFIX}_${pathname || '/'}`;
      sessionStorage.setItem(storageKey, '1');
    }
  }, [pathname]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const normalizedPath = pathname || '/';
    if (prevPathnameRef.current !== normalizedPath) {
      setVisible(false);
      prevPathnameRef.current = normalizedPath;
    }

    checkScroll();
    window.addEventListener('scroll', checkScroll, { passive: true });
    return () => window.removeEventListener('scroll', checkScroll);
  }, [mounted, checkScroll, pathname]);

  if (!visible || !mounted) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 animate-in slide-in-from-bottom duration-300"
      role="banner"
    >
      <div className="relative mx-4 mb-4 rounded-xl border border-gray-200 bg-white p-4 shadow-lg sm:mx-6 sm:mb-6 sm:flex sm:items-center sm:justify-between sm:gap-4 sm:p-5 sm:pr-12">
        <button
          type="button"
          onClick={dismiss}
          className="absolute right-3 top-3 rounded-lg p-1.5 text-neutral-400 hover:bg-gray-100 hover:text-neutral-600 transition-colors sm:right-4 sm:top-4"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
        <p className="text-sm font-medium text-neutral-900 sm:text-base pr-8 sm:pr-0">
          Ready to see Sako in action? Book a 15-min demo with our founding team.
        </p>
        <div className="mt-3 flex gap-3 sm:mt-0">
          <Link
            href="/book-a-call"
            className="inline-flex flex-1 items-center justify-center rounded-lg bg-[#1a1a1a] px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 transition-colors sm:flex-none"
          >
            Book a fit check
          </Link>
          <button
            type="button"
            onClick={dismiss}
            className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-neutral-600 hover:bg-gray-50 transition-colors"
            aria-label="Not now"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
