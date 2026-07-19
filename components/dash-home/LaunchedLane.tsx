'use client'

import { useCallback, useEffect, useState } from 'react'
import type { LaunchRecord } from '@/lib/launch/types'
import { useActionPanel } from './action-panel-context'

function badgeTone(v: string | null | undefined): string {
  if (v === 'SAFE') return 'bg-dash-greenDim text-dash-green'
  if (v === 'CAUTION') return 'bg-dash-amber/20 text-dash-amber'
  if (v === 'DANGER') return 'bg-dash-red/20 text-dash-red'
  return 'bg-dash-panel2 text-dash-tmid'
}

/**
 * "Launched on CryptoCheck" lane — real Neural V4 badges from /api/launch/list.
 * Flagged tokens are labeled, not hidden.
 */
export function LaunchedLane({ refreshKey = 0 }: { refreshKey?: number }) {
  const { selectMint, runScan } = useActionPanel()
  const [rows, setRows] = useState<LaunchRecord[] | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/launch/list?limit=12', { cache: 'no-store' })
      const body = await res.json()
      setRows(Array.isArray(body?.launches) ? (body.launches as LaunchRecord[]) : [])
    } catch {
      setRows([])
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load, refreshKey])

  return (
    <section
      id="launched-on-cryptocheck"
      className="dash-glass rounded-dash border border-dash-hairline p-4 md:p-5"
    >
      <header className="mb-3">
        <p className="font-space text-[13px] font-semibold text-dash-sky">Launched on CryptoCheck</p>
        <p className="text-[11px] text-dash-tmid">
          Real Neural V4 badges · curve → migrated lane from on-chain status
        </p>
      </header>

      {rows === null ? (
        <ul className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <li key={i} className="h-12 animate-shimmer rounded-dash-inner bg-dash-panel2" />
          ))}
        </ul>
      ) : rows.length === 0 ? (
        <p className="rounded-dash-inner border border-dashed border-dash-innerline px-3 py-6 text-center text-xs text-dash-tmid">
          No platform launches yet. Use LAUNCH when enabled (devnet).
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.mint}>
              <button
                type="button"
                onClick={() => {
                  selectMint(r.mint, 'scan')
                  void runScan(r.mint)
                  document
                    .getElementById('action-panel')
                    ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
                }}
                className="flex w-full items-center gap-2 rounded-dash-inner border border-dash-innerline px-2 py-2 text-left transition-colors hover:border-dash-sky/40 hover:bg-dash-panel2"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-semibold text-dash-thi">
                    {r.ticker || r.name || 'TOKEN'}
                  </p>
                  <p className="font-dash-mono truncate text-[10px] text-dash-tlo">{r.mint}</p>
                </div>
                <span
                  className={`shrink-0 rounded-dash-chip px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                    r.migrationStatus === 'migrated'
                      ? 'bg-dash-sky/20 text-dash-sky'
                      : r.migrationStatus === 'migrate'
                        ? 'bg-dash-amber/20 text-dash-amber'
                        : 'bg-dash-panel2 text-dash-tmid'
                  }`}
                >
                  {r.migrationStatus === 'migrated'
                    ? 'migrated'
                    : r.migrationStatus === 'migrate'
                      ? 'graduating'
                      : 'curve'}
                </span>
                <span
                  className={`shrink-0 rounded-dash-chip px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${badgeTone(r.badge ?? r.verdict)}`}
                >
                  {r.badge ?? r.verdict ?? '—'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
