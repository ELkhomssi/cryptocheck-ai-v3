import { getPlatformFeeAccount, getPlatformFeeBps, isPlatformFeeConfigured } from '@/lib/trading/platform-fee-config'
import { FEE_DISCLOSURE_PATH, TERMS_PATH } from '@/lib/revenue-dashboard/constants'
import { LAUNCHPAD_FEE_NOTE } from '@/lib/launchpad/constants'
import Link from 'next/link'

export default function LaunchpadFeesPage() {
  const bps = getPlatformFeeBps()
  const account = getPlatformFeeAccount()
  const ok = isPlatformFeeConfigured()

  return (
    <div className="space-y-6">
      <header>
        <h2 className="font-rd-display text-lg font-bold uppercase tracking-wide text-rd-hi">
          Fee disclosure
        </h2>
        <p className="mt-1 text-sm text-rd-mid">{LAUNCHPAD_FEE_NOTE}</p>
      </header>

      <section className="space-y-3 rounded-rd-sm border border-white/10 bg-rd-navy2/50 p-4 text-sm text-rd-mid">
        <p>
          We charge a Jupiter <strong className="text-rd-hi">platform fee</strong> of{' '}
          <span className="font-rd-mono text-rd-hi">{(bps / 100).toFixed(2)}%</span> ({bps} bps) on
          swaps and snipes when the fee account is configured. The fee is skimmed on-chain to our
          referral ATA — we never custody your funds.
        </p>
        <dl className="grid gap-2 sm:grid-cols-2">
          <div>
            <dt className="text-[10px] uppercase text-rd-lo">PLATFORM_FEE_BPS</dt>
            <dd className="font-rd-mono text-rd-hi">{bps}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase text-rd-lo">PLATFORM_FEE_ACCOUNT</dt>
            <dd className="font-rd-mono break-all text-xs text-rd-hi">{account ?? 'not set'}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase text-rd-lo">Status</dt>
            <dd className={ok ? 'text-rd-green' : 'text-rd-caution'}>
              {ok ? 'Live on quotes' : 'Disabled until ATA set'}
            </dd>
          </div>
        </dl>
        <p className="text-[12px]">
          One-time setup: run <code className="text-rd-hi">npm run create:referral-ata</code> to
          create Jupiter referral ATAs for output mints you charge fees on (see script docs).
        </p>
        <p className="text-[12px]">
          Legal:{' '}
          <Link href={FEE_DISCLOSURE_PATH} className="text-rd-green underline">
            Fees
          </Link>{' '}
          ·{' '}
          <Link href={TERMS_PATH} className="text-rd-green underline">
            Terms
          </Link>
          . Platform fees + launchpad = regulatory surface — counsel before mainnet scale.
        </p>
      </section>
    </div>
  )
}
