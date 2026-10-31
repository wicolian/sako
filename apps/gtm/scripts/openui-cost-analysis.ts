import { encodingForModel } from 'js-tiktoken'
import { z } from 'zod'

import { formatBrandPrompt } from '@/lib/ai/brand-context'
import { MODELS } from '@/lib/ai/ai-sdk-client'
import { generateObject, generateText } from '@/lib/ai/langsmith-ai'
import { composerSeedFixtures } from '@/__tests__/fixtures/composer-seeds'
import { buildSakoOpenUiSystemPrompt } from '@/lib/openui/sako-library'

const LegacyLandingSchema = z.object({
  headline: z.string(),
  subheadline: z.string(),
  features: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
    })
  ),
  testimonials: z.array(
    z.object({
      quote: z.string(),
      name: z.string(),
      role: z.string(),
    })
  ),
  cta: z.object({
    headline: z.string(),
    body: z.string(),
    label: z.string(),
    href: z.string(),
  }),
})

async function main() {
  const encoder = encodingForModel('gpt-4o')
  const landingFixtures = composerSeedFixtures.filter((fixture) => fixture.assetTypes.includes('landing-page')).slice(0, 5)

  const rows: Array<{
    id: string
    jsonTokens: number
    openUiTokens: number
  }> = []

  for (const fixture of landingFixtures) {
    const brief = [
      `Brand: ${fixture.brand.name}`,
      `Audience: ${fixture.brief.audience}`,
      `Goal: ${fixture.brief.goal}`,
      `Offer: ${fixture.brief.offer}`,
      `CTA: ${fixture.brief.cta}`,
    ].join('\n')

    const brandPrompt = formatBrandPrompt(fixture.brand)

    const jsonResult = await generateObject<z.infer<typeof LegacyLandingSchema>>({
      model: MODELS.STRUCTURED,
      schema: LegacyLandingSchema,
      prompt: `${brief}\n\n${brandPrompt}\n\nReturn a proof-aware landing page structure with hero, features, testimonials, and CTA.`,
    })

    const openUiResult = await generateText({
      model: MODELS.BALANCED,
      system: buildSakoOpenUiSystemPrompt({ brand: fixture.brand }),
      prompt: `${brief}\n\nReturn the same landing page as OpenUI Lang using hero, feature, testimonial, and CTA sections.`,
      temperature: 0.3,
      maxTokens: 900,
    })

    const jsonOutput = JSON.stringify(jsonResult.object)
    const openUiOutput = openUiResult.text

    rows.push({
      id: fixture.id,
      jsonTokens: encoder.encode(jsonOutput).length,
      openUiTokens: encoder.encode(openUiOutput).length,
    })
  }

  const totalJsonTokens = rows.reduce((sum, row) => sum + row.jsonTokens, 0)
  const totalOpenUiTokens = rows.reduce((sum, row) => sum + row.openUiTokens, 0)
  const savings = totalJsonTokens === 0 ? 0 : ((totalJsonTokens - totalOpenUiTokens) / totalJsonTokens) * 100

  console.table(
    rows.map((row) => ({
      fixture: row.id,
      jsonTokens: row.jsonTokens,
      openUiTokens: row.openUiTokens,
      savingsPct: `${(((row.jsonTokens - row.openUiTokens) / row.jsonTokens) * 100).toFixed(1)}%`,
    }))
  )

  console.log('\nSummary')
  console.log(`JSON tokens: ${totalJsonTokens}`)
  console.log(`OpenUI tokens: ${totalOpenUiTokens}`)
  console.log(`Savings: ${savings.toFixed(1)}%`)
}

main().catch((error) => {
  console.error('OpenUI cost analysis failed:', error)
  process.exit(1)
})
