import { Suspense } from 'react'
import { UpgradePageClient } from '@/components/billing/UpgradePageClient'

export const metadata = {
  title: 'Upgrade — CryptoCheck AI',
  description: 'Basic and Pro access — full platform via Stripe',
}

export default function UpgradePage() {
  return (
    <Suspense
      fallback={
        <div
          className="min-h-screen flex items-center justify-center text-[#00d4aa] text-xs tracking-widest"
          style={{ background: '#020408', fontFamily: 'IBM Plex Mono, monospace' }}
        >
          LOADING
        </div>
      }
    >
      <UpgradePageClient />
    </Suspense>
  )
}
