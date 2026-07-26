'use client'

import { useEffect, useState } from 'react'
import type { AgentActionType, AgentDataSource } from '@/types/agents'

export function CustomEmployeeBuilder({
  walletAddress,
  onCreated,
  onCancel,
}: {
  walletAddress?: string | null
  onCreated: () => void
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [instructions, setInstructions] = useState('')
  const [actionType, setActionType] = useState<AgentActionType>('report')
  const [sources, setSources] = useState<AgentDataSource[]>(['birdeye-screener'])
  const [available, setAvailable] = useState<{ id: AgentDataSource; label: string }[]>([])
  const [actionTypes, setActionTypes] = useState<{ id: AgentActionType; label: string }[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/agents/custom', { cache: 'no-store' })
      .then((r) => r.json())
      .then(
        (body: {
          dataSources?: { id: AgentDataSource; label: string }[]
          actionTypes?: { id: AgentActionType; label: string }[]
        }) => {
          setAvailable(body.dataSources ?? [])
          setActionTypes(body.actionTypes ?? [])
        },
      )
      .catch(() => {
        setError('Could not load builder options.')
      })
  }, [])

  const toggle = (id: AgentDataSource) => {
    setSources((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]))
  }

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/agents/custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          role,
          instructions,
          actionType,
          dataSources: sources,
          walletAddress: walletAddress ?? undefined,
        }),
      })
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setError(body.error || 'Create failed')
        return
      }
      onCreated()
    } catch {
      setError('Network error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="pd-panel" style={{ marginBottom: 16 }}>
      <div className="pd-panel-head">
        <h2>Add Custom Employee</h2>
        <button type="button" className="pd-tab" onClick={onCancel}>
          Cancel
        </button>
      </div>
      <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
          <span style={{ color: 'var(--pd-text-faint)' }}>Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{
              padding: '8px 10px',
              borderRadius: 6,
              border: '1px solid var(--pd-border)',
              background: 'var(--pd-bg)',
              color: 'var(--pd-text)',
            }}
            placeholder="e.g. Liquidity Scout"
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
          <span style={{ color: 'var(--pd-text-faint)' }}>Role</span>
          <input
            value={role}
            onChange={(e) => setRole(e.target.value)}
            style={{
              padding: '8px 10px',
              borderRadius: 6,
              border: '1px solid var(--pd-border)',
              background: 'var(--pd-bg)',
              color: 'var(--pd-text)',
            }}
            placeholder="One-line specialty"
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
          <span style={{ color: 'var(--pd-text-faint)' }}>Action type</span>
          <select
            value={actionType}
            onChange={(e) => setActionType(e.target.value as AgentActionType)}
            style={{
              padding: '8px 10px',
              borderRadius: 6,
              border: '1px solid var(--pd-border)',
              background: 'var(--pd-bg)',
              color: 'var(--pd-text)',
            }}
          >
            {(actionTypes.length
              ? actionTypes
              : [
                  { id: 'chat' as const, label: 'Chat' },
                  { id: 'report' as const, label: 'Report' },
                  { id: 'signals' as const, label: 'Signals' },
                ]
            ).map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
        <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
          <legend style={{ fontSize: 12, color: 'var(--pd-text-faint)', marginBottom: 6 }}>
            Data sources
          </legend>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {available.map((s) => (
              <label
                key={s.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 12,
                  border: '1px solid var(--pd-border)',
                  borderRadius: 6,
                  padding: '6px 10px',
                  cursor: 'pointer',
                  background: sources.includes(s.id) ? 'var(--pd-accent-soft)' : 'transparent',
                }}
              >
                <input
                  type="checkbox"
                  checked={sources.includes(s.id)}
                  onChange={() => toggle(s.id)}
                />
                {s.label}
              </label>
            ))}
          </div>
        </fieldset>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
          <span style={{ color: 'var(--pd-text-faint)' }}>Instructions</span>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            rows={4}
            style={{
              padding: '8px 10px',
              borderRadius: 6,
              border: '1px solid var(--pd-border)',
              background: 'var(--pd-bg)',
              color: 'var(--pd-text)',
              resize: 'vertical',
              fontFamily: 'inherit',
            }}
            placeholder="Merged into a locked scaffold that requires live-data grounding and the standard disclaimer."
          />
        </label>
        {error ? <div style={{ color: 'var(--pd-negative)', fontSize: 12 }}>{error}</div> : null}
        <button
          type="button"
          className="pd-connect"
          style={{ alignSelf: 'flex-start' }}
          disabled={busy || !name.trim() || !role.trim() || !sources.length}
          onClick={() => void submit()}
        >
          {busy ? 'Creating…' : 'Create Employee'}
        </button>
      </div>
    </div>
  )
}
