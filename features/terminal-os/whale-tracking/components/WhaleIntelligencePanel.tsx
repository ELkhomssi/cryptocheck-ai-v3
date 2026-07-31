'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { formatUsd, timeAgo } from '@/features/terminal-os/shared/lib/format'
import {
  actionCssClass,
  whaleDisplayAction,
} from '@/features/terminal-os/shared/lib/enrich-whale-movement'
import type { WhaleMovement } from '@/features/terminal-os/shared/types'
import type { HoldingsResponse } from '@/types/portfolio-desk'

const CHAIN_LABEL: Record<string, string> = {
  solana: 'Solana',
  ethereum: 'Ethereum',
  bnb: 'BNB',
  base: 'Base',
  arbitrum: 'Arbitrum',
  all: 'Multi',
}

function looksLikeSolanaAddress(addr: string): boolean {
  return addr.trim().length >= 32 && !addr.startsWith('0x') && !addr.includes('-')
}

type LiveAttr = {
  loading: boolean
  portfolioUsd: number | null
  positionUsd: number | null
  error?: string
}

function useLiveWalletAttribution(whale: WhaleMovement): LiveAttr {
  const [state, setState] = useState<LiveAttr>({
    loading: false,
    portfolioUsd: null,
    positionUsd: null,
  })

  useEffect(() => {
    const canFetch =
      whale.walletAttributed !== false &&
      whale.chain === 'solana' &&
      looksLikeSolanaAddress(whale.walletFull)

    if (!canFetch) {
      setState({ loading: false, portfolioUsd: null, positionUsd: null })
      return
    }

    let cancelled = false
    setState({ loading: true, portfolioUsd: null, positionUsd: null })

    void (async () => {
      try {
        const res = await fetch(
          `/api/portfolio/holdings?wallet=${encodeURIComponent(whale.walletFull)}`,
        )
        if (!res.ok) {
          if (!cancelled) {
            setState({
              loading: false,
              portfolioUsd: null,
              positionUsd: null,
              error: 'Holdings unavailable',
            })
          }
          return
        }
        const body = (await res.json()) as HoldingsResponse
        const mint = whale.tokenMint?.trim()
        const position = mint
          ? body.holdings.find((h) => h.mint === mint)
          : body.holdings.find(
              (h) => h.symbol.toUpperCase() === whale.assetSymbol.toUpperCase(),
            )
        if (!cancelled) {
          setState({
            loading: false,
            portfolioUsd: body.totalValueUsd ?? null,
            positionUsd: position?.valueUsd ?? null,
          })
        }
      } catch {
        if (!cancelled) {
          setState({
            loading: false,
            portfolioUsd: null,
            positionUsd: null,
            error: 'Holdings unavailable',
          })
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [
    whale.walletAttributed,
    whale.chain,
    whale.walletFull,
    whale.tokenMint,
    whale.assetSymbol,
  ])

  return state
}

function Metric({
  label,
  value,
  sample,
}: {
  label: string
  value: string
  sample?: boolean
}) {
  return (
    <div className="tos-wi-metric">
      <span className="tos-wi-metric-label">
        {label}
        {sample ? <span className="rd-sample-tag tos-wm-sample">sample</span> : null}
      </span>
      <span className="tos-wi-metric-value tos-num">{value}</span>
    </div>
  )
}

function fmtMoneyOrStatus(n: number | null, loading: boolean, fallback: string): string {
  if (loading) return 'Loading…'
  if (n != null) return formatUsd(n, true)
  return fallback
}

export function WhaleIntelligencePanel({
  whale,
  onClose,
}: {
  whale: WhaleMovement
  onClose: () => void
}) {
  const display = whaleDisplayAction(whale.action, whale.classification)
  const attrSample = Boolean(whale.sample)
  const live = useLiveWalletAttribution(whale)
  const isPairFlow = whale.walletAttributed === false

  const positionUsd =
    live.positionUsd != null ? live.positionUsd : whale.previousHoldingsUsd
  const portfolioUsd =
    live.portfolioUsd != null ? live.portfolioUsd : whale.currentPortfolioUsd

  return (
    <div className="tos-wi-backdrop" role="dialog" aria-modal="true" aria-label="Whale Intelligence">
      <div className="tos-wi-panel">
        <header className="tos-wi-head">
          <div>
            <p className="tos-wi-kicker">Whale Intelligence</p>
            <h2 className="tos-wi-title">
              <span className={`tos-wm-action ${actionCssClass(display)}`}>{display}</span>{' '}
              ${whale.assetSymbol}
              <span className="tos-muted"> · {CHAIN_LABEL[whale.chain] ?? whale.chain}</span>
            </h2>
          </div>
          <button type="button" className="tos-btn tos-btn-ghost" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        <div className="tos-wi-grid">
          <section className="tos-wi-card">
            <h3>{isPairFlow ? 'Pair / flow' : 'Wallet'}</h3>
            <p className="tos-mono tos-wi-addr">{whale.walletFull}</p>
            {whale.tokenMint ? (
              <p className="tos-mono tos-muted" style={{ fontSize: 'var(--tos-fs-xs)', marginTop: 6 }}>
                Mint {whale.tokenMint}
              </p>
            ) : null}
            <p className="tos-muted" style={{ fontSize: 'var(--tos-fs-xs)', marginTop: 6 }}>
              Seen {timeAgo(whale.occurredAt)} · {whale.classification}
              {isPairFlow ? ' · Market flow (not a trader wallet)' : ''}
            </p>
          </section>

          <section className="tos-wi-card">
            <h3>Flow</h3>
            <div className="tos-wi-metrics">
              <Metric label="USD notional" value={formatUsd(whale.usdValue, true)} />
              <Metric
                label="Token amount"
                value={`${whale.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${whale.assetSymbol}`}
              />
              <Metric label="AI Confidence" value={`${whale.aiConfidence}%`} />
              <Metric label="Whale Impact" value={`${whale.impactScore}`} />
              <Metric label="Smart Money" value={`${whale.smartMoneyScore}`} />
            </div>
          </section>

          <section className="tos-wi-card">
            <h3>Attribution</h3>
            <div className="tos-wi-metrics">
              <Metric
                label={live.positionUsd != null ? 'Token position' : 'Previous holdings'}
                value={fmtMoneyOrStatus(
                  positionUsd,
                  live.loading && !isPairFlow,
                  isPairFlow ? 'N/A (pair flow)' : 'Unavailable',
                )}
                sample={attrSample && positionUsd != null && live.positionUsd == null}
              />
              <Metric
                label="Portfolio value"
                value={fmtMoneyOrStatus(
                  portfolioUsd,
                  live.loading && !isPairFlow,
                  isPairFlow ? 'N/A (pair flow)' : 'Unavailable',
                )}
                sample={attrSample && portfolioUsd != null && live.portfolioUsd == null}
              />
              <Metric
                label="Win rate"
                value={
                  whale.historicalWinRatePct != null
                    ? `${whale.historicalWinRatePct}%`
                    : 'Unavailable'
                }
                sample={attrSample && whale.historicalWinRatePct != null}
              />
              <Metric
                label="Profit / Loss"
                value={
                  whale.pnlUsd != null
                    ? formatUsd(whale.pnlUsd, true)
                    : 'Unavailable'
                }
                sample={attrSample && whale.pnlUsd != null}
              />
            </div>
          </section>

          <section className="tos-wi-card tos-wi-reason">
            <h3>AI reasoning</h3>
            <p>{whale.aiReasoning}</p>
            <p className="tos-muted" style={{ marginTop: 10, fontSize: 'var(--tos-fs-xs)' }}>
              Not financial advice · DYOR
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}

export function WhaleHoverPopover({ whale }: { whale: WhaleMovement }) {
  const display = whaleDisplayAction(whale.action, whale.classification)
  const attrSample = Boolean(whale.sample)
  const fmtOrDash = (n: number | null, money = false) => {
    if (n == null) return '—'
    return money ? formatUsd(n, true) : String(n)
  }

  return (
    <div className="tos-wm-popover" role="tooltip">
      <div className="tos-wm-popover-row">
        <span className={`tos-wm-action ${actionCssClass(display)}`}>{display}</span>
        <span className="tos-muted">{CHAIN_LABEL[whale.chain]}</span>
        {whale.smartMoney ? <span className="tos-wm-sm-pill">Smart Money</span> : null}
      </div>
      <p className="tos-mono tos-wm-popover-addr">{whale.walletFull}</p>
      <dl className="tos-wm-popover-dl">
        <div>
          <dt>Prev holdings{attrSample ? <span className="tos-wm-sample">sample</span> : null}</dt>
          <dd className="tos-num">{fmtOrDash(whale.previousHoldingsUsd, true)}</dd>
        </div>
        <div>
          <dt>Portfolio{attrSample ? <span className="tos-wm-sample">sample</span> : null}</dt>
          <dd className="tos-num">{fmtOrDash(whale.currentPortfolioUsd, true)}</dd>
        </div>
        <div>
          <dt>Win rate{attrSample ? <span className="tos-wm-sample">sample</span> : null}</dt>
          <dd className="tos-num">
            {whale.historicalWinRatePct != null ? `${whale.historicalWinRatePct}%` : '—'}
          </dd>
        </div>
        <div>
          <dt>P/L{attrSample ? <span className="tos-wm-sample">sample</span> : null}</dt>
          <dd className="tos-num">{fmtOrDash(whale.pnlUsd, true)}</dd>
        </div>
        <div>
          <dt>Smart Money Score</dt>
          <dd className="tos-num">{whale.smartMoneyScore}</dd>
        </div>
        <div>
          <dt>Impact</dt>
          <dd className="tos-num">{whale.impactScore}</dd>
        </div>
      </dl>
      <p className="tos-wm-popover-why">{whale.aiReasoning}</p>
    </div>
  )
}
