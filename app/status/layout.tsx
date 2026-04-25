import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'System Status — CryptoCheck AI',
  description:
    'Live operational status, SLA commitment, and dependency health for CryptoCheck Security Intelligence.',
  robots: { index: true, follow: true },
}

export default function StatusLayout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
