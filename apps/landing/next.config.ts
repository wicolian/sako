import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";

const cspReportOnly = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'self' https://kelashik.com https://www.kelashik.com http://localhost:3000 http://localhost:3333",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https:",
  "style-src 'self' 'unsafe-inline' https:",
  [
    "script-src",
    "'self'",
    "'unsafe-inline'",
    "'unsafe-eval'",
    "https://www.googletagmanager.com",
    "https://www.google-analytics.com",
    "https://app.cal.com",
    "https://us-assets.i.posthog.com",
    "https://us.i.posthog.com",
    "https://static.cloudflareinsights.com",
    "https://clerk.trysako.com",
    "https://*.clerk.com",
    "https://assets.apollo.io",
    "https://www.clarity.ms",
    "https://v.clarity.ms",
    "https://scripts.clarity.ms",
    "https://sc.lfeeder.com",
  ].join(" "),
  [
    "connect-src",
    "'self'",
    "https://www.google-analytics.com",
    "https://region1.google-analytics.com",
    "https://app.cal.com",
    "https://us.i.posthog.com",
    "https://*.posthog.com",
    "https://o61806.ingest.us.sentry.io",
    "https://clerk.trysako.com",
    "https://*.clerk.com",
    "https://assets.apollo.io",
    "https://aplo-evnt.com",
    "https://www.clarity.ms",
    "https://v.clarity.ms",
    "https://sc.lfeeder.com",
  ].join(" "),
  "frame-src 'self' https://app.cal.com https://cal.com https://clerk.trysako.com https://*.clerk.com https://status.trysako.com https://www.youtube.com https://player.vimeo.com https://www.loom.com",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  // NOTE: upgrade-insecure-requests removed from report-only CSP
  // It's a no-op in report-only mode and causes console warnings
].join("; ");

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: '/book-a-demo', destination: '/book-a-call', permanent: true },
      { source: '/contact-sales', destination: '/contact', permanent: true },
    ];
  },
  // Experimental features for performance
  experimental: {
    // Optimize imports for tree-shaking - reduces unused JS significantly
    optimizePackageImports: [
      'lucide-react',
      'framer-motion',
      'motion',
      '@tabler/icons-react',
      '@radix-ui/react-accordion',
      '@radix-ui/react-dialog',
      '@radix-ui/react-tabs',
      '@radix-ui/react-slot',
      'clsx',
      'tailwind-merge',
      'class-variance-authority',
      'tailwindcss',
      'next-themes',
      'react-intersection-observer',
    ],
  },
  images: {
    formats: ['image/avif', 'image/webp'], // AVIF first for better compression
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 31536000, // 1 year for optimized images
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    // Enable unoptimized for external images to reduce processing overhead
    unoptimized: false,
  },
  // Compress responses
  compress: true,
  // Production source maps disabled to avoid performance overhead
  // Re-enable if needed for debugging: productionBrowserSourceMaps: true,
  async headers() {
    return [
      // Static assets get long-lived immutable cache
      // (Next.js already sets this, but explicit for Cloudflare compatibility)
      {
        source: "/_next/static/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      // Fonts and media get long cache
      {
        source: "/fonts/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      // Favicons get long cache
      {
        source: "/favicons/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      // Security headers for all routes
      {
        source: "/(.*)",
        headers: [
          // Preconnect to critical third-party domains for faster loading
          { key: "Link", value: "<https://www.googletagmanager.com>; rel=preconnect; crossorigin" },
          { key: "Link", value: "<https://www.google-analytics.com>; rel=preconnect; crossorigin" },
          { key: "Link", value: "<https://us-assets.i.posthog.com>; rel=preconnect; crossorigin" },
          { key: "Link", value: "<https://us.i.posthog.com>; rel=preconnect; crossorigin" },
          { key: "Link", value: "<https://static.cloudflareinsights.com>; rel=preconnect; crossorigin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=15552000; includeSubDomains",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Override any Feature-Policy header from Cloudflare/other sources
          { key: "Feature-Policy", value: "" },
          {
            key: "Permissions-Policy",
            value:
              "accelerometer=(), autoplay=(), camera=(), encrypted-media=(), fullscreen=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), midi=(), payment=(), usb=()",
          },
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin-allow-popups",
          },
          { key: "Cross-Origin-Resource-Policy", value: "same-site" },
          {
            key: "Content-Security-Policy",
            value:
              "frame-ancestors 'self' https://kelashik.com https://www.kelashik.com http://localhost:3000 http://localhost:3333",
          },
          {
            key: "Content-Security-Policy-Report-Only",
            value: cspReportOnly,
          },
        ],
      },
    ];
  },
};

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

export default withBundleAnalyzer(nextConfig);
