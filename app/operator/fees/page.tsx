import { FeeRevenueDashboard } from '@/components/revenue-dashboard/FeeRevenueDashboard'
import {
  getPlatformFeeAccount,
  getPlatformFeeBps,
  isPlatformFeeConfigured,
} from '@/lib/trading/platform-fee-config'
import { LAUNCHPAD_FEE_NOTE } from '@/lib/launchpad/constants'
import { FEE_DISCLOSURE_PATH, TERMS_PATH } from '@/lib/revenue-dashboard/constants'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default function OperatorFeesPage() {
  const bps = getPlatformFeeBps()
  const account = getPlatformFeeAccount()
  const ok = isPlatformFeeConfigured()

  return (
    <div className="space-y-10">
      <section className="space-y-3 rounded border border-zinc-800 bg-zinc-950 p-4 font-mono text-xs text-zinc-400">
        <h2 className="text-sm font-semibold text-zinc-100">Platform fee config</h2>
        <p>{LAUNCHPAD_FEE_NOTE}</p>
        <dl className="grid gap-2 sm:grid-cols-2">
          <div>
            <dt className="text-[10px] uppercase text-zinc-600">PLATFORM_FEE_BPS</dt>
            <dd className="tabular-nums text-zinc-100">{bps}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase text-zinc-600">PLATFORM_FEE_ACCOUNT</dt>
            <dd className="break-all text-zinc-100">{account ?? 'not set'}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase text-zinc-600">Status</dt>
            <dd className={ok ? 'text-emerald-400' : 'text-amber-400'}>
              {ok ? 'Live on quotes' : 'Disabled until ATA set'}
            </dd>
          </div>
        </dl>
        <p className="text-[10px] text-zinc-600">
          <Link href={FEE_DISCLOSURE_PATH} className="underline">
            Fee disclosure
          </Link>
          {' · '}
          <Link href={TERMS_PATH} className="underline">
            Terms
          </Link>
        </p>
      </section>
      <section>
        <h2 className="mb-3 font-mono text-sm font-semibold text-zinc-100">Fee ledger</h2>
        <FeeRevenueDashboard />
      </section>
    </div>
  )
}
