'use client'

import type { OsRecommendation } from '../types'

export function TodaysRecommendation({ recommendation }: { recommendation: OsRecommendation }) {
  return (
    <section className="aios-section" data-delay="3" aria-label="Today's Recommendation">
      <p className="aios-section-label">Today&apos;s Recommendation</p>
      <article className="aios-rec" data-kind={recommendation.kind}>
        <h2 className="aios-rec-headline">{recommendation.headline}</h2>
        {recommendation.confidence != null ? (
          <p className="aios-rec-meta">
            Confidence {recommendation.confidence}%
            {recommendation.confidenceMode ? ` · ${recommendation.confidenceMode}` : ''}
            {recommendation.action ? ` · ${recommendation.action}` : ''}
            {recommendation.symbol ? ` · $${recommendation.symbol}` : ''}
          </p>
        ) : null}
        {recommendation.detail ? <p className="aios-rec-detail">{recommendation.detail}</p> : null}
      </article>
    </section>
  )
}
