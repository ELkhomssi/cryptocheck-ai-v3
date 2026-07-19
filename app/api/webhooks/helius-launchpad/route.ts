import { createHash, timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import {
  SIGNAL_DEDUP_ID_PREFIX,
  SIGNAL_STREAM_UNIFIED,
  signalSourceStreamKey,
} from '@cryptocheck/signal-contracts'
import { buildLaunchpadSignal, mintPassesPrefilter } from '@/lib/launchpad/scout'
import {
  LAUNCHPAD_MIN_AGE_SEC,
  LAUNCHPAD_MIN_LIQUIDITY_USD,
} from '@/lib/launchpad/constants'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Constant-time secret compare (SHA-256 digests so lengths always match).
 */
function secretsEqual(provided: string, expected: string): boolean {
  const a = createHash('sha256').update(provided).digest()
  const b = createHash('sha256').update(expected).digest()
  return timingSafeEqual(a, b)
}

/**
 * Extract Bearer / header / query secret candidates.
 * Auth runs BEFORE body parse — fail closed if HELIUS_WEBHOOK_SECRET unset.
 */
function extractProvidedSecret(req: Request): string {
  const auth = req.headers.get('authorization')?.trim() ?? ''
  if (/^Bearer\s+/i.test(auth)) {
    return auth.replace(/^Bearer\s+/i, '').trim()
  }
  const hdr =
    req.headers.get('x-helius-secret')?.trim() ||
    req.headers.get('x-webhook-secret')?.trim() ||
    ''
  if (hdr) return hdr
  return new URL(req.url).searchParams.get('secret')?.trim() ?? ''
}

function assertWebhookAuthorized(req: Request): NextResponse | null {
  const expected = process.env.HELIUS_WEBHOOK_SECRET?.trim() ?? ''
  // Fail closed: never accept traffic without a configured secret.
  if (!expected) {
    console.error('[helius-launchpad] HELIUS_WEBHOOK_SECRET is not set — rejecting all requests')
    return NextResponse.json({ error: 'webhook not configured' }, { status: 401 })
  }
  const provided = extractProvidedSecret(req)
  if (!provided || !secretsEqual(provided, expected)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  return null
}

/**
 * POST /api/webhooks/helius-launchpad
 * Helius firehose → auth FIRST → pre-filter → SETNX dedup → XADD unified.
 *
 * Headers (any one): Authorization: Bearer <secret> | x-helius-secret | ?secret=
 */
export async function POST(req: Request) {
  // ── 0. Auth before any parse / Redis / DB side effects ───────────────────
  const denied = assertWebhookAuthorized(req)
  if (denied) return denied

  const payload = await req.json().catch(() => null)
  const events = Array.isArray(payload) ? payload : payload ? [payload] : []

  let accepted = 0
  let dropped = 0
  let deduped = 0

  for (const ev of events) {
    const mint = extractMint(ev as Record<string, unknown>)
    if (!mint) {
      dropped += 1
      continue
    }
    const row = ev as Record<string, unknown>
    const liquidityUsd = Number(row.liquidityUsd ?? NaN)
    // Webhook must not use process-local mint remember — Redis SETNX is the dedup.
    const ok = mintPassesPrefilter(
      mint,
      {
        liquidityUsd: Number.isFinite(liquidityUsd) ? liquidityUsd : undefined,
        ageSec: 0,
      },
      { minLiquidityUsd: LAUNCHPAD_MIN_LIQUIDITY_USD, minAgeSec: LAUNCHPAD_MIN_AGE_SEC },
      { rememberMint: false },
    )
    if (!ok) {
      console.warn('[helius-launchpad] drop prefilter', mint.slice(0, 12))
      dropped += 1
      continue
    }

    const eventId =
      (typeof row.signature === 'string' && row.signature) ||
      (typeof row.eventId === 'string' && row.eventId) ||
      (typeof row.event === 'string' && row.event) ||
      mint
    const sig = buildLaunchpadSignal({
      mint,
      symbol: typeof row.tokenSymbol === 'string' ? row.tokenSymbol : undefined,
      label: typeof row.tokenName === 'string' ? row.tokenName : undefined,
      liquidityUsd: Number.isFinite(liquidityUsd) ? liquidityUsd : undefined,
      sourceRef: `helius:${eventId}`,
    })

    try {
      const wrote = await xaddUnified(sig)
      if (wrote) accepted += 1
      else deduped += 1
    } catch (e) {
      console.error('[helius-launchpad] xadd', e)
      dropped += 1
    }
  }

  return NextResponse.json({ ok: true, accepted, dropped, deduped })
}

function extractMint(ev: Record<string, unknown>): string | null {
  if (typeof ev.mint === 'string' && ev.mint.length >= 32) return ev.mint
  if (typeof ev.tokenMint === 'string' && ev.tokenMint.length >= 32) return ev.tokenMint
  const transfers = ev.tokenTransfers as Array<{ mint?: string }> | undefined
  const t0 = transfers?.[0]?.mint
  if (typeof t0 === 'string' && t0.length >= 32) return t0
  return null
}

/** @returns true if newly written, false if deduped. */
async function xaddUnified(sig: { id: string; [k: string]: unknown }): Promise<boolean> {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) throw new Error('Redis not configured')

  const dedupKey = `${SIGNAL_DEDUP_ID_PREFIX}${sig.id}`
  const setnx = await redis(url, token, ['SET', dedupKey, '1', 'EX', 86400, 'NX'])
  // Upstash returns null when NX fails (key exists) — replay is a no-op.
  if (setnx === null) return false

  const payload = JSON.stringify(sig)
  const sourceKey = signalSourceStreamKey('launchpad')
  await redis(url, token, ['XADD', sourceKey, 'MAXLEN', '~', '50000', '*', 'payload', payload])
  await redis(url, token, [
    'XADD',
    SIGNAL_STREAM_UNIFIED,
    'MAXLEN',
    '~',
    '100000',
    '*',
    'payload',
    payload,
  ])
  return true
}

async function redis(url: string, token: string, args: (string | number)[]): Promise<unknown> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Upstash ${res.status}`)
  const j = (await res.json()) as { result?: unknown; error?: string }
  if (j.error) throw new Error(j.error)
  return j.result ?? null
}
