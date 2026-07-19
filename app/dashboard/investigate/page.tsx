import type { Metadata } from 'next'
import DashboardProPage from '@/components/operator/views/pro-terminal'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Dashboard Pro — CryptoCheck AI',
  description:
    'Dashboard Pro for developers: explainable Solana token intelligence, API-ready evidence, and audit exports.',
}

export default DashboardProPage
