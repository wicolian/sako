"use client";

import { finalCtaCopy } from "@/config/landing";
import { ShimmerButton } from "@/components/ui/buttons/shimmer-button";
import Link from "next/link";
import { trackCTAInteraction, trackBusinessIntent, trackMarketingFunnelStep } from "@/lib/analytics";

export function FinalCTA() {
  return (
    <section className="min-h-[50vh] flex flex-col text-center bg-white pt-32 pr-6 pb-32 pl-6 relative items-center justify-center">
      <div className="max-w-2xl mx-auto">
        <h2 className="text-4xl sm:text-5xl font-semibold mb-6 tracking-tight text-black leading-[1.3]">
          {finalCtaCopy.title.start}
          <br />
          <span className="font-medium italic font-serif relative inline-block">
          <span className="absolute inset-0 bg-[#9AE83E]/30 -skew-x-1 scale-x-105 scale-y-90 rounded-sm"></span>
            <span className="relative">{finalCtaCopy.title.italic}</span>
          </span>
        </h2>
        <p className="text-lg text-gray-500 mb-10">{finalCtaCopy.subtitle}</p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Link 
            href={finalCtaCopy.cta.href}
            onClick={() => {
              trackCTAInteraction('final_cta_primary', 'final_cta', 'click');
              trackMarketingFunnelStep('CLICK_CTA');
              trackBusinessIntent('demo_request');
            }}
          >
            <ShimmerButton
              shimmerColor="#9AE83E"
              shimmerSize="0.05em"
              background="rgba(10, 10, 10, 1)"
              className="text-sm font-bold uppercase tracking-tight shadow-lg shadow-[#1a1a1a]/10"
            >
              {finalCtaCopy.cta.label}
            </ShimmerButton>
          </Link>
          <Link
            href={finalCtaCopy.secondaryCta.href}
            className="px-8 py-3.5 text-sm font-semibold text-gray-600 border border-gray-200 rounded-full hover:bg-gray-50 hover:border-gray-300 transition-all"
            onClick={() => trackCTAInteraction('final_cta_secondary', 'final_cta', 'click')}
          >
            {finalCtaCopy.secondaryCta.label}
          </Link>
        </div>
        <p className="mt-8 text-xs text-gray-400">{finalCtaCopy.trustText}</p>
      </div>
    </section>
  );
}
