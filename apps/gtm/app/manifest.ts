import type { MetadataRoute } from 'next'

/**
 * Web App Manifest - served with correct Content-Type to avoid "Manifest: Syntax error".
 * Replaces reliance on public/site.webmanifest which can be served as wrong type.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Sako',
    short_name: 'Sako',
    icons: [
      {
        src: '/favicons/favicon/web-app-manifest-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/favicons/favicon/web-app-manifest-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    theme_color: '#1a1a1a',
    background_color: '#1a1a1a',
    display: 'standalone',
    start_url: '/',
  }
}
