import type { AgentFeedEvent } from '@cryptocheck/signal-contracts'
import type { UnifiedSignal } from '@cryptocheck/signal-contracts'
import { formatAge } from '@/lib/signals-dashboard/format'

export type TickerAlert = {
  id: string
  text: string
  ago: string
  kind: 'edge' | 'verdict' | 'agent' | 'signal'
}

export function buildTickerAlerts(
  signals: UnifiedSignal[],
  agentEvents: AgentFeedEvent[],
  limit = 12,
): TickerAlert[] {
  const out: TickerAlert[] = []

  for (const s of signals) {
    if (s.dropped || s.sample) continue
    if (s.subjectType === 'match_event' && s.edgeSignal && s.edgeSignal.magnitude >= 40) {
      const teams = s.teams ? `${s.teams.home} vs ${s.teams.away}` : s.label
      out.push({
        id: `edge-${s.id}`,
        text: `EDGE detected ${teams} · ${s.edgeSignal.rationale.slice(0, 60)}`,
        ago: formatAge(s.msgTimestamp),
        kind: 'edge',
      })
    } else if (s.subjectType === 'token' && (s.verdict === 'danger' || s.verdict === 'safe')) {
      out.push({
        id: `verdict-${s.id}`,
        text: `${s.verdict.toUpperCase()} flag on ${s.label}`,
        ago: formatAge(s.msgTimestamp),
        kind: 'verdict',
      })
    } else if (s.subjectType === 'token' && s.type === 'buy') {
      out.push({
        id: `buy-${s.id}`,
        text: `Smart Money signal on ${s.label}`,
        ago: formatAge(s.msgTimestamp),
        kind: 'signal',
      })
    }
    if (out.length >= limit) break
  }

  for (const ev of agentEvents) {
    if (out.length >= limit) break
    if (ev.type === 'agent.decision') {
      const d = ev.decision
      out.push({
        id: `agent-${d.id}`,
        text: `Agent decision on ${d.label ?? d.matchId} · ${d.side}`,
        ago: formatAge(d.timestamp),
        kind: 'agent',
      })
    }
  }

  return out.slice(0, limit)
}
