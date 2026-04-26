'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import {
  CRYPTOCHECK_ACCESS_KEY_SYSTEM_EVENT,
  readCryptocheckAccessKeyFromLocalStorage,
} from '@/lib/auth/cryptocheck-access-key'
import { loadEncryptedKey, maskKey } from '@/lib/crypto/client-key-store'

type VerifyOk = {
  keyTier: 'v1' | 'v2'
  keyName: string
  subscriptionTier: 'FREE' | 'PRO' | 'ENTERPRISE'
  rateLimit: { maxRequests: number; windowSeconds: number }
}

function isVerifyOk(j: unknown): j is VerifyOk {
  if (!j || typeof j !== 'object') return false
  const o = j as Record<string, unknown>
  if (o.valid !== true) return false
  if (o.keyTier !== 'v1' && o.keyTier !== 'v2') return false
  if (typeof o.keyName !== 'string') return false
  if (o.subscriptionTier !== 'FREE' && o.subscriptionTier !== 'PRO' && o.subscriptionTier !== 'ENTERPRISE')
    return false
  const rl = o.rateLimit
  if (!rl || typeof rl !== 'object') return false
  const r = rl as Record<string, unknown>
  return typeof r.maxRequests === 'number' && typeof r.windowSeconds === 'number'
}

type Props = { variant?: 'dashboard' | 'pro' }

export function GlobalAccessKeyDiagnostics({ variant = 'dashboard' }: Props) {
  const [flatPresent, setFlatPresent] = useState(false)
  const [vaultPresent, setVaultPresent] = useState(false)
  const [phase, setPhase] = useState<'idle' | 'checking' | 'ok' | 'no_key' | 'error'>('idle')
  const [masked, setMasked] = useState('')
  const [verified, setVerified] = useState<VerifyOk | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [lastCheck, setLastCheck] = useState<string | null>(null)

  const runCheck = useCallback(async () => {
    const flat = readCryptocheckAccessKeyFromLocalStorage()
    const enc = await loadEncryptedKey().catch(() => null)
    const material = (flat || enc || '').trim()

    setFlatPresent(Boolean(flat))
    setVaultPresent(Boolean(enc?.trim()))

    if (!material) {
      setPhase('no_key')
      setMasked('')
      setVerified(null)
      setErrorMsg(null)
      setLastCheck(new Date().toLocaleString())
      return
    }

    setMasked(maskKey(material))
    setPhase('checking')
    setErrorMsg(null)

    try {
      const r = await fetch('/api/v1/keys/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: material }),
      })
      const j = (await r.json().catch(() => ({}))) as unknown
      if (!r.ok) {
        const err =
          j && typeof j === 'object' && 'error' in j && typeof (j as { error?: unknown }).error === 'string'
            ? (j as { error: string }).error
            : 'Verification failed'
        setPhase('error')
        setVerified(null)
        setErrorMsg(err)
        setLastCheck(new Date().toLocaleString())
        return
      }
      if (!isVerifyOk(j)) {
        setPhase('error')
        setVerified(null)
        setErrorMsg('Unexpected verify response')
        setLastCheck(new Date().toLocaleString())
        return
      }
      setPhase('ok')
      setVerified(j)
      setLastCheck(new Date().toLocaleString())
    } catch {
      setPhase('error')
      setVerified(null)
      setErrorMsg('Network error')
      setLastCheck(new Date().toLocaleString())
    }
  }, [])

  useEffect(() => {
    void runCheck()
    const onRefresh = () => void runCheck()
    window.addEventListener(CRYPTOCHECK_ACCESS_KEY_SYSTEM_EVENT, onRefresh)
    window.addEventListener('storage', onRefresh)
    const onVis = () => {
      if (document.visibilityState === 'visible') void runCheck()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.removeEventListener(CRYPTOCHECK_ACCESS_KEY_SYSTEM_EVENT, onRefresh)
      window.removeEventListener('storage', onRefresh)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [runCheck])

  const shell =
    variant === 'pro'
      ? 'rounded-xl border border-emerald-500/20 bg-black/35 px-3 py-2.5 text-[11px] text-slate-300 backdrop-blur-sm'
      : 'rounded-xl border border-white/[0.08] bg-slate-950/70 px-3 py-2.5 font-mono-terminal text-[11px] text-slate-300 shadow-[0_0_20px_rgba(0,212,170,0.04)] backdrop-blur-sm'

  return (
    <div className={`mb-4 ${shell}`} role="region" aria-label="CryptoCheck AI global access key diagnostics">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-white/5 pb-1.5">
        <span className="font-space text-[0.58rem] font-bold uppercase tracking-[0.2em] text-emerald-400/90">
          CryptoCheck AI — Global access key system
        </span>
        {lastCheck ? (
          <span className="text-[10px] uppercase tracking-wider text-slate-500">Last check · {lastCheck}</span>
        ) : null}
      </div>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] leading-relaxed">
        <span>
          <span className="text-slate-500">Stores</span>{' '}
          <span className="font-semibold text-slate-200">
            flat <span className={flatPresent ? 'text-emerald-300' : 'text-slate-500'}>{flatPresent ? 'on' : 'off'}</span>
            {' · '}
            terminal vault <span className={vaultPresent ? 'text-emerald-300' : 'text-slate-500'}>{vaultPresent ? 'on' : 'off'}</span>
          </span>
        </span>
        <span className="hidden h-3 w-px bg-white/10 sm:inline" />
        <span>
          <span className="text-slate-500">Verify API</span>{' '}
          <span className="font-semibold text-slate-200">
            {phase === 'checking' ? (
              <span className="text-cyan-300/90">checking…</span>
            ) : phase === 'ok' ? (
              <span className="text-emerald-300">ok</span>
            ) : phase === 'error' ? (
              <span className="text-rose-300">failed</span>
            ) : phase === 'no_key' ? (
              <span className="text-slate-500">n/a</span>
            ) : (
              <span className="text-slate-500">—</span>
            )}
          </span>
        </span>
      </div>

      {phase === 'no_key' ? (
        <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
          No customer API key detected (`cc_live_…` or `cc_sentinel_2_…`).{' '}
          <Link href="/dashboard/intelligence-terminal" className="font-semibold text-[#00d4aa] underline-offset-2 hover:underline">
            Enter your key in the Analysis Console
          </Link>{' '}
          — it unlocks scans and Pro routes across CryptoCheck AI.
        </p>
      ) : null}

      {phase === 'error' && errorMsg ? (
        <p className="mt-2 text-[11px] text-rose-300/95" role="status">
          {errorMsg}
        </p>
      ) : null}

      {phase === 'ok' && verified ? (
        <div className="mt-2 grid gap-1 text-[11px] leading-relaxed text-slate-300 sm:grid-cols-2">
          <p>
            <span className="text-slate-500">Credential</span>{' '}
            <code className="rounded bg-black/40 px-1.5 py-0.5 text-emerald-200/90">{masked}</code>
          </p>
          <p>
            <span className="text-slate-500">Schema</span>{' '}
            <span className="font-bold text-slate-100">{verified.keyTier.toUpperCase()}</span>
            {' · '}
            <span className="text-slate-500">Name</span> <span className="text-slate-200">{verified.keyName}</span>
          </p>
          <p>
            <span className="text-slate-500">Subscription (verify)</span>{' '}
            <span className="font-bold text-fuchsia-200/90">{verified.subscriptionTier}</span>
          </p>
          <p>
            <span className="text-slate-500">Rate limit</span>{' '}
            <span className="font-mono-terminal tabular-nums text-cyan-200/90">
              {verified.rateLimit.maxRequests} req / {verified.rateLimit.windowSeconds}s
            </span>
          </p>
        </div>
      ) : null}

      {phase === 'checking' ? (
        <p className="mt-2 text-[11px] text-slate-500">Running full verify against CryptoCheck AI key service…</p>
      ) : null}
    </div>
  )
}
