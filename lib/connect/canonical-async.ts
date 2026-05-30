import 'server-only'

import { canonicalScan } from '@/lib/sentinel/canonical-scan'
import { mergeReasoningWithCanonical } from '@/lib/sentinel/merge-canonical-institutional'
import {
  scanBodyCacheKey,
  setInstitutionalScan,
} from '@/lib/services/scanner/ScannerCache'
import { setMintKeyedScanV2 } from '@/lib/cache/scan-cache'
import type { InstitutionalScanSnapshot } from '@/lib/services/scanner/types'
import type { CanonicalScanResult } from '@/lib/types/canonical-scan'

function mergeSnapshotWithCanonical(
  snapshot: InstitutionalScanSnapshot,
  canonical: CanonicalScanResult
): InstitutionalScanSnapshot {
  return {
    ...snapshot,
    weighted: { ...snapshot.weighted, score: canonical.riskScore },
    reasoning: mergeReasoningWithCanonical(snapshot.reasoning, canonical),
  }
}

/**
 * I7 — Fire-and-forget canonical overlay; merges into Redis caches for subsequent reads.
 * Never blocks the consumer API response.
 */
export function scheduleCanonicalMerge(
  mint: string,
  snapshot: InstitutionalScanSnapshot,
  bodyForCacheKey: Record<string, unknown>
): void {
  if (mint.length < 32) return

  void (async () => {
    try {
      const canonical = await canonicalScan(mint)
      const merged = mergeSnapshotWithCanonical(snapshot, canonical)
      const cacheKey = scanBodyCacheKey(bodyForCacheKey)
      await setInstitutionalScan(cacheKey, merged)
      await setMintKeyedScanV2(mint, cacheKey, merged)
    } catch (e) {
      console.error('[canonical-async] merge failed', mint.slice(0, 8), e instanceof Error ? e.message : e)
    }
  })()
}
