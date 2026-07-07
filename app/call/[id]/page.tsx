import Link from 'next/link'
import { notFound } from 'next/navigation'
import { fetchProofCallById } from '@/lib/proof-engine/calls-store'
import { COMPLIANCE_DISCLAIMER } from '@/lib/revenue-dashboard/constants'

export const dynamic = 'force-dynamic'

type Props = { params: { id: string } }

function outcomeLabel(outcome: string): string {
  if (outcome === 'hit') return 'HIT'
  if (outcome === 'miss') return 'MISS'
  if (outcome === 'expired') return 'EXPIRED'
  return 'PENDING'
}

export default async function ProofCallPage({ params }: Props) {
  const call = await fetchProofCallById(params.id)
  if (!call) notFound()

  const explorer =
    call.explorerUrl ||
    (call.commitTx.startsWith('paper:') ? null : `https://solscan.io/tx/${call.commitTx}`)

  return (
    <main className="min-h-screen bg-[#050807] px-4 py-10 text-slate-200">
      <div className="mx-auto max-w-2xl">
        <Link href="/dashboard" className="text-sm text-emerald-400 hover:underline">
          ← CryptoCheck AI
        </Link>

        <header className="mt-6 rounded-xl border border-white/10 bg-white/[0.03] p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
            Verified call · {call.callType.replace('_', ' ')}
          </p>
          <h1 className="mt-2 text-2xl font-bold text-white">${call.symbol}</h1>
          <p className="mt-1 font-mono text-xs text-slate-400">{call.mint}</p>

          <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Neural score</dt>
              <dd className="font-mono text-lg text-white">{call.neuralScore}/100</dd>
            </div>
            <div>
              <dt className="text-slate-500">Verdict</dt>
              <dd className="uppercase text-white">{call.verdict}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Called at</dt>
              <dd className="font-mono text-white">{new Date(call.calledAt).toUTCString()}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Outcome</dt>
              <dd className="font-semibold text-emerald-400">{outcomeLabel(call.outcome)}</dd>
            </div>
          </dl>

          <p className="mt-4 text-sm text-slate-300">{call.evidenceSummary}</p>

          {call.outcomeEvidence ? (
            <p className="mt-2 text-xs text-slate-400">Grade: {call.outcomeEvidence}</p>
          ) : null}
        </header>

        <section className="mt-4 rounded-xl border border-white/10 bg-white/[0.02] p-6">
          <h2 className="text-sm font-semibold text-white">On-chain proof</h2>
          <p className="mt-2 break-all font-mono text-xs text-slate-400">{call.commitmentHash}</p>
          {explorer ? (
            <a
              href={explorer}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block text-sm text-emerald-400 hover:underline"
            >
              View commit transaction →
            </a>
          ) : (
            <p className="mt-3 text-xs text-amber-400/90">Paper commit (live on-chain when proof live mode enabled)</p>
          )}
        </section>

        <p className="mt-8 text-center text-xs text-slate-500">{COMPLIANCE_DISCLAIMER}</p>
      </div>
    </main>
  )
}
