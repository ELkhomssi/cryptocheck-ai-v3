'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { ProofCallTrackRecord } from '@cryptocheck/signal-contracts'

export function VerifiedTrackRecordPanel() {
  const [record, setRecord] = useState<ProofCallTrackRecord | null>(null)

  useEffect(() => {
    fetch('/api/proof/calls', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => setRecord(j as ProofCallTrackRecord))
      .catch(() => setRecord(null))
  }, [])

  return (
    <section className="rounded-dash border border-dash-hairline bg-dash-panel p-4 md:p-5">
      <header className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-[13px] font-semibold text-dash-green">VERIFIED TRACK RECORD</p>
          <p className="text-[11px] text-dash-tmid">On-chain commits · auto-graded</p>
        </div>
      </header>

      {!record ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-10 animate-shimmer rounded-dash-inner bg-dash-panel2" />
          ))}
        </div>
      ) : record.calls.length === 0 ? (
        <div className="rounded-dash-inner border border-dashed border-dash-innerline px-4 py-8 text-center">
          <p className="text-xs text-dash-tmid">
            No verified calls yet. Enable <code className="text-dash-green">PROOF_ENGINE_ENABLED</code> on gate-worker.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-dash-inner border border-dash-innerline bg-dash-panel2 p-2">
              <p className="text-[10px] uppercase text-dash-tlo">Hit rate</p>
              <p className="font-dash-mono text-lg font-semibold text-dash-thi">
                {record.hitRate != null ? `${record.hitRate}%` : '—'}
              </p>
            </div>
            <div className="rounded-dash-inner border border-dash-innerline bg-dash-panel2 p-2">
              <p className="text-[10px] uppercase text-dash-tlo">This month</p>
              <p className="font-dash-mono text-lg font-semibold text-dash-thi">{record.callsThisMonth}</p>
            </div>
            <div className="rounded-dash-inner border border-dash-innerline bg-dash-panel2 p-2">
              <p className="text-[10px] uppercase text-dash-tlo">Pending</p>
              <p className="font-dash-mono text-lg font-semibold text-dash-thi">{record.pending}</p>
            </div>
          </div>

          <ul className="space-y-2">
            {record.calls.slice(0, 5).map((c) => (
              <li
                key={c.id}
                className="flex items-center gap-2 rounded-dash-inner border border-dash-innerline px-2 py-2"
              >
                <span
                  className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                    c.outcome === 'hit'
                      ? 'bg-dash-greenDim text-dash-green'
                      : c.outcome === 'miss'
                        ? 'bg-dash-red/20 text-dash-red'
                        : 'bg-dash-panel2 text-dash-tmid'
                  }`}
                >
                  {c.outcome}
                </span>
                <span className="min-w-0 flex-1 truncate text-xs font-semibold text-dash-thi">${c.symbol}</span>
                <Link href={`/call/${c.id}`} className="text-[11px] text-dash-green hover:underline">
                  Proof
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
