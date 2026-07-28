'use client'

import { X } from 'lucide-react'
import { formatUsd, timeAgo } from '@/features/terminal-os/shared/lib/format'
import {
  actionCssClass,
  whaleDisplayAction,
} from '@/features/terminal-os/shared/lib/enrich-whale-movement'
import type { WhaleMovement } from '@/features/terminal-os/shared/types'

const CHAIN_LABEL: Record<string, string> = {
  solana: 'Solana',
  ethereum: 'Ethereum',
  bnb: 'BNB',
  base: 'Base',
  arbitrum: 'Arbitrum',
  all: 'Multi',
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

export function WhaleIntelligencePanel({
  whale,
  onClose,
}: {
  whale: WhaleMovement
  onClose: () => void
}) {
  const display = whaleDisplayAction(whale.action, whale.classification)
  const attrSample = Boolean(whale.sample)

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
            <h3>Wallet</h3>
            <p className="tos-mono tos-wi-addr">{whale.walletFull}</p>
            <p className="tos-muted" style={{ fontSize: 'var(--tos-fs-xs)', marginTop: 6 }}>
              Seen {timeAgo(whale.occurredAt)} · {whale.classification}
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
                label="Previous holdings"
                value={
                  whale.previousHoldingsUsd != null
                    ? formatUsd(whale.previousHoldingsUsd, true)
                    : 'Awaiting on-chain'
                }
                sample={attrSample && whale.previousHoldingsUsd != null}
              />
              <Metric
                label="Portfolio value"
                value={
                  whale.currentPortfolioUsd != null
                    ? formatUsd(whale.currentPortfolioUsd, true)
                    : 'Awaiting on-chain'
                }
                sample={attrSample && whale.currentPortfolioUsd != null}
              />
              <Metric
                label="Win rate"
                value={
                  whale.historicalWinRatePct != null
                    ? `${whale.historicalWinRatePct}%`
                    : 'Awaiting on-chain'
                }
                sample={attrSample && whale.historicalWinRatePct != null}
              />
              <Metric
                label="Profit / Loss"
                value={
                  whale.pnlUsd != null
                    ? formatUsd(whale.pnlUsd, true)
                    : 'Awaiting on-chain'
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
