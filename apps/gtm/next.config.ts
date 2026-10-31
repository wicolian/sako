import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Enable standalone output for Docker/ECS deployment
  output: 'standalone',
  // Exclude native binaries from Turbopack bundling
  serverExternalPackages: ['@resvg/resvg-js'],
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
