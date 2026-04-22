import Link from 'next/link'
import { getPublicStatusPayload } from '@/lib/status/public-status'

export const revalidate = 30

function badge(overall: string) {
  if (overall === 'operational')
    return 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200'
  if (overall === 'partial') return 'border-amber-400/40 bg-amber-500/15 text-amber-200'
  return 'border-rose-400/40 bg-rose-500/15 text-rose-200'
}

export default async function PublicStatusPage() {
  const data = await getPublicStatusPayload()
  const { health } = data

  return (
    <div className="min-h-screen bg-[#07070a] text-[#e8e8ef]">
      <div className="mx-auto max-w-3xl px-5 py-14 pb-24">
        <header className="border-b border-white/[0.08] pb-8">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-slate-500">CryptoCheck AI</p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-100">System status</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-400">
            Public transparency for our Security Intelligence platform. This page does not require sign-in.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <span
              className={`inline-flex rounded-lg border px-3 py-1.5 text-xs font-semibold uppercase tracking-wider ${badge(data.overall)}`}
            >
              {data.overall}
            </span>
            <span className="text-xs text-slate-500">Updated {new Date(data.updated_at).toUTCString()}</span>
          </div>
          <p className="mt-4 text-sm text-slate-300">{data.summary}</p>
        </header>

        {data.incidents.length > 0 && (
          <section className="mt-10 space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-200/90">Active notices</h2>
            {data.incidents.map((inc, i) => (
              <div
                key={`${inc.title}-${i}`}
                className="rounded-xl border border-amber-400/25 bg-amber-500/[0.07] px-4 py-3 text-sm"
              >
                <p className="font-semibold text-amber-100">{inc.title}</p>
                {inc.description ? <p className="mt-1 text-xs text-amber-100/80">{inc.description}</p> : null}
                <p className="mt-2 text-[0.65rem] uppercase tracking-wider text-amber-200/60">
                  {inc.severity}
                  {inc.since ? ` · since ${inc.since}` : ''}
                </p>
              </div>
            ))}
          </section>
        )}

        <section className="mt-10 rounded-xl border border-white/[0.08] bg-[rgba(12,12,14,0.85)] p-5 shadow-[0_8px_32px_rgba(0,0,0,0.45)]">
          <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">SLA commitment</h2>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-emerald-200/95">
            {data.sla.targetMonthlyAvailabilityPct}% <span className="text-lg font-medium text-slate-400">target</span>
          </p>
          <p className="mt-1 text-xs text-slate-500">Monthly availability goal for the covered API surface (indicative).</p>
          <ul className="mt-4 space-y-2 text-sm leading-relaxed text-slate-400">
            <li>
              <span className="font-medium text-slate-300">In scope:</span> {data.sla.scope}
            </li>
            <li>
              <span className="font-medium text-slate-300">Out of scope:</span> {data.sla.exclusions}
            </li>
            <li>
              <span className="font-medium text-slate-300">How we measure:</span> {data.sla.measurement}
            </li>
          </ul>
          <p className="mt-4 text-[0.7rem] leading-relaxed text-slate-600">
            Enterprise contractual SLAs may differ; this page is a public summary. For contractual terms, refer to
            your order form or contact sales.
          </p>
        </section>

        <section className="mt-8 rounded-xl border border-white/[0.08] bg-[rgba(12,12,14,0.85)] p-5">
          <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Rolling availability</h2>
          <p className="mt-3 text-2xl font-semibold text-slate-100">
            {data.uptime.availability_pct != null ? (
              <>
                {data.uptime.availability_pct}
                <span className="text-base font-normal text-slate-500">%</span>
              </>
            ) : (
              <span className="text-slate-400">Collecting history…</span>
            )}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Last {data.uptime.window_days} days · {data.uptime.probes_in_window.toLocaleString()} synthetic probes
            {data.uptime.availability_pct == null && data.uptime.probes_in_window === 0
              ? ' (enable Upstash Redis and keep the uptime cron running to populate this figure)'
              : ''}
          </p>
        </section>

        <section className="mt-8">
          <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Components</h2>
          <div className="mt-3 overflow-hidden rounded-xl border border-white/[0.08]">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/[0.04] text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-2">System</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Latency</th>
                  <th className="px-4 py-2">Detail</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(health.checks).map(([key, c]) => (
                  <tr key={key} className="border-t border-white/[0.06]">
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-300">{key}</td>
                    <td className="px-4 py-2.5">
                      <span className={c.ok ? 'text-emerald-300' : 'text-rose-300'}>{c.ok ? 'Operational' : 'Issue'}</span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-500">{c.ms != null ? `${c.ms} ms` : '—'}</td>
                    <td className="max-w-[200px] truncate px-4 py-2.5 text-xs text-slate-600" title={c.error}>
                      {c.error ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-slate-600">
            Aggregate health: <span className="font-mono text-slate-400">{health.status}</span> · probe latency{' '}
            <span className="font-mono text-slate-400">{health.latency_ms} ms</span>
          </p>
        </section>

        <footer className="mt-12 border-t border-white/[0.08] pt-8 text-sm text-slate-500">
          <p>
            Machine-readable feed:{' '}
            <Link href="/api/status/public" className="text-emerald-400/90 underline-offset-2 hover:underline">
              /api/status/public
            </Link>
          </p>
          <p className="mt-2">
            <Link href="/" className="text-slate-400 underline-offset-2 hover:underline">
              ← Back to CryptoCheck AI
            </Link>
          </p>
          <p className="mt-4 text-xs text-slate-600">
            External vanity URL: point <code className="text-slate-500">status.yourdomain.com</code> to this project and
            add a host redirect to <code className="text-slate-500">/status</code> (see <code className="text-slate-500">vercel.json</code>).
          </p>
        </footer>
      </div>
    </div>
  )
}
