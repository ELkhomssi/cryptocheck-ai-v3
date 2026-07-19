import Link from 'next/link'
import { Crosshair, HandCoins, HeartHandshake, Rocket, Zap } from 'lucide-react'
import { LAUNCHPAD_NAV } from '@/lib/launchpad/constants'
import { getPlatformFeeBps, getPlatformFeeAccount, isPlatformFeeConfigured } from '@/lib/trading/platform-fee-config'

export default function LaunchpadHomePage() {
  const bps = getPlatformFeeBps()
  const feeOk = isPlatformFeeConfigured()
  const account = getPlatformFeeAccount()

  const cards = [
    {
      href: LAUNCHPAD_NAV.swap,
      icon: Zap,
      title: 'Risk-gated swap',
      body: 'Jupiter quote with an explicit Platform fee line before you sign.',
    },
    {
      href: LAUNCHPAD_NAV.sniper,
      icon: Crosshair,
      title: 'Verified sniper',
      body: 'Cache-first Neural V4 verdicts — fast and safe, not a pure latency race.',
    },
    {
      href: LAUNCHPAD_NAV.saves,
      icon: HeartHandshake,
      title: 'Your Saves',
      body: 'When a blocked token rugs, we prove it with a receipt. No fabricated saves.',
    },
    {
      href: LAUNCHPAD_NAV.fees,
      icon: HandCoins,
      title: 'Fee disclosure',
      body: 'On-chain Jupiter referral fees. Visible in every confirm sheet.',
    },
  ]

  return (
    <div className="space-y-8">
      <header>
        <p className="font-rd-display text-[0.62rem] font-bold uppercase tracking-[0.2em] text-rd-lime">
          Trust-first profit
        </p>
        <h2 className="mt-2 font-rd-display text-2xl font-bold uppercase tracking-wide text-rd-hi">
          Launchpad
        </h2>
        <p className="mt-2 max-w-xl text-sm text-rd-mid">
          Fees fund the firehose. Cached verdicts deliver speed. Saved-You receipts prove the gate
          worked. Counsel before mainnet scale.
        </p>
      </header>

      <section className="rounded-rd-sm border border-white/10 bg-rd-navy2/60 p-4">
        <div className="flex items-center gap-2 text-rd-green">
          <Rocket className="h-4 w-4" />
          <p className="font-rd-display text-[0.62rem] font-bold uppercase tracking-wider">
            Live fee config
          </p>
        </div>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-[10px] uppercase text-rd-lo">Platform fee</dt>
            <dd className="font-rd-mono text-rd-hi">{(bps / 100).toFixed(2)}%</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase text-rd-lo">Status</dt>
            <dd className={feeOk ? 'text-rd-green' : 'text-rd-caution'}>
              {feeOk ? 'Configured' : 'Set PLATFORM_FEE_ACCOUNT'}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase text-rd-lo">Fee ATA</dt>
            <dd className="font-rd-mono truncate text-xs text-rd-mid">{account ?? '—'}</dd>
          </div>
        </dl>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        {cards.map(({ href, icon: Icon, title, body }) => (
          <Link
            key={href}
            href={href}
            className="rounded-rd-sm border border-white/10 bg-rd-navy2/40 p-4 transition-colors hover:border-rd-green/40"
          >
            <Icon className="h-5 w-5 text-rd-green" />
            <p className="mt-3 font-rd-display text-xs font-bold uppercase tracking-wider text-rd-hi">
              {title}
            </p>
            <p className="mt-1 text-[12px] text-rd-mid">{body}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
