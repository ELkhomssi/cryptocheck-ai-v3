import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'

export default function ProLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      style={{
        minHeight: '100vh',
        background:
          'radial-gradient(ellipse 90% 60% at 50% -15%, rgba(99, 102, 241, 0.07), transparent), radial-gradient(ellipse 60% 40% at 100% 50%, rgba(16, 185, 129, 0.04), transparent), #06060a',
        color: '#e4e4eb',
        fontFamily: 'var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif',
      }}
    >
      {children}
    </div>
  )
}
