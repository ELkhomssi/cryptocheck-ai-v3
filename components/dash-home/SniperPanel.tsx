'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { VersionedTransaction } from '@solana/web3.js'
import { Crown, Loader2, ShieldCheck, TriangleAlert, Zap } from 'lucide-react'
import type { SnipeCandidate } from '@cryptocheck/signal-contracts'

type CandidatesResponse = {
  authenticated: boolean
  fullAccess: boolean
  armed: boolean
  candidates: SnipeCandidate[]
}

type RowStatus = 'idle' | 'building' | 'needsConfirm' | 'signing' | 'confirming' | 'done' | 'error'
type RowState = { status: RowStatus; message?: string; signature?: string }

const AMOUNT_PRESETS_SOL = [0.1, 0.25, 0.5, 1] as const

/** Safety ceiling: max auto-executed snipes per browser session. */
const AUTO_SESSION_CAP = 10

function verdictTone(verdict: string): string {
  if (verdict === 'SAFE') return 'bg-dash-greenDim text-dash-green'
  if (verdict === 'CAUTION') return 'bg-dash-amber/20 text-dash-amber'
  return 'bg-dash-red/20 text-dash-red'
}

export function SniperPanel() {
  const { connection } = useConnection()
  const wallet = useWallet()

  const [data, setData] = useState<CandidatesResponse | null>(null)
  const [amountSol, setAmountSol] = useState<number>(0.25)
  const [arming, setArming] = useState(false)
  const [rows, setRows] = useState<Record<string, RowState>>({})
  const [autoCount, setAutoCount] = useState(0)

  // Candidate ids already handled by auto-mode (seeded on arm so the existing
  // backlog is never retroactively sniped) + a serialization lock.
  const autoSeenRef = useRef<Set<string>>(new Set())
  const autoBusyRef = useRef(false)

  const setRow = useCallback((id: string, state: RowState) => {
    setRows((prev) => ({ ...prev, [id]: state }))
  }, [])

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/signals/snipe/candidates', { cache: 'no-store' })
      const body = (await res.json()) as CandidatesResponse
      setData(body)
    } catch {
      // leave prior state; poll will retry
    }
  }, [])

  useEffect(() => {
    void load()
    const t = setInterval(() => void load(), 15_000)
    return () => clearInterval(t)
  }, [load])

  const fullAccess = data?.fullAccess ?? false
  const armed = data?.armed ?? false
  const candidates = useMemo(() => data?.candidates ?? [], [data])

  const toggleArm = useCallback(async () => {
    if (!fullAccess || arming) return
    setArming(true)
    try {
      const res = await fetch('/api/signals/snipe/arm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ armed: !armed }),
      })
      const body = await res.json()
      if (res.ok) setData((prev) => (prev ? { ...prev, armed: Boolean(body?.arm?.armed) } : prev))
    } catch {
      // no-op; UI stays on prior state
    } finally {
      setArming(false)
    }
  }, [fullAccess, arming, armed])

  const flashSnipe = useCallback(
    async (c: SnipeCandidate, confirm = false) => {
      if (!wallet.publicKey || !wallet.signTransaction) {
        setRow(c.id, { status: 'error', message: 'Connect a wallet first' })
        return
      }
      setRow(c.id, { status: 'building' })
      try {
        const res = await fetch('/api/signals/snipe/build-swap', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mint: c.mint,
            amountSol,
            slippageBps: 100,
            userPublicKey: wallet.publicKey.toBase58(),
            signalId: c.id,
            symbol: c.symbol,
            confirm,
          }),
        })
        const body = await res.json()

        if (res.status === 403) {
          // Two shapes: risk-block ({ decision }) vs entitlement gate (scan error payload).
          const msg =
            body?.decision?.blockedReason ??
            (typeof body?.error === 'string' ? body.error : body?.error?.message) ??
            'Pro required — upgrade to snipe'
          setRow(c.id, { status: 'error', message: msg })
          return
        }
        if (res.status === 409) {
          setRow(c.id, { status: 'needsConfirm', message: 'High risk — confirm to proceed' })
          return
        }
        if (!res.ok || !body?.swapTransaction) {
          throw new Error(body?.error ?? 'Failed to build swap')
        }

        // Non-custodial: server returns an UNSIGNED tx; the wallet signs & sends.
        setRow(c.id, { status: 'signing' })
        const tx = VersionedTransaction.deserialize(Buffer.from(body.swapTransaction, 'base64'))
        const signed = await wallet.signTransaction(tx)

        setRow(c.id, { status: 'confirming' })
        const sig = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: false })
        await connection.confirmTransaction(sig, 'confirmed')

        await fetch('/api/signals/snipe/record', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mint: c.mint,
            txSignature: sig,
            signalId: c.id,
            symbol: c.symbol,
            neuralScore: c.neuralScore,
            verdict: c.verdict,
          }),
        }).catch(() => undefined)

        setRow(c.id, { status: 'done', signature: sig })
      } catch (e) {
        setRow(c.id, { status: 'error', message: e instanceof Error ? e.message : 'Snipe failed' })
      }
    },
    [wallet, connection, amountSol, setRow],
  )

  // On arm: seed the "seen" set with the current backlog so Full Auto only
  // fires on NEW candidates. On disarm: reset the session.
  useEffect(() => {
    if (armed) {
      for (const c of candidates) autoSeenRef.current.add(c.id)
    } else {
      autoSeenRef.current.clear()
      autoBusyRef.current = false
      setAutoCount(0)
    }
    // Intentionally keyed on `armed` only — seeding uses the backlog at arm time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [armed])

  // Full Auto: one new candidate at a time. Non-custodial — each still needs a
  // Phantom approval, and high-risk (409) is left for manual confirm.
  useEffect(() => {
    if (!armed || !wallet.connected) return
    if (autoBusyRef.current) return
    if (autoCount >= AUTO_SESSION_CAP) return
    const next = candidates.find((c) => !autoSeenRef.current.has(c.id))
    if (!next) return
    autoSeenRef.current.add(next.id)
    autoBusyRef.current = true
    setAutoCount((n) => n + 1)
    void flashSnipe(next, false).finally(() => {
      autoBusyRef.current = false
    })
  }, [candidates, armed, wallet.connected, autoCount, flashSnipe])

  const autoCapReached = armed && autoCount >= AUTO_SESSION_CAP

  return (
    <section className="rounded-dash border border-dash-hairline bg-dash-panel p-4 md:p-5">
      <header className="mb-3 flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <Zap className="mt-0.5 h-4 w-4 text-dash-green" />
          <div>
            <p className="text-[13px] font-semibold text-dash-green">AI SNIPER</p>
            <p className="text-[11px] text-dash-tmid">Scanned · kill-switch · you sign</p>
          </div>
        </div>

        {fullAccess ? (
          <button
            type="button"
            onClick={() => void toggleArm()}
            disabled={arming}
            aria-pressed={armed}
            className={`inline-flex items-center gap-1.5 rounded-dash-chip border px-3 py-1.5 text-[11px] font-semibold transition-colors duration-150 disabled:opacity-50 ${
              armed
                ? 'border-dash-green/50 bg-dash-greenDim text-dash-green'
                : 'border-dash-innerline text-dash-tmid hover:text-dash-thi'
            }`}
          >
            {arming ? (
              <Loader2 className="h-3.5 w-3.5 motion-safe:animate-spin" />
            ) : (
              <ShieldCheck className="h-3.5 w-3.5" />
            )}
            {armed ? 'Auto-Snipe On' : 'Arm Auto-Snipe'}
          </button>
        ) : (
          <Link
            href="/app/upgrade"
            className="inline-flex items-center gap-1.5 rounded-dash-chip border border-dash-gold/50 px-3 py-1.5 text-[11px] font-semibold text-dash-gold transition-colors duration-150 hover:border-dash-gold"
          >
            <Crown className="h-3.5 w-3.5" />
            Upgrade
          </Link>
        )}
      </header>

      {armed ? (
        <div className="mb-3 flex items-center justify-between rounded-dash-inner border border-dash-green/30 bg-dash-greenDim px-3 py-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-dash-green">
            {autoCapReached ? 'Session cap reached' : 'Auto-sniping new launches'}
          </span>
          <span className="font-dash-mono text-[10px] tabular-nums text-dash-green">
            {autoCount}/{AUTO_SESSION_CAP}
          </span>
        </div>
      ) : null}

      {/* Amount presets (SOL) */}
      <div className="mb-3 flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-wider text-dash-tlo">Size</span>
        <div className="flex flex-wrap gap-1.5">
          {AMOUNT_PRESETS_SOL.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setAmountSol(n)}
              className={`font-dash-mono rounded-dash-chip px-2.5 py-1 text-[11px] tabular-nums transition-colors duration-150 ${
                amountSol === n
                  ? 'bg-dash-green text-dash-bg'
                  : 'border border-dash-innerline text-dash-tmid hover:text-dash-thi'
              }`}
            >
              {n} SOL
            </button>
          ))}
        </div>
      </div>

      {!data ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-14 animate-shimmer rounded-dash-inner bg-dash-panel2" />
          ))}
        </div>
      ) : candidates.length === 0 ? (
        <div className="rounded-dash-inner border border-dashed border-dash-innerline px-4 py-8 text-center">
          <p className="text-xs text-dash-tmid">
            No live snipe candidates. The sniper surfaces safe, high-conviction launches here in real time.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {candidates.map((c) => {
            const row = rows[c.id] ?? { status: 'idle' as RowStatus }
            const busy =
              row.status === 'building' || row.status === 'signing' || row.status === 'confirming'
            return (
              <li
                key={c.id}
                className="rounded-dash-inner border border-dash-innerline bg-dash-panel2 px-3 py-2.5"
              >
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-dash-greenDeep font-dash-mono text-[11px] font-bold tabular-nums text-dash-green">
                    {Math.round(c.neuralScore)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-[13px] font-semibold text-dash-thi">${c.symbol}</p>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${verdictTone(c.verdict)}`}
                      >
                        {c.verdict}
                      </span>
                    </div>
                    <p className="font-dash-mono truncate text-[10px] text-dash-tlo">
                      {c.mint.slice(0, 10)}… · {c.sourceTag}
                    </p>
                  </div>
                  {!fullAccess ? (
                    <Link
                      href="/app/upgrade"
                      className="inline-flex shrink-0 items-center gap-1 rounded-dash-chip border border-dash-gold/50 px-3 py-1.5 text-[11px] font-bold text-dash-gold transition-colors duration-150 hover:border-dash-gold"
                    >
                      <Crown className="h-3 w-3" />
                      Pro
                    </Link>
                  ) : (
                  <button
                    type="button"
                    onClick={() => void flashSnipe(c, row.status === 'needsConfirm')}
                    disabled={busy || row.status === 'done' || !wallet.connected}
                    className={`inline-flex shrink-0 items-center gap-1 rounded-dash-chip px-3 py-1.5 text-[11px] font-bold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50 ${
                      row.status === 'needsConfirm'
                        ? 'bg-dash-amber text-dash-bg hover:opacity-90'
                        : 'bg-dash-green text-dash-bg hover:bg-dash-greenHi'
                    }`}
                  >
                    {busy ? (
                      <Loader2 className="h-3 w-3 motion-safe:animate-spin" />
                    ) : row.status === 'needsConfirm' ? (
                      <TriangleAlert className="h-3 w-3" />
                    ) : (
                      <Zap className="h-3 w-3" />
                    )}
                    {row.status === 'building'
                      ? 'Building'
                      : row.status === 'signing'
                        ? 'Sign'
                        : row.status === 'confirming'
                          ? 'Sending'
                          : row.status === 'done'
                            ? 'Sniped'
                            : row.status === 'needsConfirm'
                              ? 'Confirm'
                              : 'Flash Snipe'}
                  </button>
                  )}
                </div>

                {fullAccess && !wallet.connected ? (
                  <p className="mt-1.5 text-[10px] text-dash-tlo">Connect a wallet to snipe.</p>
                ) : row.status === 'done' && row.signature ? (
                  <p className="font-dash-mono mt-1.5 text-[10px] text-dash-green">
                    Confirmed · {row.signature.slice(0, 12)}…
                  </p>
                ) : row.status === 'error' ? (
                  <p className="mt-1.5 text-[10px] text-dash-red" role="alert">
                    {row.message}
                  </p>
                ) : row.status === 'needsConfirm' ? (
                  <p className="mt-1.5 text-[10px] text-dash-amber">{row.message}</p>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}

      <p className="mt-3 text-[10px] leading-relaxed text-dash-tlo">
        Non-custodial — your wallet signs every swap. Informational, not financial advice · DYOR.
      </p>
    </section>
  )
}
