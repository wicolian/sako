"use client";

import { UTMTrackedLink } from "@/components/ui/marketing/utm-link";
import { trackCTAInteraction } from "@/lib/analytics";
import { navCta } from "@/config/landing";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

interface DynamicNavCTAProps {
  className?: string;
}

export function DynamicNavCTA({ className }: DynamicNavCTAProps) {
  const [isReturningCustomer, setIsReturningCustomer] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      const cookies = document.cookie.split(';').map((c) => c.trim());
      const hasCustomerCookie = cookies.some((item) => item.startsWith('sako_customer=true'));
      const hasSignedInCookie = cookies.some((item) => item.startsWith('sako_signed_in=true'));

      setIsReturningCustomer(hasCustomerCookie);
      setIsSignedIn(hasSignedInCookie);
      setIsReady(true);
    }
  }, []);

  // Base styles for the button to match the liked design
  const baseStyles = "px-6 py-2.5 text-center text-xs font-bold uppercase tracking-wider bg-[#1a1a1a] text-white rounded-full hover:bg-gray-800 transition-all hover:scale-105 shadow-lg shadow-[#1a1a1a]/10 whitespace-nowrap leading-none flex items-center justify-center";

  // Preserve previous "loading" UI (previously driven by Clerk client boot)
  if (!isReady) {
    return (
      <div className={cn("px-6 py-2 text-center text-xs font-bold uppercase tracking-wider bg-gray-100 text-gray-400 rounded-full animate-pulse whitespace-nowrap", className)}>
        Loading...
      </div>
    );
  }

  // User is signed in → Dashboard
  if (isSignedIn) {
    return (
      <UTMTrackedLink
        href="https://app.trysako.com/dashboard"
        campaign="nav"
        onClick={() => trackCTAInteraction('dashboard', 'navbar', 'click')}
        className={cn(baseStyles, className)}
      >
        Dashboard
      </UTMTrackedLink>
    );
  }

  // Returning customer but not signed in → Sign In
  if (isReturningCustomer) {
    return (
      <UTMTrackedLink
        href="https://app.trysako.com/sign-in"
        campaign="nav"
        onClick={() => trackCTAInteraction('sign_in', 'navbar', 'click')}
        className={cn(baseStyles, className)}
      >
        Sign In
      </UTMTrackedLink>
    );
  }

  // Default: not signed in → Start Shipping
  return (
    <UTMTrackedLink
      href={navCta.href}
      campaign="nav"
      onClick={() => trackCTAInteraction('start_shipping', 'navbar', 'click')}
      className={cn(baseStyles, className)}
    >
      {navCta.label}
    </UTMTrackedLink>
  );
}
