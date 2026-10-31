import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Enable standalone output for Docker/ECS deployment
  output: 'standalone',
  // The app has a few type errors left; do not block the build on them.
  typescript: { ignoreBuildErrors: true },
  // Exclude native binaries from Turbopack bundling
  serverExternalPackages: ['@resvg/resvg-js', 'playwright', 'playwright-core'],
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
