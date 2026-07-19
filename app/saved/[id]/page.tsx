import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getSavedYouById } from '@/lib/launchpad/saved-you'

export const dynamic = 'force-dynamic'

export default async function SavedYouSharePage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string }
}) {
  const { id } = await Promise.resolve(params)
  const row = await getSavedYouById(id)
  if (!row) notFound()

  return (
    <main className="min-h-screen bg-[#070b12] px-4 py-16 text-[#e8edf5]">
      <div className="mx-auto max-w-lg rounded-2xl border border-white/10 bg-[#0c1220] p-8 shadow-[0_0_60px_rgba(34,197,94,0.12)]">
        <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-[#22c55e]">
          CryptoCheck · Saved You
        </p>
        <h1 className="mt-3 text-2xl font-bold tracking-tight">
          We blocked {row.symbol ?? 'this token'} before it rugged
        </h1>
        <p className="mt-2 text-sm text-white/60">
          Blocked {new Date(row.blockedAt).toLocaleString()} · Graded{' '}
          {new Date(row.gradedAt).toLocaleString()}
        </p>
        <p className="mt-4 font-mono text-xs break-all text-white/50">{row.mint}</p>
        <p className="mt-4 text-sm leading-relaxed text-white/80">{row.outcomeEvidence}</p>
        <dl className="mt-6 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-[10px] uppercase text-white/40">Drawdown</dt>
            <dd className="font-mono">{row.drawdownPct != null ? `${row.drawdownPct}%` : '—'}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase text-white/40">Est. loss avoided</dt>
            <dd className="font-mono text-amber-400">
              {row.lossAvoidedEstimate != null
                ? `~$${row.lossAvoidedEstimate.toFixed(2)} (estimate)`
                : '—'}
            </dd>
          </div>
        </dl>
        {row.explorerUrl ? (
          <a
            href={row.explorerUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-6 inline-block text-sm text-[#22c55e] underline"
          >
            On-chain proof →
          </a>
        ) : null}
        <p className="mt-8 text-[11px] leading-relaxed text-white/40">
          Not financial advice. Save only claimed from real graded outcomes. Loss avoided is an
          estimate (intended size × observed drawdown).
        </p>
        <Link href="/dashboard/launchpad/saves" className="mt-6 inline-block text-xs text-white/50 underline">
          Your Saves · Launchpad
        </Link>
      </div>
    </main>
  )
}
