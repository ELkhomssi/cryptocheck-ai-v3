'use client'

import { OS_INTENTS } from '../lib/intents'
import type { OsIntentId } from '../types'

export function AiGateway({
  selected,
  onSelect,
}: {
  selected: OsIntentId | null
  onSelect: (id: OsIntentId) => void
}) {
  return (
    <section className="aios-gateway" aria-labelledby="aios-gateway-title">
      <p className="aios-gateway-kicker">AI Gateway</p>
      <h2 id="aios-gateway-title" className="aios-gateway-title">
        What do you want the OS to do?
      </h2>
      <p className="aios-gateway-copy">
        Tell me your intent. I will route through the Decision Engine — not a dashboard of widgets.
      </p>
      <div className="aios-intent-grid" role="list">
        {OS_INTENTS.map((intent) => (
          <button
            key={intent.id}
            type="button"
            className="aios-intent"
            role="listitem"
            data-active={selected === intent.id ? 'true' : 'false'}
            onClick={() => onSelect(intent.id)}
          >
            <span className="aios-intent-label">{intent.label}</span>
            <span className="aios-intent-prompt">{intent.prompt}</span>
          </button>
        ))}
      </div>
    </section>
  )
}
