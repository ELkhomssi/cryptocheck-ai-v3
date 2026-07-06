import { Inter, JetBrains_Mono, Syncopate } from 'next/font/google'
import '@/lib/revenue-dashboard/design-tokens.css'
import { SignalDashboardShell } from '@/components/signals-dashboard/SignalDashboardShell'

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
  title: 'Master Feed — CryptoCheck Signals',
  description: 'Realtime Telegram signals with Sentinel gate and safe swap',
  manifest: '/signals.webmanifest',
}

export default function SignalsDashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${inter.className} ${syncopate.variable} ${jetbrains.variable} antialiased`}>
      <SignalDashboardShell>{children}</SignalDashboardShell>
    </div>
  )
}
