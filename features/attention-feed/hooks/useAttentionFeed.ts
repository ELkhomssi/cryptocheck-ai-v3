'use client'

/**
 * Live Attention Feed — SSE subscription + TLM event bus.
 * No TanStack polling of market providers. First paint from snapshot.
 */

import { useEffect, useMemo, useRef, useState, startTransition } from 'react'
import { useTradeLikeMeEngine } from '@/features/terminal-os/ai-trade-like-me/hooks/useTradeLikeMeEngine'
import { getTradeLikeMeOrchestrator } from '@/features/terminal-os/ai-trade-like-me/engines/orchestrator'
import { connectTerminalOsSse } from '@/features/terminal-os/shared/lib/sse-client'
import { useTerminalOsStore } from '@/stores/terminal-os'
import { adaptDecisionToAttention } from '../adapters/decision-adapter'
import { adaptDnaToAttention } from '../adapters/dna-adapter'
import { prioritizeAttentionItems } from '../lib/prioritize'
import { filterWorkspaceItems } from '../lib/filter-workspace'
import { mergeLiveEntries, type LiveEventHint } from '../lib/merge-live-entries'
import { readLastSeenAt, writeLastSeenAt } from '../lib/session-seen'
import type { SimpleWorkspaceId } from '../lib/vocab'
import type { AttentionFeedEntry, AttentionItem, AttentionLiveKind } from '../types'

const BATCH_MS = 2_500

type SnapshotPayload = {
  items?: AttentionItem[]
  seq?: number
  updatedAt?: string
  events?: { itemId: string; kind: 'new' | 'updated'; at: string }[]
  newCount?: number
  updatedCount?: number
}

export function useAttentionFeed(workspace: SimpleWorkspaceId = 'home'): {
  entries: AttentionFeedEntry[]
  items: AttentionItem[]
  isLoading: boolean
  isError: boolean
  isLive: boolean
} {
  const { state, narrative } = useTradeLikeMeEngine()
  const wallet = useTerminalOsStore((s) => s.walletAddress)
  const walletConnected = useTerminalOsStore((s) => s.walletConnected)

  const [serverItems, setServerItems] = useState<AttentionItem[]>([])
  const [hints, setHints] = useState<LiveEventHint[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isError, setIsError] = useState(false)
  const [isLive, setIsLive] = useState(false)
  const [lastSeenAt] = useState(() => readLastSeenAt())
  const [kindFlash, setKindFlash] = useState<Record<string, AttentionLiveKind>>({})

  const pendingRef = useRef<{
    items: AttentionItem[] | null
    hints: LiveEventHint[]
  }>({ items: null, hints: [] })
  const batchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const flushBatch = () => {
    const pending = pendingRef.current
    pendingRef.current = { items: null, hints: [] }
    startTransition(() => {
      if (pending.items) setServerItems(pending.items)
      if (pending.hints.length) {
        setHints((prev) => [...pending.hints, ...prev].slice(0, 64))
        const flash: Record<string, AttentionLiveKind> = {}
        for (const h of pending.hints) flash[h.itemId] = h.kind
        setKindFlash((prev) => ({ ...prev, ...flash }))
        window.setTimeout(() => {
          setKindFlash((prev) => {
            const next = { ...prev }
            for (const id of Object.keys(flash)) {
              if (next[id] === flash[id]) delete next[id]
            }
            return next
          })
        }, 2_400)
      }
    })
  }

  const scheduleBatch = (items: AttentionItem[] | null, newHints: LiveEventHint[]) => {
    if (items) pendingRef.current.items = items
    if (newHints.length) {
      pendingRef.current.hints = [...newHints, ...pendingRef.current.hints]
    }
    if (batchTimer.current) clearTimeout(batchTimer.current)
    batchTimer.current = setTimeout(flushBatch, BATCH_MS)
  }

  // First paint — snapshot (no spinner once data arrives; empty only if truly empty)
  useEffect(() => {
    let cancelled = false
    const q = walletConnected && wallet ? `?wallet=${encodeURIComponent(wallet)}` : ''
    void fetch(`/api/terminal-os/attention/snapshot${q}`, { cache: 'no-store' })
      .then(async (res) => {
        const body = (await res.json()) as SnapshotPayload
        if (cancelled) return
        setServerItems(body.items ?? [])
        setHints(
          (body.events ?? []).map((e) => ({
            itemId: e.itemId,
            kind: e.kind,
            at: e.at,
          })),
        )
        setIsLoading(false)
      })
      .catch(() => {
        if (!cancelled) {
          setIsError(true)
          setIsLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [wallet, walletConnected])

  // SSE — subscribe, never poll CoinGecko/Dex from the client
  useEffect(() => {
    const q = walletConnected && wallet ? `?wallet=${encodeURIComponent(wallet)}` : ''
    const handle = connectTerminalOsSse(
      `/api/terminal-os/attention/stream${q}`,
      {
        onReady: () => setIsLive(true),
        onReconnect: () => setIsLive(false),
        onEvent: (event, data) => {
          try {
            const body = JSON.parse(data) as SnapshotPayload
            if (event === 'snapshot') {
              setServerItems(body.items ?? [])
              setHints(
                (body.events ?? []).map((e) => ({
                  itemId: e.itemId,
                  kind: e.kind,
                  at: e.at,
                })),
              )
              setIsLoading(false)
              setIsLive(true)
              return
            }
            if (event === 'delta') {
              const deltaHints = (body.events ?? [])
                .filter((e) => e.kind === 'new' || e.kind === 'updated')
                .slice(0, 12)
                .map((e) => ({ itemId: e.itemId, kind: e.kind, at: e.at }))
              scheduleBatch(body.items ?? [], deltaHints)
              setIsLive(true)
            }
          } catch {
            /* ignore */
          }
        },
        onGiveUp: () => setIsLive(false),
      },
      { namedEvents: ['snapshot', 'delta'] },
    )

    return () => {
      handle.close()
      if (batchTimer.current) clearTimeout(batchTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet, walletConnected])

  const serverItemsRef = useRef(serverItems)
  serverItemsRef.current = serverItems
  const narrativeRef = useRef(narrative)
  narrativeRef.current = narrative

  // TLM bus — DecisionMade / DNAUpdated / MarketContextChanged (client engines)
  useEffect(() => {
    const orch = getTradeLikeMeOrchestrator()
    const unsub = orch.bus.subscribe('*', (event) => {
      if (
        event.type !== 'DecisionMade' &&
        event.type !== 'OpportunityScored' &&
        event.type !== 'DNAUpdated' &&
        event.type !== 'MarketContextChanged'
      ) {
        return
      }
      const st = orch.getState(useTerminalOsStore.getState().featureFlags)
      const local = [
        ...adaptDecisionToAttention(st, narrativeRef.current),
        ...adaptDnaToAttention(st.dna),
      ]
      if (!local.length) return
      const merged = prioritizeAttentionItems([...local, ...serverItemsRef.current], 12)
      const at = event.at
      const busHints: LiveEventHint[] = local.map((i) => ({
        itemId: i.id,
        kind: event.type === 'DNAUpdated' || event.type === 'DecisionMade' ? 'new' : 'updated',
        at,
      }))
      scheduleBatch(merged, busHints)
    })
    return unsub
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Mark session as seen after user has the feed open briefly
  useEffect(() => {
    const id = window.setTimeout(() => writeLastSeenAt(), 8_000)
    return () => window.clearTimeout(id)
  }, [])

  // Merge client DNA/decision into display without polling markets
  const allItems = useMemo(() => {
    const local = [
      ...adaptDecisionToAttention(state, narrative),
      ...adaptDnaToAttention(state.dna),
    ]
    const byId = new Map<string, AttentionItem>()
    for (const i of serverItems) byId.set(i.id, i)
    for (const i of local) byId.set(i.id, i)
    return prioritizeAttentionItems([...byId.values()], 12)
  }, [serverItems, state, narrative])

  const items = useMemo(
    () => filterWorkspaceItems(allItems, workspace),
    [allItems, workspace],
  )

  const entries = useMemo(
    () => mergeLiveEntries(items, hints, lastSeenAt, kindFlash),
    [items, hints, lastSeenAt, kindFlash],
  )

  return {
    entries,
    items,
    isLoading: isLoading && items.length === 0,
    isError,
    isLive,
  }
}
