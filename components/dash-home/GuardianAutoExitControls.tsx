'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useWallet } from '@solana/wallet-adapter-react'
import { dashToast } from './DashToast'

type GuardianSettings = {
  killSwitch: boolean
  global?: { enabled: boolean; max_slippage_bps: number; min_proceeds_ratio: number } | null
  config?: { enabled: boolean; maxSlippageBps: number; minProceedsRatio: number }
}

export function GuardianAutoExitControls({ mint }: { mint?: string }) {
  const wallet = useWallet()
  const [settings, setSettings] = useState<GuardianSettings | null>(null)
  const [premium, setPremium] = useState<boolean | null>(null)
  const [authorizing, setAuthorizing] = useState(false)
  const [maxSlippageBps, setMaxSlippageBps] = useState(150)
  const [minRatio, setMinRatio] = useState(0.85)

  const load = useCallback(async () => {
    try {
      const url = mint
        ? `/api/guardian/settings?mint=${encodeURIComponent(mint)}`
        : '/api/guardian/settings'
      const res = await fetch(url, { cache: 'no-store' })
      if (res.status === 403) {
        setPremium(false)
        return
      }
      if (!res.ok) return
      setPremium(true)
      setSettings(await res.json())
    } catch {
      setSettings(null)
    }
  }, [mint])

  useEffect(() => {
    void load()
  }, [load])

  const authorize = useCallback(async () => {
    if (!wallet.publicKey?.toBase58() || !wallet.signMessage) {
      dashToast('Connect wallet with signMessage support')
      return
    }
    setAuthorizing(true)
    try {
      const walletAddress = wallet.publicKey.toBase58()
      const qs = new URLSearchParams({
        wallet: walletAddress,
        maxSlippageBps: String(maxSlippageBps),
        minProceedsRatio: String(minRatio),
      })
      if (mint) qs.set('mint', mint)
      else qs.set('global', 'true')

      const msgRes = await fetch(`/api/guardian/authorize?${qs.toString()}`)
      const msgBody = await msgRes.json()
      if (!msgRes.ok) throw new Error(msgBody.error ?? 'Auth template failed')

      const encoded = new TextEncoder().encode(msgBody.message)
      const sig = await wallet.signMessage(encoded)
      const signatureBase64 = Buffer.from(sig).toString('base64')

      const postRes = await fetch('/api/guardian/authorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress,
          mint,
          global: !mint,
          maxSlippageBps,
          minProceedsRatio: minRatio,
          message: msgBody.message,
          signatureBase64,
        }),
      })
      const postBody = await postRes.json()
      if (!postRes.ok) throw new Error(postBody.error ?? 'Authorization failed')
      dashToast('Guardian standing instruction authorized')
      await load()
    } catch (e) {
      dashToast(e instanceof Error ? e.message : 'Authorization failed')
    } finally {
      setAuthorizing(false)
    }
  }, [wallet, mint, maxSlippageBps, minRatio, load])

  const toggleKillSwitch = useCallback(async () => {
    if (!settings) return
    const active = !settings.killSwitch
    const res = await fetch('/api/guardian/kill-switch', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active }),
    })
    if (res.ok) {
      dashToast(active ? 'Guardian kill-switch ON' : 'Kill-switch cleared')
      await load()
    }
  }, [settings, load])

  const toggleEnabled = useCallback(async () => {
    const currentlyEnabled = mint ? settings?.config?.enabled : settings?.global?.enabled
    const res = await fetch('/api/guardian/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mint,
        global: !mint,
        enabled: !currentlyEnabled,
        maxSlippageBps,
        minProceedsRatio: minRatio,
      }),
    })
    const body = await res.json()
    if (!res.ok) {
      dashToast(body.error ?? 'Enable failed — authorize wallet first')
      return
    }
    dashToast('Guardian auto-exit updated')
    await load()
  }, [mint, settings, maxSlippageBps, minRatio, load])

  if (premium === false) {
    return (
      <p className="rounded-dash-chip border border-dash-gold/30 bg-dash-gold/10 px-3 py-2 text-[11px] text-dash-gold">
        Guardian Auto-Exit is premium-only.{' '}
        <Link href="/app/upgrade" className="underline">
          Upgrade
        </Link>
      </p>
    )
  }

  if (!settings) return null

  return (
    <section className="rounded-dash-chip border border-dash-innerline bg-dash-inset px-3 py-3 space-y-2">
      <p className="text-[11px] font-semibold text-dash-sky">Guardian Auto-Exit</p>
      <p className="text-[10px] text-dash-tmid">
        Opt-in per position. On DANGER degrade we prepare a sell tx — you sign every exit. Slippage and
        min-proceeds guards abort bad quotes.
      </p>
      <div className="flex flex-wrap gap-2 text-[10px]">
        <label className="flex items-center gap-1 text-dash-tmid">
          Max slippage (bps)
          <input
            type="number"
            value={maxSlippageBps}
            min={10}
            max={2000}
            onChange={(e) => setMaxSlippageBps(Number(e.target.value))}
            className="w-16 rounded border border-dash-innerline bg-dash-panel2 px-1 py-0.5 font-dash-mono"
          />
        </label>
        <label className="flex items-center gap-1 text-dash-tmid">
          Min proceeds ratio
          <input
            type="number"
            step={0.05}
            value={minRatio}
            min={0.1}
            max={1}
            onChange={(e) => setMinRatio(Number(e.target.value))}
            className="w-16 rounded border border-dash-innerline bg-dash-panel2 px-1 py-0.5 font-dash-mono"
          />
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={authorizing}
          onClick={() => void authorize()}
          className="rounded-dash-chip border border-dash-sky/40 px-2 py-1 text-[10px] font-bold uppercase text-dash-sky"
        >
          {authorizing ? 'Signing…' : 'Authorize wallet'}
        </button>
        <button
          type="button"
          onClick={() => void toggleEnabled()}
          className="rounded-dash-chip border border-dash-green/40 px-2 py-1 text-[10px] font-bold uppercase text-dash-green"
        >
          {mint
            ? settings.config?.enabled
              ? 'Disable position auto-exit'
              : 'Enable position auto-exit'
            : settings.global?.enabled
              ? 'Disable auto-exit'
              : 'Enable auto-exit'}
        </button>
        <button
          type="button"
          onClick={() => void toggleKillSwitch()}
          className={`rounded-dash-chip px-2 py-1 text-[10px] font-bold uppercase ${
            settings.killSwitch
              ? 'bg-dash-red text-dash-bg'
              : 'border border-dash-red/40 text-dash-red'
          }`}
        >
          Kill-switch {settings.killSwitch ? 'ON' : 'off'}
        </button>
      </div>
    </section>
  )
}
