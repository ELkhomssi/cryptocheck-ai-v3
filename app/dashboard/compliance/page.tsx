import Link from 'next/link'
import { NeonForensicPanel } from '@/components/Dashboard/forensic-terminal/NeonForensicPanel'

export const dynamic = 'force-dynamic'

export default function DashboardCompliancePage() {
  return (
    <div className="space-y-8">
      <header className="max-w-3xl">
        <p className="font-space text-xs font-bold uppercase tracking-[0.22em] text-cyan-400/80">
          Compliance &amp; history
        </p>
        <h1 className="mt-2 font-space text-3xl font-bold tracking-tight text-slate-100 md:text-4xl">
          Evidence &amp; exports
        </h1>
        <p className="mt-3 text-base leading-relaxed text-slate-400">
          Central index for audit-friendly artifacts. Retention and DPA terms follow your CryptoCheck agreement and
          workspace Supabase policies — this page does not alter legal obligations.
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        <NeonForensicPanel title="Audit reports" subtitle="Institutional packs & console" tone="neutral">
          <p className="leading-relaxed text-slate-400">
            Generate institutional PDF / JSON packs from the Analysis Console after a scan, or use the Pro demo export
            flows where enabled.
          </p>
          <ul className="mt-4 list-inside list-disc space-y-2 font-mono-terminal text-sm text-emerald-200/90">
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
        </NeonForensicPanel>

        <NeonForensicPanel title="Security & API activity" subtitle="SENTINEL plane" tone="threat">
          <p className="leading-relaxed text-slate-400">
            SENTINEL surfaces recent authenticated actions and policy signals for your account.
          </p>
          <p className="mt-4">
            <Link
              href="/dashboard/security"
              className="font-space text-sm font-bold uppercase tracking-wide text-cyan-300 underline-offset-2 hover:text-cyan-200 hover:underline"
            >
              Open SENTINEL →
            </Link>
          </p>
        </NeonForensicPanel>

        <NeonForensicPanel title="Throughput & pipeline" subtitle="Quotas & telemetry" tone="capacity">
          <p className="leading-relaxed text-slate-400">
            Quota usage and optional scan pipeline latency samples (when telemetry tables are present).
          </p>
          <p className="mt-4">
            <Link
              href="/dashboard/usage"
              className="font-space text-sm font-bold uppercase tracking-wide text-cyan-300 underline-offset-2 hover:text-cyan-200 hover:underline"
            >
              Intelligence Ops →
            </Link>
          </p>
        </NeonForensicPanel>

        <NeonForensicPanel title="Portfolio snapshots" subtitle="Desk records" tone="neutral">
          <p className="leading-relaxed text-slate-400">
            Historical portfolio scans and CSV export for desk records (Pro+ where entitled).
          </p>
          <p className="mt-4">
            <Link
              href="/dashboard/portfolio"
              className="font-space text-sm font-bold uppercase tracking-wide text-cyan-300 underline-offset-2 hover:text-cyan-200 hover:underline"
            >
              Portfolio →
            </Link>
          </p>
        </NeonForensicPanel>

        <NeonForensicPanel title="Enterprise webhooks" subtitle="HTTPS delivery" tone="neutral">
          <p className="leading-relaxed text-slate-400">
            Configure HTTPS endpoints; delivery attempts are logged for Enterprise tiers.
          </p>
          <p className="mt-4">
            <Link
              href="/dashboard/webhooks"
              className="font-space text-sm font-bold uppercase tracking-wide text-cyan-300 underline-offset-2 hover:text-cyan-200 hover:underline"
            >
              Webhooks →
            </Link>
          </p>
        </NeonForensicPanel>

        <NeonForensicPanel title="Batch evidence" subtitle="Multi-mint scans" tone="neutral">
          <p className="leading-relaxed text-slate-400">
            Multi-mint scans with optional <code className="font-mono-terminal text-cyan-200/80">clientRef</code> for
            ticket / desk linkage in API logs.
          </p>
          <p className="mt-4">
            <Link
              href="/dashboard/batch"
              className="font-space text-sm font-bold uppercase tracking-wide text-cyan-300 underline-offset-2 hover:text-cyan-200 hover:underline"
            >
              Batch scan →
            </Link>
          </p>
        </NeonForensicPanel>
      </div>

      <NeonForensicPanel title="Public availability" subtitle="SLA & dependencies" tone="capacity">
        <p className="leading-relaxed text-slate-400">
          SLA summary and live dependency status (no login). Suitable for vendor questionnaires and client runbooks.
        </p>
        <p className="mt-4">
          <Link href="/status" className="font-space text-sm font-bold uppercase tracking-wide text-cyan-300 underline-offset-2 hover:underline">
            System status →
          </Link>
          <span className="mx-2 font-mono-terminal text-slate-600">·</span>
          <Link
            href="/api/status/public"
            className="font-mono-terminal text-sm text-slate-400 underline-offset-2 hover:text-slate-300 hover:underline"
          >
            JSON feed
          </Link>
        </p>
      </NeonForensicPanel>
    </div>
  )
}
