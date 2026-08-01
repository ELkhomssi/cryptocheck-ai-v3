import 'server-only'

import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { readTokenSnapshot } from '@/lib/personal-watch/snapshot-store'

export type PublicTokenPageData = {
  mint: string
  name: string
  symbol: string
  verdict: string | null
  safetyScore: number | null
  riskScore: number | null
  evidenceLine: string | null
  scannedAt: string | null
}

export type PublicWalletPageData = {
  address: string
  label: string | null
  tier: string | null
  historicalPnlUsd: number | null
  winRatePct: number | null
  active: boolean
  updatedAt: string | null
}

export type PublicReportPageData = {
  id: string
  title: string
  body: string
  reportType: string
  walletAddress: string | null
  createdAt: string
  eventCount: number
  insufficientActivity: boolean
}

function mapVerdict(raw: string | null | undefined): string | null {
  if (!raw) return null
  return raw.trim().toUpperCase().replace(/\s+/g, '_')
}

export async function getPublicTokenPageData(mint: string): Promise<PublicTokenPageData | null> {
  const trimmed = mint.trim()
  if (trimmed.length < 32) return null

  const snap = await readTokenSnapshot(trimmed)
  if (snap) {
    return {
      mint: snap.mint,
      name: `Token ${snap.mint.slice(0, 4)}…${snap.mint.slice(-4)}`,
      symbol: snap.mint.slice(0, 4).toUpperCase(),
      verdict: snap.verdict,
      safetyScore: snap.safetyScore,
      riskScore: snap.riskScore,
      evidenceLine: snap.evidenceLine,
      scannedAt: snap.scannedAt,
    }
  }

  try {
    const sb = getSupabaseAdmin()
    const { data } = await sb
      .from('scan_history')
      .select('mint_address, risk_score, verdict, created_at')
      .eq('mint_address', trimmed)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!data) return null
    const risk =
      data.risk_score != null && Number.isFinite(Number(data.risk_score))
        ? Math.max(0, Math.min(100, Math.round(Number(data.risk_score))))
        : null
    return {
      mint: trimmed,
      name: `Token ${trimmed.slice(0, 4)}…${trimmed.slice(-4)}`,
      symbol: trimmed.slice(0, 4).toUpperCase(),
      verdict: mapVerdict(data.verdict),
      safetyScore: risk == null ? null : 100 - risk,
      riskScore: risk,
      evidenceLine: 'From scan_history · live product data',
      scannedAt: typeof data.created_at === 'string' ? data.created_at : null,
    }
  } catch {
    return null
  }
}

export async function getPublicWalletPageData(address: string): Promise<PublicWalletPageData | null> {
  const trimmed = address.trim()
  if (trimmed.length < 32) return null

  try {
    const sb = getSupabaseAdmin()
    const { data } = await sb
      .from('smart_money_wallets')
      .select('address, label, tier, historical_pnl_usd, win_rate_pct, active, last_active_at, created_at')
      .eq('address', trimmed)
      .maybeSingle()

    if (data) {
      return {
        address: data.address,
        label: data.label ?? null,
        tier: data.tier ?? null,
        historicalPnlUsd:
          data.historical_pnl_usd != null ? Number(data.historical_pnl_usd) : null,
        winRatePct: data.win_rate_pct != null ? Number(data.win_rate_pct) : null,
        active: data.active !== false,
        updatedAt:
          (data.last_active_at as string | null) ?? (data.created_at as string | null) ?? null,
      }
    }

    const { data: tracked } = await sb
      .from('trading_os_tracked_wallets')
      .select('wallet, updated_at, last_trade_at, win_rate, meta')
      .eq('wallet', trimmed)
      .maybeSingle()

    if (!tracked) return null
    const meta = tracked.meta && typeof tracked.meta === 'object' ? (tracked.meta as Record<string, unknown>) : {}
    const label = typeof meta.label === 'string' ? meta.label : null
    return {
      address: trimmed,
      label,
      tier: 'tracked',
      historicalPnlUsd: null,
      winRatePct: tracked.win_rate != null ? Number(tracked.win_rate) : null,
      active: true,
      updatedAt: (tracked.updated_at as string | null) ?? (tracked.last_trade_at as string | null) ?? null,
    }
  } catch {
    return null
  }
}

export async function getPublicReportPageData(id: string): Promise<PublicReportPageData | null> {
  const trimmed = id.trim()
  if (!/^[0-9a-f-]{36}$/i.test(trimmed)) return null

  try {
    const sb = getSupabaseAdmin()
    const { data, error } = await sb.from('reports').select('*').eq('id', trimmed).maybeSingle()
    if (error || !data) return null
    return {
      id: String(data.id),
      title: String(data.title ?? 'Intelligence Report'),
      body: String(data.body ?? ''),
      reportType: String(data.report_type ?? 'report'),
      walletAddress: (data.wallet_address as string | null) ?? null,
      createdAt: String(data.created_at ?? new Date().toISOString()),
      eventCount: Number(data.event_count ?? 0) || 0,
      insufficientActivity: data.insufficient_activity === true,
    }
  } catch {
    return null
  }
}
