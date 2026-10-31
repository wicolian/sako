import { ClaimData } from "@/components/campaigns/compliance-sidebar"

export interface TextSegment {
  id: string
  text: string
  isClaim: boolean
  claim?: ClaimData
}

/**
 * Fuzzy matches claims within generated text and returns an array of segments.
 * In a real implementation, this would handle complex fuzzy matching or parse
 * specific delimiters like [CLAIM:id]...[/CLAIM] added by the LLM.
 */
export function parseContentWithClaims(content: string, claims: ClaimData[]): TextSegment[] {
  if (!content) return []
  if (!claims || claims.length === 0) {
    return [{ id: 'seg-0', text: content, isClaim: false }]
  }

  // Sort claims by length descending so we match longer phrases first
  const sortedClaims = [...claims].sort((a, b) => b.text.length - a.text.length)
  
  let segments: TextSegment[] = [{ id: 'init', text: content, isClaim: false }]

  for (const claim of sortedClaims) {
    const newSegments: TextSegment[] = []
    
    for (const segment of segments) {
      if (segment.isClaim) {
        newSegments.push(segment)
        continue
      }
      
      // Simple substring match for now.
      // In a production scenario, you would want to use a fuzzy matching algorithm
      // or regex that accounts for punctuation/whitespace differences.
      const index = segment.text.toLowerCase().indexOf(claim.text.toLowerCase())
      
      if (index !== -1) {
        if (index > 0) {
          newSegments.push({
            id: `text-${Math.random().toString(36).substr(2, 9)}`,
            text: segment.text.substring(0, index),
            isClaim: false,
          })
        }
        
        newSegments.push({
          id: `claim-${claim.id}-${Math.random().toString(36).substr(2, 9)}`,
          text: segment.text.substring(index, index + claim.text.length),
          isClaim: true,
          claim: claim,
        })
        
        if (index + claim.text.length < segment.text.length) {
          newSegments.push({
            id: `text-${Math.random().toString(36).substr(2, 9)}`,
            text: segment.text.substring(index + claim.text.length),
            isClaim: false,
          })
        }
      } else {
        newSegments.push(segment)
      }
    }
    segments = newSegments
  }

  return segments
}
