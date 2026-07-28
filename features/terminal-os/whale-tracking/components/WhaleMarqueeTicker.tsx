'use client'

import { useMemo, useState, startTransition } from 'react'
import { PanelSkeleton, EmptyState } from '@/features/terminal-os/shared/components/PanelStates'
import { formatUsd, timeAgo } from '@/features/terminal-os/shared/lib/format'
import {
  actionCssClass,
  whaleDisplayAction,
} from '@/features/terminal-os/shared/lib/enrich-whale-movement'
import { useWhaleMarqueeStream } from '@/features/terminal-os/whale-tracking/hooks/useWhaleMarqueeStream'
import {
  WhaleHoverPopover,
  WhaleIntelligencePanel,
} from '@/features/terminal-os/whale-tracking/components/WhaleIntelligencePanel'
import type { WhaleMarqueeFilter, WhaleMovement } from '@/features/terminal-os/shared/types'

const FILTERS: { id: WhaleMarqueeFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'solana', label: 'Solana' },
  { id: 'ethereum', label: 'Ethereum' },
  { id: 'bnb', label: 'BNB' },
  { id: 'base', label: 'Base' },
  { id: 'smart_money', label: 'Smart Money' },
]

const CHAIN_SHORT: Record<string, string> = {
  solana: 'SOL',
  ethereum: 'ETH',
  bnb: 'BNB',
  base: 'BASE',
  arbitrum: 'ARB',
}

function applyFilter(rows: WhaleMovement[], filter: WhaleMarqueeFilter): WhaleMovement[] {
  if (filter === 'all') return rows
  if (filter === 'smart_money') return rows.filter((w) => w.smartMoney)
  return rows.filter((w) => w.chain === filter)
}

/** Cap DOM nodes for 60fps — ring buffer can hold 256; marquee shows ≤48 × 2 copies */
const MARQUEE_VISIBLE = 48

function WhaleChip({
  whale,
  onOpen,
}: {
  whale: WhaleMovement
  onOpen: (w: WhaleMovement) => void
}) {
  const [hover, setHover] = useState(false)
  const display = whaleDisplayAction(whale.action, whale.classification)

  return (
    <button
      type="button"
      className="tos-wm-chip"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
      onClick={() => onOpen(whale)}
      aria-label={`${display} ${whale.assetSymbol} ${whale.walletTruncated}`}
    >
      <span className="tos-wm-avatar" aria-hidden>
        {whale.avatarInitials}
      </span>
      <span className="tos-mono tos-wm-wallet">{whale.walletTruncated}</span>
      <span className="tos-wm-chain">{CHAIN_SHORT[whale.chain] ?? whale.chain}</span>
      {whale.tokenLogoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="tos-wm-logo" src={whale.tokenLogoUrl} alt="" width={18} height={18} />
      ) : (
        <span className="tos-wm-logo tos-wm-logo-fallback" aria-hidden>
          {whale.assetSymbol.slice(0, 1)}
        </span>
      )}
      <span className={`tos-wm-action ${actionCssClass(display)}`}>{display}</span>
      <span className="tos-num tos-wm-amt">
        {formatUsd(whale.usdValue, true)}
        <span className="tos-muted">
          {' '}
          · {whale.amount.toLocaleString(undefined, { maximumFractionDigits: 1 })} {whale.assetSymbol}
        </span>
      </span>
      <span className="tos-wm-time">{timeAgo(whale.occurredAt)}</span>
      <span className="tos-wm-conf tos-num">{whale.aiConfidence}%</span>
      <span className="tos-wm-impact tos-num">Δ{whale.impactScore}</span>
      {hover ? <WhaleHoverPopover whale={whale} /> : null}
    </button>
  )
}

export function WhaleMarqueeTicker({
  fixed = false,
  title = 'Top Whale Movements',
}: {
  fixed?: boolean
  title?: string
}) {
  const { events, conn, error, isLoading } = useWhaleMarqueeStream()
  const [filter, setFilter] = useState<WhaleMarqueeFilter>('all')
  const [selected, setSelected] = useState<WhaleMovement | null>(null)
  const [paused, setPaused] = useState(false)

  const visible = useMemo(() => {
    const filtered = applyFilter(events, filter)
    return filtered.slice(0, MARQUEE_VISIBLE)
  }, [events, filter])

  /** Duplicate strip for seamless CSS loop */
  const strip = useMemo(() => {
    if (visible.length === 0) return []
    // Ensure enough width for continuous scroll
    const base = visible.length < 6 ? [...visible, ...visible, ...visible] : visible
    return base
  }, [visible])

  const openPanel = (w: WhaleMovement) => {
    startTransition(() => setSelected(w))
  }

  return (
    <section
      className={`tos-wm-ticker${fixed ? ' tos-wm-ticker--fixed' : ''}`}
      aria-label={title}
      data-conn={conn}
    >
      <div className="tos-wm-bar">
        <div className="tos-wm-title-block">
          <span className="tos-wm-live" data-state={conn} aria-hidden />
          <h2 className="tos-wm-title">{title}</h2>
          <span className="tos-wm-sub">
            High-confidence ·{' '}
            {conn === 'live' ? 'Live' : conn === 'polling' ? 'Polling' : conn === 'connecting' ? 'Connecting' : 'Offline'}
          </span>
        </div>
        <div className="tos-wm-filters" role="tablist" aria-label="Whale filters">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={filter === f.id}
              className={`tos-wm-filter${filter === f.id ? ' is-active' : ''}`}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {error && visible.length === 0 ? (
        <EmptyState message={error} />
      ) : isLoading ? (
        <div className="tos-wm-track-wrap">
          <PanelSkeleton rows={1} />
        </div>
      ) : visible.length === 0 ? (
        <EmptyState message="No high-confidence whale flows for this filter." />
      ) : (
        <div
          className="tos-wm-track-wrap"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          <div
            className={`tos-wm-track${paused ? ' is-paused' : ''}`}
            style={{
              // Duration scales with item count for ~40px/s perceived speed
              animationDuration: `${Math.max(28, strip.length * 3.2)}s`,
            }}
          >
            <div className="tos-wm-strip">
              {strip.map((w, i) => (
                <WhaleChip key={`a-${w.id}-${i}`} whale={w} onOpen={openPanel} />
              ))}
            </div>
            <div className="tos-wm-strip" aria-hidden>
              {strip.map((w, i) => (
                <WhaleChip key={`b-${w.id}-${i}`} whale={w} onOpen={openPanel} />
              ))}
            </div>
          </div>
        </div>
      )}

      {selected ? (
        <WhaleIntelligencePanel whale={selected} onClose={() => setSelected(null)} />
      ) : null}
    </section>
  )
}
