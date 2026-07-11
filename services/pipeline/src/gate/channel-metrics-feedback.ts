/**
 * Gate → signal_channel_metrics feedback.
 * Updates success_rate / latency / trust_score; auto-disables toxic channels.
 * Formulas kept in sync with services/ingestion/src/discovery/metrics-formula.ts
 * (pipeline must not import from services/ingestion).
 */
import type { UnifiedSignal } from '@cryptocheck/signal-contracts'

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.min(1, Math.max(0, n))
}

function successRate(safe: number, caution: number, danger: number): number {
  const r = safe + caution + danger
  return r <= 0 ? 0.5 : safe / r
}

function trustScore(input: {
  successRate: number
  dangerRate: number
  latencyMs: number
  engagementScore?: number | null
}): number {
  const success = clamp01(input.successRate)
  const safety = clamp01(1 - clamp01(input.dangerRate))
  const latencyNorm = clamp01(1 - Math.min(input.latencyMs, 8_000) / 8_000)
  const engagement = clamp01((input.engagementScore ?? 50) / 100)
  return (
    Math.round(
      100 * (0.45 * success + 0.25 * safety + 0.15 * latencyNorm + 0.15 * engagement) * 100,
    ) / 100
  )
}

function dRate(safe: number, caution: number, danger: number): number {
  const r = safe + caution + danger
  return r <= 0 ? 0 : danger / r
}

function shouldDisable(m: {
  signals_safe: number
  signals_caution: number
  signals_danger: number
  trust_score: number
}): { disable: boolean; reason?: string } {
  const min = Number(process.env.SIGNAL_CHANNEL_METRICS_MIN_SAMPLES ?? 8)
  const floor = Number(process.env.SIGNAL_CHANNEL_TRUST_DISABLE_FLOOR ?? 25)
  const dangerFloor = Number(process.env.SIGNAL_CHANNEL_DANGER_RATE_DISABLE ?? 0.65)
  const resolved = m.signals_safe + m.signals_caution + m.signals_danger
  if (resolved < min) return { disable: false }
  const dr = dRate(m.signals_safe, m.signals_caution, m.signals_danger)
  if (dr >= dangerFloor) return { disable: true, reason: `danger_rate=${dr.toFixed(2)}` }
  if (m.trust_score < floor) return { disable: true, reason: `trust_score=${m.trust_score}` }
  return { disable: false }
}

function normalizeChannel(ref: string): string {
  const t = ref.trim()
  if (!t) return t
  if (t.startsWith('@') || /^\d+$/.test(t)) return t
  return `@${t.replace(/^@/, '')}`
}

function supabaseCreds(): { url: string; key: string } | null {
  const url = process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) return null
  return { url: url.replace(/\/$/, ''), key }
}

type MetricsRow = {
  channel_id: string
  signals_seen: number
  signals_safe: number
  signals_caution: number
  signals_danger: number
  signals_dropped: number
  latency_ms: number
  latency_samples: number
  engagement_score: number | null
  auto_disabled: boolean
}

/**
 * Record one resolved token outcome for the originating Telegram channel.
 * Best-effort — never throws into the gate hot path.
 */
export async function recordChannelOutcome(
  signal: UnifiedSignal,
  opts: { latencyMs?: number },
): Promise<void> {
  if (signal.sourceTag !== 'telegram' || signal.subjectType !== 'token') return

  const channelRaw =
    signal.sources?.[0] ??
    (typeof (signal as { sourceChannel?: string }).sourceChannel === 'string'
      ? (signal as { sourceChannel?: string }).sourceChannel
      : undefined)
  if (!channelRaw || typeof channelRaw !== 'string') return
  const channelId = normalizeChannel(channelRaw)

  const creds = supabaseCreds()
  if (!creds) return

  const headers = {
    apikey: creds.key,
    Authorization: `Bearer ${creds.key}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  }

  try {
    const getUrl = `${creds.url}/rest/v1/signal_channel_metrics?platform=eq.telegram&channel_id=eq.${encodeURIComponent(channelId)}&select=*`
    const existingRes = await fetch(getUrl, { headers, cache: 'no-store' })
    const existingRows = existingRes.ok ? ((await existingRes.json()) as MetricsRow[]) : []
    const prev = existingRows[0]

    const next: MetricsRow = {
      channel_id: channelId,
      signals_seen: (prev?.signals_seen ?? 0) + 1,
      signals_safe: prev?.signals_safe ?? 0,
      signals_caution: prev?.signals_caution ?? 0,
      signals_danger: prev?.signals_danger ?? 0,
      signals_dropped: prev?.signals_dropped ?? 0,
      latency_ms: prev?.latency_ms ?? 0,
      latency_samples: prev?.latency_samples ?? 0,
      engagement_score: prev?.engagement_score ?? null,
      auto_disabled: prev?.auto_disabled ?? false,
    }

    if (signal.dropped) {
      next.signals_dropped += 1
    } else if (signal.verdict === 'safe') {
      next.signals_safe += 1
    } else if (signal.verdict === 'caution') {
      next.signals_caution += 1
    } else if (signal.verdict === 'danger') {
      next.signals_danger += 1
    } else {
      return
    }

    if (typeof opts.latencyMs === 'number' && opts.latencyMs >= 0) {
      const n = next.latency_samples + 1
      next.latency_ms = Math.round((next.latency_ms * next.latency_samples + opts.latencyMs) / n)
      next.latency_samples = n
    }

    const sr = successRate(next.signals_safe, next.signals_caution, next.signals_danger)
    const dr = dRate(next.signals_safe, next.signals_caution, next.signals_danger)
    const trust = trustScore({
      successRate: sr,
      dangerRate: dr,
      latencyMs: next.latency_ms,
      engagementScore: next.engagement_score,
    })

    const disable = shouldDisable({
      signals_safe: next.signals_safe,
      signals_caution: next.signals_caution,
      signals_danger: next.signals_danger,
      trust_score: trust,
    })

    const body = {
      platform: 'telegram',
      channel_id: channelId,
      signals_seen: next.signals_seen,
      signals_safe: next.signals_safe,
      signals_caution: next.signals_caution,
      signals_danger: next.signals_danger,
      signals_dropped: next.signals_dropped,
      success_rate: sr,
      latency_ms: next.latency_ms,
      latency_samples: next.latency_samples,
      trust_score: trust,
      last_signal_at: new Date().toISOString(),
      last_scored_at: new Date().toISOString(),
      auto_disabled: disable.disable || next.auto_disabled,
      auto_disable_reason: disable.disable ? disable.reason ?? null : null,
      updated_at: new Date().toISOString(),
    }

    await fetch(`${creds.url}/rest/v1/signal_channel_metrics?on_conflict=platform,channel_id`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(body),
    })

    if (disable.disable) {
      await fetch(
        `${creds.url}/rest/v1/telegram_channels?username=eq.${encodeURIComponent(channelId)}`,
        {
          method: 'PATCH',
          headers: { ...headers, Prefer: 'return=minimal' },
          body: JSON.stringify({ enabled: false, updated_at: new Date().toISOString() }),
        },
      )
      console.info('[channel-metrics] auto-disabled after gate feedback', {
        channelId,
        reason: disable.reason,
        trust,
      })
    }
  } catch (e) {
    console.warn('[channel-metrics] feedback failed', e instanceof Error ? e.message : e)
  }
}
