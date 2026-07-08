/**
 * AI Sniper execution layer (Next.js side).
 *
 * - Reads vetted SnipeCandidates from the Redis stream the sniper worker emits.
 * - Stores per-user "armed" state (auto-disarms via TTL — never runs unattended forever).
 * - Persists the audit trail (attempt / swap) to signal_snipe_actions.
 *
 * NON-CUSTODIAL: nothing here signs or moves funds. Swap building returns an
 * unsigned base64 transaction; the browser wallet (Phantom) signs and sends.
 */
import {
  SIGNAL_SNIPE_CANDIDATES_STREAM,
  SNIPE_STREAM_FIELD,
  type SnipeActionRecord,
  type SnipeCandidate,
} from '@cryptocheck/signal-contracts'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

// ── Redis (Upstash REST) — stream + arm-state, mirrors lib/cache/intel-cache ──

function redisEnabled(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
}

async function upstashCommand<T = unknown>(args: (string | number)[]): Promise<T | null> {
  if (!redisEnabled()) return null
  const url = process.env.UPSTASH_REDIS_REST_URL!
  const token = process.env.UPSTASH_REDIS_REST_TOKEN!
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Upstash HTTP ${res.status}`)
  const j = (await res.json()) as { result?: T; error?: string }
  if (j.error) throw new Error(j.error)
  return (j.result ?? null) as T | null
}

// ── Candidate feed ────────────────────────────────────────────────────────────

type StreamEntry = [string, string[]]

function fieldValue(fields: string[], name: string): string | null {
  for (let i = 0; i < fields.length; i += 2) {
    if (fields[i] === name) return fields[i + 1] ?? null
  }
  return null
}

/** Newest-first vetted snipe candidates (from the sniper worker). */
export async function readSnipeCandidates(limit = 30): Promise<SnipeCandidate[]> {
  const count = Math.min(Math.max(1, limit), 100)
  let raw: StreamEntry[] | null = null
  try {
    raw = await upstashCommand<StreamEntry[]>([
      'XREVRANGE',
      SIGNAL_SNIPE_CANDIDATES_STREAM,
      '+',
      '-',
      'COUNT',
      count,
    ])
  } catch {
    return []
  }
  if (!raw?.length) return []

  const out: SnipeCandidate[] = []
  for (const [, fields] of raw) {
    const data = fieldValue(fields, SNIPE_STREAM_FIELD)
    if (!data) continue
    try {
      out.push(JSON.parse(data) as SnipeCandidate)
    } catch {
      // skip malformed entry
    }
  }
  return out
}

// ── Per-user arming state ───────────────────────────────────────────────────

export type SnipeArmState = {
  armed: boolean
  /** Hard cap per auto-snipe (USD) — a money-safety ceiling. */
  maxAmountUsd: number
  slippageBps: number
  /** Only auto-act on candidates at/above this safety score. */
  minScore: number
  updatedAt: string
  /** When arming auto-expires (ISO). */
  expiresAt?: string
}

/** Safety ceiling — arming auto-disarms after this window so it never runs unattended. */
const ARM_TTL_SEC = Number(process.env.SNIPER_ARM_TTL_SEC ?? 12 * 60 * 60)
const MAX_AMOUNT_CEILING_USD = Number(process.env.SNIPER_MAX_AMOUNT_USD ?? 500)

function armKey(userId: string): string {
  return `ccai:sig:snipe:armed:${userId}`
}

export function defaultArmState(): SnipeArmState {
  return { armed: false, maxAmountUsd: 50, slippageBps: 100, minScore: 75, updatedAt: new Date().toISOString() }
}

export async function getArmState(userId: string): Promise<SnipeArmState> {
  try {
    const raw = await upstashCommand<string>(['GET', armKey(userId)])
    if (!raw) return defaultArmState()
    return { ...defaultArmState(), ...(JSON.parse(raw) as Partial<SnipeArmState>) }
  } catch {
    return defaultArmState()
  }
}

export async function setArmState(
  userId: string,
  patch: Partial<Pick<SnipeArmState, 'armed' | 'maxAmountUsd' | 'slippageBps' | 'minScore'>>,
): Promise<SnipeArmState> {
  const current = await getArmState(userId)
  const now = new Date()
  const next: SnipeArmState = {
    armed: patch.armed ?? current.armed,
    // Clamp to the platform ceiling — never trust a client-supplied larger cap.
    maxAmountUsd: clamp(patch.maxAmountUsd ?? current.maxAmountUsd, 1, MAX_AMOUNT_CEILING_USD),
    slippageBps: clamp(patch.slippageBps ?? current.slippageBps, 10, 2_000),
    minScore: clamp(patch.minScore ?? current.minScore, 0, 100),
    updatedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + ARM_TTL_SEC * 1_000).toISOString(),
  }
  await upstashCommand(['SET', armKey(userId), JSON.stringify(next), 'EX', ARM_TTL_SEC])
  return next
}

function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo
  return Math.min(hi, Math.max(lo, n))
}

// ── Audit trail (service-role → signal_snipe_actions) ─────────────────────────

export async function logSnipeAction(row: SnipeActionRecord): Promise<boolean> {
  try {
    const sb = getSupabaseAdmin()
    const { error } = await sb.from('signal_snipe_actions').insert({
      user_id: row.userId ?? null,
      signal_id: row.signalId,
      mint: row.mint,
      symbol: row.symbol,
      action: row.action,
      allowed: row.allowed,
      neural_score: Math.round(row.neuralScore),
      verdict: row.verdict,
      red_flags: row.redFlags,
      evidence_summary: row.evidenceSummary,
      blocked_reason: row.blockedReason ?? null,
      tx_signature: row.txSignature ?? null,
      created_at: row.createdAt,
    })
    if (error) {
      console.error('[snipe] audit insert failed', error.message)
      return false
    }
    return true
  } catch (e) {
    console.error('[snipe] audit insert threw', e instanceof Error ? e.message : e)
    return false
  }
}

export function isValidSolanaMint(v: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v)
}

export const MAX_AMOUNT_USD = MAX_AMOUNT_CEILING_USD
