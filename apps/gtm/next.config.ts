import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Enable standalone output for Docker/ECS deployment
  output: 'standalone',
  // Exclude native binaries from Turbopack bundling
  serverExternalPackages: ['@resvg/resvg-js', 'postgres', 'playwright', 'playwright-core', 'puppeteer', 'puppeteer-core', '@remotion/renderer', '@remotion/bundler', '@remotion/lambda'],
  // Some shared modules pull Node built-ins into client bundles. Stub them in the browser.
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve = config.resolve || {}
      config.resolve.fallback = {
        ...(config.resolve.fallback || {}),
        fs: false, net: false, tls: false, dns: false, child_process: false,
        async_hooks: false, inspector: false, http2: false, perf_hooks: false,
        worker_threads: false, module: false, readline: false,
      }
    }
    return config
  },
  typescript: { ignoreBuildErrors: true },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/site.webmanifest',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/manifest+json',
          },
        ],
      },
    ]
  },
}

export default nextConfig
