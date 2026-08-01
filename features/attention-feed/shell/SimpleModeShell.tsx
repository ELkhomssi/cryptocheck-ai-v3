'use client'

/**
 * Simple Mode V2 — AI Operating System experience.
 * Home = Attention Feed. Four workspaces = filtered views + Execution.
 * Pro Mode TerminalOsShell is never imported or edited here.
 */

import { useCallback, useState, startTransition } from 'react'
import { EmptyState } from '@/features/terminal-os/shared/components/PanelStates'
import { useTradeLikeMeEngine } from '@/features/terminal-os/ai-trade-like-me/hooks/useTradeLikeMeEngine'
import { useTerminalOsStore } from '@/stores/terminal-os'
import { AttentionFeedList } from '../components/AttentionFeedList'
import { AskAiInput } from '../components/AskAiInput'
import { SimpleSecureAccount } from '../components/SimpleSecureAccount'
import { useAttentionFeed } from '../hooks/useAttentionFeed'
import { SIMPLE_WORKSPACES, type SimpleWorkspaceId } from '../lib/vocab'
import { SimpleCoachWorkspace } from '../workspaces/SimpleCoachWorkspace'
import { SimpleExecutionWorkspace } from '../workspaces/SimpleExecutionWorkspace'
import '../styles.css'

function FeedWorkspace({
  workspace,
  onAcceptExecution,
}: {
  workspace: Extract<SimpleWorkspaceId, 'home' | 'employees' | 'discovery'>
  onAcceptExecution: () => void
}) {
  const { entries, items, isError, isLive } = useAttentionFeed(workspace)
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set())
  const setFocusedToken = useTerminalOsStore((s) => s.setFocusedToken)
  const { refreshOpportunity, state } = useTradeLikeMeEngine()

  const visible = entries.filter((e) => !dismissed.has(e.item.id))
  const meta = SIMPLE_WORKSPACES.find((w) => w.id === workspace)!

  const onDismiss = useCallback((id: string) => {
    setDismissed((prev) => new Set(prev).add(id))
  }, [])

  const onAccept = useCallback(
    (id: string) => {
      const item = items.find((i) => i.id === id)
      if (item?.sourceEngine === 'decision-engine' && state.currentOpportunity) {
        const opp = state.currentOpportunity
        setFocusedToken({
          id: opp.tokenSymbol,
          symbol: opp.tokenSymbol,
          name: opp.tokenSymbol,
          chain: opp.chain === 'all' ? 'solana' : opp.chain,
          priceUsd: 0,
        })
        onAcceptExecution()
        return
      }
      setDismissed((prev) => new Set(prev).add(id))
    },
    [items, state.currentOpportunity, setFocusedToken, onAcceptExecution],
  )

  return (
    <div className="sm-workspace">
      <div className="sm-workspace-head">
        <h2 className="sm-workspace-title">{meta.label === 'Home' ? 'Attention' : meta.label}</h2>
        <span className="sm-live-pill" data-live={isLive ? 'true' : 'false'}>
          {isLive ? 'Live' : 'Reconnecting'}
        </span>
      </div>
      <p className="sm-workspace-q">{meta.question}</p>
      {workspace === 'home' ? (
        <p className="sm-loop">
          Understand me → Watch the market → Tell me what deserves attention → Execute only after
          my approval
        </p>
      ) : null}
      {workspace === 'discovery' ? (
        <button
          type="button"
          className="sm-btn sm-btn-ghost"
          style={{ marginBottom: '0.75rem' }}
          onClick={() => void refreshOpportunity()}
        >
          Refresh high-conviction list
        </button>
      ) : null}
      {isError && !visible.length ? (
        <EmptyState message="Attention feed offline — engines did not return ranked items." />
      ) : null}
      {!visible.length && !isError ? (
        <EmptyState
          message={
            workspace === 'discovery'
              ? 'Not enough data yet — no high-conviction opportunities ranked right now.'
              : 'All clear — nothing urgent in this workspace.'
          }
        />
      ) : null}
      <AttentionFeedList
        entries={visible}
        onAccept={onAccept}
        onDismiss={onDismiss}
        acceptLabelFor={(id) => {
          const item = items.find((i) => i.id === id)
          return item?.sourceEngine === 'decision-engine' ? 'Review execution' : 'Got it'
        }}
      />
    </div>
  )
}

export function SimpleModeShell() {
  const [workspace, setWorkspace] = useState<SimpleWorkspaceId>('home')

  return (
    <div className="sm-shell" data-simple-mode>
      <header className="sm-top">
        <div className="sm-top-row">
          <div>
            <p className="sm-brand">CryptoCheck AI</p>
            <h1 className="sm-title">Your AI operating system</h1>
            <p className="sm-sub">
              Conclusions first. Evidence when you ask. Execute only after you approve.
            </p>
          </div>
          <SimpleSecureAccount />
        </div>
        <nav className="sm-nav" aria-label="Simple Mode workspaces">
          {SIMPLE_WORKSPACES.map((w) => (
            <button
              key={w.id}
              type="button"
              className="sm-nav-btn"
              data-active={workspace === w.id}
              onClick={() => startTransition(() => setWorkspace(w.id))}
            >
              {w.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="sm-main">
        {workspace === 'home' || workspace === 'employees' || workspace === 'discovery' ? (
          <FeedWorkspace
            workspace={workspace}
            onAcceptExecution={() => setWorkspace('execution')}
          />
        ) : null}
        {workspace === 'coach' ? <SimpleCoachWorkspace /> : null}
        {workspace === 'execution' ? <SimpleExecutionWorkspace /> : null}
      </main>

      <footer className="sm-footer">
        {workspace === 'home' || workspace === 'coach' ? <AskAiInput /> : null}
        <p className="sm-disclaimer">
          Not financial advice · DYOR · Simple Mode decides; Pro Mode analyzes.
        </p>
      </footer>
    </div>
  )
}
