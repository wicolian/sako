"use client";

import Link from "next/link";
import { appendUTMParams, preserveUTM, type UTMParams } from "@/lib/utils";
import { utmConfig } from "@/config/landing";
import { trackProductClick } from "@/lib/analytics";
import { ComponentProps } from "react";

interface UTMTrackedLinkProps extends Omit<ComponentProps<typeof Link>, 'href'> {
  href: string;
  campaign?: keyof typeof utmConfig.campaigns;
  customUTM?: UTMParams;
  track?: boolean;
}

/**
 * UTMTrackedLink - Automatically adds UTM parameters to external links
 *
 * Features:
 * - Automatically adds UTM parameters to external links
 * - Preserves internal links unchanged
 * - Supports predefined campaigns or custom UTM parameters
 * - Integrates with existing analytics tracking
 *
 * Usage:
 * <UTMTrackedLink href="https://cal.com/example" campaign="hero">
 *   Book a call
 * </UTMTrackedLink>
 *
 * <UTMTrackedLink href="https://app.trysako.com" customUTM={{ campaign: 'custom' }}>
 *   Custom UTM
 * </UTMTrackedLink>
 */
export function UTMTrackedLink({
  href,
  campaign,
  customUTM,
  track = true,
  onClick,
  ...props
}: UTMTrackedLinkProps) {
  // Determine UTM parameters to use
  let utmParams = customUTM;

  if (!utmParams && campaign) {
    utmParams = utmConfig.campaigns[campaign];
  }

  // Apply UTM parameters to the URL
  const processedHref = utmParams ? appendUTMParams(href, utmParams) : href;

  // Enhanced click handler for product attribution
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // Track product clicks specifically
    if (track && href.includes('app.trysako.com')) {
      const destination = href.includes('/login') ? 'app_login' :
                         href.includes('/dashboard') ? 'app_dashboard' : 'app_signup';
      trackProductClick(destination, campaign);
    }

    // Call original onClick if provided
    if (onClick) {
      onClick(e);
    }
  };

  // Check if this is an external link (starts with http/https)
  const isExternal = processedHref.startsWith('http');

  if (isExternal) {
    // Use regular anchor tag for external links to support target="_blank"
    return (
      <a
        href={processedHref}
        onClick={handleClick}
        target="_blank"
        rel="noopener noreferrer"
        {...props}
      />
    );
  }

  // Use Next.js Link for internal navigation (preserve UTM across internal links)
  const finalHref = preserveUTM(processedHref);
  return (
    <Link
      href={finalHref}
      onClick={handleClick}
      {...props}
    />
  );
}

// Re-export for convenience
export { appendUTMParams } from "@/lib/utils";
export { utmConfig } from "@/config/landing";
