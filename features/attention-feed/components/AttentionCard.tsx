'use client'

/**
 * AttentionCard — progressive disclosure is structural, not stylistic.
 * Levels: 0 Headline → 1 Reality+Analysis → 2 Recommendation → 3 Evidence
 * Evidence cannot appear before Conclusion (headline) or Reality/Analysis.
 */

import { useCallback, useState } from 'react'
import type { AttentionItem, DisclosureLevel } from '../types'

function advance(item: AttentionItem, level: DisclosureLevel): DisclosureLevel {
  if (level === 0) return 1
  if (level === 1) return item.recommendation ? 2 : 3
  if (level === 2) return 3
  return 3
}

export function AttentionCard({
  item,
  onAccept,
  onDismiss,
}: {
  item: AttentionItem
  onAccept?: (id: string) => void
  onDismiss?: (id: string) => void
}) {
  const [level, setLevel] = useState<DisclosureLevel>(0)

  const expand = useCallback(() => {
    setLevel((l) => advance(item, l))
  }, [item])

  /** Evidence only after Reality/Analysis has been revealed (level ≥ 1). */
  const revealEvidence = useCallback(() => {
    setLevel((l) => (l < 1 ? 1 : 3))
  }, [])

  return (
    <article className="sm-card" data-urgency={item.urgency} data-level={level}>
      <header className="sm-card-head">
        <span className="sm-urgency" data-urgency={item.urgency}>
          {item.urgency}
        </span>
        <span className="sm-engine">{item.sourceEngine}</span>
      </header>

      <button type="button" className="sm-headline" onClick={expand} aria-expanded={level > 0}>
        {item.headline}
      </button>

      {level >= 1 ? (
        <div className="sm-body">
          <p className="sm-reality">
            <span className="sm-label">Reality</span>
            {item.reality}
          </p>
          <p className="sm-analysis">
            <span className="sm-label">AI thinking</span>
            {item.analysis}
          </p>
        </div>
      ) : null}

      {level >= 2 && item.recommendation ? (
        <div className="sm-rec">
          <span className="sm-label">Decision</span>
          <p className="sm-rec-action">{item.recommendation.action}</p>
          <p className="sm-rec-conf">Confidence {item.recommendation.confidence}%</p>
          <div className="sm-rec-actions">
            <button
              type="button"
              className="sm-btn sm-btn-primary"
              onClick={() => onAccept?.(item.id)}
            >
              Accept
            </button>
            <button
              type="button"
              className="sm-btn sm-btn-ghost"
              onClick={() => onDismiss?.(item.id)}
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : null}

      {level >= 1 && level < 3 ? (
        <button type="button" className="sm-evidence-toggle" onClick={revealEvidence}>
          Show evidence
        </button>
      ) : null}

      {level >= 3 ? (
        <div className="sm-evidence" aria-label="Evidence">
          <span className="sm-label">Evidence</span>
          <ul>
            {item.evidence.map((e) => (
              <li key={e.id}>
                <strong>{e.label}</strong>
                {e.value != null ? <span className="sm-ev-val">{String(e.value)}</span> : null}
                {e.detail ? <span className="sm-ev-detail">{e.detail}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {level === 0 ? (
        <p className="sm-hint">Tap the conclusion to see what happened and why.</p>
      ) : null}
    </article>
  )
}
