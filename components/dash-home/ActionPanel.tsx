'use client'

import { useEffect, useState } from 'react'
import { Crosshair, GraduationCap, Rocket, Shield, Zap } from 'lucide-react'
import type { UnifiedSignal } from '@cryptocheck/signal-contracts'
import { namespacedSignalId } from '@cryptocheck/signal-contracts'
import { SignalSwapSheet } from '@/components/signals-dashboard/SignalSwapSheet'
import { scanResultToFactors, verdictLabel } from '@/lib/command-center/scan-factors'
import { formatAge } from '@/lib/signals-dashboard/format'
import { useActionPanel, type ActionMode } from './action-panel-context'
import { LaunchPanel } from './LaunchPanel'
import { SniperPanel } from './SniperPanel'
import { CoachPanel } from './CoachPanel'
import { isLaunchModeEnabled } from '@/lib/launch/feature-flag'

function riskWord(v: string): string {
  if (v === 'SAFE') return 'Low risk'
  if (v === 'CAUTION') return 'Elevated'
  if (v === 'DANGER') return 'High risk'
  return v
}

function factorTone(status: string): string {
  if (status === 'Pass' || status === 'OK') return 'text-dash-green'
  if (status === 'Warn') return 'text-dash-gold'
  return 'text-dash-red'
}

function ScoreRing({ value, size = 110, stroke = 6 }: { value: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(100, value)) / 100
  const color = pct >= 0.7 ? '#22C55E' : pct >= 0.4 ? '#F97316' : '#EF4444'
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1a1a1a" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeDasharray={`${c * pct} ${c}`}
        strokeLinecap="round"
      />
      <text
        x="50%"
        y="50%"
        dominantBaseline="middle"
        textAnchor="middle"
        fill="#E5E5E5"
        fontSize={size > 80 ? 18 : 12}
        fontWeight={700}
        style={{ transform: 'rotate(90deg)', transformOrigin: 'center' }}
      >
        {Math.round(value)}
      </text>
    </svg>
  )
}

function syntheticSignal(mint: string, label: string, verdict: string): UnifiedSignal {
  const v =
    verdict === 'SAFE' ? 'safe' : verdict === 'CAUTION' ? 'caution' : verdict === 'DANGER' ? 'danger' : 'scanning'
  return {
    id: namespacedSignalId('telegram', `panel:${mint}`),
    sourceTag: 'telegram',
    sourceRef: `panel:${mint}`,
    subjectType: 'token',
    label,
    type: 'mention',
    msgTimestamp: new Date().toISOString(),
    ingestTimestamp: new Date().toISOString(),
    confidence: 1,
    chain: 'solana',
    contractAddress: mint,
    tokenSymbol: label,
    verdict: v as UnifiedSignal['verdict'],
    rawPayload: { synthetic: true },
    sources: ['action-panel'],
    sourceCount: 1,
  }
}

const LAUNCH_ENABLED = isLaunchModeEnabled()

const MODES: { id: ActionMode; label: string; icon: typeof Shield; disabled?: boolean }[] = [
  { id: 'scan', label: 'Scan', icon: Shield },
  { id: 'swap', label: 'Swap', icon: Zap },
  { id: 'sniper', label: 'Sniper', icon: Crosshair },
  { id: 'coach', label: 'Coach', icon: GraduationCap },
  {
    id: 'launch',
    label: LAUNCH_ENABLED ? 'Launch' : 'Launch · Soon',
    icon: Rocket,
    disabled: !LAUNCH_ENABLED,
  },
]

function useSyncedDraft(seed: string) {
  const [v, setV] = useState(seed)
  useEffect(() => {
    setV(seed)
  }, [seed])
  return [v, setV] as const
}

/**
 * Single right-rail Action Panel — mode + token in state; Scan / Swap / Sniper / Launch never navigate away.
 */
export function ActionPanel({ onLaunched }: { onLaunched?: (mint: string) => void } = {}) {
  const { mode, setMode, mint, scan, scanning, signal, runScan, selectMint } = useActionPanel()
  const [mintDraft, setMintDraft] = useSyncedDraft(mint)
  const factors = scan ? scanResultToFactors(scan) : null

  const swapSignal: UnifiedSignal | null =
    signal?.subjectType === 'token'
      ? signal
      : mint.length >= 32 && scan
        ? syntheticSignal(mint, scan.symbol || scan.name || 'TOKEN', scan.verdict)
        : null

  return (
    <section
      id="action-panel"
      className="dash-glass sticky top-4 rounded-dash border border-dash-hairline p-4 md:p-5"
    >
      <div className="mb-4 flex gap-1 rounded-dash-chip border border-dash-innerline bg-dash-inset p-1">
        {MODES.map((m) => {
          const Icon = m.icon
          const active = mode === m.id
          return (
            <button
              key={m.id}
              type="button"
              disabled={m.disabled}
              title={m.disabled ? 'Token create coming soon — Stage 1 beta' : undefined}
              onClick={() => {
                if (m.disabled) return
                setMode(m.id)
              }}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-dash-chip px-2 py-2 text-[11px] font-bold uppercase tracking-wider transition-colors ${
                m.disabled
                  ? 'cursor-not-allowed text-dash-tlo opacity-60'
                  : active
                    ? 'bg-dash-green/15 text-dash-green'
                    : 'text-dash-tmid hover:text-dash-thi'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {m.label}
            </button>
          )
        })}
      </div>

      {mode === 'scan' ? (
        <div className="space-y-4">
          <p className="font-space text-[13px] font-semibold text-dash-sky">AI Token Scanner</p>
          <p className="text-[11px] text-dash-tmid">Neural V4 · gateway scan · stays on this panel</p>

          {scanning ? (
            <div className="flex flex-col items-center py-8">
              <div className="h-[110px] w-[110px] animate-shimmer rounded-full bg-dash-panel2" />
              <p className="mt-4 text-xs text-dash-tmid">Scanning on-chain intelligence…</p>
            </div>
          ) : scan ? (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <div className="flex flex-col items-center">
                <ScoreRing value={scan.safetyScore} size={110} stroke={6} />
                <p className="font-dash-mono mt-1 text-[11px] text-dash-tlo">/100</p>
                <p className="font-dash-mono text-[11px] uppercase text-dash-tmid">
                  {riskWord(scan.verdict)}
                </p>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] uppercase tracking-[0.14em] text-dash-tlo">AI Verdict</p>
                <p className="font-space text-base font-semibold text-dash-thi">
                  {verdictLabel(scan.verdict)}
                </p>
                <p className="font-dash-mono mt-1 truncate text-[10px] text-dash-tlo">{scan.mint}</p>
                <div className="mt-3 border-t border-dash-innerline pt-2">
                  {factors?.map((f) => (
                    <div key={f.label} className="flex items-center gap-2 py-1.5 text-xs">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-dash-green" />
                      <span className="shrink-0 text-[12px] text-dash-tmid">{f.label}</span>
                      <span className="min-w-0 flex-1 border-b border-dotted border-dash-innerline" />
                      <span className={`shrink-0 text-[12px] font-medium ${factorTone(f.status)}`}>
                        {f.status}
                      </span>
                    </div>
                  ))}
                </div>
                {signal?.subjectType === 'token' ? (
                  <dl className="mt-3 grid grid-cols-2 gap-2 border-t border-dash-innerline pt-3">
                    {(
                      [
                        ['Liquidity', signal.rawPayload?.liquidity],
                        ['Age', signal.msgTimestamp],
                        ['Holders', signal.rawPayload?.holders],
                        ['Market Cap', signal.rawPayload?.marketCap],
                      ] as const
                    ).map(([label, raw]) => (
                      <div key={label}>
                        <dt className="text-[10px] uppercase tracking-wider text-dash-tlo">{label}</dt>
                        <dd className="font-dash-mono text-[11px] text-dash-thi">
                          {label === 'Age'
                            ? formatAge(String(raw ?? ''))
                            : raw == null || raw === ''
                              ? '—'
                              : String(raw)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
                <button
                  type="button"
                  onClick={() => setMode('swap')}
                  disabled={scan.verdict === 'DANGER'}
                  className="mt-4 w-full rounded-dash-chip bg-dash-green py-2 text-xs font-bold uppercase tracking-wider text-dash-bg noro-glow-green disabled:opacity-40"
                >
                  Swap this token
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center py-6 text-center opacity-70">
              <ScoreRing value={0} size={100} stroke={6} />
              <p className="mt-4 text-sm text-dash-tmid">Scan a token to analyze</p>
            </div>
          )}

          <div className="space-y-2">
            <input
              type="text"
              value={mintDraft}
              onChange={(e) => setMintDraft(e.target.value)}
              placeholder="Paste Solana mint address…"
              className="font-dash-mono w-full rounded-dash-chip border border-dash-innerline bg-dash-inset px-3 py-2 text-xs text-dash-thi placeholder:text-dash-tlo focus:outline-none focus-visible:ring-2 focus-visible:ring-dash-green"
            />
            <button
              type="button"
              onClick={() => {
                const m = mintDraft.trim()
                if (m.length >= 32) {
                  selectMint(m, 'scan')
                  void runScan(m)
                }
              }}
              disabled={scanning || mintDraft.trim().length < 32}
              className="w-full rounded-dash-chip bg-dash-green py-2.5 text-xs font-bold uppercase tracking-wider text-dash-bg noro-glow-green transition-opacity duration-150 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Scan Any Token
            </button>
          </div>
        </div>
      ) : null}

      {mode === 'swap' ? (
        <div>
          <p className="mb-2 font-space text-[13px] font-semibold text-dash-green">Risk-gated Swap</p>
          {swapSignal ? (
            <SignalSwapSheet
              signal={swapSignal}
              open
              onClose={() => setMode('scan')}
              variant="inline"
            />
          ) : (
            <p className="rounded-dash-inner border border-dash-innerline px-3 py-6 text-center text-xs text-dash-tmid">
              Select a token from Alpha Feed or run a Scan first — then Swap opens here.
            </p>
          )}
        </div>
      ) : null}

      {mode === 'sniper' ? (
        <div className="-mx-1">
          <SniperPanel />
        </div>
      ) : null}

      {mode === 'coach' ? <CoachPanel /> : null}

      {mode === 'launch' ? (
        LAUNCH_ENABLED ? (
          <LaunchPanel onLaunched={onLaunched} />
        ) : (
          <div className="space-y-3 py-6 text-center">
            <p className="font-space text-[13px] font-semibold text-dash-sky">Launch · Coming soon</p>
            <p className="text-[11px] leading-relaxed text-dash-tmid">
              Token create is paused for Stage 1 beta until the on-chain platform PDA and a successful
              devnet launch are proven. Use Scan / Swap / Sniper in the meantime.
            </p>
          </div>
        )
      ) : null}
    </section>
  )
}
