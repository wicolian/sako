/**
 * Gate Layout - Minimal public layout for the Compliance Gate
 * 
 * No authentication required. Clean, focused design.
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { ThemeProvider } from 'next-themes'

export const metadata: Metadata = {
  title: 'Compliance Gate | Sako',
  description: 'Validate your marketing claims before they get you sued. Free AI-powered compliance checker.',
  openGraph: {
    title: 'Compliance Gate | Sako',
    description: 'Validate your marketing claims before they get you sued. Free AI-powered compliance checker.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Compliance Gate | Sako',
    description: 'Validate your marketing claims before they get you sued.',
  },
}

export default function GateLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <div className="min-h-screen flex flex-col bg-background">
        {/* Header */}
        <header className="border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container flex h-14 max-w-screen-2xl items-center justify-between px-4">
            <Link href="/gate" className="flex items-center space-x-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <span className="text-lg font-bold text-primary-foreground">S</span>
              </div>
              <span className="font-semibold text-lg">Sako</span>
              <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                Compliance Gate
              </span>
            </Link>
            
            <div className="flex items-center gap-4">
              <Link 
                href="/login" 
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Sign In
              </Link>
              <Link
                href="/signup"
                className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors"
              >
                Get Started
              </Link>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1">
          {children}
        </main>

        {/* Footer */}
        <footer className="border-t border-border/40 py-6">
          <div className="container max-w-screen-2xl px-4">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Powered by</span>
                <span className="font-semibold text-foreground">ClaimsOS</span>
                <span>•</span>
                <span>AI-powered compliance validation</span>
              </div>
              <div className="flex items-center gap-6 text-sm text-muted-foreground">
                <Link href="https://trysako.com" className="hover:text-foreground transition-colors">
                  About Sako
                </Link>
                <Link href="https://trysako.com/docs" className="hover:text-foreground transition-colors">
                  Documentation
                </Link>
                <Link href="https://trysako.com/privacy" className="hover:text-foreground transition-colors">
                  Privacy
                </Link>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </ThemeProvider>
  )
}
