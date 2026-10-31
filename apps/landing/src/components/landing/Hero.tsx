"use client";

import { heroCopy } from "@/config/landing";
import { AnimatedGradientText } from "@/components/ui/animations/animated-gradient-text";
import { PointerHighlight } from "@/components/ui/visuals/pointer-highlight";
import { ShimmerButton } from "@/components/ui/buttons/shimmer-button";
import { VideoDialog } from "@/components/ui/visuals/video-dialog";
import Link from "next/link";
import { trackCTAInteraction, trackBusinessIntent, trackMarketingFunnelStep } from "@/lib/analytics";

export function Hero() {
  return (
    <header className="px-6 relative overflow-hidden min-h-screen flex flex-col items-center justify-center">
      <div className="mx-auto text-center flex flex-col items-center max-w-[1200px] w-full py-20">
        {/* Eyebrow with Animated Gradient Text */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-gray-200 shadow-sm mb-8 animate-fade-in">
          <div className="w-1.5 h-1.5 rounded-full bg-[#9AE83E] animate-pulse"></div>
          <AnimatedGradientText className="text-xs font-bold uppercase tracking-wider">
            {heroCopy.eyebrow}
          </AnimatedGradientText>
        </div>

        {/* H1 */}
        <h1
          className="text-5xl sm:text-7xl font-semibold text-[#1a1a1a] tracking-tight leading-[1.05] mb-8 animate-fade-in opacity-0"
          style={{ animationDelay: "100ms" }}
        >
          {heroCopy.title.line1}
          <br />
          <span className="text-[#1a1a1a]">{heroCopy.title.line2Start}</span>
          <PointerHighlight
            pointerClassName="text-[#9AE83E]"
          >
            <span className="font-medium italic text-[#9AE83E] font-serif text-serif-accent text-serif-italic">
              {heroCopy.title.line2Italic}
            </span>
          </PointerHighlight>
        </h1>

        {/* Subhead */}
        <p
          className="leading-relaxed animate-fade-in text-lg text-gray-500 opacity-0 max-w-2xl mb-10"
          style={{ animationDelay: "200ms" }}
        >
          {heroCopy.subtitle}
        </p>

        {/* CTAs - Light theme consistent */}
        <div
          className="flex flex-col sm:flex-row gap-4 items-center animate-fade-in opacity-0"
          style={{ animationDelay: "300ms" }}
        >
          <Link
            href={heroCopy.primaryCta.href}
            onClick={() => {
              trackCTAInteraction('get_started', 'hero', 'click');
              trackBusinessIntent('demo_request');
              trackMarketingFunnelStep('CLICK_CTA', { cta_location: 'hero' });
            }}
          >
            <ShimmerButton
              shimmerColor="#9AE83E"
              shimmerSize="0.05em"
              background="rgba(26, 26, 26, 1)"
              className="text-white text-sm font-bold flex items-center gap-2 px-8 py-3.5"
            >
              {heroCopy.primaryCta.label}
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </ShimmerButton>
          </Link>
          <VideoDialog
            videoUrl="https://youtu.be/QdpPXRVrOqg"
            title="SAKO Launch Video"
          >
            <button
              onClick={() => trackCTAInteraction('learn_more', 'hero', 'click')}
              className="px-8 py-3.5 text-sm font-semibold text-gray-600 bg-transparent border border-gray-300 rounded-full hover:bg-gray-100/50 hover:border-gray-400 hover:text-gray-800 transition-all backdrop-blur-sm"
            >
              {heroCopy.secondaryCta.label}
            </button>
          </VideoDialog>
        </div>

        {/* Reassurance */}
        <div
          className="mt-8 flex flex-col items-center gap-2 animate-fade-in opacity-0"
          style={{ animationDelay: "400ms" }}
        >
          <Link
            href={heroCopy.tertiaryCta.href}
            onClick={() => trackCTAInteraction('book_call', 'hero', 'click')}
            className="text-xs font-medium text-gray-400 hover:text-black underline underline-offset-4 decoration-gray-300 transition-colors"
          >
            {heroCopy.tertiaryCta.label}
          </Link>
          <p className="text-xs text-gray-600 font-medium uppercase tracking-wide mt-4">
            {heroCopy.trustText}
          </p>
        </div>
      </div>
    </header>
  );
}
