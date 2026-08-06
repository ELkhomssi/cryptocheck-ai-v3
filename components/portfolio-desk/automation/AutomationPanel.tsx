'use client'

/**
 * Automation workspace — recipes map to real agents; schedules run via cron.
 * Money path unchanged: agents never auto-sign swaps.
 */

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AgentActivityRow, AIEmployee } from '@/types/agents'
import { statusCopyForAgentRun } from '@/lib/intelligence/copy'
import { AUTOMATION_RECIPES } from '@/lib/portfolio-desk/automation-recipes'
import { ProUpgradePrompt } from '@/components/identity/ProUpgradePrompt'

type ScheduleRow = {
  id: string
  recipeId: string
  enabled: boolean
  intervalMinutes: number
  nextRunAt: string
  lastRunAt: string | null
  lastStatus: string | null
  lastError: string | null
}

function formatInterval(mins: number): string {
  if (mins >= 1440) return `every ${Math.round(mins / 1440)}d`
  if (mins >= 60) return `every ${Math.round(mins / 60)}h`
  return `every ${mins}m`
}

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

  const schedulesQ = useQuery({
    queryKey: ['automation-schedules'],
    queryFn: async () => {
      const res = await fetch('/api/automation/schedules', { cache: 'no-store' })
      if (!res.ok) return [] as ScheduleRow[]
      const body = (await res.json()) as { schedules?: ScheduleRow[] }
      return body.schedules ?? []
    },
    refetchInterval: 20_000,
  })

  const employees = rosterQ.data?.employees ?? []
  const byId = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees])
  const scheduleByRecipe = useMemo(() => {
    const m = new Map<string, ScheduleRow>()
    for (const s of schedulesQ.data ?? []) m.set(s.recipeId, s)
    return m
  }, [schedulesQ.data])

  const runMut = useMutation({
    mutationFn: async (recipeId: string) => {
      const recipe = AUTOMATION_RECIPES.find((r) => r.id === recipeId)
      if (!recipe) throw new Error('Unknown recipe')
      const agent = byId.get(recipe.agentId) || employees.find((e) => e.id === recipe.agentId)
      if (!agent) throw new Error(`Agent ${recipe.agentId} not in roster`)
      const res = await fetch(`/api/agents/${encodeURIComponent(recipe.agentId)}/run`, {
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

  const scheduleMut = useMutation({
    mutationFn: async (params: { recipeId: string; enabled: boolean }) => {
      const res = await fetch('/api/automation/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })
      const body = (await res.json().catch(() => ({}))) as {
        error?: string
        message?: string
        note?: string
        schedule?: ScheduleRow
      }
      if (res.status === 401) {
        throw new Error(body.error || 'Sign in with Solana to enable schedules')
      }
      if (res.status === 402) {
        setShowProUpsell(true)
        throw new Error(body.message || body.error || 'Pro required for schedules')
      }
      if (!res.ok) throw new Error(body.error || 'Schedule update failed')
      return body
    },
    onSuccess: (body) => {
      setMsg(body.note || 'Schedule updated')
      void qc.invalidateQueries({ queryKey: ['automation-schedules'] })
    },
    onError: (e) => setMsg(e instanceof Error ? e.message : 'Failed'),
  })

  const recent = activityQ.data ?? []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="pd-panel" style={{ padding: 16 }}>
        <h2 style={{ margin: '0 0 6px', fontSize: 15 }}>Automation recipes</h2>
        <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--pd-text-dim)' }}>
          Each recipe maps to a real AI Employee. Run now, or enable a schedule so the cron worker
          executes it unattended (reports/signals only — never auto-swaps).
          {rosterQ.data?.openaiAvailable === false
            ? ' LLM key missing — runs stay unavailable.'
            : ''}
        </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: 12,
          }}
        >
          {AUTOMATION_RECIPES.map((r) => {
            const sched = scheduleByRecipe.get(r.id)
            const enabled = Boolean(sched?.enabled)
            const agent = byId.get(r.agentId)
            return (
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
                <p style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--pd-text-dim)' }}>
                  {r.blurb}
                </p>
                <p
                  className="pd-num"
                  style={{ margin: '0 0 12px', fontSize: 10, color: 'var(--pd-text-faint)' }}
                >
                  {agent?.name || r.agentId} · {formatInterval(r.intervalMinutes)}
                  {enabled && sched?.nextRunAt
                    ? ` · next ${new Date(sched.nextRunAt).toLocaleString()}`
                    : ''}
                  {sched?.lastStatus ? ` · last ${sched.lastStatus}` : ''}
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  <button
                    type="button"
                    className="pd-connect"
                    disabled={runMut.isPending || rosterQ.isLoading || !agent}
                    onClick={() => runMut.mutate(r.id)}
                  >
                    {runMut.isPending ? 'Starting…' : 'Run now'}
                  </button>
                  <button
                    type="button"
                    className="pd-tab"
                    disabled={scheduleMut.isPending}
                    onClick={() =>
                      scheduleMut.mutate({ recipeId: r.id, enabled: !enabled })
                    }
                  >
                    {enabled ? 'Disable schedule' : 'Enable schedule'}
                  </button>
                </div>
              </article>
            )
          })}
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
            <p>Start a recipe or enable a schedule. Idle is honest — we do not invent activity.</p>
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
