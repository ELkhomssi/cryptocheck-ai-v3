import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { Instrument_Serif, IBM_Plex_Sans } from 'next/font/google'
import { TerminalOsProviders } from '@/features/terminal-os/shell/Providers'
import '@/styles/tokens.css'
import '@/styles/terminal-os.css'
import '@/features/intelligence-chart/styles.css'
import '@/features/execution-desk/styles.css'

const instrumentSerif = Instrument_Serif({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-instrument-serif',
  display: 'swap',
})

const ibmPlex = IBM_Plex_Sans({
  weight: ['400', '500', '600'],
  subsets: ['latin'],
  variable: '--font-ibm-plex',
  display: 'swap',
})

export const metadata = {
  title: 'CryptoCheck AI · Operating System',
  description:
    'CryptoCheck AI Operating System — portfolio-aware intelligence, AI Gateway, Mission Feed, and Coach. Approve decisions. Execute last.',
}

export default function TerminalOsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-tos
      className={`${GeistSans.variable} ${GeistMono.variable} ${instrumentSerif.variable} ${ibmPlex.variable}`}
      style={{
        minHeight: '100vh',
        background: 'var(--tos-bg-app)',
        fontFamily: 'var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif',
      }}
    >
      <TerminalOsProviders>{children}</TerminalOsProviders>
    </div>
  )
}
