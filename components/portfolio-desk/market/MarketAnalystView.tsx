'use client'

/**
 * Phase 17.2 — Market Analyst presentation.
 * Order: conclusion → why → evidence (Show me why) → charts → raw metrics.
 * First viewport: insights only — zero tables.
 */

import { useMemo, useState } from 'react'
import type {
  MarketAnalystBrief,
  MarketEvidence,
  MarketInsightCard,
  NarrativeCluster,
} from '@/lib/portfolio-desk/market-analyst'
import { formatPct } from '@/lib/portfolio-desk/format'

function Spark({ values }: { values: number[] }) {
  if (!values.length) return null
  const min = Math.min(...values, 0)
  const max = Math.max(...values, 0)
  const span = Math.max(max - min, 0.01)
  const w = 160
  const h = 36
  const pts = values
    .map((v, i) => {
      const x = (i / Math.max(values.length - 1, 1)) * w
      const y = h - ((v - min) / span) * (h - 4) - 2
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden className="ma-spark">
      <polyline
        fill="none"
        stroke="var(--pd-accent)"
        strokeWidth="1.5"
        points={pts}
      />
    </svg>
  )
}

function EvidenceBlock({
  evidence,
  onSelectMint,
}: {
  evidence: MarketEvidence
  onSelectMint?: (mint: string) => void
}) {
  if (evidence.unavailableReason) {
    return <p className="ma-soft">{evidence.unavailableReason}</p>
  }
  return (
    <div className="ma-evidence">
      {evidence.spark.length > 1 ? (
        <div className="ma-evidence-chart">
          <p className="ma-evidence-label">Sample path</p>
          <Spark values={evidence.spark} />
        </div>
      ) : null}
      {evidence.metrics.length > 0 ? (
        <dl className="ma-metrics">
          {evidence.metrics.map((m) => (
            <div key={m.label}>
              <dt>{m.label}</dt>
              <dd className="pd-num">{m.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {evidence.movers.length > 0 ? (
        <ul className="ma-movers">
          {evidence.movers.map((m) => (
            <li key={m.mint}>
              <button
                type="button"
                className="ma-mover-btn"
                onClick={() => onSelectMint?.(m.mint)}
              >
                <strong>{m.symbol}</strong>
                <span className={`pd-num ${m.change24hPct >= 0 ? 'pd-badge-up' : 'pd-badge-down'}`}>
                  {formatPct(m.change24hPct)}
                </span>
                <em>{m.note}</em>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function ShowMeWhy({
  evidence,
  onSelectMint,
}: {
  evidence: MarketEvidence
  onSelectMint?: (mint: string) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="ma-why-wrap">
      <button
        type="button"
        className="ma-why-toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? 'Hide evidence' : 'Show me why'}
      </button>
      {open ? <EvidenceBlock evidence={evidence} onSelectMint={onSelectMint} /> : null}
    </div>
  )
}

function InsightCard({
  card,
  onSelectMint,
}: {
  card: MarketInsightCard
  onSelectMint?: (mint: string) => void
}) {
  return (
    <article className="ma-insight">
      <p className="ma-insight-conclusion">{card.conclusion}</p>
      <p className="ma-insight-why">{card.whyItMatters}</p>
      <p className="ma-confidence">Confidence · {card.confidence}</p>
      <ShowMeWhy evidence={card.evidence} onSelectMint={onSelectMint} />
    </article>
  )
}

function NarrativeCard({
  cluster,
  onSelectMint,
}: {
  cluster: NarrativeCluster
  onSelectMint?: (mint: string) => void
}) {
  return (
    <article className="ma-narrative">
      <header className="ma-narrative-head">
        <h3>{cluster.title}</h3>
        <span className="ma-confidence">
          {cluster.tokenCount > 0 ? `${cluster.tokenCount} in sample` : 'No sample'} ·{' '}
          {cluster.confidence}
        </span>
      </header>
      <p className="ma-insight-conclusion">{cluster.conclusion}</p>
      <p className="ma-insight-why">
        <strong>Liquidity.</strong> {cluster.liquidityMove}
      </p>
      <p className="ma-insight-why">
        <strong>Why.</strong> {cluster.why}
      </p>
      <p className="ma-insight-why">
        <strong>Risk.</strong> {cluster.risk}
      </p>
      <p className="ma-insight-why">
        <strong>Near term.</strong> {cluster.shortTerm}
      </p>
      <ShowMeWhy evidence={cluster.evidence} onSelectMint={onSelectMint} />
    </article>
  )
}

export function MarketAnalystView({
  brief,
  loading,
  onSelectMint,
}: {
  brief: MarketAnalystBrief | null
  loading: boolean
  onSelectMint?: (mint: string) => void
}) {
  const ready = brief && !loading

  const activeNarratives = useMemo(
    () => (brief?.narratives ?? []).filter((n) => n.tokenCount > 0),
    [brief],
  )
  const emptyNarratives = useMemo(
    () => (brief?.narratives ?? []).filter((n) => n.tokenCount === 0),
    [brief],
  )

  if (loading && !brief) {
    return (
      <div className="ma-stage" aria-busy>
        <p className="ma-kicker">Market Intelligence</p>
        <div className="pd-skeleton" style={{ height: 28, width: '70%', marginBottom: 12 }} />
        <div className="pd-skeleton" style={{ height: 18, width: '50%', marginBottom: 8 }} />
        <div className="pd-skeleton" style={{ height: 18, width: '40%' }} />
      </div>
    )
  }

  if (!ready || !brief) {
    return (
      <div className="ma-stage">
        <p className="ma-kicker">Market Intelligence</p>
        <h1 className="ma-title">Not enough real market data available yet.</h1>
        <p className="ma-sub">
          Waiting on the existing screener and macro quote routes. Nothing is fabricated.
        </p>
      </div>
    )
  }

  return (
    <div className="ma-root">
      {/* ── First screen: insights only (zero tables) ── */}
      <section className="ma-stage" aria-label="Market conclusion">
        <p className="ma-kicker">Market Intelligence · Analyst</p>
        <h1 className="ma-title">{brief.conclusion}</h1>
        <p className="ma-sub">{brief.whyItMatters}</p>
        {brief.attention ? (
          <p className="ma-attention">
            <span>Attention</span>
            {brief.attention}
          </p>
        ) : null}
        {brief.unavailableReason && brief.insightCards.length === 0 ? (
          <p className="ma-soft">{brief.unavailableReason}</p>
        ) : null}
      </section>

      {brief.insightCards.length > 0 ? (
        <section className="ma-section" aria-label="Insight cards">
          <h2 className="ma-section-title">What matters</h2>
          <div className="ma-insight-grid">
            {brief.insightCards.map((card) => (
              <InsightCard key={card.id} card={card} onSelectMint={onSelectMint} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="ma-section" aria-label="Narratives">
        <h2 className="ma-section-title">Narratives</h2>
        <p className="ma-section-sub">
          Clusters from the live screener sample — keyword and structure matches only. Empty
          clusters stay honest.
        </p>
        <div className="ma-narrative-grid">
          {activeNarratives.map((n) => (
            <NarrativeCard key={n.id} cluster={n} onSelectMint={onSelectMint} />
          ))}
        </div>
        {emptyNarratives.length > 0 ? (
          <p className="ma-soft" style={{ marginTop: 14 }}>
            No live sample yet for:{' '}
            {emptyNarratives.map((n) => n.title).join(' · ')}. Not enough real market data
            available yet.
          </p>
        ) : null}
      </section>

      {/* ── Below the fold: charts then raw metrics entry ── */}
      <section className="ma-section ma-below" aria-label="Supporting charts">
        <h2 className="ma-section-title">Supporting charts</h2>
        {brief.sampleSpark.length > 1 ? (
          <div className="ma-chart-panel">
            <p className="ma-evidence-label">Screener sample 24h path</p>
            <Spark values={brief.sampleSpark} />
            <p className="ma-soft">Each point is a token’s 24h change in the live sample — not a price candle.</p>
          </div>
        ) : (
          <p className="ma-soft">Not enough real market data available yet for a sample chart.</p>
        )}
      </section>

      <p className="ma-sources">{brief.sourcesNote}</p>
    </div>
  )
}
