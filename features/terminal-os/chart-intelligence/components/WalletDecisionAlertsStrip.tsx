'use client'

/**
 * Top strip: wallet-scoped alerts from published Decisions + holdings/whale evidence.
 * KERNEL: Decision.action only for exit/entry commands; price/whales are evidence.
 */

import { useQuery } from '@tanstack/react-query'
import type { Decision } from '@cryptocheck/decision-contracts'
import { useWhaleMovements } from '@/features/terminal-os/shared/hooks/useTerminalQueries'
import { useTerminalOsStore } from '@/stores/terminal-os'
import {
  buildWalletDecisionAlerts,
  type WalletDecisionAlert,
} from '@/features/terminal-os/chart-intelligence/lib/wallet-decision-alerts'
import type { HoldingsResponse } from '@/types/portfolio-desk'

export function WalletDecisionAlertsStrip() {
  const wallet = useTerminalOsStore((s) => s.walletAddress)
  const connected = useTerminalOsStore((s) => s.walletConnected)
  const chainFamily = useTerminalOsStore((s) => s.walletChainFamily)
  const setFocused = useTerminalOsStore((s) => s.setFocusedToken)

  const holdingsQ = useQuery({
    queryKey: ['tos', 'chart-ws-holdings', wallet],
    enabled: Boolean(connected && wallet && chainFamily !== 'evm'),
    queryFn: async () => {
      const res = await fetch(`/api/portfolio/holdings?wallet=${encodeURIComponent(wallet!)}`, {
        cache: 'no-store',
      })
      if (!res.ok) return null
      return (await res.json()) as HoldingsResponse
    },
    staleTime: 20_000,
    refetchInterval: 45_000,
  })

  const decisionsQ = useQuery({
    queryKey: ['tos', 'chart-ws-decisions', wallet],
    queryFn: async () => {
      const qs = new URLSearchParams({ limit: '16' })
      if (wallet) qs.set('wallet', wallet)
      const res = await fetch(`/api/terminal-os/decisions?${qs}`, { cache: 'no-store' })
      if (!res.ok) return [] as Decision[]
      const body = (await res.json()) as { decisions?: Decision[] }
      return body.decisions ?? []
    },
    staleTime: 12_000,
    refetchInterval: 20_000,
  })

  const whalesQ = useWhaleMovements(24)

  const holdings = holdingsQ.data?.holdings ?? []
  const alerts: WalletDecisionAlert[] = buildWalletDecisionAlerts({
    holdings: holdings.map((h) => ({
      mint: h.mint,
      symbol: h.symbol,
      change24hPct: h.change24hPct,
      valueUsd: h.valueUsd,
    })),
    decisions: decisionsQ.data ?? [],
    whales: (whalesQ.data ?? []).map((w) => ({
      assetSymbol: w.assetSymbol,
      action: w.action,
      usdValue: w.usdValue,
    })),
  })

  return (
    <section className="tos-chart-ws-alerts" data-tos-chart-alerts="true" aria-label="Wallet Decision alerts">
      <header className="tos-chart-ws-alerts-head">
        <span>Wallet alerts</span>
        <span className="tos-desk-live" data-on={alerts.length > 0 ? 'true' : 'false'}>
          {!connected
            ? 'Connect wallet'
            : alerts.length
              ? `${alerts.length} live`
              : chainFamily === 'evm'
                ? 'EVM holdings · quiet'
                : 'Quiet'}
        </span>
      </header>

      {!connected || !wallet ? (
        <p className="tos-desk-empty">
          Connect a Solana or EVM wallet — EXIT/SELL Decisions on holdings surface here as exit
          alerts; BUY Decisions with whale/rise evidence surface as entry alerts. Real Decision
          Engine only.
        </p>
      ) : holdingsQ.isLoading && !holdingsQ.data ? (
        <p className="tos-desk-empty">Loading holdings…</p>
      ) : alerts.length === 0 ? (
        <p className="tos-desk-empty">
          No wallet-scoped Decision alerts yet — EXIT/SELL on held mints and BUY with whale/rise
          evidence appear here. Sharp drops without a Decision show as watch-only.
        </p>
      ) : (
        <ul className="tos-chart-ws-alerts-list">
          {alerts.map((a) => (
            <li key={a.id} data-kind={a.kind}>
              <button
                type="button"
                className="tos-chart-ws-alert-btn"
                onClick={() =>
                  setFocused({
                    id: a.mint,
                    symbol: a.symbol,
                    name: a.symbol,
                    chain: 'solana',
                    priceUsd: 0,
                  })
                }
              >
                <span className="tos-chart-ws-alert-kind">{a.kind}</span>
                <strong>{a.headline}</strong>
                {a.confidence != null ? (
                  <span className="tos-num">{a.confidence}%</span>
                ) : (
                  <span className="tos-muted">—</span>
                )}
              </button>
              <p className="tos-chart-ws-alert-evidence">{a.evidence.slice(0, 2).join(' · ')}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
