import { Inter, JetBrains_Mono, Syncopate } from 'next/font/google'
import '@/lib/revenue-dashboard/design-tokens.css'
import { RevenueDashboardShell } from '@/components/revenue-dashboard/RevenueDashboardShell'

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
})

const syncopate = Syncopate({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-rd-display',
  display: 'swap',
})

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-rd-mono',
  display: 'swap',
})

export const metadata = {
  title: 'Revenue Terminal — CryptoCheck AI',
  description: 'Scan → safe swap with transparent platform fees',
}

export default function RevenueDashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${inter.className} ${syncopate.variable} ${jetbrains.variable} antialiased`}>
      <RevenueDashboardShell>{children}</RevenueDashboardShell>
    </div>
  )
}
