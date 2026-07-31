'use client'

/**
 * Money Lifecycle V2 ribbon — connective narrative over existing engines.
 * Wide (≥1440px): 8 nodes. Narrower: 4 groups with AI detail expand.
 * Motion reflects real active stage only (no decorative loop).
 */

import { useState, startTransition } from 'react'
import { useTerminalOsStore } from '@/stores/terminal-os'
import { useTerminalWallet } from '@/features/terminal-os/wallet/useTerminalWallet'
import { useMoneyLifecycle } from '../useMoneyLifecycle'
import { LIFECYCLE_GROUPS, type LifecycleNodeView, type LifecycleStageId } from '../types'

function statusLabel(status: LifecycleNodeView['status']): string {
  switch (status) {
    case 'active':
      return 'Active'
    case 'ready':
      return 'Ready'
    case 'needs_wallet':
      return 'Connect'
    case 'needs_config':
      return 'Configure'
    case 'insufficient_data':
      return 'No data'
    default:
      return 'Idle'
  }
}

export function MoneyLifecycleRibbon() {
  const { derived, snapshot } = useMoneyLifecycle()
  const setActiveNav = useTerminalOsStore((s) => s.setActiveNav)
  const { connectSolana, isConnecting } = useTerminalWallet()
  const [selected, setSelected] = useState<LifecycleStageId | null>(null)
  const [aiExpanded, setAiExpanded] = useState(false)

  const selectedNode =
    derived.nodes.find((n) => n.meta.id === (selected ?? derived.activeStageId)) ??
    derived.nodes[0]

  const onSelectStage = (id: LifecycleStageId) => {
    startTransition(() => setSelected(id))
  }

  const onCta = (node: LifecycleNodeView) => {
    if (node.ctaExternalUrl) {
      window.open(node.ctaExternalUrl, '_blank', 'noopener,noreferrer')
      return
    }
    if (node.meta.id === 'enters' && !snapshot.walletConnected) {
      void connectSolana()
      return
    }
    if (node.ctaHref) {
      setActiveNav(node.ctaHref as Parameters<typeof setActiveNav>[0])
    }
  }

  return (
    <section
      className="tos-mlc"
      aria-label="Money Lifecycle"
      data-active-stage={derived.activeStageId}
      data-active-group={derived.activeGroupId}
    >
      <div className="tos-mlc-head">
        <p className="tos-mlc-kicker">Money Lifecycle</p>
        <p className="tos-mlc-compliance">Non-custodial · Not financial advice · DYOR</p>
      </div>

      {/* Wide: full 8-node ribbon */}
      <ol className="tos-mlc-nodes tos-mlc-nodes--full" aria-label="Eight lifecycle stages">
        {derived.nodes.map((node, i) => (
          <li key={node.meta.id} className="tos-mlc-node-wrap">
            {i > 0 ? <span className="tos-mlc-flow" aria-hidden /> : null}
            <button
              type="button"
              className="tos-mlc-node"
              data-status={node.status}
              data-active={node.meta.id === derived.activeStageId ? 'true' : 'false'}
              aria-pressed={selected === node.meta.id}
              onClick={() => onSelectStage(node.meta.id)}
            >
              <span className="tos-mlc-idx">{node.meta.index}</span>
              <span className="tos-mlc-label">{node.meta.shortLabel}</span>
              <span className="tos-mlc-state">{statusLabel(node.status)}</span>
            </button>
          </li>
        ))}
      </ol>

      {/* Narrow: 4 groups; AI expands to stages 2–6 */}
      <div className="tos-mlc-groups" aria-label="Lifecycle groups">
        {LIFECYCLE_GROUPS.map((g) => {
          const groupActive = derived.activeGroupId === g.id
          const groupNodes = derived.nodes.filter((n) => g.stageIds.includes(n.meta.id))
          const pulse = groupNodes.some((n) => n.status === 'active')
          return (
            <div key={g.id} className="tos-mlc-group" data-active={groupActive ? 'true' : 'false'}>
              <button
                type="button"
                className="tos-mlc-group-btn"
                data-status={pulse ? 'active' : groupNodes[0]?.status || 'idle'}
                data-active={groupActive ? 'true' : 'false'}
                onClick={() => {
                  if (g.id === 'ai') {
                    setAiExpanded((v) => !v)
                    onSelectStage(derived.activeGroupId === 'ai' ? derived.activeStageId : 'decides')
                  } else {
                    setAiExpanded(false)
                    onSelectStage(g.stageIds[0])
                  }
                }}
              >
                <span className="tos-mlc-label">{g.label}</span>
                <span className="tos-mlc-state">
                  {pulse ? 'Active' : statusLabel(groupNodes[0]?.status || 'idle')}
                </span>
              </button>
              {g.id === 'ai' && aiExpanded ? (
                <ol className="tos-mlc-ai-detail">
                  {groupNodes.map((node) => (
                    <li key={node.meta.id}>
                      <button
                        type="button"
                        className="tos-mlc-node tos-mlc-node--compact"
                        data-status={node.status}
                        data-active={node.meta.id === derived.activeStageId ? 'true' : 'false'}
                        onClick={() => onSelectStage(node.meta.id)}
                      >
                        <span className="tos-mlc-idx">{node.meta.index}</span>
                        <span className="tos-mlc-label">{node.meta.shortLabel}</span>
                      </button>
                    </li>
                  ))}
                </ol>
              ) : null}
            </div>
          )
        })}
      </div>

      {selectedNode ? (
        <div className="tos-mlc-detail" data-status={selectedNode.status}>
          <div className="tos-mlc-detail-text">
            <h3 className="tos-mlc-detail-title">
              {selectedNode.meta.index}. {selectedNode.meta.fullLabel}
            </h3>
            <p className="tos-mlc-detail-engine">{selectedNode.meta.engine}</p>
            <p className="tos-mlc-detail-headline">{selectedNode.headline}</p>
            <ul className="tos-mlc-detail-lines">
              {selectedNode.detailLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
          {selectedNode.ctaLabel ? (
            <button
              type="button"
              className="tos-btn tos-btn-gold tos-mlc-cta"
              disabled={isConnecting && selectedNode.meta.id === 'enters'}
              onClick={() => onCta(selectedNode)}
            >
              {isConnecting && selectedNode.meta.id === 'enters'
                ? 'Connecting…'
                : selectedNode.ctaLabel}
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
