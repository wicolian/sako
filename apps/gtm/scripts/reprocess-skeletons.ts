/**
 * Reprocess Skeletons
 *
 * Batch job to compile design skeletons for all existing templates.
 * Run: bunx tsx scripts/reprocess-skeletons.ts
 */

import { createServiceClient } from '@/lib/supabase/service'
import { compileDesignSkeleton } from '@/lib/templates/design-system-compiler'

async function main() {
  const supabase = createServiceClient()

  console.log('Fetching templates without skeletons...')
  const { data: templates, error } = await supabase
    .from('design_templates')
    .select('id, name, section_type, html, css, metadata')
    .is('design_skeleton', null)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Failed to fetch templates:', error.message)
    process.exit(1)
  }

  console.log(`Found ${templates?.length ?? 0} templates to process`)

  let processed = 0
  let failed = 0

  for (const template of templates ?? []) {
    try {
      const skeleton = compileDesignSkeleton(
        template.html ?? '',
        template.css ?? '',
        {
          type: template.section_type ?? 'custom',
          category: (template.metadata as Record<string, unknown>)?.category as string,
          tags: (template.metadata as Record<string, unknown>)?.tags as string[],
        }
      )

      const { error: updateError } = await supabase
        .from('design_templates')
        .update({
          design_skeleton: skeleton,
          skeleton_css: skeleton.layoutCSS,
          skeleton_html: skeleton.structureHTML,
          complexity_score: skeleton.complexityScore,
          aesthetic_signature: JSON.stringify(skeleton.aestheticSignature),
        })
        .eq('id', template.id)

      if (updateError) {
        console.error(`Failed to update template ${template.id}: ${updateError.message}`)
        failed++
      } else {
        processed++
        if (processed % 10 === 0) {
          console.log(`Processed ${processed}/${templates?.length ?? 0}...`)
        }
      }
    } catch (err) {
      console.error(`Error processing template ${template.id}:`, err)
      failed++
    }
  }

  console.log(`Done! Processed: ${processed}, Failed: ${failed}`)
}

main().catch(console.error)
