import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import '@/styles/terminal-os.css'

export const metadata = {
  title: 'Terminal OS v6 · CryptoCheck AI',
  description:
    'CryptoCheck AI Trading Operating System — live market intelligence, AI Trade Like Me, security scanning, and portfolio health.',
}

export default function TerminalOsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-tos
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      style={{
        minHeight: '100vh',
        background: 'var(--tos-bg-app)',
        fontFamily: 'var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif',
      }}
    >
      {children}
    </div>
  )
}
