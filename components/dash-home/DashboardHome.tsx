import { JetBrains_Mono } from 'next/font/google'
import '@/lib/dashboard/tokens.css'
import { DashboardPage } from './DashboardPage'

const dashMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-dash-mono',
  display: 'swap',
})

export type DashboardHomeProps = {
  userEmail: string
  effectiveTier: string
  isAnonymousPreview?: boolean
}

/** Command-center shell — spec path: components/dashboard (implemented as dash-home on case-insensitive FS). */
export function DashboardHome(props: DashboardHomeProps) {
  return (
    <div className={`${dashMono.variable} font-sans`}>
      <DashboardPage {...props} />
    </div>
  )
}
