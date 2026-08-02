'use client'

import type { OsBriefing, OsIntentId } from '../types'
import { OS_INTENTS } from '../lib/intents'

function routeLine(intent: OsIntentId | null, briefing: OsBriefing | null): string | null {
  if (!intent) return null
  const meta = OS_INTENTS.find((i) => i.id === intent)
  if (!meta) return null
  const rec = briefing?.recommendation
  if (intent === 'protect') {
    return 'Routing toward capital protection — risk and security first.'
  }
  if (intent === 'passive' || intent === 'monitor') {
    return rec?.kind === 'opportunity'
      ? 'Monitoring armed — high-confidence Decision available when you are ready.'
      : 'Monitoring armed — patience until the Decision Engine clears an entry.'
  }
  if (intent === 'copy_strategy') {
    return briefing?.dna.available
      ? `Copying your strategy via Trader DNA · ${briefing.dna.styleSummary}`
      : 'Strategy copy needs Trader DNA — use Teach AI below to describe your rules.'
  }
  if (rec?.kind === 'opportunity') {
    return `Routing invest intent → ${rec.symbol ? `$${rec.symbol}` : 'opportunity'} (${rec.confidence ?? '—'}% confidence).`
  }
  return 'Routing invest intent → wait for a Decision Engine clearance.'
}

export function AiOsCoach({
  briefing,
  loading,
  intent,
}: {
  briefing: OsBriefing | null
  loading: boolean
  intent: OsIntentId | null
}) {
  return (
    <section className="aios-section aios-coach" data-delay="1" aria-live="polite">
      <p className="aios-section-label">AI Coach</p>
      {loading && !briefing ? (
        <p className="aios-empty">Listening to wallet, market, and Decision Engine…</p>
      ) : (
        <>
          <h2 className="aios-coach-greeting">{briefing?.greeting ?? 'Hello.'}</h2>
          <ul className="aios-coach-lines">
            {(briefing?.coachLines ?? []).map((line) => (
              <li key={line.id}>{line.text}</li>
            ))}
          </ul>
          {routeLine(intent, briefing) ? (
            <p className="aios-route">{routeLine(intent, briefing)}</p>
          ) : null}
        </>
      )}
    </section>
  )
}
