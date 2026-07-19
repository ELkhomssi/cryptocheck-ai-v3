import 'server-only'

import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { redis } from '@/lib/cache/redis'
import {
  WATCH_SNAP_REDIS_PREFIX,
  type CoachVerdict,
  type TokenWatchSnapshot,
} from './constants'
import { normalizeCoachVerdict } from './degrade'

export async function readTokenSnapshot(mint: string): Promise<TokenWatchSnapshot | null> {
  try {
    const cached = await redis.get(`${WATCH_SNAP_REDIS_PREFIX}${mint}`)
    if (cached) {
      const parsed = JSON.parse(cached) as TokenWatchSnapshot
      if (parsed?.mint) return parsed
    }
  } catch {
    /* fall through */
  }

  try {
    const sb = getSupabaseAdmin()
    const { data, error } = await sb
      .from('token_watch_snapshots')
      .select('mint, safety_score, risk_score, verdict, evidence_labels, evidence_line, scanned_at')
      .eq('mint', mint)
      .maybeSingle()
    if (error || !data) return null
    return {
      mint: data.mint,
      safetyScore: Number(data.safety_score),
      riskScore: Number(data.risk_score),
      verdict: normalizeCoachVerdict(data.verdict),
      evidenceLabels: Array.isArray(data.evidence_labels) ? data.evidence_labels.map(String) : [],
      evidenceLine: data.evidence_line ?? null,
      scannedAt: data.scanned_at,
    }
  } catch {
    return null
  }
}

export async function writeTokenSnapshot(snap: TokenWatchSnapshot): Promise<void> {
  try {
    await redis.setex(`${WATCH_SNAP_REDIS_PREFIX}${snap.mint}`, 60 * 60 * 24 * 7, JSON.stringify(snap))
  } catch {
    /* best-effort */
  }

  try {
    const sb = getSupabaseAdmin()
    await sb.from('token_watch_snapshots').upsert(
      {
        mint: snap.mint,
        safety_score: snap.safetyScore,
        risk_score: snap.riskScore,
        verdict: snap.verdict,
        evidence_labels: snap.evidenceLabels,
        evidence_line: snap.evidenceLine,
        scanned_at: snap.scannedAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'mint' },
    )
  } catch (e) {
    console.error('[personal-watch] writeTokenSnapshot', e)
  }
}

/** Nearest snapshot at or before `atIso` for entry-timing analytics. */
export async function nearestSnapshotBefore(
  mint: string,
  atIso: string,
): Promise<{ verdict: CoachVerdict; safetyScore: number } | null> {
  try {
    const sb = getSupabaseAdmin()
    const { data } = await sb
      .from('token_watch_snapshots')
      .select('verdict, safety_score, scanned_at')
      .eq('mint', mint)
      .lte('scanned_at', atIso)
      .order('scanned_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (data) {
      return {
        verdict: normalizeCoachVerdict(data.verdict),
        safetyScore: Number(data.safety_score),
      }
    }

    // Fallback: scan_history if present
    const { data: hist } = await sb
      .from('scan_history')
      .select('verdict, risk_score, created_at')
      .eq('mint_address', mint)
      .lte('created_at', atIso)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!hist) return null
    const risk = hist.risk_score != null ? Number(hist.risk_score) : 50
    return {
      verdict: normalizeCoachVerdict(hist.verdict),
      safetyScore: Math.max(0, Math.min(100, 100 - risk)),
    }
  } catch {
    return null
  }
}
