'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { VersionedTransaction } from '@solana/web3.js'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Rocket,
  Shield,
  Wallet,
} from 'lucide-react'
import {
  LAUNCH_COMPLIANCE,
  MIN_SOL_TARGET,
  MIN_SOL_TARGET_DEVNET,
  MIN_SUPPLY_HUMAN,
} from '@/lib/launch/constants'
import type { LaunchFeeBreakdown } from '@/lib/launch/types'
import { dashToast } from './DashToast'

const IS_DEVNET_LAUNCH =
  (process.env.NEXT_PUBLIC_LAUNCHLAB_CLUSTER ?? process.env.NEXT_PUBLIC_LAUNCH_MODE_CLUSTER ?? 'devnet')
    .toLowerCase() !== 'mainnet' &&
  (process.env.NEXT_PUBLIC_LAUNCHLAB_CLUSTER ?? '').toLowerCase() !== 'mainnet-beta'

const SOL_FLOOR = IS_DEVNET_LAUNCH ? MIN_SOL_TARGET_DEVNET : MIN_SOL_TARGET
const EXPLORER =
  IS_DEVNET_LAUNCH ? 'https://explorer.solana.com/?cluster=devnet' : 'https://explorer.solana.com'

type WizardStep = 'wallet' | 'details' | 'risk' | 'fees' | 'sign' | 'done'

type Status = 'idle' | 'preparing' | 'simulating' | 'signing' | 'confirming' | 'error' | 'blocked'

type PrepareOk = {
  blocked: false
  mint: string
  poolId: string
  platformId: string
  transactions: string[]
  metadataUri: string
  trackingId: string
  feeEstimate?: LaunchFeeBreakdown
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

type RiskPreview = {
  ok: boolean
  warnings: string[]
  recommendations: string[]
}

const STEPS: WizardStep[] = ['wallet', 'details', 'risk', 'fees', 'sign', 'done']

function stepIndex(s: WizardStep): number {
  return STEPS.indexOf(s)
}

function formatSol(n: number): string {
  if (!Number.isFinite(n)) return '—'
  if (n === 0) return '0'
  if (n < 0.001) return n.toFixed(6)
  return n.toFixed(4)
}

/**
 * LAUNCH mode body for the unified Action Panel — never navigates away from /dashboard.
 * Multi-step: wallet → details → risk → fees → sign → done.
 */
export function LaunchPanel({ onLaunched }: { onLaunched?: (mint: string) => void }) {
  const { connection } = useConnection()
  const wallet = useWallet()

  const [step, setStep] = useState<WizardStep>('wallet')
  const [name, setName] = useState('')
  const [ticker, setTicker] = useState('')
  const [description, setDescription] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [website, setWebsite] = useState('')
  const [twitter, setTwitter] = useState('')
  const [telegram, setTelegram] = useState('')
  const [discord, setDiscord] = useState('')
  const [supply, setSupply] = useState(String(MIN_SUPPLY_HUMAN * 100))
  const [solTarget, setSolTarget] = useState(String(SOL_FLOOR))
  const [curveType, setCurveType] = useState<'justsendit' | 'custom'>('justsendit')
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [totalLocked, setTotalLocked] = useState('0')
  const [cliffSec, setCliffSec] = useState('0')
  const [unlockSec, setUnlockSec] = useState('0')

  const [status, setStatus] = useState<Status>('idle')
  const [reasons, setReasons] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [trackingId, setTrackingId] = useState<string | null>(null)
  const [fees, setFees] = useState<LaunchFeeBreakdown | null>(null)
  const [risk, setRisk] = useState<RiskPreview | null>(null)
  const [prepared, setPrepared] = useState<PrepareOk | null>(null)
  const [resultMint, setResultMint] = useState<string | null>(null)
  const [resultBadge, setResultBadge] = useState<string | null>(null)
  const [txSig, setTxSig] = useState<string | null>(null)

  useEffect(() => {
    if (wallet.publicKey && step === 'wallet') setStep('details')
  }, [wallet.publicKey, step])

  const onFile = useCallback((file: File | null) => {
    if (!file) return
    if (file.size > 200_000) {
      setError('Image must be ≤ 200KB')
      return
    }
    const allowed = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
    if (!allowed.includes(file.type)) {
      setError('Image must be PNG, JPG, WebP, or GIF')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setImageUrl(reader.result)
        setError(null)
      }
    }
    reader.readAsDataURL(file)
  }, [])

  const detailsValid = useMemo(() => {
    return (
      name.trim().length >= 2 &&
      ticker.trim().length >= 2 &&
      Boolean(imageUrl.trim()) &&
      Number(supply) >= MIN_SUPPLY_HUMAN &&
      Number(solTarget) >= SOL_FLOOR
    )
  }, [name, ticker, imageUrl, supply, solTarget])

  const loadFees = useCallback(async () => {
    if (!wallet.publicKey) return
    const res = await fetch('/api/launch/estimate-fees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creatorWallet: wallet.publicKey.toBase58() }),
    })
    const body = await res.json()
    if (!res.ok) throw new Error(body?.error || 'Fee estimate failed')
    setFees(body as LaunchFeeBreakdown)
    if (body.trackingId) setTrackingId(String(body.trackingId))
  }, [wallet.publicKey])

  const runRiskPreview = useCallback(() => {
    const warnings: string[] = []
    const recommendations: string[] = []

    if (curveType === 'custom' && Number(solTarget) < 30 && !IS_DEVNET_LAUNCH) {
      warnings.push('Low SOL target can look like a honeypot graduation setup.')
    }
    if (Number(totalLocked) > 0 && Number(cliffSec) === 0) {
      warnings.push('Locked supply without a cliff unlocks immediately after migrate.')
    }
    if (!website && !twitter && !telegram) {
      warnings.push('No social links — buyers may treat this as anonymous.')
      recommendations.push('Add at least one verified social (Twitter / Telegram / website).')
    }
    if (imageUrl.startsWith('data:')) {
      recommendations.push('Prefer a durable HTTPS image URL or enable Pinata IPFS on the server.')
    }
    recommendations.push('Neural V4 scans the mint after on-chain confirm — flagged tokens are labeled, not hidden.')
    recommendations.push('Revocation of mint/freeze is handled by Raydium LaunchLab pool rules after create.')
    recommendations.push('Platform earns 1.0% of curve volume; creator earns 0.5% — no hidden create fee.')

    setRisk({
      ok: warnings.length < 3,
      warnings,
      recommendations,
    })
  }, [curveType, solTarget, totalLocked, cliffSec, website, twitter, telegram, imageUrl])

  const goRisk = useCallback(() => {
    if (!detailsValid) {
      setError('Complete name, ticker, image, supply, and SOL target')
      return
    }
    setError(null)
    runRiskPreview()
    setStep('risk')
  }, [detailsValid, runRiskPreview])

  const goFees = useCallback(async () => {
    setError(null)
    setStatus('preparing')
    try {
      await loadFees()
      setStatus('idle')
      setStep('fees')
    } catch (e) {
      setStatus('error')
      setError(e instanceof Error ? e.message : 'Fee estimate failed')
    }
  }, [loadFees])

  const prepareAndSign = useCallback(async () => {
    if (!wallet.publicKey || !wallet.signTransaction) {
      setError('Connect a wallet to launch')
      setStatus('error')
      return
    }
    setError(null)
    setReasons([])
    setPrepared(null)
    setStatus('preparing')
    setStep('sign')

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
          website: website.trim() || undefined,
          twitter: twitter.trim() || undefined,
          telegram: telegram.trim() || undefined,
          discord: discord.trim() || undefined,
        }),
      })
      const body = await res.json()
      if (body?.trackingId) setTrackingId(String(body.trackingId))

      if (res.status === 403 || body?.blocked) {
        setReasons(Array.isArray(body?.reasons) ? body.reasons : ['Launch blocked'])
        setStatus('blocked')
        return
      }
      if (!res.ok || !body?.transactions?.length) {
        throw new Error(body?.detail || body?.error || 'Prepare failed')
      }

      const prep = body as PrepareOk
      if (prep.feeEstimate) setFees(prep.feeEstimate)
      setPrepared(prep)

      setStatus('simulating')
      const simRes = await fetch('/api/launch/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactions: prep.transactions,
          creatorWallet: wallet.publicKey.toBase58(),
        }),
      })
      const simBody = await simRes.json()
      if (!simRes.ok || !simBody?.ok) {
        throw new Error(simBody?.error || simBody?.detail || 'Simulation failed')
      }

      setStatus('signing')
      let lastSig = ''
      for (const b64 of prep.transactions) {
        const tx = VersionedTransaction.deserialize(Buffer.from(b64, 'base64'))
        const signed = await wallet.signTransaction(tx)
        setStatus('confirming')
        lastSig = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: false })
        await connection.confirmTransaction(lastSig, 'confirmed')
      }
      setTxSig(lastSig)

      const confirmRes = await fetch('/api/launch/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mint: prep.mint,
          signature: lastSig,
          creatorWallet: wallet.publicKey.toBase58(),
          name: prep.params.name,
          ticker: prep.params.ticker,
          description: description.trim(),
          imageUrl: imageUrl.trim(),
          supply: prep.params.supply,
          totalSellA: prep.params.totalSellA,
          totalFundRaisingB: prep.params.totalFundRaisingB,
          solTarget: prep.params.solTarget,
          curveType,
          poolId: prep.poolId,
        }),
      })
      const confirmBody = await confirmRes.json()
      if (!confirmRes.ok) {
        throw new Error(confirmBody?.error || 'Confirm failed')
      }

      setResultMint(prep.mint)
      setResultBadge(confirmBody?.launch?.badge ?? confirmBody?.launch?.verdict ?? 'scanned')
      setStatus('idle')
      setStep('done')
      dashToast(`Launched ${prep.params.ticker} · Neural V4 ${confirmBody?.launch?.badge ?? 'scanned'}`)
      onLaunched?.(prep.mint)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Launch failed'
      setError(msg)
      setStatus(msg.toLowerCase().includes('reject') ? 'error' : 'error')
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
    website,
    twitter,
    telegram,
    discord,
    onLaunched,
  ])

  const busy =
    status === 'preparing' ||
    status === 'simulating' ||
    status === 'signing' ||
    status === 'confirming'

  const back = () => {
    if (busy) return
    const i = stepIndex(step)
    if (i > 0 && step !== 'done') setStep(STEPS[i - 1]!)
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="font-space text-[13px] font-semibold text-dash-sky">Launch Token</p>
        <p className="text-[11px] text-dash-tmid">
          Raydium LaunchLab · scanner-gated · non-custodial
        </p>
      </div>

      <ol className="flex flex-wrap gap-1.5" aria-label="Launch steps">
        {(['wallet', 'details', 'risk', 'fees', 'sign'] as const).map((s) => {
          const active = step === s || (step === 'done' && s === 'sign')
          const done = stepIndex(step) > stepIndex(s) || step === 'done'
          return (
            <li
              key={s}
              className={`rounded-dash-chip px-2 py-1 text-[9px] font-bold uppercase tracking-wider ${
                active
                  ? 'bg-dash-green/15 text-dash-green'
                  : done
                    ? 'bg-dash-inset text-dash-tmid'
                    : 'bg-dash-inset text-dash-tlo'
              }`}
            >
              {s}
            </li>
          )
        })}
      </ol>

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
        </div>
      ) : null}

      {error ? (
        <div className="rounded-dash-inner border border-dash-red/30 bg-dash-red/10 px-3 py-2" role="alert">
          <p className="text-[11px] text-dash-red">{error}</p>
          {trackingId ? (
            <p className="mt-1 font-dash-mono text-[9px] text-dash-tlo">Tracking ID: {trackingId}</p>
          ) : null}
        </div>
      ) : null}

      {step === 'wallet' ? (
        <div className="space-y-3 rounded-dash-inner border border-dash-innerline bg-dash-inset px-3 py-4">
          <div className="flex items-center gap-2 text-dash-sky">
            <Wallet className="h-4 w-4" />
            <p className="text-xs font-semibold">Connect wallet</p>
          </div>
          <p className="text-[11px] text-dash-tmid">
            Phantom, Solflare, or Backpack. You sign every create transaction — CryptoCheck never holds keys.
          </p>
          {!wallet.publicKey ? (
            <p className="text-center text-[10px] text-dash-tlo">Use the wallet button in the header to connect.</p>
          ) : (
            <p className="font-dash-mono break-all text-[10px] text-dash-green">
              {wallet.publicKey.toBase58()}
            </p>
          )}
        </div>
      ) : null}

      {step === 'details' ? (
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
          <label className="block text-[10px] uppercase tracking-wider text-dash-tlo">Logo</label>
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

          <div className="grid grid-cols-2 gap-2">
            <div>
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
            </div>
            <div>
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
            </div>
          </div>

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

          <label className="block text-[10px] uppercase tracking-wider text-dash-tlo">Socials</label>
          <input
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="Website https://"
            className="w-full rounded-dash-chip border border-dash-innerline bg-dash-inset px-3 py-2 text-xs text-dash-thi placeholder:text-dash-tlo"
          />
          <input
            value={twitter}
            onChange={(e) => setTwitter(e.target.value)}
            placeholder="Twitter / X"
            className="w-full rounded-dash-chip border border-dash-innerline bg-dash-inset px-3 py-2 text-xs text-dash-thi placeholder:text-dash-tlo"
          />
          <input
            value={telegram}
            onChange={(e) => setTelegram(e.target.value)}
            placeholder="Telegram"
            className="w-full rounded-dash-chip border border-dash-innerline bg-dash-inset px-3 py-2 text-xs text-dash-thi placeholder:text-dash-tlo"
          />
          <input
            value={discord}
            onChange={(e) => setDiscord(e.target.value)}
            placeholder="Discord invite"
            className="w-full rounded-dash-chip border border-dash-innerline bg-dash-inset px-3 py-2 text-xs text-dash-thi placeholder:text-dash-tlo"
          />

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
      ) : null}

      {step === 'risk' && risk ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-dash-sky">
            <Shield className="h-4 w-4" />
            <p className="text-xs font-semibold">Pre-launch risk framing</p>
          </div>
          <p className="text-[11px] text-dash-tmid">
            Config review before prepare. Full Neural V4 mint scan runs after confirm.
          </p>
          {risk.warnings.length ? (
            <div className="rounded-dash-inner border border-amber-500/35 bg-amber-500/10 px-3 py-2">
              <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-400">
                <AlertTriangle className="h-3 w-3" /> Warnings
              </p>
              <ul className="mt-1 list-disc space-y-1 pl-4 text-[11px] text-amber-200/90">
                {risk.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-[11px] text-dash-green">No config warnings from local heuristics.</p>
          )}
          <div className="rounded-dash-inner border border-dash-innerline bg-dash-inset px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-dash-tlo">Recommendations</p>
            <ul className="mt-1 list-disc space-y-1 pl-4 text-[11px] text-dash-tmid">
              {risk.recommendations.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
          <dl className="grid grid-cols-2 gap-2 text-[10px]">
            <div className="rounded-dash-chip border border-dash-innerline bg-dash-inset px-2 py-2">
              <dt className="text-dash-tlo">Name</dt>
              <dd className="text-dash-thi">{name}</dd>
            </div>
            <div className="rounded-dash-chip border border-dash-innerline bg-dash-inset px-2 py-2">
              <dt className="text-dash-tlo">Ticker</dt>
              <dd className="font-dash-mono text-dash-thi">{ticker}</dd>
            </div>
            <div className="rounded-dash-chip border border-dash-innerline bg-dash-inset px-2 py-2">
              <dt className="text-dash-tlo">Supply</dt>
              <dd className="font-dash-mono text-dash-thi">{Number(supply).toLocaleString()}</dd>
            </div>
            <div className="rounded-dash-chip border border-dash-innerline bg-dash-inset px-2 py-2">
              <dt className="text-dash-tlo">SOL target</dt>
              <dd className="font-dash-mono text-dash-thi">{solTarget}</dd>
            </div>
          </dl>
        </div>
      ) : null}

      {step === 'fees' && fees ? (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-dash-sky">Creation summary</p>
          <ul className="space-y-1.5">
            {fees.lines.map((line) => (
              <li
                key={line.id}
                className={`flex items-start justify-between gap-3 rounded-dash-chip border px-3 py-2 text-[11px] ${
                  line.id === 'total'
                    ? 'border-dash-green/35 bg-dash-green/10 text-dash-green'
                    : 'border-dash-innerline bg-dash-inset text-dash-thi'
                }`}
              >
                <span>
                  <span className="font-semibold">{line.label}</span>
                  {line.note ? (
                    <span className="mt-0.5 block text-[9px] text-dash-tlo">{line.note}</span>
                  ) : null}
                </span>
                <span className="font-dash-mono shrink-0">{formatSol(line.sol)} SOL</span>
              </li>
            ))}
          </ul>
          <p className="text-[10px] text-dash-tmid">
            Curve fees after launch: ~{fees.curveFees.platformFeeBpsApprox} bps platform · ~
            {fees.curveFees.creatorFeeBpsApprox} bps creator. {fees.curveFees.note}
          </p>
          {fees.walletBalanceSol != null ? (
            <p
              className={`text-[11px] ${
                fees.sufficientBalance === false ? 'text-dash-red' : 'text-dash-tmid'
              }`}
            >
              Wallet balance: {formatSol(fees.walletBalanceSol)} SOL
              {fees.sufficientBalance === false ? ' — insufficient for estimated total' : ''}
            </p>
          ) : null}
        </div>
      ) : null}

      {step === 'sign' ? (
        <div className="space-y-3 rounded-dash-inner border border-dash-innerline bg-dash-inset px-3 py-4">
          <div className="flex items-center gap-2 text-dash-sky">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
            <p className="text-xs font-semibold">
              {status === 'preparing'
                ? 'Screening & building…'
                : status === 'simulating'
                  ? 'Simulating…'
                  : status === 'signing'
                    ? 'Sign in wallet…'
                    : status === 'confirming'
                      ? 'Confirming on-chain…'
                      : status === 'blocked'
                        ? 'Blocked'
                        : 'Ready'}
            </p>
          </div>
          {prepared ? (
            <p className="font-dash-mono break-all text-[10px] text-dash-tmid">Mint {prepared.mint}</p>
          ) : null}
          {trackingId ? (
            <p className="font-dash-mono text-[9px] text-dash-tlo">Tracking ID: {trackingId}</p>
          ) : null}
        </div>
      ) : null}

      {step === 'done' && resultMint ? (
        <div className="space-y-3 rounded-dash-inner border border-dash-green/35 bg-dash-green/10 px-3 py-3">
          <div className="flex items-center gap-2 text-dash-green">
            <CheckCircle2 className="h-4 w-4" />
            <p className="text-xs font-semibold">Token launched</p>
          </div>
          <p className="font-dash-mono break-all text-[10px] text-dash-tmid">{resultMint}</p>
          {resultBadge ? (
            <p className="text-[11px] text-dash-thi">Neural V4 badge: {resultBadge}</p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <a
              href={`${EXPLORER.replace(/\?.*/, '')}/address/${resultMint}${IS_DEVNET_LAUNCH ? '?cluster=devnet' : ''}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-dash-chip border border-dash-innerline bg-dash-inset px-2 py-1 text-[10px] text-dash-sky hover:text-dash-thi"
            >
              Explorer <ExternalLink className="h-3 w-3" />
            </a>
            {txSig ? (
              <a
                href={`${EXPLORER.replace(/\?.*/, '')}/tx/${txSig}${IS_DEVNET_LAUNCH ? '?cluster=devnet' : ''}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-dash-chip border border-dash-innerline bg-dash-inset px-2 py-1 text-[10px] text-dash-sky hover:text-dash-thi"
              >
                Tx <ExternalLink className="h-3 w-3" />
              </a>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="flex gap-2">
        {step !== 'wallet' && step !== 'done' ? (
          <button
            type="button"
            onClick={back}
            disabled={busy}
            className="flex items-center justify-center gap-1 rounded-dash-chip border border-dash-innerline bg-dash-inset px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-dash-tmid disabled:opacity-50"
          >
            <ArrowLeft className="h-3 w-3" /> Back
          </button>
        ) : null}

        {step === 'details' ? (
          <button
            type="button"
            onClick={goRisk}
            disabled={!wallet.publicKey || !detailsValid}
            className="flex flex-1 items-center justify-center gap-2 rounded-dash-chip bg-dash-green py-2.5 text-xs font-bold uppercase tracking-wider text-dash-bg noro-glow-green transition-opacity duration-150 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Continue <ArrowRight className="h-3.5 w-3.5" />
          </button>
        ) : null}

        {step === 'risk' ? (
          <button
            type="button"
            onClick={() => void goFees()}
            disabled={busy}
            className="flex flex-1 items-center justify-center gap-2 rounded-dash-chip bg-dash-green py-2.5 text-xs font-bold uppercase tracking-wider text-dash-bg noro-glow-green disabled:opacity-50"
          >
            {status === 'preparing' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Fee summary <ArrowRight className="h-3.5 w-3.5" />
          </button>
        ) : null}

        {step === 'fees' ? (
          <button
            type="button"
            onClick={() => void prepareAndSign()}
            disabled={busy || fees?.sufficientBalance === false}
            className="flex flex-1 items-center justify-center gap-2 rounded-dash-chip bg-dash-green py-2.5 text-xs font-bold uppercase tracking-wider text-dash-bg noro-glow-green disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Rocket className="h-3.5 w-3.5" /> Simulate & launch
          </button>
        ) : null}

        {step === 'done' ? (
          <button
            type="button"
            onClick={() => {
              setStep('details')
              setPrepared(null)
              setResultMint(null)
              setResultBadge(null)
              setTxSig(null)
              setError(null)
              setReasons([])
              setStatus('idle')
            }}
            className="flex flex-1 items-center justify-center gap-2 rounded-dash-chip border border-dash-innerline bg-dash-inset py-2.5 text-xs font-bold uppercase tracking-wider text-dash-thi"
          >
            Launch another
          </button>
        ) : null}
      </div>

      {!wallet.publicKey && step !== 'wallet' ? (
        <p className="text-center text-[10px] text-dash-tlo">Connect a wallet to launch.</p>
      ) : null}
    </div>
  )
}
