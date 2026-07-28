/**
 * Event bus V2 — typed publish/subscribe.
 * Engines never call each other's internals; only events.
 */

import type { TlmEvent, TlmEventType } from '../types'

type Handler = (event: TlmEvent) => void

const LEGACY_MAP: Partial<Record<TlmEventType, TlmEventType>> = {
  TradeRecorded: 'tlm.trade.recorded',
  DNAUpdated: 'tlm.dna.updated',
  OpportunityScored: 'tlm.opportunity.scored',
  DecisionMade: 'tlm.decision.made',
  ExecutionBlocked: 'tlm.autonomy.blocked',
  SessionStarted: 'tlm.session.started',
  SessionStopped: 'tlm.session.stopped',
  TeachNote: 'tlm.teach.note',
  AnalyticsUpdated: 'tlm.analytics.updated',
}

export class TlmEventBus {
  private handlers = new Map<TlmEventType | '*', Set<Handler>>()

  publish<T>(type: TlmEventType, payload: T, source: string): TlmEvent<T> {
    const event: TlmEvent<T> = {
      type,
      at: new Date().toISOString(),
      payload,
      source,
    }
    const deliver = (t: TlmEventType | '*') => {
      this.handlers.get(t)?.forEach((h) => h(event as TlmEvent))
    }
    deliver(type)
    deliver('*')
    const legacy = LEGACY_MAP[type]
    if (legacy) deliver(legacy)
    return event
  }

  subscribe(type: TlmEventType | '*', handler: Handler): () => void {
    let set = this.handlers.get(type)
    if (!set) {
      set = new Set()
      this.handlers.set(type, set)
    }
    set.add(handler)
    return () => set!.delete(handler)
  }

  clear() {
    this.handlers.clear()
  }
}

export const tlmEventBus = new TlmEventBus()
