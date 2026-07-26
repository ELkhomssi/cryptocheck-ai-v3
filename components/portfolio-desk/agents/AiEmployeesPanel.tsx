'use client'

import { useCallback, useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useSolana } from '@/components/SolanaProvider'
import type {
  AgentActivityRow,
  AgentRunStructured,
  RosterEmployeeView,
  TeamOverviewStats,
} from '@/types/agents'
import { AgentChatPanel } from './AgentChatPanel'
import { AgentResultPanel } from './AgentResultPanel'
import { CustomEmployeeBuilder } from './CustomEmployeeBuilder'
import { EmployeeCard } from './EmployeeCard'
import { TeamActivityFeed } from './TeamActivityFeed'
import { TeamOverview } from './TeamOverview'

type RosterResponse = {
  employees: RosterEmployeeView[]
  overview: TeamOverviewStats
  anthropicAvailable: boolean
}

async function fetchRoster(wallet: string | null): Promise<RosterResponse> {
  const q = wallet ? `?wallet=${encodeURIComponent(wallet)}` : ''
  const res = await fetch(`/api/agents/roster${q}`, { cache: 'no-store' })
  if (!res.ok) {
    return {
      employees: [],
      overview: {
        totalEmployees: 0,
        activeNow: 0,
        tasksRunning: 0,
        alertsToday: 0,
        successRate: null,
      },
      anthropicAvailable: false,
    }
  }
  return (await res.json()) as RosterResponse
}

async function fetchActivity(): Promise<AgentActivityRow[]> {
  const res = await fetch('/api/agents/activity?limit=40', { cache: 'no-store' })
  if (!res.ok) return []
  const body = (await res.json()) as { activity?: AgentActivityRow[] }
  return body.activity ?? []
}

export function AiEmployeesPanel() {
  const { walletAddress } = useSolana()
  const qc = useQueryClient()
  const [showBuilder, setShowBuilder] = useState(false)
  const [activeChat, setActiveChat] = useState<RosterEmployeeView | null>(null)
  const [activeResultEmp, setActiveResultEmp] = useState<RosterEmployeeView | null>(null)
  const [result, setResult] = useState<AgentRunStructured | null>(null)
  const [resultError, setResultError] = useState<string | null>(null)
  const [resultLoading, setResultLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())

  const rosterQ = useQuery({
    queryKey: ['agents-roster', walletAddress],
    queryFn: () => fetchRoster(walletAddress),
    refetchInterval: 30_000,
    staleTime: 15_000,
  })

  const activityQ = useQuery({
    queryKey: ['agents-activity'],
    queryFn: fetchActivity,
    refetchInterval: 8_000,
    staleTime: 5_000,
  })

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])

  const online = rosterQ.data ? rosterQ.data.anthropicAvailable : null

  const runStructured = useCallback(
    async (emp: RosterEmployeeView) => {
      setActiveChat(null)
      setActiveResultEmp(emp)
      setResult(null)
      setResultError(null)
      setResultLoading(true)
      setBusyId(emp.id)
      try {
        const res = await fetch(`/api/agents/${encodeURIComponent(emp.id)}/run`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: emp.actionType,
            walletAddress: walletAddress ?? undefined,
            message: `Execute ${emp.actionLabel} for ${emp.name}.`,
          }),
        })
        const body = (await res.json().catch(() => ({}))) as {
          error?: string
          result?: AgentRunStructured
        }
        if (!res.ok || !body.result) {
          setResultError(body.error || 'Agent run failed')
          return
        }
        setResult(body.result)
        void qc.invalidateQueries({ queryKey: ['agents-activity'] })
        void qc.invalidateQueries({ queryKey: ['agents-roster'] })
      } catch {
        setResultError('Network error')
      } finally {
        setResultLoading(false)
        setBusyId(null)
      }
    },
    [qc, walletAddress],
  )

  const onAction = (emp: RosterEmployeeView) => {
    if (emp.actionType === 'chat') {
      setActiveResultEmp(null)
      setResult(null)
      setActiveChat(emp)
      return
    }
    void runStructured(emp)
  }

  const employees = rosterQ.data?.employees ?? []
  const overview = rosterQ.data?.overview ?? {
    totalEmployees: 0,
    activeNow: 0,
    tasksRunning: 0,
    alertsToday: 0,
    successRate: null,
  }

  return (
    <section style={{ marginTop: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button
          type="button"
          className="pd-tab"
          onClick={() => setShowBuilder((v) => !v)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <Plus className="h-3.5 w-3.5" />
          Add Custom Employee
        </button>
      </div>

      {showBuilder ? (
        <CustomEmployeeBuilder
          walletAddress={walletAddress}
          onCancel={() => setShowBuilder(false)}
          onCreated={() => {
            setShowBuilder(false)
            void qc.invalidateQueries({ queryKey: ['agents-roster'] })
          }}
        />
      ) : null}

      <TeamOverview stats={overview} />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: 12,
          marginBottom: 16,
        }}
      >
        {employees.map((emp) => (
          <EmployeeCard
            key={emp.id}
            employee={emp}
            online={online}
            busy={busyId === emp.id}
            onAction={() => onAction(emp)}
          />
        ))}
      </div>

      {!employees.length && !rosterQ.isLoading ? (
        <div className="pd-panel" style={{ padding: 18, marginBottom: 16, fontSize: 13, color: 'var(--pd-text-dim)' }}>
          Roster unavailable. Confirm migrations and API routes are deployed.
        </div>
      ) : null}

      {activeChat ? (
        <AgentChatPanel employee={activeChat} onClose={() => setActiveChat(null)} />
      ) : null}

      {activeResultEmp ? (
        <AgentResultPanel
          employee={activeResultEmp}
          result={result}
          loading={resultLoading}
          error={resultError}
          onClose={() => {
            setActiveResultEmp(null)
            setResult(null)
            setResultError(null)
          }}
          onRefresh={() => void runStructured(activeResultEmp)}
        />
      ) : null}

      <TeamActivityFeed rows={activityQ.data ?? []} now={now} />
    </section>
  )
}
