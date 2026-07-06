'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { CheckCircle2, ShieldAlert, X } from 'lucide-react'
import type { Decision, VerifyResult } from '@cryptocheck/signal-contracts'

type Props = {
  open: boolean
  decision: Decision | null
  result: VerifyResult | null
  loading: boolean
  onClose: () => void
}

function explorerHref(tx?: string, url?: string): string | null {
  if (url) return url
  if (!tx || tx.startsWith('paper:')) return null
  return `https://explorer.solana.com/tx/${tx}`
}

type Step = 'packet' | 'hash' | 'commitment' | 'result'

export function VerifyProofModal({ open, decision, result, loading, onClose }: Props) {
  const reduce = useReducedMotion()
  const [step, setStep] = useState<Step>('packet')

  useEffect(() => {
    if (!open) {
      setStep('packet')
      return
    }
    if (loading || !result) {
      setStep('packet')
      const t1 = window.setTimeout(() => setStep('hash'), reduce ? 0 : 450)
      const t2 = window.setTimeout(() => setStep('commitment'), reduce ? 0 : 900)
      return () => {
        window.clearTimeout(t1)
        window.clearTimeout(t2)
      }
    }
    setStep('result')
  }, [open, loading, result, reduce])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open || !decision) return null

  const proof = decision.proof
  const href = explorerHref(proof?.txSignature, proof?.explorerUrl)
  const packetPreview = JSON.stringify(
    {
      matchId: decision.matchId,
      signalId: decision.signalId,
      dataHash: decision.dataHash.slice(0, 16) + '…',
      market: decision.market,
    },
    null,
    2,
  )

  const ok = result?.ok === true

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="verify-title"
            className="relative z-10 w-full max-w-lg overflow-hidden rounded-rd-lg border border-rd-green/25 bg-rd-navy2 shadow-[0_0_60px_rgba(63,224,90,0.12)]"
            initial={reduce ? false : { opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? undefined : { opacity: 0, y: 8 }}
            transition={{ duration: 0.22 }}
          >
            <div className="flex items-start justify-between border-b border-white/10 px-4 py-3">
              <div>
                <p className="rd-label text-rd-lime">Proof vault</p>
                <h2
                  id="verify-title"
                  className="font-rd-display text-sm font-bold uppercase tracking-wider text-rd-hi"
                >
                  Verify commitment
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-rd-sm p-2 text-rd-mid hover:bg-white/10 hover:text-rd-hi focus:outline-none focus-visible:ring-2 focus-visible:ring-rd-green/50"
                aria-label="Close verify modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 p-4">
              <StepCard
                active={step === 'packet' || step === 'hash' || step === 'commitment' || step === 'result'}
                label="1 · Stored TxODDS packet"
                done={step !== 'packet'}
              >
                <pre className="max-h-24 overflow-auto rounded border border-white/10 bg-rd-navy/80 p-2 font-rd-mono text-[0.6rem] leading-relaxed text-rd-mid">
                  {packetPreview}
                </pre>
              </StepCard>

              <StepCard
                active={step === 'hash' || step === 'commitment' || step === 'result'}
                label="2 · Data hash"
                done={step === 'commitment' || step === 'result'}
              >
                <p className="break-all font-rd-mono text-[0.65rem] tabular-nums text-rd-green">
                  {step === 'packet' ? (
                    <span className="text-rd-lo motion-safe:animate-pulse">resolving…</span>
                  ) : (
                    decision.dataHash
                  )}
                </p>
              </StepCard>

              <StepCard
                active={step === 'commitment' || step === 'result'}
                label="3 · On-chain commitment"
                done={step === 'result'}
              >
                <p className="break-all font-rd-mono text-[0.65rem] tabular-nums text-rd-lime">
                  {step === 'packet' || step === 'hash' ? (
                    <span className="text-rd-lo motion-safe:animate-pulse">resolving…</span>
                  ) : (
                    proof?.commitmentHash ?? '—'
                  )}
                </p>
                <p className="mt-1 font-rd-mono text-[0.55rem] text-rd-lo">
                  {proof?.txSignature?.startsWith('paper:')
                    ? `paper:${proof.txSignature.slice(6, 22)}…`
                    : proof?.txSignature
                      ? `tx ${proof.txSignature.slice(0, 20)}…`
                      : 'indexed commitment'}
                </p>
              </StepCard>

              {step === 'result' && result ? (
                <motion.div
                  initial={reduce ? false : { opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`flex items-start gap-3 rounded-rd-md border px-4 py-3 ${
                    ok
                      ? 'border-rd-safe/50 bg-rd-safe/10 shadow-[0_0_24px_rgba(63,224,90,0.15)]'
                      : 'border-rd-danger/50 bg-rd-danger/10'
                  }`}
                >
                  {ok ? (
                    <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-rd-safe" aria-hidden />
                  ) : (
                    <ShieldAlert className="mt-0.5 h-6 w-6 shrink-0 text-rd-danger" aria-hidden />
                  )}
                  <div>
                    <p
                      className={`font-rd-display text-sm font-bold uppercase tracking-[0.12em] ${
                        ok ? 'text-rd-safe' : 'text-rd-danger'
                      }`}
                    >
                      {ok ? 'Match ✓ Tamper-evident' : 'Mismatch — proof failed'}
                    </p>
                    <p className="mt-1 text-xs text-rd-mid">
                      {ok
                        ? 'Packet hash and commitment align. The agent saw this data and made this call.'
                        : 'Stored packet or commitment does not match. Details logged for operators.'}
                    </p>
                    {href ? (
                      <a
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-flex font-rd-display text-[0.55rem] font-bold uppercase tracking-wider text-rd-green underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-rd-green/50"
                      >
                        Open Solana explorer
                      </a>
                    ) : (
                      <p className="mt-2 font-rd-mono text-[0.6rem] text-rd-lo">
                        Paper proof — index is source of truth (no live Memo tx)
                      </p>
                    )}
                  </div>
                </motion.div>
              ) : loading || step !== 'result' ? (
                <p className="text-center font-rd-display text-[0.55rem] font-bold uppercase tracking-wider text-rd-lo motion-safe:animate-pulse">
                  Walking proof chain…
                </p>
              ) : null}
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  )
}

function StepCard({
  active,
  done,
  label,
  children,
}: {
  active: boolean
  done: boolean
  label: string
  children: React.ReactNode
}) {
  return (
    <div
      className={`rounded-rd-sm border px-3 py-2 transition-colors ${
        active
          ? done
            ? 'border-rd-green/30 bg-rd-green/[0.04]'
            : 'border-white/15 bg-rd-navy/60'
          : 'border-white/5 bg-transparent opacity-40'
      }`}
    >
      <p className="rd-label mb-1.5 text-[0.5rem]">{label}</p>
      {active ? children : <div className="h-4" />}
    </div>
  )
}
