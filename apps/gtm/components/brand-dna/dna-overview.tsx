'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Building2, Globe, Lightbulb } from 'lucide-react'

interface BrandData {
  name: string
  website_url: string
  logo_url?: string
  industry?: string
  tagline?: string
  mission?: string
}

interface DnaOverviewProps {
  brand: BrandData
}

export function DnaOverview({ brand }: DnaOverviewProps) {
  return (
    <Card className="bg-gradient-to-br from-primary/5 to-purple-500/5 border-primary/20">
      <CardContent className="pt-6">
        <div className="flex items-start gap-6">
          {/* Logo */}
          <div className="w-20 h-20 rounded-2xl bg-background border flex items-center justify-center shrink-0">
            {brand.logo_url ? (
              <img
                src={brand.logo_url}
                alt={brand.name}
                className="w-16 h-16 object-contain"
              />
            ) : (
              <Building2 className="h-10 w-10 text-muted-foreground" />
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-2xl font-bold">{brand.name}</h2>
              {brand.industry && (
                <Badge variant="secondary">{brand.industry}</Badge>
              )}
            </div>

            {brand.tagline && (
              <p className="text-lg text-muted-foreground mb-3">
                "{brand.tagline}"
              </p>
            )}

            {brand.mission && (
              <div className="flex items-start gap-2 text-sm text-muted-foreground mb-3">
                <Lightbulb className="h-4 w-4 mt-0.5 shrink-0" />
                <p>{brand.mission}</p>
              </div>
            )}

            {brand.website_url && (
              <a
                href={brand.website_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                <Globe className="h-3.5 w-3.5" />
                {brand.website_url.replace(/^https?:\/\//, '').replace(/\/$/, '')}
              </a>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
