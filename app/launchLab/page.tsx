import type { Metadata } from 'next'
import { LaunchLabApp } from '@/components/launchlab/LaunchLabApp'
import { DashToastProvider } from '@/components/dash-home/DashToast'

export const metadata: Metadata = {
  title: 'LaunchLab — CryptoCheck AI',
  description:
    'Discover and launch tokens on Raydium LaunchLab via CryptoCheck. Scanner-gated creation. Non-custodial.',
}

export const dynamic = 'force-dynamic'

/** Public Raydium-style LaunchLab surface. Creation reuses /api/launch/* (same as Action Panel). */
export default function LaunchLabPage() {
  return (
    <DashToastProvider>
      <LaunchLabApp />
    </DashToastProvider>
  )
}
