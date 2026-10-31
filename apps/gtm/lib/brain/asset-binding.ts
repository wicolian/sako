import type { AssetDocument } from '@/lib/assets/asset-document'
import type { BrainContext } from './types'
import { buildBrainProvenance } from './service'

export function bindAssetDocumentToBrain(
  doc: AssetDocument,
  context: BrainContext,
): AssetDocument {
  return {
    ...doc,
    brainSnapshotId: context.snapshot.id,
    provenance: buildBrainProvenance(context),
  }
}
