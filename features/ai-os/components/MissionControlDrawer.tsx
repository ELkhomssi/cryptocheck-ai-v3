'use client'

/**
 * Mission Control — collapsible side drawer.
 * Status only: Scanner, Decision Engine, Discovery, DNA, Scout, Automation, Gateway, Whales.
 */

import { useMemo } from 'react'
import type { ModuleCardView } from '@/types/intelligence'
import type { MissionViewModel } from '@/types/intelligence-core'
import type { MissionControlNode } from '../types'

function mapModuleState(
  state: ModuleCardView['state'],
  calibrating: boolean,
): MissionControlNode['status'] {
  if (calibrating) return 'calibrating'
  if (state === 'running' || state === 'investigating') return 'live'
  if (state === 'waiting') return 'waiting'
  return 'idle'
}

function buildNodes(
  modules: ModuleCardView[],
  mission: MissionViewModel | null,
  dnaReady: boolean,
): MissionControlNode[] {
  const byName = (re: RegExp) =>
    modules.find((m) => re.test(m.displayName) || re.test(m.id))

  const security = byName(/security|scanner|risk/i)
  const market = byName(/market/i)
  const wallet = byName(/wallet|whale/i)
  const portfolio = byName(/portfolio/i)
  const trading = byName(/trad/i)
  const research = byName(/research|scout|launch/i)

  const running = mission?.running?.length ?? 0

  return [
    {
      id: 'scanner',
      label: 'Scanner',
      status: security ? mapModuleState(security.state, security.calibrating) : 'idle',
      detail: security?.investigationTarget ?? (security?.stats?.[0]?.value != null ? String(security.stats[0].value) : null),
    },
    {
      id: 'decision',
      label: 'Decision Engine',
      status: trading
        ? mapModuleState(trading.state, trading.calibrating)
        : running > 0
          ? 'live'
          : 'idle',
      detail: trading?.investigationTarget ?? null,
    },
    {
      id: 'discovery',
      label: 'Discovery',
      status: market ? mapModuleState(market.state, market.calibrating) : 'idle',
      detail: mission?.market?.topMoverSymbol
        ? `Top mover ${mission.market.topMoverSymbol}`
        : null,
    },
    {
      id: 'dna',
      label: 'DNA',
      status: dnaReady ? 'live' : 'waiting',
      detail: dnaReady ? 'Trader DNA loaded' : 'Train from wallet history',
    },
    {
      id: 'scout',
      label: 'Scout',
      status: research ? mapModuleState(research.state, research.calibrating) : 'idle',
      detail: research?.investigationTarget ?? null,
    },
    {
      id: 'automation',
      label: 'Automation',
      status: running > 0 ? 'live' : 'idle',
      detail: running > 0 ? `${running} active job${running === 1 ? '' : 's'}` : 'No active jobs',
    },
    {
      id: 'gateway',
      label: 'Gateway',
      status: mission ? 'live' : 'waiting',
      detail: mission?.dailyBrief?.pending ? 'Brief pending' : 'Brief ready',
    },
    {
      id: 'whales',
      label: 'Whales',
      status: wallet ? mapModuleState(wallet.state, wallet.calibrating) : portfolio ? mapModuleState(portfolio.state, portfolio.calibrating) : 'idle',
      detail: wallet?.investigationTarget ?? null,
    },
  ]
}

export function MissionControlDrawer({
  open,
  onClose,
  modules,
  mission,
  dnaReady,
  overallHealth,
}: {
  open: boolean
  onClose: () => void
  modules: ModuleCardView[]
  mission: MissionViewModel | null
  dnaReady: boolean
  overallHealth: { score: number | null; calibrating: boolean }
}) {
  const nodes = useMemo(
    () => buildNodes(modules, mission, dnaReady),
    [modules, mission, dnaReady],
  )

  return (
    <>
      <div
        className="aios-drawer-scrim"
        data-open={open ? 'true' : 'false'}
        onClick={onClose}
        aria-hidden={!open}
      />
      <aside
        className="aios-drawer"
        data-open={open ? 'true' : 'false'}
        aria-hidden={!open}
        aria-label="Mission Control"
      >
        <div className="aios-drawer-head">
          <div>
            <p className="aios-kicker">Mission Control</p>
            <h2 className="aios-section-title">System status</h2>
          </div>
          <button type="button" className="aios-icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <p className="aios-drawer-health">
          Overall{' '}
          {overallHealth.calibrating || overallHealth.score == null
            ? 'Calibrating'
            : `${Math.round(overallHealth.score)}%`}
        </p>

        <ul className="aios-mc-list">
          {nodes.map((n) => (
            <li key={n.id} className="aios-mc-node" data-status={n.status}>
              <span className="aios-mc-dot" aria-hidden />
              <div>
                <strong>{n.label}</strong>
                <span className="aios-mc-status">{n.status}</span>
                {n.detail ? <p className="aios-muted">{n.detail}</p> : null}
              </div>
            </li>
          ))}
        </ul>
      </aside>
    </>
  )
}
