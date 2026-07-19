'use client'

import { useCallback, useState } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { VersionedTransaction } from '@solana/web3.js'
import { Loader2, Rocket } from 'lucide-react'
import { LAUNCH_COMPLIANCE, MIN_SOL_TARGET, MIN_SOL_TARGET_DEVNET, MIN_SUPPLY_HUMAN } from '@/lib/launch/constants'
import { dashToast } from './DashToast'

const IS_DEVNET_LAUNCH =
  (process.env.NEXT_PUBLIC_LAUNCHLAB_CLUSTER ?? process.env.NEXT_PUBLIC_LAUNCH_MODE_CLUSTER ?? 'devnet')
    .toLowerCase() !== 'mainnet' &&
  (process.env.NEXT_PUBLIC_LAUNCHLAB_CLUSTER ?? '').toLowerCase() !== 'mainnet-beta'

const SOL_FLOOR = IS_DEVNET_LAUNCH ? MIN_SOL_TARGET_DEVNET : MIN_SOL_TARGET

type Status = 'idle' | 'preparing' | 'signing' | 'confirming' | 'done' | 'blocked' | 'error'

type PrepareOk = {
  blocked: false
  mint: string
  poolId: string
  platformId: string
  transactions: string[]
  params: {
    name: string
    ticker: string
    supply: string
    totalSellA: string
    totalFundRaisingB: string
    decimals: number
    migrateType: 'cpmm'
    solTarget: number
  }
}

/**
 * LAUNCH mode body for the unified Action Panel — never navigates away from /dashboard.
 */
export function LaunchPanel({ onLaunched }: { onLaunched?: (mint: string) => void }) {
  const { connection } = useConnection()
  const wallet = useWallet()

  const [name, setName] = useState('')
  const [ticker, setTicker] = useState('')
  const [description, setDescription] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [supply, setSupply] = useState(String(MIN_SUPPLY_HUMAN * 100)) // 1B default feel
  const [solTarget, setSolTarget] = useState(String(SOL_FLOOR))
  const [curveType, setCurveType] = useState<'justsendit' | 'custom'>('justsendit')
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [totalLocked, setTotalLocked] = useState('0')
  const [cliffSec, setCliffSec] = useState('0')
  const [unlockSec, setUnlockSec] = useState('0')

  const [status, setStatus] = useState<Status>('idle')
  const [reasons, setReasons] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [resultMint, setResultMint] = useState<string | null>(null)

  const onFile = useCallback((file: File | null) => {
    if (!file) return
    if (file.size > 200_000) {
      setError('Image must be ≤ 200KB')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') setImageUrl(reader.result)
    }
    reader.readAsDataURL(file)
  }, [])

  const launch = useCallback(async () => {
    if (!wallet.publicKey || !wallet.signTransaction) {
      setError('Connect a wallet to launch')
      setStatus('error')
      return
    }
    setError(null)
    setReasons([])
    setResultMint(null)
    setStatus('preparing')

    try {
      const res = await fetch('/api/launch/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          ticker: ticker.trim(),
          description: description.trim(),
          imageUrl: imageUrl.trim(),
          supply: Number(supply),
          solTarget: Number(solTarget),
          curveType,
          creatorWallet: wallet.publicKey.toBase58(),
          totalLockedAmount: Number(totalLocked) || 0,
          cliffPeriodSec: Number(cliffSec) || 0,
          unlockPeriodSec: Number(unlockSec) || 0,
        }),
      })
      const body = await res.json()

      if (res.status === 403 || body?.blocked) {
        setReasons(Array.isArray(body?.reasons) ? body.reasons : ['Launch blocked'])
        setStatus('blocked')
        return
      }
      if (!res.ok || !body?.transactions?.length) {
        throw new Error(body?.detail || body?.error || 'Prepare failed')
      }

      const prepared = body as PrepareOk
      setStatus('signing')

      // Non-custodial: wallet signs each VersionedTransaction (mint may already be partial-signed).
      let lastSig = ''
      for (const b64 of prepared.transactions) {
        const tx = VersionedTransaction.deserialize(Buffer.from(b64, 'base64'))
        const signed = await wallet.signTransaction(tx)
        setStatus('confirming')
        lastSig = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: false })
        await connection.confirmTransaction(lastSig, 'confirmed')
      }

      const confirmRes = await fetch('/api/launch/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mint: prepared.mint,
          signature: lastSig,
          creatorWallet: wallet.publicKey.toBase58(),
          name: prepared.params.name,
          ticker: prepared.params.ticker,
          description: description.trim(),
          imageUrl: imageUrl.trim(),
          supply: prepared.params.supply,
          totalSellA: prepared.params.totalSellA,
          totalFundRaisingB: prepared.params.totalFundRaisingB,
          solTarget: prepared.params.solTarget,
          curveType,
          poolId: prepared.poolId,
        }),
      })
      const confirmBody = await confirmRes.json()
      if (!confirmRes.ok) {
        throw new Error(confirmBody?.error || 'Confirm failed')
      }

      setResultMint(prepared.mint)
      setStatus('done')
      const badge = confirmBody?.launch?.badge ?? confirmBody?.launch?.verdict ?? 'scanned'
      dashToast(`Launched ${prepared.params.ticker} · Neural V4 ${badge}`)
      onLaunched?.(prepared.mint)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Launch failed')
      setStatus('error')
    }
  }, [
    wallet,
    connection,
    name,
    ticker,
    description,
    imageUrl,
    supply,
    solTarget,
    curveType,
    totalLocked,
    cliffSec,
    unlockSec,
    onLaunched,
  ])

  const busy = status === 'preparing' || status === 'signing' || status === 'confirming'

  return (
    <div className="space-y-4">
      <div>
        <p className="font-space text-[13px] font-semibold text-dash-sky">Launch Token</p>
        <p className="text-[11px] text-dash-tmid">Raydium LaunchLab · scanner-gated · stays on this panel</p>
      </div>

      <p className="rounded-dash-inner border border-dash-innerline bg-dash-inset px-3 py-2 text-[10px] leading-relaxed text-dash-tmid">
        {LAUNCH_COMPLIANCE}
      </p>

      {status === 'blocked' ? (
        <div className="rounded-dash-inner border border-dash-red/40 bg-dash-red/10 px-3 py-3" role="alert">
          <p className="text-xs font-bold uppercase tracking-wider text-dash-red">Launch blocked</p>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-[11px] text-dash-red">
            {reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          <p className="mt-2 text-[10px] text-dash-tlo">
            We refuse to build the launch transaction. Flagged launches are not hidden elsewhere — we label them.
          </p>
        </div>
      ) : null}

      {error ? (
        <p className="text-[11px] text-dash-red" role="alert">
          {error}
        </p>
      ) : null}

      {status === 'done' && resultMint ? (
        <div className="rounded-dash-inner border border-dash-green/35 bg-dash-green/10 px-3 py-3">
          <p className="text-xs font-semibold text-dash-green">Token launched</p>
          <p className="font-dash-mono mt-1 break-all text-[10px] text-dash-tmid">{resultMint}</p>
        </div>
      ) : null}

      <div className="space-y-2">
        <label className="block text-[10px] uppercase tracking-wider text-dash-tlo">Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={32}
          placeholder="Token name"
          className="w-full rounded-dash-chip border border-dash-innerline bg-dash-inset px-3 py-2 text-xs text-dash-thi placeholder:text-dash-tlo focus:outline-none focus-visible:ring-2 focus-visible:ring-dash-green"
        />
        <label className="block text-[10px] uppercase tracking-wider text-dash-tlo">Ticker</label>
        <input
          value={ticker}
          onChange={(e) => setTicker(e.target.value.toUpperCase())}
          maxLength={10}
          placeholder="TICKER"
          className="font-dash-mono w-full rounded-dash-chip border border-dash-innerline bg-dash-inset px-3 py-2 text-xs text-dash-thi placeholder:text-dash-tlo focus:outline-none focus-visible:ring-2 focus-visible:ring-dash-green"
        />
        <label className="block text-[10px] uppercase tracking-wider text-dash-tlo">Image</label>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          className="w-full text-[11px] text-dash-tmid file:mr-2 file:rounded-dash-chip file:border-0 file:bg-dash-panel2 file:px-2 file:py-1 file:text-[10px] file:text-dash-thi"
        />
        <input
          value={imageUrl.startsWith('data:') ? '' : imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="Or paste HTTPS image URL…"
          className="w-full rounded-dash-chip border border-dash-innerline bg-dash-inset px-3 py-2 text-xs text-dash-thi placeholder:text-dash-tlo focus:outline-none focus-visible:ring-2 focus-visible:ring-dash-green"
        />
        {imageUrl.startsWith('data:') ? (
          <p className="text-[10px] text-dash-green">Image attached (data URL)</p>
        ) : null}

        <label className="block text-[10px] uppercase tracking-wider text-dash-tlo">
          Supply (min {MIN_SUPPLY_HUMAN.toLocaleString()})
        </label>
        <input
          type="number"
          value={supply}
          onChange={(e) => setSupply(e.target.value)}
          min={MIN_SUPPLY_HUMAN}
          className="font-dash-mono w-full rounded-dash-chip border border-dash-innerline bg-dash-inset px-3 py-2 text-xs text-dash-thi focus:outline-none focus-visible:ring-2 focus-visible:ring-dash-green"
        />
        <label className="block text-[10px] uppercase tracking-wider text-dash-tlo">
          SOL target (min {SOL_FLOOR})
        </label>
        <input
          type="number"
          value={solTarget}
          onChange={(e) => setSolTarget(e.target.value)}
          min={SOL_FLOOR}
          step={IS_DEVNET_LAUNCH ? 0.05 : 1}
          className="font-dash-mono w-full rounded-dash-chip border border-dash-innerline bg-dash-inset px-3 py-2 text-xs text-dash-thi focus:outline-none focus-visible:ring-2 focus-visible:ring-dash-green"
        />

        <label className="block text-[10px] uppercase tracking-wider text-dash-tlo">Curve preset</label>
        <div className="flex gap-1 rounded-dash-chip border border-dash-innerline bg-dash-inset p-1">
          {(
            [
              { id: 'justsendit' as const, label: 'JustSendIt' },
              { id: 'custom' as const, label: 'Custom' },
            ] as const
          ).map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setCurveType(p.id)}
              className={`flex-1 rounded-dash-chip px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider ${
                curveType === p.id ? 'bg-dash-green/15 text-dash-green' : 'text-dash-tmid'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setAdvancedOpen((v) => !v)}
          className="text-[10px] uppercase tracking-wider text-dash-tlo hover:text-dash-thi"
        >
          {advancedOpen ? 'Hide' : 'Show'} advanced (vesting)
        </button>
        {advancedOpen ? (
          <div className="space-y-2 border-t border-dash-innerline pt-2">
            <label className="block text-[10px] text-dash-tlo">Locked amount (human units)</label>
            <input
              type="number"
              value={totalLocked}
              onChange={(e) => setTotalLocked(e.target.value)}
              className="font-dash-mono w-full rounded-dash-chip border border-dash-innerline bg-dash-inset px-3 py-2 text-xs text-dash-thi"
            />
            <label className="block text-[10px] text-dash-tlo">Cliff (seconds)</label>
            <input
              type="number"
              value={cliffSec}
              onChange={(e) => setCliffSec(e.target.value)}
              className="font-dash-mono w-full rounded-dash-chip border border-dash-innerline bg-dash-inset px-3 py-2 text-xs text-dash-thi"
            />
            <label className="block text-[10px] text-dash-tlo">Unlock period (seconds)</label>
            <input
              type="number"
              value={unlockSec}
              onChange={(e) => setUnlockSec(e.target.value)}
              className="font-dash-mono w-full rounded-dash-chip border border-dash-innerline bg-dash-inset px-3 py-2 text-xs text-dash-thi"
            />
          </div>
        ) : null}

        <label className="block text-[10px] uppercase tracking-wider text-dash-tlo">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          maxLength={500}
          placeholder="Optional description"
          className="w-full resize-none rounded-dash-chip border border-dash-innerline bg-dash-inset px-3 py-2 text-xs text-dash-thi placeholder:text-dash-tlo focus:outline-none focus-visible:ring-2 focus-visible:ring-dash-green"
        />
      </div>

      <button
        type="button"
        onClick={() => void launch()}
        disabled={busy || !wallet.publicKey}
        className="flex w-full items-center justify-center gap-2 rounded-dash-chip bg-dash-green py-2.5 text-xs font-bold uppercase tracking-wider text-dash-bg noro-glow-green transition-opacity duration-150 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Rocket className="h-3.5 w-3.5" />}
        {status === 'preparing'
          ? 'Screening…'
          : status === 'signing'
            ? 'Sign in wallet…'
            : status === 'confirming'
              ? 'Confirming…'
              : 'Launch'}
      </button>
      {!wallet.publicKey ? (
        <p className="text-center text-[10px] text-dash-tlo">Connect a wallet to launch.</p>
      ) : null}
    </div>
  )
}
