'use client'

/**
 * Live Attention list — batched reorder + FLIP position transitions.
 * Caps individual FLIP when >5 items move (full refresh fade instead).
 */

import { useEffect, useLayoutEffect, useRef } from 'react'
import { AttentionCard } from './AttentionCard'
import type { AttentionFeedEntry } from '../types'

const FLIP_MS = 320
const FLIP_CAP = 5

export function AttentionFeedList({
  entries,
  onAccept,
  onDismiss,
  acceptLabelFor,
}: {
  entries: AttentionFeedEntry[]
  onAccept?: (id: string) => void
  onDismiss?: (id: string) => void
  acceptLabelFor?: (id: string) => string | undefined
}) {
  const listRef = useRef<HTMLDivElement>(null)
  const prevRects = useRef<Map<string, DOMRect>>(new Map())
  const prevOrder = useRef<string[]>([])

  useLayoutEffect(() => {
    const root = listRef.current
    if (!root) return
    const nodes = Array.from(root.querySelectorAll<HTMLElement>('[data-attention-id]'))
    const nextOrder = nodes.map((n) => n.dataset.attentionId!).filter(Boolean)
    const prev = prevRects.current
    const moved: HTMLElement[] = []

    for (const node of nodes) {
      const id = node.dataset.attentionId
      if (!id) continue
      const old = prev.get(id)
      const next = node.getBoundingClientRect()
      if (old) {
        const dx = old.left - next.left
        const dy = old.top - next.top
        if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
          moved.push(node)
          node.style.transform = `translate(${dx}px, ${dy}px)`
          node.style.transition = 'transform 0s'
        }
      }
    }

    const useFlip = moved.length > 0 && moved.length <= FLIP_CAP
    const useRefresh = moved.length > FLIP_CAP

    if (useRefresh && root) {
      root.dataset.refresh = 'true'
      window.setTimeout(() => {
        if (listRef.current) listRef.current.dataset.refresh = 'false'
      }, FLIP_MS)
    }

    if (useFlip) {
      requestAnimationFrame(() => {
        for (const node of moved) {
          node.style.transition = `transform ${FLIP_MS}ms var(--sm-ease-state, cubic-bezier(0.22, 1, 0.36, 1))`
          node.style.transform = ''
        }
      })
      window.setTimeout(() => {
        for (const node of moved) {
          node.style.transition = ''
        }
      }, FLIP_MS + 40)
    } else {
      for (const node of moved) {
        node.style.transform = ''
        node.style.transition = ''
      }
    }

    const map = new Map<string, DOMRect>()
    for (const node of nodes) {
      const id = node.dataset.attentionId
      if (id) map.set(id, node.getBoundingClientRect())
    }
    prevRects.current = map
    prevOrder.current = nextOrder
  }, [entries])

  // Clear one-shot "new" entrance after animation
  useEffect(() => {
    const root = listRef.current
    if (!root) return
    const news = root.querySelectorAll<HTMLElement>('[data-live-kind="new"]')
    if (!news.length) return
    const id = window.setTimeout(() => {
      news.forEach((n) => {
        if (n.dataset.liveKind === 'new') n.dataset.liveKind = 'stable'
      })
    }, 900)
    return () => window.clearTimeout(id)
  }, [entries])

  return (
    <div className="sm-feed" ref={listRef} data-refresh="false">
      {entries.map(({ item, kind, sinceAway }) => (
        <div
          key={item.id}
          className="sm-feed-item"
          data-attention-id={item.id}
          data-live-kind={kind}
          data-since-away={sinceAway ? 'true' : 'false'}
        >
          {sinceAway ? <span className="sm-away-mark">Since you’ve been away</span> : null}
          <AttentionCard
            item={item}
            onAccept={onAccept}
            onDismiss={onDismiss}
            acceptLabel={acceptLabelFor?.(item.id)}
            liveKind={kind}
          />
        </div>
      ))}
    </div>
  )
}
