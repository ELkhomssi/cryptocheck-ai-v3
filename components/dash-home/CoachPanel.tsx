'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useActionPanel } from './action-panel-context'
import { dashToast } from './DashToast'
import type { CoachInsight, WatchDegradeEvent } from '@/lib/personal-watch/constants'

type CoachPayload = {
  premium: boolean
  upgradeHint: string | null
  weekly: { line: string; savesThisWeek: number; patternsFlagged: number; degradeAlertsThisWeek: number }
  alerts: WatchDegradeEvent[]
  insights: CoachInsight[]
  insightEmptyReason: string | null
  tradeCount: number
  saves: Array<{
    id: string
    mint: string
    symbol: string | null
    graded_at: string
    outcome_evidence: string
    loss_avoided_estimate: number | null
    explorer_url: string | null
  }>
}

export function CoachPanel() {
  const { selectMint } = useActionPanel()
  const [data, setData] = useState<CoachPayload | null>(null)
  const [openInsight, setOpenInsight] = useState<string | null>(null)
  const [seenAlert, setSeenAlert] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/coach/summary', { cache: 'no-store' })
      if (!res.ok) {
        setData(null)
        return
      }
      const body = (await res.json()) as CoachPayload
      setData(body)
      const newest = body.alerts[0]?.id
      if (newest && seenAlert && newest !== seenAlert) {
        const a = body.alerts[0]!
        dashToast(`Watch: ${a.newVerdict} · ${a.reason.slice(0, 80)}`)
      }
      if (newest) setSeenAlert(newest)
    } catch {
      setData(null)
    }
  }, [seenAlert])

  useEffect(() => {
    void load()
    const t = setInterval(() => void load(), 45_000)
    return () => clearInterval(t)
  }, [load])

  if (!data) {
    return (
      <div className="space-y-3 py-4">
        <div className="h-8 animate-shimmer rounded-dash-chip bg-dash-panel2" />
        <p className="text-xs text-dash-tmid">Loading Your Coach…</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="font-space text-[13px] font-semibold text-dash-sky">Your Coach</p>
        <p className="text-[11px] text-dash-tmid">
          Personal watch alerts · patterns from your FeeRecords · Saved-You proofs
        </p>
        <p className="mt-2 rounded-dash-chip border border-dash-innerline bg-dash-inset px-3 py-2 font-dash-mono text-[11px] text-dash-thi">
          {data.weekly.line}
        </p>
        <p className="mt-1 text-[10px] text-dash-tlo">Every number is from your real rows — never fabricated.</p>
      </div>

      {!data.premium && data.upgradeHint ? (
        <p className="rounded-dash-chip border border-dash-gold/30 bg-dash-gold/10 px-3 py-2 text-[11px] text-dash-gold">
          {data.upgradeHint}{' '}
          <Link href="/app/upgrade" className="underline">
            Upgrade
          </Link>
        </p>
      ) : null}

      <section>
        <p className="mb-2 text-[10px] uppercase tracking-[0.14em] text-dash-tlo">Recent watch alerts</p>
        {data.alerts.length === 0 ? (
          <p className="rounded-dash-chip border border-dashed border-dash-innerline px-3 py-4 text-center text-[11px] text-dash-tmid">
            No watch alerts yet. Add tokens to Watchlist or run a Portfolio scan — we re-check unique
            mints on an interval and only alert on real degradations.
          </p>
        ) : (
          <ul className="space-y-2">
            {data.alerts.map((a) => (
              <li
                key={a.id}
                className="rounded-dash-chip border border-dash-innerline bg-dash-inset px-3 py-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-dash-mono text-[10px] text-dash-tlo">
                    {a.prevVerdict} → <span className="text-dash-red">{a.newVerdict}</span>
                  </span>
                  <span className="text-[10px] text-dash-tlo">{new Date(a.ts).toLocaleString()}</span>
                </div>
                <p className="mt-1 text-[11px] text-dash-thi">{a.reason}</p>
                <p className="font-dash-mono mt-1 truncate text-[10px] text-dash-tlo">{a.mint}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => selectMint(a.mint, 'scan')}
                    className="rounded-dash-chip border border-dash-green/40 px-2 py-1 text-[10px] font-bold uppercase text-dash-green"
                  >
                    Open scan
                  </button>
                  {a.held ? (
                    <button
                      type="button"
                      onClick={() => selectMint(a.mint, 'swap')}
                      className="rounded-dash-chip bg-dash-green px-2 py-1 text-[10px] font-bold uppercase text-dash-bg"
                    >
                      Swap to safety
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <p className="mb-2 text-[10px] uppercase tracking-[0.14em] text-dash-tlo">
          Patterns from your trades ({data.tradeCount} FeeRecords)
        </p>
        {data.insights.length === 0 ? (
          <p className="rounded-dash-chip border border-dashed border-dash-innerline px-3 py-4 text-center text-[11px] text-dash-tmid">
            {data.insightEmptyReason ?? 'No pattern yet.'}
          </p>
        ) : (
          <ul className="space-y-2">
            {data.insights.map((ins) => (
              <li key={ins.id} className="rounded-dash-chip border border-dash-innerline px-3 py-2">
                <p className="text-[12px] text-dash-thi">{ins.summary}</p>
                <button
                  type="button"
                  onClick={() => setOpenInsight(openInsight === ins.id ? null : ins.id)}
                  className="mt-2 text-[10px] font-bold uppercase tracking-wider text-dash-sky"
                >
                  {openInsight === ins.id ? 'Hide trades' : `Show ${ins.citedTrades.length} trades`}
                </button>
                {openInsight === ins.id ? (
                  <ul className="mt-2 space-y-1 border-t border-dash-innerline pt-2">
                    {ins.citedTrades.map((t) => (
                      <li key={t.feeRecordId} className="font-dash-mono text-[10px] text-dash-tmid">
                        <a
                          href={`https://solscan.io/tx/${t.signature}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-dash-sky underline"
                        >
                          {t.signature.slice(0, 8)}…
                        </a>{' '}
                        · {t.entryVerdict} · ${t.volumeUsd.toFixed(2)} ·{' '}
                        {new Date(t.executedAt).toLocaleString()}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <p className="mb-2 text-[10px] uppercase tracking-[0.14em] text-dash-tlo">Saved-You</p>
        {data.saves.length === 0 ? (
          <p className="rounded-dash-chip border border-dashed border-dash-innerline px-3 py-4 text-center text-[11px] text-dash-tmid">
            No proven saves yet. Watch DANGER alerts feed the same Saved-You engine as swap/snipe
            blocks.
          </p>
        ) : (
          <ul className="space-y-2">
            {data.saves.map((s) => (
              <li key={s.id} className="rounded-dash-chip border border-dash-innerline px-3 py-2">
                <Link href={`/saved/${s.id}`} className="text-[12px] font-semibold text-dash-green">
                  {s.symbol ?? s.mint.slice(0, 6)} · proof
                </Link>
                <p className="mt-1 text-[10px] text-dash-tmid">{s.outcome_evidence}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
