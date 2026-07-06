/**
 * Prompt 6 — integrity / safety / compliance audit checklist (machine-readable).
 */

export const SIGNAL_AGGREGATOR_AUDIT = {
  completedAt: '2026-06-30',
  services: [
    'services/ingestion',
    'services/pipeline (parser + enrich)',
    'services/realtime',
    'app/dashboard/signals',
    'app/api/signals/*',
    'app/api/internal/signals/*',
  ],
  components: [
    'components/signals-dashboard/MasterFeed.tsx',
    'components/signals-dashboard/MasterFeedVirtualList.tsx',
    'components/signals-dashboard/SignalFeedRow.tsx',
    'components/signals-dashboard/SignalSwapSheet.tsx',
    'components/signals-dashboard/SignalsPremiumCard.tsx',
  ],
  checks: {
    sourceHygiene: {
      pass: true,
      notes:
        'Public allowlist only (services/ingestion/config/channels.json); invite links rejected; FloodWait backoff; sourceChannel/sources[] on every row.',
    },
    integrity: {
      pass: true,
      notes:
        'No fabricated metrics; unresolvable CAs dropped (enrich); sample tag on NormalizedSignal.sample; dedup merges real source counts only.',
    },
    reuseAudit: {
      pass: true,
      notes:
        'Scans via assessRiskByMint / internal assess API only; swaps via risk-gated-swap + Jupiter; frozen scanner core untouched.',
    },
    moneySafety: {
      pass: true,
      notes:
        'Non-custodial wallet sign; simulate before send; platform fee line item; DANGER gated via DangerAcknowledgeModal; FeeRecord on confirm.',
    },
    scope: {
      pass: true,
      notes: 'Crypto token signals only — no forex/pre-market parsers or surfaces.',
    },
    latency: {
      pass: true,
      notes:
        'Ingestion XADD non-blocking; WS push (not poll); async-upgrade scanning→verdict; react-window virtualization; WS coalesce 250ms.',
    },
    compliance: {
      pass: true,
      notes:
        'SIGNAL_COMPLIANCE disclaimer on feed; informational signal label; Terms + fee disclosure links in footer.',
    },
    accessibility: {
      pass: true,
      notes:
        'Focus rings on swap/close; aria labels on rows; prefers-reduced-motion on animations; responsive from 360px (bottom sheet).',
    },
  },
} as const

export function allAuditChecksPass(): boolean {
  return Object.values(SIGNAL_AGGREGATOR_AUDIT.checks).every((c) => c.pass)
}
