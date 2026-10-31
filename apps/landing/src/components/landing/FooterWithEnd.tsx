"use client";

import { useEffect, useRef, useCallback } from "react";
import { footerLinks, footerCopy, socialLinks } from "@/config/landing";
import { NewsletterForm } from "@/components/blocks/NewsletterForm";
import Image from "next/image";
import Link from "next/link";
import { TextHoverEffect } from "@/components/ui/animations/text-hover-effect";

export function FooterWithEnd() {
  const containerRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLElement>(null);
  const sakoRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isScrollingBackRef = useRef(false);
  const rafRef = useRef<number | null>(null);

  // Cache viewport height to avoid repeated access
  const viewportHeightRef = useRef(typeof window !== 'undefined' ? window.innerHeight : 0);

  const scrollBackToFooter = useCallback(() => {
    if (!footerRef.current || isScrollingBackRef.current) return;

    isScrollingBackRef.current = true;

    // Use requestAnimationFrame to batch DOM read + write
    requestAnimationFrame(() => {
      if (!footerRef.current) return;
      const footerBottom = footerRef.current.getBoundingClientRect().bottom + window.scrollY;
      const targetScroll = footerBottom - viewportHeightRef.current;

      window.scrollTo({
        top: Math.max(0, targetScroll),
        behavior: "smooth",
      });
    });

    // Reset the flag after animation completes
    setTimeout(() => {
      isScrollingBackRef.current = false;
    }, 600);
  }, []);

  useEffect(() => {
    // Update cached viewport height on resize (debounced)
    let resizeTimeout: NodeJS.Timeout | null = null;
    const handleResize = () => {
      if (resizeTimeout) clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        viewportHeightRef.current = window.innerHeight;
      }, 100);
    };

    const handleScroll = () => {
      if (!sakoRef.current || !footerRef.current || isScrollingBackRef.current) return;

      // Cancel any pending RAF to avoid stacking
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }

      // Use requestAnimationFrame to batch DOM reads and avoid forced reflow
      rafRef.current = requestAnimationFrame(() => {
        if (!sakoRef.current) return;

        const sakoRect = sakoRef.current.getBoundingClientRect();
        const viewportHeight = viewportHeightRef.current;

        // Calculate how much of the SAKO section is visible
        const visibleHeight = Math.min(viewportHeight, sakoRect.bottom) - Math.max(0, sakoRect.top);
        const visibilityRatio = visibleHeight / sakoRect.height;

        // Clear any existing timeout
        if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current);
        }

        // If SAKO section is more than 25% visible, set up snap-back on scroll stop
        if (visibilityRatio > 0.25 && sakoRect.top < viewportHeight) {
          scrollTimeoutRef.current = setTimeout(() => {
            scrollBackToFooter();
          }, 200); // 200ms after user stops scrolling
        }
      });
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleResize, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleResize);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      if (resizeTimeout) {
        clearTimeout(resizeTimeout);
      }
    };
  }, [scrollBackToFooter]);

  return (
    <div ref={containerRef} className="relative">
      {/* Main Footer */}
      <footer ref={footerRef} className="relative w-full bg-neutral-950 pt-20 px-6 pb-12">
        <div className="max-w-[1200px] mx-auto relative z-10">
          {/* Main Footer content stacked on mobile */}
          <div className="flex flex-col md:flex-row justify-between items-start mb-16 gap-12 md:gap-0">
            {/* Left side - Logo, description, socials, contact */}
            <div className="w-full md:w-3/10 max-w-xs flex flex-col items-center md:items-start text-center md:text-left">
              <Link href="/" className="mb-6 inline-block">
                <Image
                  src="/sako-white.svg"
                  alt={footerCopy.brandName}
                  width={100}
                  height={25}
                  className="h-6 w-auto"
                />
              </Link>
              <p className="text-sm text-neutral-500 leading-relaxed mb-6">
                {footerCopy.description}
              </p>

              <div className="flex items-center gap-5 mb-8">
                {socialLinks.map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    target={link.href.startsWith('http') ? "_blank" : undefined}
                    rel={link.href.startsWith('http') ? "noopener noreferrer nofollow" : undefined}
                    className="text-neutral-500 hover:text-[#9AE83E] transition-all duration-300 group"
                    aria-label={link.label}
                  >
                    {link.icon === "linkedin" && (
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className="group-hover:scale-110 transition-transform"
                      >
                        <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path>
                        <rect width="4" height="12" x="2" y="9"></rect>
                        <circle cx="4" cy="4" r="2"></circle>
                      </svg>
                    )}
                    {link.icon === "email" && (
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className="group-hover:scale-110 transition-transform"
                      >
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                        <polyline points="22,6 12,13 2,6"></polyline>
                      </svg>
                    )}
                    {link.icon === "discord" && (
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        className="group-hover:scale-110 transition-transform"
                      >
                        <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419-.0189 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" />
                      </svg>
                    )}
                  </a>
                ))}
              </div>

              <div className="text-[11px] text-neutral-600 mb-4">
                <p className="flex items-center justify-center md:justify-start gap-2">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 opacity-50">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                    <circle cx="12" cy="10" r="3"></circle>
                  </svg>
                  <span>{footerCopy.companyInfo.location}</span>
                </p>
              </div>
            </div>

            {/* Right side - Navigation columns stacked on mobile */}
            <div className="w-full md:w-7/10 grid grid-cols-2 lg:grid-cols-4 gap-8">
              <div>
                <h4 className="font-medium text-sm mb-6 text-white">Product</h4>
                <ul className="space-y-4 text-sm">
                  {footerLinks.product.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="text-neutral-400 hover:text-white transition-colors inline-flex items-center gap-2"
                      >
                        {link.label}
                        {link.comingSoon && (
                          <span className="text-xs font-medium text-[#9AE83E] bg-[#9AE83E]/10 px-1.5 py-0.5 rounded">
                            Soon
                          </span>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="font-medium text-sm mb-6 text-white">Resources</h4>
                <ul className="space-y-4 text-sm">
                  {footerLinks.solutions.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="text-neutral-400 hover:text-white transition-colors"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="font-medium text-sm mb-6 text-white">Company</h4>
                <ul className="space-y-4 text-sm">
                  {footerLinks.company.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="text-neutral-400 hover:text-white transition-colors"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="font-medium text-sm mb-6 text-white">Legal</h4>
                <ul className="space-y-4 text-sm">
                  {footerLinks.legal.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="text-neutral-400 hover:text-white transition-colors"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Newsletter strip */}
          <div className="border-t border-neutral-800 pt-10 pb-8">
            <NewsletterForm
              variant="footer"
              heading={footerCopy.newsletter.heading}
              description={footerCopy.newsletter.description}
              ctaLabel={footerCopy.newsletter.ctaLabel}
              socialProof={footerCopy.newsletter.socialProof}
            />
          </div>

          {/* Bottom bar */}
          <div className="flex flex-col md:flex-row justify-between items-center pt-10 gap-6 md:gap-8 mb-8">
            <p className="text-[10px] md:text-xs text-neutral-600 text-center md:text-left md:w-1/3 order-3 md:order-1">
              © {new Date().getFullYear()}{" "}
              <a
                href="https://www.creativeops.in/"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-white transition-colors"
              >
                Creative Ops, Inc.
              </a>{" "}
              · All rights reserved
            </p>
            <div className="w-full md:w-1/3 flex items-center justify-center order-1 md:order-2">
              <span className="text-[9px] md:text-[10px] text-neutral-700 font-mono uppercase tracking-[0.2em] whitespace-nowrap">
                Designed & Shipped with Sako
              </span>
            </div>
            <div className="w-full md:w-1/3 flex items-center justify-center md:justify-end order-2 md:order-3">
              <div className="flex justify-center md:justify-end overflow-visible" suppressHydrationWarning>
                <iframe
                  src="https://status.trysako.com/badge?theme=dark"
                  width="250"
                  height="30"
                  suppressHydrationWarning
                  style={{
                    colorScheme: 'normal',
                    filter: 'hue-rotate(-35deg) brightness(1.3) saturate(1.2)',
                    border: 'none',
                    overflow: 'hidden',
                  }}
                  title="Sako Status"
                  loading="lazy"
                  className="max-w-none origin-center md:origin-right scale-[0.8] md:scale-[0.85] grayscale opacity-60 hover:grayscale-0 hover:opacity-100 transition-all duration-700"
                />
              </div>
            </div>
          </div>
        </div>
      </footer>

      {/* SAKO Reveal Section - scrolls past but snaps back */}
      <div
        ref={sakoRef}
        className="h-[50vh] flex items-center justify-center bg-neutral-950 relative overflow-hidden"
      >
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1a1a1a_1px,transparent_1px),linear-gradient(to_bottom,#1a1a1a_1px,transparent_1px)] bg-[size:80px_80px] opacity-20" />

        {/* Glow effect */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-[#9AE83E]/5 rounded-full blur-[120px] pointer-events-none" />

        {/* TextHoverEffect for SAKO with looping animation */}
        <div className="w-full h-[200px] md:h-[250px] max-w-[1200px] px-4 relative z-10">
          <TextHoverEffect text="SAKO" duration={0.15} />
        </div>
      </div>
    </div>
  );
}
