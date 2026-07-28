/**
 * Lightweight in-process event bus for Trade Like Me engines.
 * UI subscribes; engines publish. No business logic here.
 */

import type { TlmEvent, TlmEventType } from '../types'

type Handler = (event: TlmEvent) => void

export class TlmEventBus {
  private handlers = new Map<TlmEventType | '*', Set<Handler>>()

  publish<T>(type: TlmEventType, payload: T, source: string): TlmEvent<T> {
    const event: TlmEvent<T> = {
      type,
      at: new Date().toISOString(),
      payload,
      source,
    }
    const specific = this.handlers.get(type)
    const all = this.handlers.get('*')
    specific?.forEach((h) => h(event as TlmEvent))
    all?.forEach((h) => h(event as TlmEvent))
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
