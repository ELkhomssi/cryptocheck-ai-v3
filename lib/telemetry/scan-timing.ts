import 'server-only'

import { getSupabaseAdmin } from '@/lib/supabase/admin'

export type ScanTimingRecord = {
  mint: string
  cached: boolean
  heliusMs: number
  dasMs: number
  dexMs: number
  analyzeMs: number
  totalMs: number
  userId: string | null
}

/**
 * Fire-and-forget insert into `scan_timings` (service role; table may not exist until migration).
 */
export function recordScanTiming(row: ScanTimingRecord): void {
  void (async () => {
    try {
      const sb = getSupabaseAdmin()
      await sb.from('scan_timings').insert({
        mint: row.mint,
        cached: row.cached,
        helius_ms: Math.round(row.heliusMs),
        das_ms: Math.round(row.dasMs),
        dex_ms: Math.round(row.dexMs),
        analyze_ms: Math.round(row.analyzeMs),
        total_ms: Math.round(row.totalMs),
        user_id: row.userId,
      })
    } catch {
      /* table missing or RLS — ignore */
    }
  })()
}
