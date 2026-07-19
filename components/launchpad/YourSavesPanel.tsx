'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import type { SavedYouRow } from '@/lib/launchpad/saved-you-types'
import { dashToast } from '@/components/dash-home/DashToast'

type SavesResponse = {
  saves: SavedYouRow[]
  stats: {
    blocks: number
    rugged: number
    survived: number
    pending: number
    saveRatePct: number | null
  }
  newestId?: string
}

export function YourSavesPanel() {
  const [data, setData] = useState<SavesResponse | null>(null)
  const [seenNewest, setSeenNewest] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/launchpad/saves', { cache: 'no-store' })
      const body = (await res.json()) as SavesResponse
      setData(body)
      const newest = body.saves[0]?.id
      if (newest && seenNewest && newest !== seenNewest) {
        const row = body.saves[0]
        dashToast(
          `We saved you — ${row.symbol ?? row.mint.slice(0, 6)} rugged · proof`,
        )
      }
      if (newest) setSeenNewest(newest)
    } catch {
      setData({
        saves: [],
        stats: { blocks: 0, rugged: 0, survived: 0, pending: 0, saveRatePct: null },
      })
    }
  }, [seenNewest])

  useEffect(() => {
    void load()
    const t = setInterval(() => void load(), 30_000)
    return () => clearInterval(t)
  }, [load])

  if (!data) {
    return <div className="h-40 animate-pulse rounded-rd-sm bg-white/5" />
  }

  const { stats, saves } = data

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ['Blocks', stats.blocks],
          ['Rugs proven', stats.rugged],
          ['Survived', stats.survived],
          ['Save rate', stats.saveRatePct != null ? `${stats.saveRatePct}%` : '—'],
        ].map(([label, val]) => (
          <div key={String(label)} className="rounded-rd-sm border border-white/10 px-3 py-2">
            <p className="text-[10px] uppercase text-rd-lo">{label}</p>
            <p className="font-rd-mono text-rd-hi">{val}</p>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-rd-lo">
        Save rate = rugs / (rugs + survived). Pending blocks are excluded. Never fabricated.
      </p>

      {saves.length === 0 ? (
        <p className="rounded-rd-sm border border-dashed border-white/15 px-4 py-8 text-center text-sm text-rd-mid">
          No proven saves yet. When a DANGER block later rugs on-chain, it appears here.
        </p>
      ) : (
        <ul className="space-y-3">
          {saves.map((s) => (
            <li
              key={s.id}
              className="rounded-rd-sm border border-white/10 bg-rd-navy2/40 px-4 py-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-rd-display text-xs font-bold uppercase text-rd-hi">
                    {s.symbol ?? s.mint.slice(0, 8)}
                  </p>
                  <p className="font-rd-mono text-[10px] text-rd-lo">{s.mint}</p>
                </div>
                <Link
                  href={`/saved/${s.id}`}
                  className="text-[10px] font-bold uppercase tracking-wider text-rd-green"
                >
                  Share card
                </Link>
              </div>
              <p className="mt-2 text-[11px] text-rd-mid">{s.outcomeEvidence}</p>
              <dl className="mt-2 grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-3">
                <div>
                  <dt className="text-rd-lo">Blocked</dt>
                  <dd className="font-rd-mono text-rd-hi">
                    {new Date(s.blockedAt).toLocaleString()}
                  </dd>
                </div>
                <div>
                  <dt className="text-rd-lo">Drawdown</dt>
                  <dd className="font-rd-mono text-rd-hi">
                    {s.drawdownPct != null ? `${s.drawdownPct}%` : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-rd-lo">Est. loss avoided</dt>
                  <dd className="font-rd-mono text-rd-caution">
                    {s.lossAvoidedEstimate != null
                      ? `~$${s.lossAvoidedEstimate.toFixed(2)} (estimate)`
                      : '—'}
                  </dd>
                </div>
              </dl>
              {s.explorerUrl ? (
                <a
                  href={s.explorerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block text-[10px] text-rd-green underline"
                >
                  Explorer proof
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
