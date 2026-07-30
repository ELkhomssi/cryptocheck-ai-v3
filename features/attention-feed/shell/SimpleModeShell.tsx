'use client'

import { useCallback, useState } from 'react'
import { PanelSkeleton, EmptyState } from '@/features/terminal-os/shared/components/PanelStates'
import { AttentionCard } from '../components/AttentionCard'
import { AskAiInput } from '../components/AskAiInput'
import { useAttentionFeed } from '../hooks/useAttentionFeed'
import '../styles.css'

/**
 * Simple Mode — AI OS default view.
 * One primary surface: Attention Feed. One persistent chrome: Ask AI.
 * No tickers, chart grids, or right-rail panels.
 */
export function SimpleModeShell() {
  const { items, isLoading, isError } = useAttentionFeed()
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set())

  const visible = items.filter((i) => !dismissed.has(i.id))

  const onDismiss = useCallback((id: string) => {
    setDismissed((prev) => new Set(prev).add(id))
  }, [])

  const onAccept = useCallback((id: string) => {
    // Accept = acknowledge; keep card but could soft-dismiss later
    setDismissed((prev) => new Set(prev).add(id))
  }, [])

  return (
    <div className="sm-shell" data-simple-mode>
      <header className="sm-top">
        <div>
          <p className="sm-brand">CryptoCheck AI</p>
          <h1 className="sm-title">What needs your attention</h1>
          <p className="sm-sub">
            Conclusions first. Evidence only when you ask why.
          </p>
        </div>
      </header>

      <main className="sm-main">
        {isError && !visible.length ? (
          <EmptyState message="Attention feed offline — engines did not return ranked items." />
        ) : null}
        {isLoading && !visible.length ? <PanelSkeleton rows={5} /> : null}
        {!isLoading && !visible.length ? (
          <EmptyState message="All clear — no high-priority attention items right now." />
        ) : null}
        <div className="sm-feed">
          {visible.map((item) => (
            <AttentionCard
              key={item.id}
              item={item}
              onAccept={onAccept}
              onDismiss={onDismiss}
            />
          ))}
        </div>
      </main>

      <footer className="sm-footer">
        <AskAiInput />
        <p className="sm-disclaimer">
          Not financial advice · DYOR · Simple Mode decides; Pro Mode analyzes.
        </p>
      </footer>
    </div>
  )
}
