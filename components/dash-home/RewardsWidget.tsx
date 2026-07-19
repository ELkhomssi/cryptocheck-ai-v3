'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, Gift } from 'lucide-react'
import { dashToast } from './DashToast'

const PRIZES = [
  { id: 'sol', label: '1 SOL credit (engagement)', weight: 1 },
  { id: 'credit', label: '+1 Scan Credit', weight: 3 },
  { id: 'sniper', label: 'Free AI Sniper day', weight: 2 },
  { id: 'luck', label: 'Better luck next time', weight: 3 },
  { id: 'alpha', label: 'Alpha tip unlock', weight: 1 },
] as const

const COOLDOWN_KEY = 'ccai:rewards:lastSpin'
const LAST_PRIZE_KEY = 'ccai:rewards:lastPrize'

function pickPrize() {
  const total = PRIZES.reduce((s, p) => s + p.weight, 0)
  let r = Math.random() * total
  for (const p of PRIZES) {
    r -= p.weight
    if (r <= 0) return p
  }
  return PRIZES[0]!
}

function readCooldownMs(): number | null {
  try {
    const raw = localStorage.getItem(COOLDOWN_KEY)
    if (!raw) return null
    const n = Number(raw)
    return Number.isFinite(n) ? n : null
  } catch {
    return null
  }
}

function canSpinLocal(): boolean {
  const last = readCooldownMs()
  if (last == null) return true
  return Date.now() - last >= 24 * 60 * 60 * 1000
}

function hoursLeft(): number {
  const last = readCooldownMs()
  if (last == null) return 0
  return Math.max(0, Math.ceil((24 * 60 * 60 * 1000 - (Date.now() - last)) / 3_600_000))
}

/**
 * Compact engagement Rewards widget — themed to NORO dash tokens.
 * Free spins only (local 24h cooldown). In-panel result + toast — no route / no pay-to-spin.
 */
export function RewardsWidget() {
  const [open, setOpen] = useState(true)
  const [spinning, setSpinning] = useState(false)
  const [result, setResult] = useState<string | null>(() => {
    try {
      return localStorage.getItem(LAST_PRIZE_KEY)
    } catch {
      return null
    }
  })
  const [cooldownH, setCooldownH] = useState(0)

  const oddsLine = useMemo(() => {
    const total = PRIZES.reduce((s, x) => s + x.weight, 0)
    return PRIZES.map((p) => `${p.label} (~${Math.round((p.weight / total) * 100)}%)`).join(' · ')
  }, [])

  const onSpin = () => {
    if (spinning) return
    if (!canSpinLocal()) {
      const hrs = hoursLeft()
      setCooldownH(hrs)
      const msg = `Next free spin in ~${hrs}h`
      setResult(msg)
      dashToast(msg)
      return
    }
    setSpinning(true)
    setResult(null)
    window.setTimeout(() => {
      const prize = pickPrize()
      const line = `You won · ${prize.label}`
      try {
        localStorage.setItem(COOLDOWN_KEY, String(Date.now()))
        localStorage.setItem(LAST_PRIZE_KEY, line)
      } catch {
        /* ignore */
      }
      setSpinning(false)
      setResult(line)
      setCooldownH(24)
      dashToast(`Rewards · ${prize.label}`)
    }, 900)
  }

  return (
    <section id="rewards" className="dash-glass rounded-dash border border-dash-hairline">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
        aria-expanded={open}
      >
        <span className="inline-flex items-center gap-2 font-space text-[13px] font-semibold text-dash-green">
          <Gift className="h-4 w-4" />
          Rewards · Spin
        </span>
        <ChevronDown
          className={`h-4 w-4 text-dash-tlo transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open ? (
        <div className="border-t border-dash-innerline px-4 py-3">
          <p className="text-[11px] text-dash-tmid">
            Engagement rewards · free spin · no purchase · not a wager
          </p>

          <div
            className={`mx-auto mt-3 flex h-24 w-24 items-center justify-center rounded-full border-2 border-dash-green/40 bg-dash-inset ${
              spinning ? 'animate-spin border-dashed' : ''
            }`}
            aria-hidden
          >
            <Gift className={`h-8 w-8 text-dash-green ${spinning ? 'opacity-60' : ''}`} />
          </div>

          <button
            type="button"
            onClick={onSpin}
            disabled={spinning}
            className="mt-3 w-full rounded-dash-chip bg-dash-green py-2 text-xs font-bold uppercase tracking-wider text-dash-bg noro-glow-green disabled:opacity-50"
          >
            {spinning ? 'Spinning…' : canSpinLocal() ? 'Spin · Free' : `Cooldown · ~${cooldownH || hoursLeft()}h`}
          </button>

          {result ? (
            <p
              className="mt-3 rounded-dash-chip border border-dash-green/30 bg-dash-green/10 px-3 py-2 text-center text-[12px] font-semibold text-dash-green"
              role="status"
            >
              {result}
            </p>
          ) : null}

          <p className="mt-2 text-[10px] leading-relaxed text-dash-tlo">{oddsLine}</p>
          <a
            href="/terms"
            className="mt-2 inline-block text-[10px] font-semibold text-dash-green hover:underline"
          >
            Rewards terms
          </a>
        </div>
      ) : null}
    </section>
  )
}
