import Link from 'next/link'
import { GlassCard } from '@/components/Dashboard/GlassCard'

export const dynamic = 'force-dynamic'

export default function DashboardCompliancePage() {
  return (
    <div className="space-y-8">
      <header className="max-w-3xl">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-slate-500">Compliance &amp; history</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-200">Evidence &amp; exports</h1>
        <p className="mt-2 text-sm font-medium leading-relaxed text-slate-400">
          Central index for audit-friendly artifacts. Retention and DPA terms follow your CryptoCheck agreement and
          workspace Supabase policies — this page does not alter legal obligations.
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        <GlassCard className="p-6">
          <h2 className="text-sm font-semibold text-slate-200">Audit reports</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            Generate institutional PDF / JSON packs from the Analysis Console after a scan, or use the Pro demo export
            flows where enabled.
          </p>
          <ul className="mt-4 list-inside list-disc space-y-2 text-sm text-emerald-200/90">
            <li>
              <Link href="/dashboard/intelligence-terminal" className="underline-offset-2 hover:underline">
                Analysis Console
              </Link>{' '}
              — full report + audit actions in-product
            </li>
            <li>
              <Link href="/pro/dashboard" className="underline-offset-2 hover:underline">
                Intelligence Terminal (public)
              </Link>{' '}
              — demo exports where configured
            </li>
          </ul>
        </GlassCard>

        <GlassCard className="p-6">
          <h2 className="text-sm font-semibold text-slate-200">Security &amp; API activity</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            SENTINEL surfaces recent authenticated actions and policy signals for your account.
          </p>
          <p className="mt-4">
            <Link
              href="/dashboard/security"
              className="text-sm font-semibold text-emerald-200/90 underline-offset-2 hover:underline"
            >
              Open SENTINEL →
            </Link>
          </p>
        </GlassCard>

        <GlassCard className="p-6">
          <h2 className="text-sm font-semibold text-slate-200">Throughput &amp; pipeline</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            Quota usage and optional scan pipeline latency samples (when telemetry tables are present).
          </p>
          <p className="mt-4">
            <Link
              href="/dashboard/usage"
              className="text-sm font-semibold text-emerald-200/90 underline-offset-2 hover:underline"
            >
              Intelligence Ops →
            </Link>
          </p>
        </GlassCard>

        <GlassCard className="p-6">
          <h2 className="text-sm font-semibold text-slate-200">Portfolio snapshots</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            Historical portfolio scans and CSV export for desk records (Pro+ where entitled).
          </p>
          <p className="mt-4">
            <Link
              href="/dashboard/portfolio"
              className="text-sm font-semibold text-emerald-200/90 underline-offset-2 hover:underline"
            >
              Portfolio →
            </Link>
          </p>
        </GlassCard>

        <GlassCard className="p-6">
          <h2 className="text-sm font-semibold text-slate-200">Enterprise webhooks</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            Configure HTTPS endpoints; delivery attempts are logged for Enterprise tiers.
          </p>
          <p className="mt-4">
            <Link
              href="/dashboard/webhooks"
              className="text-sm font-semibold text-emerald-200/90 underline-offset-2 hover:underline"
            >
              Webhooks →
            </Link>
          </p>
        </GlassCard>

        <GlassCard className="p-6">
          <h2 className="text-sm font-semibold text-slate-200">Batch evidence</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            Multi-mint scans with optional <code className="text-slate-500">clientRef</code> for ticket / desk linkage
            in API logs.
          </p>
          <p className="mt-4">
            <Link
              href="/dashboard/batch"
              className="text-sm font-semibold text-emerald-200/90 underline-offset-2 hover:underline"
            >
              Batch scan →
            </Link>
          </p>
        </GlassCard>
      </div>

      <GlassCard className="p-6">
        <h2 className="text-sm font-semibold text-slate-200">Public availability</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          SLA summary and live dependency status (no login). Suitable for vendor questionnaires and client runbooks.
        </p>
        <p className="mt-4">
          <Link href="/status" className="text-sm font-semibold text-emerald-200/90 underline-offset-2 hover:underline">
            System status →
          </Link>
          <span className="mx-2 text-slate-600">·</span>
          <Link
            href="/api/status/public"
            className="text-sm font-semibold text-slate-400 underline-offset-2 hover:underline"
          >
            JSON feed
          </Link>
        </p>
      </GlassCard>
    </div>
  )
}
