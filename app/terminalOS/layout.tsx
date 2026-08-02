import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { TerminalOsProviders } from '@/features/terminal-os/shell/Providers'
import '@/styles/tokens.css'
import '@/styles/terminal-os.css'
import '@/features/intelligence-chart/styles.css'
import '@/features/execution-desk/styles.css'
import '@/features/ai-os/styles.css'

export const metadata = {
  title: 'CryptoCheck AI · AI Operating System',
  description:
    'CryptoCheck AI Operating System — intent gateway, AI Coach, and Decision Engine recommendations. Not financial advice.',
}

export default function TerminalOsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      style={{
        minHeight: '100vh',
        fontFamily: 'var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif',
      }}
    >
      <TerminalOsProviders>{children}</TerminalOsProviders>
    </div>
  )
}
