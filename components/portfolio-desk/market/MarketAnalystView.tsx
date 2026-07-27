'use client'

/**
 * Market Intelligence — Chief Market Strategist briefing.
 * Continuous conversation. No cards. No widget titles. No dashboard chrome.
 * Presentation polish only.
 */

import { useEffect, useState } from 'react'
import type {
  MarketAnalystBrief,
  MarketDecision,
  MarketEvidence,
} from '@/lib/portfolio-desk/market-analyst'
import { marketSpeechHoldMs } from '@/lib/portfolio-desk/market-analyst'
import { formatPct } from '@/lib/portfolio-desk/format'

type Phase = 'reconstruct' | 'executive' | 'decisions' | 'aftermath'

function Spark({ values }: { values: number[] }) {
  if (values.length < 2) return null
  const min = Math.min(...values, 0)
  const max = Math.max(...values, 0)
  const span = Math.max(max - min, 0.01)
  const w = 220
  const h = 40
  const pts = values
    .map((v, i) => {
      const x = (i / Math.max(values.length - 1, 1)) * w
      const y = h - ((v - min) / span) * (h - 4) - 2
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden className="ma-spark">
      <polyline fill="none" stroke="var(--pd-accent)" strokeWidth="1.5" points={pts} />
    </svg>
  )
}

function EvidenceBody({
  evidence,
  onSelectMint,
}: {
  evidence: MarketEvidence
  onSelectMint?: (mint: string) => void
}) {
  if (evidence.unavailableReason) {
    return <p className="mc-ceo-soft">{evidence.unavailableReason}</p>
  }
  return (
    <div className="ma-evidence">
      {evidence.spark.length > 1 ? <Spark values={evidence.spark} /> : null}
      {evidence.metrics.length > 0 ? (
        <dl className="mc-ceo-nums">
          {evidence.metrics.map((m) => (
            <div key={m.label}>
              <dt>{m.label}</dt>
              <dd className="pd-num">{m.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {evidence.movers.length > 0 ? (
        <ul className="mc-ceo-list">
          {evidence.movers.map((m) => (
            <li key={m.mint}>
              <button type="button" className="ma-mover-btn" onClick={() => onSelectMint?.(m.mint)}>
                <strong>{m.symbol}</strong>{' '}
                <span className={`pd-num ${m.change24hPct >= 0 ? 'pd-badge-up' : 'pd-badge-down'}`}>
                  {formatPct(m.change24hPct)}
                </span>
                <em> — {m.note}</em>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function DecisionSpeech({
  decision,
  showEvidence,
  onSelectMint,
}: {
  decision: MarketDecision
  showEvidence: boolean
  onSelectMint?: (mint: string) => void
}) {
  return (
    <div className="mc-ceo-focus">
      <p className="mc-ceo-line">{decision.whatHappened}</p>
      <p className="mc-ceo-meaning">{decision.whyItMatters}</p>
      <p className="mc-ceo-meaning">{decision.whatToDo}</p>
      <p className="mc-ceo-soft">I’m {decision.confidencePct}% confident in this read.</p>
      {showEvidence ? (
        <div className="mc-ceo-proof">
          <p className="mc-ceo-soft">Here’s why.</p>
          <EvidenceBody evidence={decision.evidence} onSelectMint={onSelectMint} />
        </div>
      ) : null}
    </div>
  )
}

export function MarketAnalystView({
  brief,
  loading,
  onSelectMint,
  onOpenRaw,
}: {
  brief: MarketAnalystBrief | null
  loading: boolean
  onSelectMint?: (mint: string) => void
  onOpenRaw?: () => void
}) {
  const [phase, setPhase] = useState<Phase>('reconstruct')
  const [step, setStep] = useState(0)
  const [evidenceOn, setEvidenceOn] = useState(false)

  const briefingKey = loading
    ? 'loading'
    : `${brief?.executiveConclusion ?? 'x'}:${brief?.decisions.length ?? 0}:${brief?.convictionLine ?? ''}`

  useEffect(() => {
    setPhase('reconstruct')
    setStep(0)
    setEvidenceOn(false)
  }, [briefingKey])

  useEffect(() => {
    if (phase !== 'reconstruct') return
    if (loading) return
    if (!brief) return
    const t = window.setTimeout(() => {
      setPhase('executive')
      setStep(0)
    }, 2200)
    return () => window.clearTimeout(t)
  }, [phase, loading, brief, briefingKey])

  useEffect(() => {
    if (phase !== 'executive') return
    if (!brief) return
    const hold = marketSpeechHoldMs(
      `${brief.openingLine} ${brief.executiveConclusion} ${brief.executiveWhy} ${brief.temperatureLine}`,
    )
    const t = window.setTimeout(() => {
      if (brief.decisions.length === 0) {
        setPhase('aftermath')
        return
      }
      setPhase('decisions')
      setStep(1)
      setEvidenceOn(false)
    }, hold)
    return () => window.clearTimeout(t)
  }, [phase, brief, briefingKey])

  useEffect(() => {
    if (phase !== 'decisions') return
    if (!brief) return
    const idx = step - 1
    const d = brief.decisions[idx]
    if (!d) {
      setPhase('aftermath')
      return
    }
    if (!evidenceOn) {
      const speech = `${d.whatHappened} ${d.whyItMatters} ${d.whatToDo}`
      const t = window.setTimeout(() => setEvidenceOn(true), marketSpeechHoldMs(speech))
      return () => window.clearTimeout(t)
    }
    const t = window.setTimeout(() => {
      if (step >= brief.decisions.length) {
        setPhase('aftermath')
        return
      }
      setStep((s) => s + 1)
      setEvidenceOn(false)
    }, 2800)
    return () => window.clearTimeout(t)
  }, [phase, step, evidenceOn, brief, briefingKey])

  if (!brief && loading) {
    return (
      <div className="mc-ceo">
        <div className="mc-ceo-stage" aria-busy aria-live="polite">
          <p className="mc-ceo-line mc-ceo-greet">I’m finishing today’s market read.</p>
          <p className="mc-ceo-meaning">Hold on — I won’t speak a call from an incomplete book.</p>
        </div>
      </div>
    )
  }

  if (!brief) {
    return (
      <div className="mc-ceo">
        <div className="mc-ceo-stage">
          <p className="mc-ceo-line">Not enough real market data available yet.</p>
          <p className="mc-ceo-meaning">I will not invent a tape.</p>
        </div>
      </div>
    )
  }

  if (phase === 'reconstruct') {
    return (
      <div className="mc-ceo">
        <div className="mc-ceo-stage" aria-live="polite">
          <p className="mc-ceo-line mc-ceo-greet">I’m finishing today’s market read.</p>
          <p className="mc-ceo-meaning">
            Live book, flow, and macro — then I filter what deserves your attention.
          </p>
          <ul className="mc-ceo-engines">
            {brief.reconstruction.map((s) => (
              <li key={s.id} className={s.done ? 'is-done' : 'is-busy'}>
                <span>{s.label}</span>
                <em>{s.status}</em>
              </li>
            ))}
          </ul>
        </div>
      </div>
    )
  }

  if (phase === 'executive') {
    return (
      <div className="mc-ceo">
        <div className="mc-ceo-stage" aria-live="polite">
          <div className="mc-ceo-focus">
            <p className="mc-ceo-line mc-ceo-greet">{brief.openingLine}</p>
            <p className="mc-ceo-line">{brief.executiveConclusion}</p>
            <p className="mc-ceo-meaning">{brief.executiveWhy}</p>
            <p className="mc-ceo-meaning">{brief.temperatureLine}</p>
          </div>
        </div>
      </div>
    )
  }

  if (phase === 'decisions') {
    const current = brief.decisions[step - 1]
    const prior = brief.decisions.slice(0, Math.max(0, step - 1))
    return (
      <div className="mc-ceo">
        <div className="mc-ceo-stage" aria-live="polite">
          {prior.length > 0 ? (
            <div className="mc-ceo-trail">
              <p>{brief.openingLine}</p>
              <p>{brief.executiveConclusion}</p>
              {prior.map((d) => (
                <p key={d.id}>{d.whatHappened}</p>
              ))}
            </div>
          ) : (
            <div className="mc-ceo-trail">
              <p>{brief.executiveConclusion}</p>
            </div>
          )}
          {current ? (
            <DecisionSpeech
              decision={current}
              showEvidence={evidenceOn}
              onSelectMint={onSelectMint}
            />
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <div className="mc-ceo">
      <div className="mc-ceo-stage" aria-live="polite">
        <div className="mc-ceo-trail">
          <p>{brief.openingLine}</p>
          <p>{brief.executiveConclusion}</p>
          <p>{brief.temperatureLine}</p>
          {brief.decisions.map((d) => (
            <p key={d.id}>
              {d.whatHappened}{' '}
              <span className="mc-ceo-soft">({d.confidencePct}%)</span>
            </p>
          ))}
        </div>

        <div className="mc-ceo-focus">
          <p className="mc-ceo-line mc-ceo-propose">{brief.convictionLine}</p>
          <p className="mc-ceo-meaning">
            That is the briefing. Supporting path and raw book only if you still need them.
          </p>
        </div>

        {brief.sampleSpark.length > 1 ? (
          <div className="mc-ceo-proof">
            <Spark values={brief.sampleSpark} />
            <p className="mc-ceo-soft">Sample 24h path across the live book — not a price candle.</p>
          </div>
        ) : null}

        {onOpenRaw ? (
          <button type="button" className="ma-unlock-evidence" onClick={onOpenRaw}>
            Show me the raw book
          </button>
        ) : null}
      </div>
    </div>
  )
}
