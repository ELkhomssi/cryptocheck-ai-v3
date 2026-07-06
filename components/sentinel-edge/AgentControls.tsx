'use client'

import { useState } from 'react'
import type { AgentControlState } from '@cryptocheck/signal-contracts'
import { ConnectionPill, type ConnectionState } from '@/components/command-center/ConnectionPill'

type Props = {
  control: AgentControlState
  saving: boolean
  connection: ConnectionState
  onChange: (patch: Partial<AgentControlState>) => void
}

export function AgentControls({ control, saving, connection, onChange }: Props) {
  const [confirmKill, setConfirmKill] = useState(false)

  const armKill = () => {
    if (control.killSwitch) {
      onChange({ killSwitch: false })
      setConfirmKill(false)
      return
    }
    if (!confirmKill) {
      setConfirmKill(true)
      window.setTimeout(() => setConfirmKill(false), 4000)
      return
    }
    onChange({ killSwitch: true })
    setConfirmKill(false)
  }

  return (
    <div className="rd-panel space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full border px-2.5 py-1 font-rd-display text-[0.55rem] font-bold uppercase tracking-wider ${
              control.mode === 'live'
                ? 'border-rd-green/50 bg-rd-green/15 text-rd-green shadow-[0_0_12px_rgba(63,224,90,0.2)]'
                : 'border-amber-400/40 bg-amber-400/10 text-amber-200'
            }`}
          >
            {control.mode === 'live' ? 'Live' : 'Paper'}
          </span>
          <span
            className={`rounded-full border px-2.5 py-1 font-rd-display text-[0.55rem] font-bold uppercase tracking-wider ${
              control.enabled && !control.killSwitch
                ? 'border-rd-green/40 text-rd-green'
                : 'border-white/15 text-rd-lo'
            }`}
          >
            {control.killSwitch ? 'Halted' : control.enabled ? 'Armed' : 'Disabled'}
          </span>
          <ConnectionPill state={connection} />
        </div>

        <button
          type="button"
          disabled={saving}
          onClick={armKill}
          className={`min-w-[9.5rem] rounded-rd-sm px-4 py-2.5 font-rd-display text-[0.65rem] font-bold uppercase tracking-wider focus:outline-none focus-visible:ring-2 focus-visible:ring-rd-danger/70 ${
            control.killSwitch
              ? 'border border-rd-safe/50 bg-rd-safe/15 text-rd-safe'
              : confirmKill
                ? 'border border-rd-danger bg-rd-danger text-white shadow-[0_0_28px_rgba(255,90,110,0.45)]'
                : 'border border-rd-danger/60 bg-rd-danger/20 text-rd-danger shadow-[0_0_20px_rgba(255,90,110,0.2)]'
          }`}
        >
          {control.killSwitch
            ? 'Resume agent'
            : confirmKill
              ? 'Confirm kill'
              : 'Kill-switch'}
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block text-xs text-rd-mid">
          Enabled
          <button
            type="button"
            disabled={saving}
            onClick={() => onChange({ enabled: !control.enabled })}
            className={`mt-1 flex w-full items-center justify-center rounded-rd-sm border px-3 py-2 font-rd-display text-[0.58rem] font-bold uppercase tracking-wider focus:outline-none focus-visible:ring-2 focus-visible:ring-rd-green/50 ${
              control.enabled
                ? 'border-rd-green/40 bg-rd-green/10 text-rd-green'
                : 'border-white/10 text-rd-lo'
            }`}
          >
            {control.enabled ? 'On' : 'Off'}
          </button>
        </label>

        <label className="block text-xs text-rd-mid">
          Mode
          <select
            value={control.mode}
            disabled={saving}
            onChange={(e) =>
              onChange({ mode: e.target.value === 'live' ? 'live' : 'paper' })
            }
            className="mt-1 w-full rounded-rd-sm border border-white/10 bg-rd-navy/80 px-3 py-2 text-sm text-rd-hi focus:outline-none focus-visible:ring-2 focus-visible:ring-rd-green/50"
          >
            <option value="paper">Paper</option>
            <option value="live">Live</option>
          </select>
        </label>

        <label className="block text-xs text-rd-mid">
          Edge threshold
          <input
            type="number"
            min={0}
            max={100}
            value={control.edgeThreshold}
            disabled={saving}
            onChange={(e) => onChange({ edgeThreshold: Number(e.target.value) })}
            className="mt-1 w-full rounded-rd-sm border border-white/10 bg-rd-navy/80 px-3 py-2 font-rd-mono text-sm tabular-nums text-rd-hi focus:outline-none focus-visible:ring-2 focus-visible:ring-rd-green/50"
          />
        </label>

        <label className="block text-xs text-rd-mid">
          Confidence floor
          <input
            type="number"
            min={0}
            max={1}
            step={0.05}
            value={control.confidenceFloor}
            disabled={saving}
            onChange={(e) => onChange({ confidenceFloor: Number(e.target.value) })}
            className="mt-1 w-full rounded-rd-sm border border-white/10 bg-rd-navy/80 px-3 py-2 font-rd-mono text-sm tabular-nums text-rd-hi focus:outline-none focus-visible:ring-2 focus-visible:ring-rd-green/50"
          />
        </label>

        <label className="block text-xs text-rd-mid">
          Max size
          <input
            type="number"
            min={1}
            value={control.maxPositionSize}
            disabled={saving}
            onChange={(e) => onChange({ maxPositionSize: Number(e.target.value) })}
            className="mt-1 w-full rounded-rd-sm border border-white/10 bg-rd-navy/80 px-3 py-2 font-rd-mono text-sm tabular-nums text-rd-hi focus:outline-none focus-visible:ring-2 focus-visible:ring-rd-green/50"
          />
        </label>

        <label className="block text-xs text-rd-mid">
          Per-match cap
          <input
            type="number"
            min={1}
            value={control.perMatchCap}
            disabled={saving}
            onChange={(e) => onChange({ perMatchCap: Number(e.target.value) })}
            className="mt-1 w-full rounded-rd-sm border border-white/10 bg-rd-navy/80 px-3 py-2 font-rd-mono text-sm tabular-nums text-rd-hi focus:outline-none focus-visible:ring-2 focus-visible:ring-rd-green/50"
          />
        </label>

        <label className="block text-xs text-rd-mid">
          Daily loss limit
          <input
            type="number"
            min={1}
            value={control.dailyLossLimit}
            disabled={saving}
            onChange={(e) => onChange({ dailyLossLimit: Number(e.target.value) })}
            className="mt-1 w-full rounded-rd-sm border border-white/10 bg-rd-navy/80 px-3 py-2 font-rd-mono text-sm tabular-nums text-rd-hi focus:outline-none focus-visible:ring-2 focus-visible:ring-rd-green/50"
          />
        </label>
      </div>

      <p className="text-[0.65rem] text-rd-lo">
        Updated {new Date(control.updatedAt).toLocaleString()} · Gate applies on next signal
      </p>
    </div>
  )
}
