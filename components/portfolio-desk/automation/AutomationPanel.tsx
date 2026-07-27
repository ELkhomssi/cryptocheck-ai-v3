'use client'

/**
 * Automation workspace — recipe-style rules backed by agent roster + activity.
 * Presents schedules as recipes, not "assign employee tasks."
 */

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AgentActivityRow, AIEmployee } from '@/types/agents'
import { statusCopyForAgentRun } from '@/lib/intelligence/copy'
import { ProUpgradePrompt } from '@/components/identity/ProUpgradePrompt'

const RECIPES: {
  id: string
  title: string
  blurb: string
  agentHint: string
  action: 'report' | 'signals' | 'analysis' | 'optimize'
}[] = [
  {
    id: 'daily-outlook',
    title: 'Daily market outlook',
    blurb: 'Generate a structured market outlook from live screener context.',
    agentHint: 'market-analyst',
    action: 'report',
  },
  {
    id: 'liquidity-watch',
    title: 'Liquidity change scan',
    blurb: 'Scan trending / new listings for liquidity structure changes.',
    agentHint: 'liquidity-scout',
    action: 'signals',
  },
  {
    id: 'portfolio-audit',
    title: 'Portfolio risk audit',
    blurb: 'Analyze connected wallet holdings for concentration and risk.',
    agentHint: 'risk-officer',
    action: 'analysis',
  },
  {
    id: 'whale-monitor',
    title: 'Whale / smart-money pulse',
    blurb: 'Pull smart-money leaning signals from live market feeds.',
    agentHint: 'whale-hunter',
    action: 'signals',
  },
]

export function AutomationPanel({ walletAddress }: { walletAddress: string | null }) {
  const qc = useQueryClient()
  const [msg, setMsg] = useState<string | null>(null)
  const [showProUpsell, setShowProUpsell] = useState(false)

  const rosterQ = useQuery({
    queryKey: ['automation-roster'],
    queryFn: async () => {
      const res = await fetch('/api/agents/roster', { cache: 'no-store' })
      if (!res.ok) throw new Error('Roster unavailable')
      return (await res.json()) as {
        employees?: AIEmployee[]
        openaiAvailable?: boolean
      }
    },
    staleTime: 60_000,
  })

  const activityQ = useQuery({
    queryKey: ['automation-activity'],
    queryFn: async () => {
      const res = await fetch('/api/agents/activity?limit=30', { cache: 'no-store' })
      if (!res.ok) return [] as AgentActivityRow[]
      const body = (await res.json()) as { activity?: AgentActivityRow[] }
      return body.activity ?? []
    },
    refetchInterval: 12_000,
  })

  const employees = rosterQ.data?.employees ?? []
  const byId = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees])

  const runMut = useMutation({
    mutationFn: async (recipeId: string) => {
      const recipe = RECIPES.find((r) => r.id === recipeId)
      if (!recipe) throw new Error('Unknown recipe')
      const agent =
        employees.find((e) => e.id.includes(recipe.agentHint.split('-')[0])) ||
        employees.find((e) => e.actionType === recipe.action) ||
        employees[0]
      if (!agent) throw new Error('No agents available')
      const res = await fetch(`/api/agents/${encodeURIComponent(agent.id)}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: recipe.action,
          walletAddress: walletAddress || undefined,
          automation: true,
          source: 'automation',
        }),
      })
      const body = (await res.json().catch(() => ({}))) as {
        available?: boolean
        error?: string
        message?: string
        feature?: string
        activityId?: string
      }
      if (res.status === 402) {
        setShowProUpsell(true)
        throw new Error(body.message || body.error || 'Pro required for Automation')
      }
      if (!res.ok) throw new Error(body.error || 'Run failed')
      if (body.available === false) throw new Error(body.error || 'Agent unavailable')
      return { agent, recipe, body }
    },
    onSuccess: ({ recipe, agent }) => {
      setMsg(statusCopyForAgentRun(agent.id, 'started', recipe.title))
      void qc.invalidateQueries({ queryKey: ['automation-activity'] })
      void qc.invalidateQueries({ queryKey: ['mission-running-intel'] })
      void qc.invalidateQueries({ queryKey: ['intelligence-modules'] })
    },
    onError: (e) => setMsg(e instanceof Error ? e.message : 'Failed'),
  })

  const recent = activityQ.data ?? []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="pd-panel" style={{ padding: 16 }}>
        <h2 style={{ margin: '0 0 6px', fontSize: 15 }}>Automation recipes</h2>
        <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--pd-text-dim)' }}>
          Rules run against live agent orchestrators. Output is framed as activity — not employee
          avatars. {rosterQ.data?.openaiAvailable === false ? 'LLM key missing — runs stay unavailable.' : ''}
        </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: 12,
          }}
        >
          {RECIPES.map((r) => (
            <article
              key={r.id}
              style={{
                border: '1px solid var(--pd-border-soft)',
                borderRadius: 'var(--pd-radius)',
                padding: 14,
                background: 'var(--pd-surface-2)',
              }}
            >
              <h3 style={{ margin: '0 0 6px', fontSize: 14 }}>{r.title}</h3>
              <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--pd-text-dim)' }}>
                {r.blurb}
              </p>
              <button
                type="button"
                className="pd-connect"
                disabled={runMut.isPending || rosterQ.isLoading || employees.length === 0}
                onClick={() => runMut.mutate(r.id)}
              >
                {runMut.isPending ? 'Starting…' : 'Run now'}
              </button>
            </article>
          ))}
        </div>
        {msg ? (
          <p style={{ marginTop: 12, fontSize: 12, color: 'var(--pd-text-dim)' }}>{msg}</p>
        ) : null}
        {showProUpsell ? (
          <div style={{ marginTop: 14 }}>
            <ProUpgradePrompt feature="automation" onDismiss={() => setShowProUpsell(false)} />
          </div>
        ) : null}
      </div>

      <div className="pd-panel" style={{ padding: 16 }}>
        <h2 style={{ margin: '0 0 12px', fontSize: 15 }}>Recent runs</h2>
        {activityQ.isLoading ? <div className="pd-skeleton" style={{ height: 48 }} /> : null}
        {!activityQ.isLoading && recent.length === 0 ? (
          <div className="pd-empty" style={{ padding: 18 }}>
            <h3>No automation runs yet</h3>
            <p>Start a recipe above. Idle is honest — we do not invent activity.</p>
          </div>
        ) : null}
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {recent.map((row) => (
            <li
              key={row.id}
              style={{
                padding: '10px 0',
                borderBottom: '1px solid var(--pd-border-soft)',
                fontSize: 13,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <span>{row.description || row.kind}</span>
                <span className="pd-num" style={{ fontSize: 11, color: 'var(--pd-text-faint)' }}>
                  {row.status}
                </span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--pd-text-faint)', marginTop: 4 }}>
                {byId.get(row.agentId)?.role || row.agentName} ·{' '}
                {new Date(row.createdAt).toLocaleString()}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
